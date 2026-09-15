import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isTransientAuthError } from './authErrors';

// `sb-<project-ref>-auth-token`, plus a `.0` / `.1` suffix once the session
// is large enough for @supabase/ssr to chunk it across cookies.
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

export function hasAuthCookie(cookieNames: string[]): boolean {
  return cookieNames.some((name) => AUTH_COOKIE.test(name));
}

/**
 * A speculative fetch the router made on the player's behalf, not a page they
 * asked for. `router.prefetch` fires several of these at once from the hole
 * screen (summary, next hole, review), and they must not be answered with a
 * redirect: the router caches what a prefetch returns, so one blip turned the
 * *next* tap of "Save shot · Next" into a trip to the sign-in page.
 */
export function isPrefetch(headers: Headers): boolean {
  return (
    headers.get('next-router-prefetch') === '1' ||
    headers.get('x-middleware-prefetch') === '1' ||
    headers.get('purpose') === 'prefetch' ||
    headers.get('x-purpose') === 'prefetch' ||
    headers.get('x-moz') === 'prefetch'
  );
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  // Built fresh rather than kept from the protected URL, so the sign-in page
  // carries exactly one parameter. The search string rides along inside it:
  // a hole reached from the round review (`?from=review`) has to come back
  // the same way.
  url.search = '';
  url.searchParams.set(
    'redirectTo',
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  const cookieNames = request.cookies.getAll().map((c) => c.name);

  // Prefetches are answered without touching Supabase at all. Refreshing the
  // session three times in parallel rotates the refresh token three times,
  // and the losers of that race are what signed players out mid-round.
  if (isPrefetch(request.headers)) {
    return hasAuthCookie(cookieNames)
      ? NextResponse.next({ request })
      : // Nothing to cache and nothing to follow; the real navigation that
        // comes later gets the redirect.
        new NextResponse(null, { status: 401 });
  }

  // No session cookie at all is the one unambiguous signed-out case, and it
  // doesn't need a network round trip to establish.
  if (!hasAuthCookie(cookieNames)) return redirectToLogin(request);

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not write any code between createServerClient and
  // supabase.auth.getUser() — it refreshes the session.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user) {
    // A dropped connection fails this call exactly the way an expired session
    // does, and answering both with a redirect is what bounced players to
    // /login from a course car park. On a transient failure the request goes
    // through untouched: the cookies are left as they were, the page renders
    // from the browser's own session, and every read and write behind it is
    // still gated by row-level security.
    if (isTransientAuthError(error)) return supabaseResponse;
    return redirectToLogin(request);
  }

  return supabaseResponse;
}
