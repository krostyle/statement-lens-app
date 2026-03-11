'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { formatCurrency } from '@/src/lib/utils';
import type { FinancialAnalysisResult } from '@/src/infrastructure/ai/financial-analysis.service';

interface Props {
  statementId?: string;
  month?: string;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

export function AnalysisPanel({ statementId, month }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<FinancialAnalysisResult | null>(null);

  const handleAnalyze = async () => {
    setStatus('loading');
    setResult(null);
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementId, month }),
      });
      if (!res.ok) throw new Error('Error del servidor');
      const data = await res.json();
      setResult(data);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis IA de tus finanzas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'idle' && (
          <Button className="w-full" onClick={handleAnalyze}>
            Analizar mis finanzas
          </Button>
        )}

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-brand-600" />
            <p className="text-sm text-zinc-500">Analizando tus finanzas... esto puede tardar unos segundos</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-red-500">No se pudo generar el análisis. Inténtalo de nuevo.</p>
            <Button variant="outline" className="w-full" onClick={handleAnalyze}>
              Reintentar
            </Button>
          </div>
        )}

        {status === 'done' && result && (
          <div className="space-y-6">
            {/* Summary */}
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-zinc-700">Resumen general</h3>
              <p className="text-sm text-zinc-600">{result.summary}</p>
            </div>

            {/* Opportunities */}
            {result.topOpportunities.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-700">Oportunidades de ahorro</h3>
                <div className="space-y-2">
                  {result.topOpportunities.map((op, i) => (
                    <div key={i} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-900">{op.title}</p>
                        {op.estimatedSaving != null && (
                          <Badge variant="secondary" className="shrink-0">
                            {formatCurrency(op.estimatedSaving)}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">{op.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unusual spending */}
            {result.unusualSpending.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-700">Gastos inusuales</h3>
                <div className="space-y-2">
                  {result.unusualSpending.map((u, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{u.merchant}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{u.reason}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-red-600">
                        {formatCurrency(u.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            {result.tips.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-700">Consejos</h3>
                <ul className="space-y-1">
                  {result.tips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-sm text-zinc-600">
                      <span className="mt-0.5 text-brand-600">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={handleAnalyze}>
              Volver a analizar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
