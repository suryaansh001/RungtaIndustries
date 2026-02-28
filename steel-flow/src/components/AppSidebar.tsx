import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, Package, Boxes, ArrowLeftRight,
  ScrollText, DollarSign, UserCog, Settings, LogOut,
  Receipt, BarChart2, TrendingDown,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar
} from '@/components/ui/sidebar';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Parties', url: '/parties', icon: Users },
  { title: 'Coils', url: '/coils', icon: Package },
  { title: 'Packets', url: '/packets', icon: Boxes },
  { title: 'Transfers', url: '/transfers', icon: ArrowLeftRight },
  { title: 'Transactions', url: '/transactions', icon: ScrollText },
];

const financeItems = [
  { title: 'Billing', url: '/billing', icon: Receipt },
  { title: 'Analytics', url: '/analytics', icon: BarChart2 },
];

const adminItems = [
  { title: 'Pricing', url: '/pricing', icon: DollarSign },
  { title: 'Aging Report', url: '/reports/aging', icon: TrendingDown },
  { title: 'Users', url: '/users', icon: UserCog },
];

export function AppSidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderItem = (item: typeof navItems[0]) => {
    const active = location.pathname.startsWith(item.url);
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          onClick={() => navigate(item.url)}
          className={cn(
            'w-full justify-start gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all',
            active
              ? 'bg-primary/10 text-primary border-l-2 border-primary'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{item.title}</span>}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex items-center gap-2 px-4 py-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">R</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Rungta Industrial Corporation</h2>
              <p className="text-[10px] text-muted-foreground">Inventory Management</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center mx-auto">
            <span className="text-sm font-bold text-primary-foreground">R</span>
          </div>
        )}
      </div>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2 bg-sidebar-border" />
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest px-3 py-1">Finance</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {financeItems.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <>
            <Separator className="my-2 bg-sidebar-border" />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map(renderItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/settings')}
                  className={cn(
                    'w-full justify-start gap-3 rounded-md px-3 py-2.5 text-sm font-medium',
                    location.pathname === '/settings'
                      ? 'bg-primary/10 text-primary border-l-2 border-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>Settings</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-secondary-foreground">
                  {user.username[0].toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.username}</p>
                <StatusBadge status={user.role === 'admin' ? 'active' : 'pending'} className="mt-0.5" />
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="shrink-0 text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
        {collapsed && (
          <Button variant="ghost" size="icon" onClick={handleLogout} className="mx-auto text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
