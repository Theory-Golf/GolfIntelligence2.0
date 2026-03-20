'use client';

import React, { useState } from 'react';

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

  return (
    <div className="page-hero">
      <div className="page-hero-inner">
        <p className="eyebrow" style={{ marginBottom: '20px' }}>
          Get in touch
        </p>

        <h1 className="display-heading">
          <span style={{ color: 'var(--color-accent)' }}>Contact</span>
        </h1>

        <p className="display-sub">
          Interested in bringing theory.golf to your program? Reach out — we'd
          love to walk you through what the platform can do for your team.
        </p>

        {submitted ? (
          <div style={{ marginTop: '40px', maxWidth: '480px' }}>
            <p
              style={{
                color: 'var(--color-accent)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              Message sent
            </p>
            <p style={{ color: 'var(--color-text)', lineHeight: '1.6' }}>
              Thanks for reaching out. We'll be in touch shortly.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            style={{ marginTop: '40px', maxWidth: '480px', width: '100%' }}
          >
            <div className="wyc-field">
              <label className="wyc-label" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className="wyc-input"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                autoComplete="name"
              />
              {errors.name && <p className="wyc-error">{errors.name}</p>}
            </div>

            <div className="wyc-field">
              <label className="wyc-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="wyc-input"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {errors.email && <p className="wyc-error">{errors.email}</p>}
            </div>

            <div className="wyc-field">
              <label className="wyc-label" htmlFor="phone">
                Cell Phone{' '}
                <span className="wyc-optional">(optional)</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="wyc-input"
                value={form.phone}
                onChange={handleChange}
                placeholder="(555) 000-0000"
                autoComplete="tel"
              />
            </div>

            <div className="wyc-field">
              <label className="wyc-label" htmlFor="organization">
                Organization / Program{' '}
                <span className="wyc-optional">(optional)</span>
              </label>
              <input
                id="organization"
                name="organization"
                type="text"
                className="wyc-input"
                value={form.organization}
                onChange={handleChange}
                placeholder="University golf program, club, etc."
                autoComplete="organization"
              />
            </div>

            <div className="wyc-field">
              <label className="wyc-label" htmlFor="message">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                className="wyc-input"
                value={form.message}
                onChange={handleChange}
                placeholder="Tell us about your program and what you're looking for..."
                rows={5}
                style={{ resize: 'vertical', minHeight: '120px' }}
              />
              {errors.message && <p className="wyc-error">{errors.message}</p>}
            </div>

            {submitError && (
              <p className="wyc-error" style={{ marginBottom: '12px' }}>
                {submitError}
              </p>
            )}

            <button
              type="submit"
              className="wyc-btn-primary"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
