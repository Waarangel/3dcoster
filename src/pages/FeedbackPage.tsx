import { useState } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Button, Input, Select, Textarea, Card } from '../components/ui';
import { Reveal } from '../components/motion/Reveal';

const ISSUES_URL = 'https://github.com/Waarangel/3dcoster/issues';

export function FeedbackPage() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submittedType, setSubmittedType] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('submitting');

    const form = e.currentTarget;
    const formData = new FormData(form);
    const type = String(formData.get('type') ?? '');

    try {
      const response = await fetch('https://formspree.io/f/mbdgwnjl', {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        setSubmittedType(type);
        setStatus('success');
        form.reset();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />

      {/* Content */}
      <section className="relative overflow-hidden pt-32 pb-20 px-6">
        <div className="hero-aura pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <div className="max-w-2xl mx-auto">
          <Reveal trigger="mount">
            <div className="text-center mb-10">
              <h1 className="font-display text-4xl font-extrabold text-[var(--ink)]">Send us feedback</h1>
              <p className="mt-4 text-[var(--ink-soft)] text-lg">
                Found a bug? Have an idea? We&apos;d love to hear from you.
              </p>
              <p className="mt-3 text-sm text-[var(--ink-faint)]">
                A real person reads every message. For bugs, you can also{' '}
                <a
                  href={ISSUES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--brand-soft)] hover:text-[var(--ink)] underline underline-offset-2 transition-colors"
                >
                  open an issue on GitHub
                </a>
                .
              </p>
            </div>
          </Reveal>

          {status === 'success' ? (
            <Reveal trigger="mount">
              <Card padding="lg" className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(23,150,255,0.12)]">
                  <svg className="h-8 w-8 text-[var(--brand-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-display text-xl font-bold text-[var(--ink)] mb-2">Thanks — message sent.</h2>
                <p className="text-[var(--ink-soft)]">
                  We read every message, and get back to you if you left an email.
                </p>
                {submittedType === 'bug' && (
                  <p className="mt-3 text-sm text-[var(--ink-faint)]">
                    Reporting a bug? Tracking it on{' '}
                    <a
                      href={ISSUES_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--brand-soft)] hover:text-[var(--ink)] underline underline-offset-2 transition-colors"
                    >
                      GitHub Issues
                    </a>{' '}
                    helps us fix it faster.
                  </p>
                )}
                <button
                  onClick={() => setStatus('idle')}
                  className="mt-6 text-[var(--brand-soft)] hover:text-[var(--ink)] transition-colors"
                >
                  Send another message
                </button>
              </Card>
            </Reveal>
          ) : (
            <Reveal trigger="mount" delay={0.08}>
              <Card padding="lg">
                <form onSubmit={handleSubmit}>
                  <div className="space-y-6">
                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-[var(--ink-soft)] mb-2">
                        Email (optional)
                      </label>
                      <Input type="email" id="email" name="email" placeholder="your@email.com" inputSize="lg" />
                      <p className="text-[var(--ink-faint)] text-xs mt-1">Only if you&apos;d like a response</p>
                    </div>

                    {/* Type */}
                    <div>
                      <label htmlFor="type" className="block text-sm font-medium text-[var(--ink-soft)] mb-2">
                        Feedback Type
                      </label>
                      <Select id="type" name="type" selectSize="lg">
                        <option value="feature">Feature Request</option>
                        <option value="bug">Bug Report</option>
                        <option value="general">General Feedback</option>
                        <option value="other">Other</option>
                      </Select>
                    </div>

                    {/* Message */}
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-[var(--ink-soft)] mb-2">
                        Your Message
                      </label>
                      <Textarea
                        id="message"
                        name="message"
                        rows={5}
                        required
                        placeholder="Tell us what's on your mind..."
                        textareaSize="lg"
                      />
                    </div>

                    {/* Error message */}
                    {status === 'error' && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
                        Something went wrong. Please try again or email us directly at waarangel@gmail.com
                      </div>
                    )}

                    {/* Submit */}
                    <Button type="submit" disabled={status === 'submitting'} btnSize="lg" fullWidth>
                      {status === 'submitting' ? 'Sending...' : 'Send Feedback'}
                    </Button>
                  </div>
                </form>
              </Card>
            </Reveal>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
