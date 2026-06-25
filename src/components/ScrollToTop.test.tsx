import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { ScrollToTop } from './ScrollToTop';

// ---------------------------------------------------------------------------
// ScrollToTop — route-change scroll behavior.
//
// Locks three behaviors:
//   1. Pathname change scrolls window to the top instantly.
//   2. Hash-only change (same pathname) does NOT scroll to top — browser handles it.
//   3. ScrollToTop renders null — no DOM output of its own.
// ---------------------------------------------------------------------------

const scrollToSpy = vi.fn();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  scrollToSpy.mockClear();
  window.scrollTo = scrollToSpy;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// A component that provides programmatic navigation control from a ref.
let _navigate: ((to: string) => void) | null = null;
function NavHook() {
  const navigate = useNavigate();
  _navigate = navigate;
  return null;
}

function App({ initialEntry }: { initialEntry: string }) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <ScrollToTop />
      <NavHook />
    </MemoryRouter>
  );
}

describe('ScrollToTop', () => {
  it('scrolls to the top when the pathname changes', async () => {
    await act(async () => {
      root.render(<App initialEntry="/" />);
    });
    // Clear calls from the initial mount
    scrollToSpy.mockClear();

    // Navigate to a different pathname
    await act(async () => {
      _navigate?.('/features');
    });

    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
  });

  it('does NOT scroll to top when only the hash changes', async () => {
    await act(async () => {
      root.render(<App initialEntry="/faq#shipping" />);
    });
    scrollToSpy.mockClear();

    // Navigate to same pathname with a different hash only
    await act(async () => {
      _navigate?.('/faq#returns');
    });

    // scrollTo should not have been called because pathname did not change
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('renders null — no DOM output', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ScrollToTop />
        </MemoryRouter>,
      );
    });
    // MemoryRouter itself renders no DOM; ScrollToTop adds nothing
    expect(container.children.length).toBe(0);
  });
});
