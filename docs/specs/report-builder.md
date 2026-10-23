# Spec: Armador de reportes mensuales

| | |
|---|---|
| Estado | Implementado (2026-10-23). Hay decisiones por validar, marcadas con **[validar]**. |
| Ruta | `/reports/[month]`, por ejemplo `/reports/2026-10` |
| Reemplaza a | El reporte HTML estático que generaba `GET /api/snapshot/report` en una pestaña nueva |

## Objetivo

Antes de imprimir o guardar como PDF, el usuario puede armar el reporte del mes: elegir qué secciones y gráficos incluir, filtrar los movimientos y agrupar y ordenar los gastos. Lo que ve en la hoja de vista previa es exactamente lo que se imprime.

## Capas y archivos

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Domain | `src/domain/services/report.service.ts` | Lógica pura: filtros, dimensiones, agrupación anidada, orden y porciones para gráficos |
| Application | `src/application/use-cases/reports/get-report-data.use-case.ts` | Carga los datos crudos de la ventana de 6 meses |
| Adapters | `src/adapters/presenters/report.presenter.ts` | Deriva todo lo que se muestra (métricas, presupuesto, comparación, tendencia) a partir de datos y filtros |
| Infra / API | `app/api/snapshot/report/route.ts`, `src/infrastructure/container.ts` | Endpoint JSON y wiring |
| UI | `src/components/reports/report-*.tsx`, `app/(dashboard)/reports/[month]/page.tsx` | Panel de configuración, hoja, gráficos e impresión |

Los datos se cargan una sola vez. Todo lo derivado se calcula en el cliente, así que cambiar un filtro o una agrupación no vuelve a llamar al servidor.

## Contrato del API

`GET /api/snapshot/report?month=YYYY-MM`

| Caso | Respuesta |
|---|---|
| Sin sesión | `401 { error }` |
| `month` ausente o inválido (el mes debe ser `01`–`12`) | `400 { error }` |
| El mes no tiene movimientos de seguimiento | `404 { error }` |
| OK | `200 ReportDataDTO` |

```ts
interface ReportDataDTO {
  month: string;                                              // mes del reporte
  months: string[];                                           // ventana de 6 meses que termina en `month`, del más antiguo al más nuevo
  transactionsByMonth: Record<string, SnapshotTransaction[]>; // una clave por cada mes de `months` (puede venir vacía)
  categories: { id; name; isFixed; excludeFromBudget }[];
  budgets: { categoryId; amount }[];                          // solo los presupuestos del mes del reporte
}
```

Los movimientos se obtienen con `findTrackingByMonth`, es decir, por **mes contable**.

## Reglas de negocio

Cada regla indica el test que la cubre.

### Filtros (`filterReportTransactions`)

| # | Regla | Test |
|---|---|---|
| F1 | Sin selección = todo incluido. | `keeps everything except reimbursed…` |
| F2 | Banco y medio de pago filtran **todos** los tipos de movimiento (gasto, ingreso, transferencia). | `filters every transaction type by bank and source` |
| F3 | Categoría, búsqueda y monto mínimo filtran **solo gastos**. Los ingresos y las transferencias no se ven afectados. **[validar]** | `applies category, search and minimum amount only to expenses` |
| F4 | La búsqueda compara contra comercio y descripción, sin distinguir mayúsculas ni tildes. | `search matches the description too…` |
| F5 | Las categorías reembolsables (`excludeFromBudget`) quedan **fuera por defecto** y se pueden incluir con una opción. **[validar]** | `includes reimbursed categories when asked` |
| F6 | "Descontar devoluciones" desactivado elimina las devoluciones, y los totales pasan a ser gasto bruto. | `drops returns when includeReturns is false` |
| F7 | Los filtros se aplican a **todo el reporte**: mes actual, mes anterior (comparación) y tendencia de 6 meses. **[validar]** | presenter: `builds the trend … respecting filters` |

### Agrupación y orden (`groupExpenses`, `sortTransactions`)

| # | Regla | Test |
|---|---|---|
| G1 | Dimensiones: comercio, categoría, banco, medio de pago, fijo/variable y semana del mes (días 1–7, 8–14, 15–21, 22–28, 29–31). | `dimensionOf` |
| G2 | Hasta 2 niveles anidados. Solo se agrupan gastos; ingresos y transferencias se ignoran. | `nests a second dimension…` |
| G3 | Total del grupo = gasto neto: las devoluciones lo reducen. "Compras" cuenta solo las compras, no las devoluciones. | `nets returns into each group…` |
| G4 | El `%` de cada grupo, incluidos los subgrupos, se calcula sobre el total general. | `nests a second dimension…` |
| G5 | Los grupos se ordenan por monto, cantidad o nombre, ascendente o descendente. La semana se ordena por calendario. | `sorts groups by…`, `sorts week groups in calendar order…` |
| G6 | Los movimientos se ordenan por fecha, monto (gasto, de mayor a menor) o comercio, sin mutar la entrada. | `sortTransactions` |
| G7 | Los gráficos de distribución muestran el top N y agrupan el resto en "Otros". Los grupos con neto ≤ 0 no aparecen. | `sliceByDimension` |

### Métricas derivadas (`buildReportModel`)

| # | Regla | Test |
|---|---|---|
| M1 | El presupuesto total se compara contra la **proyección**, que incluye los gastos fijos que aún no se cobran, y no solo contra lo ya gastado. | `compares the budget against the projection…` |
| M2 | Con filtro de categorías, el presupuesto total suma solo esas categorías. | `scopes the total budget to the selected categories` |
| M3 | Con filtro de **banco o medio de pago**, no se muestra presupuesto total y la proyección **no** suma gastos fijos pendientes, porque el presupuesto no se divide por canal y no se sabe por qué canal se cobrará, por ejemplo, el arriendo. **[validar]** | `drops the total budget and pending fixed commitments…` |
| M4 | El detalle por categoría marca "Fijo" y "Excedido". | `flags fixed and over-budget categories…` |
| M5 | Comparación con el mes anterior según la dimensión elegida: solo grupos presentes en ambos meses, ordenados por mayor cambio porcentual y luego por monto actual. Hasta 8 filas. Si el mes anterior no tuvo gasto, no hay comparación. | `compares against the previous month…`, `has no comparison…` |
| M6 | La tendencia incluye los meses de la ventana con gasto > 0. La tasa de ahorro de 6 meses es `1 − gastos/ingresos` de la ventana completa. | `builds the trend and rolling savings rate…` |
| M7 | Las tablas separan gastos (incluidas las devoluciones, con su badge), ingresos y transferencias. | `separates income, transfers and expenses…` |

## Comportamiento de la UI

- **Secciones** (11): Resumen, Presupuesto total, Distribución del gasto, Gastado vs. presupuesto, Comparación con el mes anterior, Tendencia de 6 meses, Gastos, Detalle por categoría, Ingresos, Transferencias internas y Notas. Se activan y reordenan desde el panel, o desde la hoja pasando el mouse. Al mover en la hoja se salta a la sección visible vecina.
- **Distribución**: se elige la dimensión, dona o barras, y el top 4–7.
- **Tabla de gastos**: sin agrupar (lista de movimientos) o con 1–2 niveles. Se puede limitar a los primeros N grupos (el resto se resume en una fila), mostrar movimientos dentro de cada grupo y elegir columnas. Los grupos se abren y cierran con un clic, y **un grupo cerrado se imprime cerrado**.
- **Documento**: título propio (si está vacío, se usa el nombre del mes), notas y un aviso de los filtros aplicados en el encabezado.
- **Colores**: paleta categórica validada para daltonismo, de 7 colores más "Otros" en gris. El color sigue a la entidad: se asigna según el ranking del mes sin filtrar, así que filtrar no cambia el color de lo que queda visible.
- **Gráficos**: SVG/HTML propio en vez de Recharts, para que la impresión salga idéntica a la pantalla. Tienen tooltip en pantalla, y en papel cada valor queda escrito (leyenda, etiqueta o eje).
- **Persistencia**: la última configuración se guarda en `localStorage` (`statement-lens:report-builder:v1`) y aplica a todos los meses. "Restablecer" vuelve a la configuración por defecto. El estado de grupos abiertos o cerrados no se guarda.
- **Navegación**: flechas para el mes anterior y el siguiente entre los meses con datos.
- **Layout**: la barra (volver, mes, Restablecer, Imprimir) queda fija bajo la cabecera de la app. En pantallas `lg+` el panel de configuración **acompaña el scroll** y tiene scroll propio, para que los cambios se apliquen sin subir y bajar. Para esto, el contenedor de contenido del layout del dashboard **no puede ser un contenedor de scroll** (usa `overflow-x-clip`, no `overflow-auto`), porque si lo fuera se rompe `position: sticky`.
- **Estados**: skeleton mientras carga. Si hay error o el mes no tiene datos, se muestra un mensaje con un enlace a Seguimiento.

## Impresión

- `@page` A4 con márgenes de 14 mm × 12 mm. Se ocultan el sidebar, la cabecera, la barra, el panel, el chat flotante y los controles de la hoja (`print:hidden`).
- Las secciones con gráficos no se cortan entre páginas, y las filas de las tablas tampoco.
- La fila de total de cada tabla va en un `<tbody>`, no en un `<tfoot>`, porque el navegador repite el `<tfoot>` en cada página.
- El título de la pestaña ("Reporte Octubre 2026 — Statement Lens") se usa como nombre sugerido del PDF.

## Fuera de alcance

- Etiquetas o tags propios por transacción (fase 2: requiere un modelo `Tag` y migración).
- Presets con nombre guardados en la base de datos.
- Tests de componentes de UI.

## Decisiones por validar

Las marcadas **[validar]** (F3, F5, F7 y M3) se implementaron sin confirmación explícita. Si alguna no corresponde, cambia primero la regla en este documento, luego su test y después el código.
