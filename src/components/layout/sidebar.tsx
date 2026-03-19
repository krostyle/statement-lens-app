'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { LayoutDashboard, ArrowLeftRight, Tag, FileText, LogOut, ScanLine, Loader2, Target, X } from 'lucide-react';
import { signOut } from 'next-auth/react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/src/components/ui/sidebar';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transacciones', icon: ArrowLeftRight },
  { href: '/categories', label: 'Categorías', icon: Tag },
  { href: '/budgets', label: 'Presupuestos', icon: Target },
  { href: '/statements', label: 'Estados de cuenta', icon: FileText },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const { setOpenMobile, isMobile } = useSidebar();

  const displayName = session?.user?.name ?? session?.user?.email ?? 'Usuario';
  const initial = displayName[0].toUpperCase();

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-blue-300" />
          <div>
            <p className="text-sm font-bold text-white leading-tight">Statement Lens</p>
            <p className="text-xs text-blue-300/70">Finanzas personales</p>
          </div>
          <button
            className="ml-auto flex md:hidden items-center justify-center rounded p-1 hover:bg-white/10"
            onClick={() => setOpenMobile(false)}
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? 'bg-brand-600 text-white hover:bg-brand-600 hover:text-white' : ''}
                      onClick={() => { if (isMobile) setOpenMobile(false); }}
                    >
                      <Link href={href}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-4">
        <SidebarSeparator className="mb-2" />
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initial}
          </div>
          <p className="text-sm font-medium text-white truncate min-w-0 flex-1">{displayName}</p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
              {signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
