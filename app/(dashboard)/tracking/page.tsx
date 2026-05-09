import { TrackingView } from '@/src/components/tracking/tracking-view';

export const metadata = { title: 'Month Tracking — Statement Lens' };

export default function TrackingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Seguimiento del mes</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Carga tu cartola XLSX o pega el texto de tu tarjeta para ver un resumen parcial del mes en curso.
        </p>
      </div>
      <TrackingView />
    </div>
  );
}
