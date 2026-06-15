import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ToastProvider } from './ToastProvider';
import { useToast } from './useToast';
import type { ToastApi } from './types';

// ---------------------------------------------------------------------------
// ToastProvider — the shared, modular toast system that replaces the two
// copy-pasted inline toasts (GcodeImport success / CostCalculator error).
//
// These tests pin the behavior contract:
//   - success/info toasts are role="status" aria-live="polite"
//   - error toasts are role="alert" aria-live="assertive"  (fixes the old
//     GcodeImport success-toast a11y gap by making a11y a single concern)
//   - multiple toasts STACK in one viewport (fixes the old top-right overlap)
//   - auto-dismiss after duration; manual dismiss; ReactNode content
//   - useToast() throws outside a provider
//
// Raw createRoot + act per project precedent (RecordSaleModal.test.tsx) — no
// third-party render-hook library.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

// Captures the toast API from inside the provider so tests can drive it.
function CaptureApi({ onReady }: { onReady: (api: ToastApi) => void }) {
  const api = useToast();
  onReady(api);
  return null;
}

function mount(): ToastApi {
  let captured: ToastApi | undefined;
  act(() => {
    root.render(
      <ToastProvider>
        <CaptureApi onReady={(api) => { captured = api; }} />
      </ToastProvider>
    );
  });
  if (!captured) throw new Error('API not captured');
  return captured;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('ToastProvider / useToast', () => {
  it('renders a success toast with its content and a polite status role', () => {
    const api = mount();
    act(() => { api.success('Imported successfully'); });

    expect(document.body.textContent).toContain('Imported successfully');
    const status = document.body.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute('aria-live')).toBe('polite');
  });

  it('renders an error toast with an assertive alert role', () => {
    const api = mount();
    act(() => { api.error('Could not save the job'); });

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.getAttribute('aria-live')).toBe('assertive');
    expect(alert?.textContent).toContain('Could not save the job');
  });

  it('stacks multiple toasts at once instead of overlapping', () => {
    const api = mount();
    act(() => {
      api.success('First');
      api.error('Second');
    });

    const toasts = document.body.querySelectorAll('[data-toast]');
    expect(toasts.length).toBe(2);
    expect(document.body.textContent).toContain('First');
    expect(document.body.textContent).toContain('Second');
  });

  it('auto-dismisses after the given duration', () => {
    vi.useFakeTimers();
    const api = mount();
    act(() => { api.success('Bye soon', { duration: 5000 }); });
    expect(document.body.textContent).toContain('Bye soon');

    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.body.textContent).not.toContain('Bye soon');
  });

  it('does not auto-dismiss when duration is 0', () => {
    vi.useFakeTimers();
    const api = mount();
    act(() => { api.info('Sticky', { duration: 0 }); });

    act(() => { vi.advanceTimersByTime(60000); });
    expect(document.body.textContent).toContain('Sticky');
  });

  it('dismisses a toast by id', () => {
    const api = mount();
    let id = '';
    act(() => { id = api.success('Dismiss me', { duration: 0 }); });
    expect(document.body.textContent).toContain('Dismiss me');

    act(() => { api.dismiss(id); });
    expect(document.body.textContent).not.toContain('Dismiss me');
  });

  it('renders rich ReactNode content (preserves the gcode import case)', () => {
    const api = mount();
    act(() => {
      api.success(
        <div>
          <span data-testid="rich-badge">3MF</span>
          <span>2.50h</span>
        </div>,
        { duration: 0 }
      );
    });

    expect(document.body.querySelector('[data-testid="rich-badge"]')).not.toBeNull();
    expect(document.body.textContent).toContain('2.50h');
  });

  it('throws when useToast is used outside a ToastProvider', () => {
    const orphan = createRoot(document.createElement('div'));
    expect(() => {
      act(() => { orphan.render(<CaptureApi onReady={() => {}} />); });
    }).toThrow(/ToastProvider/);
  });
});
