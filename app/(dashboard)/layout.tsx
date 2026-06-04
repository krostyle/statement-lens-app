import { cookies } from 'next/headers';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/src/components/ui/sidebar';
import { AppSidebar } from '@/src/components/layout/sidebar';
import { FloatingChat } from '@/src/components/chat/floating-chat';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  // sidebar saves its state as 'true'/'false' in this cookie on every toggle
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset className="bg-zinc-50">
        {/* Top bar — always visible; trigger collapses sidebar on all screen sizes */}
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4">
          <SidebarTrigger className="text-zinc-600" />
          {/* App name only on mobile (sidebar shows it on desktop) */}
          <span className="text-sm font-semibold text-zinc-800 lg:hidden">Statement Lens</span>
        </header>
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>
      </SidebarInset>
      <FloatingChat />
    </SidebarProvider>
  );
}
