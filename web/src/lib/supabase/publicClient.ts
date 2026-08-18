import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cookie-free Supabase client for public, unauthenticated reads (e.g. Ethos
 * papers). Unlike `lib/supabase/server.ts`, this doesn't call `cookies()`,
 * so pages using it can stay statically cached / ISR-revalidated instead of
 * being forced into per-request dynamic rendering.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
