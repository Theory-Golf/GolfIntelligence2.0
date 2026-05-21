import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/golf-intelligence';

  // Vercel terminates TLS at the edge; request.url's host is the internal
  // deployment URL. Use the forwarded host/proto so we redirect back to the
  // domain the cookies were set on (e.g. www.theory.golf), not the bare
  // *.vercel.app deployment.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const requestUrl = new URL(request.url);
  const origin =
    forwardedHost && forwardedProto
      ? `${forwardedProto}://${forwardedHost}`
      : requestUrl.origin;

  const safeNext = next.startsWith('/') ? next : '/golf-intelligence';
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
