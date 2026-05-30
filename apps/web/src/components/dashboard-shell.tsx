'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Bot,
  ClipboardCheck,
  LayoutDashboard,
  MessageSquareText,
  Moon,
  Settings,
  Sun,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { label: 'Visao Geral', href: '/', icon: LayoutDashboard },
  { label: 'Filas', href: '/filas', icon: BarChart3 },
  { label: 'Atendentes', href: '/atendentes', icon: UsersRound },
  { label: 'Conversas', href: '/conversas', icon: MessageSquareText },
  { label: 'Qualidade', href: '/qualidade', icon: ClipboardCheck },
  { label: 'Configuracoes', href: '/configuracoes', icon: Settings },
];

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('atendebi-theme');
    setTheme(storedTheme === 'dark' ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('atendebi-theme', theme);
  }, [theme]);

  const activeLabel =
    navItems.find((item) =>
      item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href),
    )?.label ?? 'Visao Geral';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="border-b border-border bg-white md:w-64 md:border-b-0 md:border-r">
          <div className="flex h-16 items-center justify-between px-5 md:h-20">
            <div>
              <p className="text-base font-semibold tracking-normal text-zinc-950">AtendeBI</p>
              <p className="text-xs font-medium text-zinc-500">Operacao conversacional</p>
            </div>
            <Bot className="h-5 w-5 text-teal-700" aria-hidden="true" />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:overflow-visible md:pb-0">
            {navItems.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    'flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 md:w-full',
                    isActive && 'bg-teal-50 text-teal-800',
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
          <header className="flex min-h-16 flex-col justify-center gap-3 border-b border-border bg-white px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <h1 className="text-xl font-semibold tracking-normal text-zinc-950">{activeLabel}</h1>
              <p className="text-sm text-zinc-500">
                Hoje, {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                Ultimas 24h
              </Button>
              <Button size="sm">Atualizar</Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button variant="outline" size="sm" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
                <span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
              </Button>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
