'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!form.email.trim()) {
      errs.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!form.message.trim()) errs.message = 'Message is required.';
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    setSubmitError('');

    try {
      const res = await fetch(process.env.NEXT_PUBLIC_FORMSPREE_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          organization: form.organization || undefined,
          message: form.message,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setSubmitError(
          data?.errors?.[0]?.message ||
            'Something went wrong. Please try again.'
        );
      }
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  const inputClasses =
    'w-full bg-surface border border-border text-foreground font-mono text-sm px-3 py-2.5 min-h-11 outline-none transition-colors focus:border-primary';

  return (
    <section className="px-6 pt-20 pb-20">
      <div className="max-w-lg mx-auto">
        <p className="eyebrow mb-5">Get in touch</p>
        <h1 className="font-display font-extrabold text-[clamp(40px,7vw,72px)] leading-[0.9] tracking-tight uppercase text-foreground">
          <span className="text-primary">Contact</span>
        </h1>
        <p className="font-body text-base text-muted-foreground mt-5 leading-relaxed">
          Interested in bringing theory.golf to your program? Reach out — we&apos;d
          love to walk you through what the platform can do for your team.
        </p>

        {submitted ? (
          <div className="mt-10">
            <p className="text-primary font-mono text-xs tracking-[0.15em] uppercase mb-3">
              Message sent
            </p>
            <p className="text-foreground leading-relaxed">
              Thanks for reaching out. We&apos;ll be in touch shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-10 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground" htmlFor="name">
                Name
              </label>
              <input id="name" name="name" type="text" className={inputClasses} value={form.name} onChange={handleChange} placeholder="Your name" autoComplete="name" />
              {errors.name && <p className="font-mono text-[11px] text-primary tracking-[0.05em] mt-1">{errors.name}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" className={inputClasses} value={form.email} onChange={handleChange} placeholder="you@example.com" autoComplete="email" />
              {errors.email && <p className="font-mono text-[11px] text-primary tracking-[0.05em] mt-1">{errors.email}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground" htmlFor="phone">
                Cell Phone <span className="text-ash text-[9px] tracking-[0.1em]">(optional)</span>
              </label>
              <input id="phone" name="phone" type="tel" className={inputClasses} value={form.phone} onChange={handleChange} placeholder="(555) 000-0000" autoComplete="tel" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground" htmlFor="organization">
                Organization / Program <span className="text-ash text-[9px] tracking-[0.1em]">(optional)</span>
              </label>
              <input id="organization" name="organization" type="text" className={inputClasses} value={form.organization} onChange={handleChange} placeholder="University golf program, club, etc." autoComplete="organization" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground" htmlFor="message">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                className={`${inputClasses} resize-y min-h-[120px]`}
                value={form.message}
                onChange={handleChange}
                placeholder="Tell us about your program and what you're looking for..."
                rows={5}
              />
              {errors.message && <p className="font-mono text-[11px] text-primary tracking-[0.05em] mt-1">{errors.message}</p>}
            </div>

            {submitError && (
              <p className="font-mono text-[11px] text-primary tracking-[0.05em]">{submitError}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Sending...' : 'Send Message'}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
