import { SessionProvider } from '@/src/components/layout/session-provider';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/src/components/ui/sidebar';
import { AppSidebar } from '@/src/components/layout/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-zinc-50">
          {/* Mobile header — only visible below md breakpoint */}
          <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 md:hidden">
            <SidebarTrigger className="text-zinc-600" />
            <span className="text-sm font-semibold text-zinc-800">Statement Lens</span>
          </header>
          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
