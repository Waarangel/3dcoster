import { Link } from 'react-router-dom';
import { useState } from 'react';
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/pwa-192x192.png" alt="3DCoster" className="w-10 h-10 rounded-xl" />
            <span className="text-white font-semibold text-xl">3DCoster</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/features"
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors text-sm font-medium"
            >
              Features
            </Link>
            <Link
              to="/download"
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors text-sm font-medium"
            >
              Download
            </Link>
            <Link
              to="/app"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Go to App
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-blue-500/10 rounded-xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">Send Us Feedback</h1>
            <p className="text-slate-400 text-lg">
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
              <h2 className="text-xl font-semibold text-white mb-2">Thanks for your feedback!</h2>
              <p className="text-slate-400 mb-6">We'll review it and get back to you if needed.</p>
              <button
                onClick={() => setStatus('idle')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
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
                    <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                      Email (optional)
                    </label>
                    <Input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="your@email.com"
                      inputSize="lg"
                    />
                    <p className="text-slate-500 text-xs mt-1">Only if you'd like a response</p>
                  </div>

                  {/* Type */}
                  <div>
                    <label htmlFor="type" className="block text-sm font-medium text-slate-300 mb-2">
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
                    <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-2">
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
