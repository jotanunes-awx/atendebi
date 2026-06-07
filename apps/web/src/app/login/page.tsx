'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  Network,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/lib/auth';

const loginMenuItems = [
  { label: 'Dashboard executivo', icon: LayoutDashboard },
  { label: 'Conversas e chamados', icon: MessageSquareText },
  { label: 'Insights de qualidade', icon: Sparkles },
  { label: 'Integracoes seguras', icon: Network },
];

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_28rem),linear-gradient(180deg,#f8fbff,#edf4fb)] text-foreground dark:bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.13),transparent_28rem),linear-gradient(180deg,#111827,#0b1224)]">
      <div className="grid min-h-screen lg:grid-cols-[21rem_1fr]">
        <aside className="relative overflow-hidden bg-[linear-gradient(180deg,#1f3f86,#11265c_48%,#0d1d49)] px-6 py-7 text-white shadow-[24px_0_70px_rgba(15,23,42,0.18)]">
          <div className="absolute -left-24 top-20 h-48 w-48 rounded-full bg-cyan-300/15 blur-3xl" />
          <div className="absolute bottom-10 right-0 h-52 w-52 rounded-full bg-blue-400/15 blur-3xl" />

          <div className="relative flex min-h-full flex-col">
            <Link href="/" className="flex items-center gap-3">
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-lg shadow-sky-950/20">
                <Bot className="h-6 w-6" aria-hidden="true" />
                <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-cyan-300 ring-2 ring-[#1f3f86]" />
              </span>
              <div>
                <p className="text-2xl font-bold tracking-normal">AtendeBI</p>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100/65">Intelligence Suite</p>
              </div>
            </Link>

            <button
              type="button"
              className="mt-12 flex w-full items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-left shadow-inner shadow-white/5 backdrop-blur"
            >
              <span>
                <span className="block text-sm font-semibold">Jotanunes Construtora</span>
                <span className="mt-1 block text-xs text-sky-100/70">Ambiente corporativo</span>
              </span>
              <ChevronDown className="h-4 w-4 text-sky-100/75" aria-hidden="true" />
            </button>

            <div className="mt-10">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-sky-100/45">Menu</p>
              <div className="mt-3 space-y-2">
                {loginMenuItems.map((item, index) => (
                  <div
                    key={item.label}
                    className={
                      index === 0
                        ? 'flex h-11 items-center gap-3 rounded-2xl bg-white px-3 text-sm font-semibold text-[#17326f] shadow-[0_14px_36px_rgba(0,0,0,0.18)]'
                        : 'flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-sky-100/78'
                    }
                  >
                    <span
                      className={
                        index === 0
                          ? 'flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#2f80ed,#20bfd4)] text-white'
                          : 'flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-sky-100'
                      }
                    >
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto rounded-3xl border border-white/10 bg-white/10 p-4 shadow-inner shadow-white/5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-200">
                  <Clock3 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Historico auditavel</p>
                  <p className="text-xs text-sky-100/70">Dados preservados alem das plataformas de origem.</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="flex h-16 items-center justify-end border-b border-border/70 bg-white/75 px-5 backdrop-blur dark:bg-card/75">
            <ThemeToggle />
          </header>

          <div className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-10 lg:px-10">
            <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Plataforma de gestao de atendimento
                </span>
                <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight tracking-normal text-slate-950 dark:text-white md:text-5xl">
                  Entre para enxergar atendimento, chamados e telefonia em uma unica visao.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                  O AtendeBI transforma BLiP, GLPI e Teams Phone em indicadores claros para diretoria, gestores e
                  equipes operacionais, sem expor chaves ou dados sensiveis no navegador.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-white p-4 shadow-sm dark:bg-card">
                    <BarChart3 className="mb-4 h-5 w-5 text-primary" aria-hidden="true" />
                    <p className="text-2xl font-bold text-card-foreground">BI</p>
                    <p className="text-xs text-muted-foreground">Indicadores simples</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-white p-4 shadow-sm dark:bg-card">
                    <ShieldCheck className="mb-4 h-5 w-5 text-success" aria-hidden="true" />
                    <p className="text-2xl font-bold text-card-foreground">LGPD</p>
                    <p className="text-xs text-muted-foreground">Base propria</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-white p-4 shadow-sm dark:bg-card">
                    <Building2 className="mb-4 h-5 w-5 text-info" aria-hidden="true" />
                    <p className="text-2xl font-bold text-card-foreground">SaaS</p>
                    <p className="text-xs text-muted-foreground">Multiempresa</p>
                  </div>
                </div>
              </div>

              <section className="rounded-[2rem] border border-border bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.10)] dark:bg-card lg:p-8">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Acesso seguro</p>
                  <h2 className="mt-3 text-2xl font-bold tracking-normal text-card-foreground">
                    {isAuthenticated ? 'Sessao ativa' : 'Entrar no AtendeBI'}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {isAuthenticated
                      ? authMode === 'entra'
                        ? 'Voce ja esta autenticado com Microsoft Entra ID.'
                        : 'Voce ja esta autenticado no modo local.'
                      : authMode === 'entra'
                        ? 'Entre com sua conta corporativa para acessar a plataforma.'
                        : 'Use a simulacao corporativa enquanto o Entra ID real nao estiver ativo.'}
                  </p>
                </div>

                {authError ? (
                  <div className="mt-6 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                    {authError}
                  </div>
                ) : null}

                <div className="mt-7 rounded-3xl border border-border bg-secondary/70 p-4">
                  {isReady && isAuthenticated && user ? (
                    <div className="flex items-start gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20">
                        {user.avatar}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-foreground">{user.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full border border-border bg-card px-3 py-1 text-card-foreground">
                            {user.tenant}
                          </span>
                          <span className="rounded-full border border-border bg-card px-3 py-1 text-card-foreground">
                            {user.role}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                        <span className="text-sm text-muted-foreground">Usuario</span>
                        <span className="text-sm font-bold text-card-foreground">Daniel Fernando</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                        <span className="text-sm text-muted-foreground">Perfil</span>
                        <span className="text-sm font-bold text-card-foreground">ATENDEBI_ADMIN</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                        <span className="text-sm text-muted-foreground">Tenant</span>
                        <span className="text-sm font-bold text-card-foreground">Jotanunes</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  {isAuthenticated ? (
                    <>
                      <Button type="button" onClick={() => router.push('/')} className="h-11 w-full rounded-2xl sm:w-auto">
                        Continuar
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="outline"
                        type="button"
                        onClick={handleLogout}
                        className="h-11 w-full rounded-2xl sm:w-auto"
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        Sair
                      </Button>
                    </>
                  ) : (
                    <Button type="button" onClick={handleLogin} disabled={!isReady} className="h-12 w-full rounded-2xl">
                      <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                      Entrar com Microsoft
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>

                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <span>
                    {authMode === 'entra'
                      ? 'Login real via Entra ID habilitado. A API pode validar o Bearer token quando AUTH_MODE=entra.'
                      : 'Ambiente em modo mock para validacao do produto. O desenho ja esta preparado para Entra ID.'}
                  </span>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
