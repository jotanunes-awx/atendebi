'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@atendebi.local');
  const [password, setPassword] = useState('senha123');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push('/');
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-white p-8 shadow-panel">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">AtendeBI</p>
          <h1 className="mt-4 text-3xl font-semibold text-zinc-950">Entrar no sistema</h1>
          <p className="mt-2 text-sm text-zinc-500">Acesso temporário para o MVP local.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-zinc-700">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-zinc-50 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700">
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-zinc-50 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" className="w-full sm:w-auto">Entrar</Button>
            <Link href="/" className="text-sm font-medium text-teal-700 hover:text-teal-900">
              Voltar para o dashboard
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
