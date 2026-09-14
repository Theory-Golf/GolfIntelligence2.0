import { describe, it, expect } from 'vitest';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { describeAuthError, isTransientAuthError } from '../authErrors';
import { hasAuthCookie, isPrefetch } from '../middleware';

describe('isTransientAuthError', () => {
  it('treats a dropped fetch as transient', () => {
    // What WebKit hands back when the connection goes away mid-request.
    expect(isTransientAuthError(new TypeError('Load failed'))).toBe(true);
    expect(isTransientAuthError(new TypeError('Failed to fetch'))).toBe(true);
    expect(
      isTransientAuthError(new AuthRetryableFetchError('Load failed', 0)),
    ).toBe(true);
  });

  it('treats a server-side failure as transient', () => {
    expect(isTransientAuthError(new AuthApiError('upstream', 503, undefined))).toBe(true);
    expect(isTransientAuthError(new AuthApiError('slow down', 429, undefined))).toBe(true);
  });

  it('does not excuse a real auth failure', () => {
    expect(
      isTransientAuthError(
        new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
      ),
    ).toBe(false);
    expect(
      isTransientAuthError(new AuthApiError('Invalid Refresh Token', 401, undefined)),
    ).toBe(false);
  });

  it('is false for no error at all', () => {
    expect(isTransientAuthError(null)).toBe(false);
    expect(isTransientAuthError(undefined)).toBe(false);
  });
});

describe('describeAuthError', () => {
  it('replaces the runtime wording for a dropped connection', () => {
    const message = describeAuthError(new TypeError('Load failed'));
    expect(message).not.toContain('Load failed');
    expect(message).toContain('connection');
  });

  it('keeps Supabase wording for a real auth failure', () => {
    expect(
      describeAuthError(
        new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
      ),
    ).toBe('Invalid login credentials');
  });
});

describe('hasAuthCookie', () => {
  it('finds the session cookie, chunked or not', () => {
    expect(hasAuthCookie(['sb-abcdefgh-auth-token'])).toBe(true);
    expect(hasAuthCookie(['sb-abcdefgh-auth-token.0', 'sb-abcdefgh-auth-token.1'])).toBe(true);
  });

  it('is not fooled by the PKCE verifier or unrelated cookies', () => {
    expect(hasAuthCookie(['sb-abcdefgh-auth-token-code-verifier'])).toBe(false);
    expect(hasAuthCookie(['tg-theme', '_vercel_jwt'])).toBe(false);
    expect(hasAuthCookie([])).toBe(false);
  });
});

describe('isPrefetch', () => {
  it('recognises a router prefetch', () => {
    expect(isPrefetch(new Headers({ 'next-router-prefetch': '1' }))).toBe(true);
    expect(isPrefetch(new Headers({ purpose: 'prefetch' }))).toBe(true);
    expect(isPrefetch(new Headers({ 'x-middleware-prefetch': '1' }))).toBe(true);
  });

  it('leaves a real navigation alone', () => {
    expect(isPrefetch(new Headers({ accept: 'text/html' }))).toBe(false);
    expect(isPrefetch(new Headers())).toBe(false);
  });
});
