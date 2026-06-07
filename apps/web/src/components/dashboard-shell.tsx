'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  ChevronDown,
  ClipboardCheck,
  LayoutDashboard,
  LogIn,
  Menu,
  MessageSquareText,
  RefreshCw,
  Settings,
  ShoppingCart,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { useAuth } from '@/lib/auth';
import { getUserExperience } from '@/lib/access-control';

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
  { label: 'Menu', items: ['/', '/filas', '/atendentes'] },
  { label: 'Inteligencia', items: ['/conversas', '/qualidade', '/bot', '/vendas'] },
  { label: 'Administracao', items: ['/configuracoes'] },
];

const topModules = [
  { label: 'Atendimento', href: '/', paths: ['/', '/conversas', '/qualidade'] },
  { label: 'Filas e equipes', href: '/filas', paths: ['/filas', '/atendentes'] },
  { label: 'Bot', href: '/bot', paths: ['/bot'] },
  { label: 'Vendas', href: '/vendas', paths: ['/vendas'] },
  { label: 'Configuracoes', href: '/configuracoes', paths: ['/configuracoes'] },
];

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const { isAuthenticated, isReady, user } = useAuth();
  const experience = getUserExperience(user);
  const visibleNavItems = navItems.filter((item) => experience.visibleNav.includes(item.href));

  const activeLabel =
    visibleNavItems.find((item) =>
      item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href),
    )?.label ?? 'Visao Geral';
  const visibleTopModules = topModules.filter((module) =>
    module.paths.some((modulePath) => visibleNavItems.some((item) => item.href === modulePath)),
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_32rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)))] text-foreground">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="border-b border-white/10 bg-[linear-gradient(180deg,#1f3f86,#11265c_48%,#0d1d49)] text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] md:sticky md:top-0 md:h-screen md:w-[20.5rem]">
          <div className="flex h-20 items-center justify-between px-6">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 text-sky-700 shadow-lg shadow-sky-950/20">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-cyan-300 ring-2 ring-[#1f3f86]" />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-bold tracking-normal text-white">AtendeBI</p>
                <p className="truncate text-xs font-medium text-sky-100/80">Inteligencia de atendimento</p>
              </div>
            </Link>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sky-100/80 md:hidden">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <div className="hidden px-6 pb-8 md:block">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-left shadow-inner shadow-white/5 backdrop-blur transition hover:bg-white/15"
            >
              <span>
                <span className="block text-sm font-semibold text-white">{user?.tenant ?? 'Jotanunes'}</span>
                <span className="mt-1 block text-xs text-sky-100/75">{experience.audienceLabel}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-sky-100/70" aria-hidden="true" />
            </button>
          </div>

          <nav className="flex gap-2 overflow-x-auto px-4 pb-4 md:block md:space-y-7 md:overflow-visible md:px-6">
            {navGroups.map((group) => {
              const groupedItems = visibleNavItems.filter((item) => group.items.includes(item.href));

              if (groupedItems.length === 0) {
                return null;
              }

              return (
                <div key={group.label} className="shrink-0 md:shrink">
                  <p className="mb-2 hidden text-[0.68rem] font-bold uppercase tracking-[0.18em] text-sky-100/45 md:block">
                    {group.label}
                  </p>
                  <div className="flex gap-2 md:block md:space-y-1.5">
                    {groupedItems.map((item) => {
                      const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          className={cn(
                            'group flex h-11 shrink-0 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-sky-100/75 transition-all duration-200 hover:bg-white/12 hover:text-white md:w-full',
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
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="mt-auto hidden px-6 pb-6 md:block">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 shadow-inner shadow-white/5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-200">
                  <Activity className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Historico proprio</p>
                  <p className="text-xs text-sky-100/70">24 meses auditaveis</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-full max-w-[1540px] items-center gap-2 overflow-x-auto px-4 md:px-8">
              {visibleTopModules.map((module) => {
                const isActive = module.paths.some((modulePath) =>
                  modulePath === '/' ? pathname === '/' : pathname?.startsWith(modulePath),
                );

                return (
                <Link
                    key={module.label}
                    href={module.href}
                  className={cn(
                      'relative flex h-full shrink-0 items-center px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
                      isActive && 'text-foreground',
                  )}
                >
                    {module.label}
                    {isActive ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" /> : null}
                </Link>
                );
              })}
            </div>
          </div>

          <header className="border-b border-border/60 bg-card/80 px-4 py-5 shadow-[0_16px_42px_rgba(15,23,42,0.04)] backdrop-blur md:px-8">
            <div className="mx-auto flex w-full max-w-[1540px] flex-col justify-center gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-sky-600 shadow-sm md:hidden">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </span>
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
