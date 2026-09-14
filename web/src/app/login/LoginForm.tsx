'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { describeAuthError, isTransientAuthError } from '@/lib/supabase/authErrors';

const inputClasses =
  'w-full bg-surface border border-border text-foreground font-mono text-sm px-3 py-2.5 min-h-11 outline-none transition-colors focus:border-primary';

// A phone waking up on course wifi routinely loses the first request or two.
// Three tries over ~2s costs nothing on a good connection and is the
// difference between signing in and reading "Load failed" on a bad one.
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Only same-origin paths. `redirectTo` arrives from the query string, so
 * without this an emailed link could bounce a player straight off the site
 * with their attention on the sign-in form.
 */
function safeRedirect(value: string | null): string {
  if (!value) return '/golf-intelligence';
  if (!value.startsWith('/') || value.startsWith('//')) return '/golf-intelligence';
  return value;
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirectTo'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    const supabase = createClient();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let signInError: unknown = null;
      try {
        const { error: returned } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        signInError = returned;
      } catch (thrown) {
        // A fetch that dies outright rejects instead of resolving; it
        // classifies the same way, so both paths meet here.
        signInError = thrown;
      }

      if (!signInError) {
        window.location.assign(redirectTo);
        return;
      }

      const retryable = isTransientAuthError(signInError);
      if (!retryable || attempt === MAX_ATTEMPTS) {
        setError(describeAuthError(signInError));
        setLoading(false);
        return;
      }

      await sleep(attempt * 600);
    }
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
            <label className="font-mono text-label tracking-[0.2em] uppercase text-muted-foreground" htmlFor="email">
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
            <label className="font-mono text-label tracking-[0.2em] uppercase text-muted-foreground" htmlFor="password">
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
            <p className="font-mono text-label text-primary tracking-[0.05em]">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="font-mono text-label tracking-[0.1em] uppercase text-muted-foreground mt-8 text-center">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </section>
  );
}
