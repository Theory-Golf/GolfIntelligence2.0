'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

const inputClasses =
  'w-full bg-surface border border-border text-foreground font-mono text-sm px-3 py-2.5 min-h-11 outline-none transition-colors focus:border-primary';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/golf-intelligence';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <section className="px-6 pt-20 pb-20">
      <div className="max-w-md mx-auto">
        <p className="eyebrow mb-5">Welcome back</p>
        <h1 className="font-display font-extrabold text-[clamp(40px,7vw,72px)] leading-[0.9] tracking-tight uppercase text-foreground">
          Sign <span className="text-primary">In</span>
        </h1>

        <form onSubmit={handleSubmit} noValidate className="mt-10 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className={inputClasses}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className={inputClasses}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="font-mono text-[11px] text-primary tracking-[0.05em]">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="font-mono text-[11px] tracking-[0.1em] uppercase text-muted-foreground mt-8 text-center">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </section>
  );
}
