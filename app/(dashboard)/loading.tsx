import { Skeleton } from '@/src/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-52 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Spending chart */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-44 w-full rounded-lg" />
      </div>
    </div>
  );
}
