import { useState } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Button, Input, Select, Textarea, Card } from '../components/ui';

export function FeedbackPage() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('submitting');

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('https://formspree.io/f/mbdgwnjl', {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
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
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-[rgba(23,150,255,0.1)] border border-[rgba(23,150,255,0.2)] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[var(--brand-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h1 className="font-display text-4xl font-extrabold text-[var(--ink)] mb-4">Send us feedback</h1>
            <p className="text-[var(--ink-soft)] text-lg">
              Found a bug? Have an idea? We'd love to hear from you.
            </p>
          </div>

          {status === 'success' ? (
            <Card padding="lg" className="text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-display text-xl font-bold text-[var(--ink)] mb-2">Thanks for your feedback!</h2>
              <p className="text-[var(--ink-soft)] mb-6">We'll review it and get back to you if needed.</p>
              <button
                onClick={() => setStatus('idle')}
                className="text-[var(--brand-soft)] hover:text-[var(--ink)] transition-colors"
              >
                Send another message
              </button>
            </Card>
          ) : (
            <Card padding="lg">
              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-[var(--ink-soft)] mb-2">
                      Email (optional)
                    </label>
                    <Input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="your@email.com"
                      inputSize="lg"
                    />
                    <p className="text-[var(--ink-faint)] text-xs mt-1">Only if you'd like a response</p>
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
                  <Button
                    type="submit"
                    disabled={status === 'submitting'}
                    btnSize="lg"
                    fullWidth
                  >
                    {status === 'submitting' ? 'Sending...' : 'Send Feedback'}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
