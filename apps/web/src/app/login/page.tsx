'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, CheckCircle2, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { user, isAuthenticated, isReady, authMode, authError, login, logout } = useAuth();

  async function handleLogin() {
    const loggedIn = await login();

    if (loggedIn) {
      router.push('/');
    }
  }

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8">
        <section className="flex min-h-[520px] flex-col justify-between rounded-lg border border-border bg-card p-6 shadow-panel lg:p-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                BI
              </span>
              <div>
                <p className="text-base font-semibold text-card-foreground">AtendeBI</p>
                <p className="text-xs text-muted-foreground">Jotanunes Demo</p>
              </div>
            </Link>
            <ThemeToggle />
          </div>

          <div className="py-10">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Acesso corporativo</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-normal text-card-foreground md:text-5xl">
              Inteligencia operacional para atendimento conversacional.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              Ambiente preparado para Microsoft Entra ID, mantendo tenant, perfil e permissões no mesmo formato que a
              API já espera. Em desenvolvimento, o modo mock continua disponível.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-md border border-border bg-secondary p-3">
              <ShieldCheck className="mb-3 h-4 w-4 text-primary" aria-hidden="true" />
              Perfil administrativo
            </div>
            <div className="rounded-md border border-border bg-secondary p-3">
              <Building2 className="mb-3 h-4 w-4 text-primary" aria-hidden="true" />
              Tenant Jotanunes
            </div>
            <div className="rounded-md border border-border bg-secondary p-3">
              <CheckCircle2 className="mb-3 h-4 w-4 text-primary" aria-hidden="true" />
              {authMode === 'entra' ? 'Sessão Entra ID' : 'Sessão local'}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-6 shadow-panel lg:p-8">
          <div>
            <p className="text-sm font-medium text-primary">Microsoft Entra ID</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-normal text-card-foreground">
              {isAuthenticated ? 'Sessão ativa' : 'Entrar no AtendeBI'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {isAuthenticated
                ? authMode === 'entra'
                  ? 'Você já está autenticado com Microsoft Entra ID.'
                  : 'Você já está autenticado no modo local.'
                : authMode === 'entra'
                  ? 'Entre com sua conta corporativa para acessar a plataforma.'
                  : 'Use a simulação corporativa para acessar o dashboard com o usuário demo.'}
            </p>
          </div>

          {authError ? (
            <div className="mt-6 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              {authError}
            </div>
          ) : null}

          <div className="mt-8 rounded-lg border border-border bg-secondary p-4">
            {isReady && isAuthenticated && user ? (
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                  {user.avatar}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{user.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-md border border-border bg-card px-2 py-1 text-card-foreground">
                      {user.tenant}
                    </span>
                    <span className="rounded-md border border-border bg-card px-2 py-1 text-card-foreground">
                      {user.role}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
                  <span className="text-sm text-muted-foreground">Usuário</span>
                  <span className="text-sm font-medium text-card-foreground">Daniel Fernando</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
                  <span className="text-sm text-muted-foreground">Perfil</span>
                  <span className="text-sm font-medium text-card-foreground">ATENDEBI_ADMIN</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
                  <span className="text-sm text-muted-foreground">Tenant</span>
                  <span className="text-sm font-medium text-card-foreground">Jotanunes</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {isAuthenticated ? (
              <>
                <Button type="button" onClick={() => router.push('/')} className="w-full sm:w-auto">
                  Continuar
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="outline" type="button" onClick={handleLogout} className="w-full sm:w-auto">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sair
                </Button>
              </>
            ) : (
              <Button type="button" onClick={handleLogin} disabled={!isReady} className="w-full">
                Entrar com Microsoft
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>

          <div className="mt-6 rounded-md border border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
            {authMode === 'entra'
              ? 'Login real via Entra ID habilitado. A API pode validar o Bearer token quando AUTH_MODE=entra.'
              : 'Este ambiente está no modo mock. Para ativar Entra ID, configure NEXT_PUBLIC_AUTH_MODE=entra.'}
          </div>
        </section>
      </div>
    </main>
  );
}
