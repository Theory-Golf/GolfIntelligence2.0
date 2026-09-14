'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export default function AuthMenu({ className }: { className?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // getSession reads the session already in the cookie; getUser would put a
    // network round trip behind a navbar label, and on a dropped connection
    // it answers "no user" — flipping a signed-in player mid-round to "Sign
    // In". Nothing here is a security boundary: the middleware gates the
    // pages and row-level security gates the data.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setEmail(data.session?.user?.email ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const linkClasses = cn(
    'font-mono text-label tracking-[0.12em] uppercase no-underline whitespace-nowrap transition-colors text-muted-foreground hover:text-primary',
    className
  );

  if (loading) return null;

  if (!email) {
    return (
      <Link href="/login" className={linkClasses}>
        Sign In
      </Link>
    );
  }

  return (
    <button onClick={handleSignOut} className={cn(linkClasses, 'bg-transparent border-none cursor-pointer p-0')}>
      Sign Out
    </button>
  );
}
