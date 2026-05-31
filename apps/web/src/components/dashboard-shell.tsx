'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  BarChart3,
  Bot,
  ClipboardCheck,
  LayoutDashboard,
  LogIn,
  MessageSquareText,
  RefreshCw,
  Settings,
  ShoppingCart,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { useAuth } from '@/lib/auth';

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

const periodOptions = [
  { value: '24h', label: 'Ultimas 24h' },
  { value: '7d', label: 'Ultimos 7 dias' },
  { value: '30d', label: 'Ultimos 30 dias' },
  { value: '90d', label: 'Ultimos 90 dias' },
  { value: '12m', label: '12 meses' },
  { value: 'custom', label: 'Periodo personalizado' },
];

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const { isAuthenticated, isReady } = useAuth();
  const [period, setPeriod] = useState('30d');

  const activeLabel =
    navItems.find((item) =>
      item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href),
    )?.label ?? 'Visao Geral';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="border-b border-border bg-card md:w-64 md:border-b-0 md:border-r">
          <div className="flex h-16 items-center justify-between px-5 md:h-20">
            <div>
              <p className="text-base font-semibold tracking-normal text-card-foreground">AtendeBI</p>
              <p className="text-xs font-medium text-muted-foreground">Operacao conversacional</p>
            </div>
            <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:overflow-visible md:pb-0">
            {navItems.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    'flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:w-full',
                    isActive && 'bg-primary/10 text-primary',
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex min-h-16 flex-col justify-center gap-3 border-b border-border bg-card px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <h1 className="text-xl font-semibold tracking-normal text-card-foreground">{activeLabel}</h1>
              <p className="text-sm text-muted-foreground">
                Hoje, {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium text-muted-foreground">
                Periodo
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  className="h-full bg-transparent text-sm font-semibold text-foreground outline-none"
                  aria-label="Periodo do dashboard"
                >
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="hidden h-8 items-center rounded-md border border-info/30 bg-info/10 px-3 text-xs font-semibold text-info xl:inline-flex">
                Historico proprio: 24 meses mock
              </span>
              <Button size="sm" type="button">
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
          </header>
          <main className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
