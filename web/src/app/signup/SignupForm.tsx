'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

const inputClasses =
  'w-full bg-surface border border-border text-foreground font-mono text-sm px-3 py-2.5 min-h-11 outline-none transition-colors focus:border-primary';

export default function SignupForm() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const emailRedirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: displayName.trim() ? { display_name: displayName.trim() } : undefined,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      window.location.assign('/golf-intelligence');
    } else {
      setConfirmationSent(true);
      setLoading(false);
    }
  }

  if (confirmationSent) {
    return (
      <section className="px-6 pt-20 pb-20">
        <div className="max-w-md mx-auto">
          <p className="eyebrow mb-5">Check your inbox</p>
          <h1 className="font-display font-extrabold text-[clamp(40px,7vw,72px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Confirm <span className="text-primary">Email</span>
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 leading-relaxed">
            We sent a confirmation link to <span className="text-foreground">{email}</span>.
            Click the link to activate your account, then sign in.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 pt-20 pb-20">
      <div className="max-w-md mx-auto">
        <p className="eyebrow mb-5">Create your account</p>
        <h1 className="font-display font-extrabold text-[clamp(40px,7vw,72px)] leading-[0.9] tracking-tight uppercase text-foreground">
          Sign <span className="text-primary">Up</span>
        </h1>

        <form onSubmit={handleSubmit} noValidate className="mt-10 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-label tracking-[0.2em] uppercase text-muted-foreground" htmlFor="displayName">
              Display Name <span className="text-ash text-label-sm tracking-[0.1em]">(optional)</span>
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              className={inputClasses}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you'd like to be addressed"
              autoComplete="name"
            />
          </div>

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
              minLength={6}
              className={inputClasses}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="font-mono text-label text-primary tracking-[0.05em]">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>
        </form>

        <p className="font-mono text-label tracking-[0.1em] uppercase text-muted-foreground mt-8 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
