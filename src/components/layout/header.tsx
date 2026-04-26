import { currentUser } from '@clerk/nextjs/server';

export async function Header({ title }: { title: string }) {
  const user = await currentUser();
  const displayName = user?.fullName ?? user?.emailAddresses?.[0]?.emailAddress ?? 'Usuario';

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">{displayName}</span>
        <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold">
          {displayName[0].toUpperCase()}
        </div>
      </div>
    </header>
  );
}
