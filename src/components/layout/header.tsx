import { auth } from '@/src/infrastructure/auth/nextauth.config';

export async function Header({ title }: { title: string }) {
  const session = await auth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">{session?.user?.name ?? session?.user?.email}</span>
        <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold">
          {(session?.user?.name ?? session?.user?.email ?? 'U')[0].toUpperCase()}
        </div>
      </div>
    </header>
  );
}
