import { NextResponse } from 'next/server';

export const runtime = 'edge';

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  organization?: string;
  message?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  let body: ContactPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const message = body.message?.trim();

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: 'Name, email, and message are required.' },
      { status: 400 }
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 }
    );
  }

  const endpoint = process.env.FORMSPREE_URL || process.env.NEXT_PUBLIC_FORMSPREE_URL;
  if (!endpoint) {
    console.error('[contact] FORMSPREE_URL is not configured');
    return NextResponse.json(
      { error: 'Contact form is not configured. Please email us directly.' },
      { status: 503 }
    );
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        phone: body.phone?.trim() || undefined,
        organization: body.organization?.trim() || undefined,
        message,
      }),
    });

    if (upstream.ok) {
      return NextResponse.json({ ok: true });
    }

    let upstreamMessage = 'Something went wrong. Please try again.';
    try {
      const data = (await upstream.json()) as { errors?: Array<{ message?: string }> };
      if (data?.errors?.[0]?.message) upstreamMessage = data.errors[0].message;
    } catch {
      // Non-JSON response — keep default message
    }
    console.error('[contact] Formspree responded', upstream.status, upstreamMessage);
    return NextResponse.json({ error: upstreamMessage }, { status: 502 });
  } catch (err) {
    console.error('[contact] Failed to reach Formspree', err);
    return NextResponse.json(
      { error: 'Unable to reach the messaging service. Please try again shortly.' },
      { status: 502 }
    );
  }
}
