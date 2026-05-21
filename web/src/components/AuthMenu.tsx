'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export default function AuthMenu({ className }: { className?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setEmail(data.user?.email ?? null);
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
    'font-mono text-[11px] tracking-[0.12em] uppercase no-underline whitespace-nowrap transition-colors text-muted-foreground hover:text-primary',
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
