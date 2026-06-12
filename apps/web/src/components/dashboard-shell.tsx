'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  ClipboardCheck,
  Headphones,
  LayoutDashboard,
  LineChart,
  LogIn,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings,
  ShoppingCart,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { useAuth } from '@/lib/auth';
import { getUserExperience, type DashboardViewMode } from '@/lib/access-control';

const navItems = [
  { label: 'Visao Geral', href: '/', icon: LayoutDashboard },
  { label: 'Filas', href: '/filas', icon: BarChart3 },
  { label: 'Atendentes', href: '/atendentes', icon: UsersRound },
  { label: 'Conversas', href: '/conversas', icon: MessageSquareText },
  { label: 'Qualidade', href: '/qualidade', icon: ClipboardCheck },
  { label: 'Bot', href: '/bot', icon: Bot },
  { label: 'Vendas', href: '/vendas', icon: ShoppingCart },
  { label: 'Configuracoes', href: '/configuracoes', icon: Settings },
];

const navGroups = [
  { label: 'Operacao', items: ['/', '/filas', '/atendentes'] },
  { label: 'Inteligencia', items: ['/conversas', '/qualidade', '/bot', '/vendas'] },
  { label: 'Administracao', items: ['/configuracoes'] },
];

const dashboardTabs: Array<{
  label: string;
  description: string;
  view: DashboardViewMode;
  icon: typeof LayoutDashboard;
}> = [
  { label: 'Executivo', description: 'Resumo para diretoria', view: 'executive', icon: LayoutDashboard },
  { label: 'Atendimento', description: 'Clientes, filas e qualidade', view: 'service', icon: Headphones },
  { label: 'TI / GLPI', description: 'Chamados e backlog', view: 'it', icon: LineChart },
  { label: 'Comercial', description: 'Leads e oportunidades', view: 'commercial', icon: BriefcaseBusiness },
  { label: 'Completo', description: 'Todas as origens', view: 'global', icon: Sparkles },
];

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const { isAuthenticated, isReady, user } = useAuth();
  const experience = getUserExperience(user);
  const visibleNavItems = navItems.filter((item) => experience.visibleNav.includes(item.href));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDashboardView, setActiveDashboardView] = useState<DashboardViewMode | null>(null);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem('atendebi-sidebar-collapsed') === 'true');
    setActiveDashboardView(readDashboardViewFromUrl());
  }, []);

  // Fecha o menu mobile ao trocar de rota.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Enquanto o drawer mobile estiver aberto, trava o scroll de fundo e permite fechar com Esc.
  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('atendebi-sidebar-collapsed', String(next));
      return next;
    });
  }

  const activeLabel =
    visibleNavItems.find((item) =>
      item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href),
    )?.label ?? 'Visao Geral';

  const visibleDashboardTabs = useMemo(
    () =>
      dashboardTabs.filter((tab) => {
        if (tab.view === 'it') {
          return experience.allowedProviders.includes('GLPI');
        }

        if (tab.view === 'commercial') {
          return experience.allowedProviders.includes('BLIP') || experience.allowedProviders.includes('TEAMS_PHONE');
        }

        if (tab.view === 'global') {
          return experience.preferredView === 'global' || experience.allowedProviders.length >= 3;
        }

        return true;
      }),
    [experience.allowedProviders, experience.preferredView],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_32rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)))] text-foreground">
      <div className="flex min-h-screen flex-col md:flex-row">
        {mobileOpen ? (
          <div
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm md:hidden"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col overflow-y-auto bg-[linear-gradient(180deg,#1f3f86,#11265c_48%,#0d1d49)] text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] transition-transform duration-300 md:sticky md:top-0 md:z-auto md:h-screen md:max-w-none md:translate-x-0 md:overflow-visible md:transition-[width]',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
            collapsed ? 'md:w-[5.75rem]' : 'md:w-[20.5rem]',
          )}
        >
          <div className={cn('flex h-20 items-center px-4', collapsed ? 'justify-center md:px-3' : 'justify-between md:px-6')}>
            <Link href="/" className={cn('flex min-w-0 items-center gap-3', collapsed && 'md:justify-center')}>
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/95 text-sky-700 shadow-lg shadow-sky-950/20">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-cyan-300 ring-2 ring-[#1f3f86]" />
              </span>
              <div className={cn('min-w-0 transition-opacity duration-200', collapsed && 'md:hidden')}>
                <p className="text-xl font-bold tracking-normal text-white">AtendeBI</p>
                <p className="truncate text-xs font-medium text-sky-100/80">Inteligencia de atendimento</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={toggleSidebar}
              className={cn(
                'hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sky-100 transition hover:bg-white/15 md:flex',
                collapsed && 'absolute left-[4.2rem] z-10 rounded-l-none',
              )}
              aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-sky-100/80 transition hover:bg-white/15 md:hidden"
              aria-label="Fechar menu lateral"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className={cn('px-6 pb-6 md:pb-8', collapsed && 'md:hidden')}>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 shadow-inner shadow-white/5 backdrop-blur">
              <span className="block text-sm font-semibold text-white">{user?.tenant ?? 'Jotanunes'}</span>
              <span className="mt-1 block text-xs text-sky-100/75">{experience.audienceLabel}</span>
            </div>
          </div>

          <nav className={cn('space-y-6 px-4 pb-4 md:overflow-visible', collapsed ? 'md:space-y-2 md:px-3' : 'md:space-y-7 md:px-6')}>
            {navGroups.map((group) => {
              const groupedItems = visibleNavItems.filter((item) => group.items.includes(item.href));

              if (groupedItems.length === 0) {
                return null;
              }

              return (
                <div key={group.label}>
                  <p className={cn('mb-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-sky-100/45', collapsed && 'md:hidden')}>
                    {group.label}
                  </p>
                  <div className={cn('space-y-1.5', collapsed && 'md:space-y-2')}>
                    {groupedItems.map((item) => {
                      const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            'group flex h-11 w-full items-center rounded-2xl text-sm font-semibold text-sky-100/75 transition-all duration-200 hover:bg-white/12 hover:text-white',
                            collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                            isActive && 'bg-white text-[#17326f] shadow-[0_14px_36px_rgba(0,0,0,0.18)] hover:bg-white hover:text-[#17326f]',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-sky-100 transition-colors group-hover:bg-white/15',
                              isActive && 'bg-[linear-gradient(135deg,#2f80ed,#20bfd4)] text-white',
                            )}
                          >
                            <item.icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className={cn(collapsed && 'md:hidden')}>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className={cn('mt-auto hidden px-6 pb-6 md:block', collapsed && 'md:px-3')}>
            <div className={cn('rounded-3xl border border-white/10 bg-white/10 p-4 shadow-inner shadow-white/5', collapsed && 'flex justify-center p-3')}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-200">
                  <Activity className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className={cn(collapsed && 'md:hidden')}>
                  <p className="text-sm font-semibold text-white">Historico proprio</p>
                  <p className="text-xs text-sky-100/70">24 meses auditaveis</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-3 px-4 py-3 md:px-8 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary">Dashboards</p>
                <p className="mt-1 text-xs text-muted-foreground">Troque a visao sem sair do produto.</p>
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {visibleDashboardTabs.map((tab) => {
                  const isActive = pathname === '/' && (activeDashboardView ?? experience.preferredView) === tab.view;

                  return (
                    <a
                      key={tab.view}
                      href={`/?view=${tab.view}`}
                      className={cn(
                        'group flex min-w-[156px] items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-panel',
                        isActive && 'border-primary/40 bg-primary/10',
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                        <tab.icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-card-foreground">{tab.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{tab.description}</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          <header className="border-b border-border/60 bg-card/80 px-4 py-5 shadow-[0_16px_42px_rgba(15,23,42,0.04)] backdrop-blur md:px-8">
            <div className="mx-auto flex w-full max-w-[1540px] flex-col justify-center gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-sky-600 shadow-sm md:hidden"
                  aria-label="Abrir menu lateral"
                  aria-expanded={mobileOpen}
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-normal text-card-foreground">{activeLabel}</h1>
                  <p className="max-w-3xl truncate text-sm text-muted-foreground md:whitespace-normal">
                    {experience.shortDescription}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="hidden h-9 items-center rounded-full border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200 xl:inline-flex">
                  Historico proprio: 24 meses
                </span>
                <Button size="sm" type="button" onClick={() => window.location.reload()} className="rounded-full shadow-sm">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Atualizar</span>
                </Button>
                <ThemeToggle />
                {isReady && isAuthenticated ? (
                  <UserMenu />
                ) : isReady ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/login">
                      <LogIn className="h-4 w-4" aria-hidden="true" />
                      Entrar com Microsoft
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1540px] px-4 py-7 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function readDashboardViewFromUrl(): DashboardViewMode | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const view = new URLSearchParams(window.location.search).get('view');

  return view === 'executive' || view === 'service' || view === 'it' || view === 'commercial' || view === 'global'
    ? view
    : null;
}
