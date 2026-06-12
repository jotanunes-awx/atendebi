'use client';

import { useRouter } from 'next/navigation';
import { Building2, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function UserMenu() {
  const router = useRouter();
  const { user, logout, isAuthenticated, isReady } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  if (!isReady) {
    return <div className="h-9 w-28 animate-pulse rounded-md border border-border bg-muted" aria-hidden="true" />;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  async function handleLogout() {
    await logout();
    setOpen(false);
    router.push('/login');
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={cn(
          'flex h-9 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-sm font-medium text-foreground shadow-panel transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'bg-secondary',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
          {user.avatar}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl"
          role="menu"
        >
          <div className="border-b border-border p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                {user.avatar}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 p-3 text-sm">
            <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-secondary-foreground">
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span>{user.tenant}</span>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-secondary-foreground">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span>{user.role}</span>
            </div>
          </div>

          <div className="border-t border-border p-3">
            <Button variant="ghost" className="w-full justify-start" type="button" onClick={handleLogout}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-2.5" aria-hidden="true">
      <UserRound className="h-4 w-4 text-muted-foreground" />
      <span className="h-3 w-20 rounded bg-muted" />
    </div>
  );
}
