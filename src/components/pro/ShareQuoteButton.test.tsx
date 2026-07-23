import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Quote } from '../../types';
import { ToastProvider } from '../ui';

// ---------------------------------------------------------------------------
// ShareQuoteButton — Phase 43-04 (PRO-02 / D-10).
//
// Raw createRoot + act per project precedent (ConfirmModal.test.tsx /
// LogFailureModal.test.tsx). useProAuth is mocked directly so both the
// signed-out (Pro chip + pitch modal) and signed-in (publish/unpublish)
// branches are exercised without a real Supabase client.
// ---------------------------------------------------------------------------

vi.stubGlobal('__IS_TAURI__', false);

let mockIsSignedIn = false;

vi.mock('../../hooks/useProAuth', () => ({
  useProAuth: () => ({
    session: mockIsSignedIn ? { user: { id: 'user-1' } } : null,
    user: mockIsSignedIn ? { id: 'user-1' } : null,
    isSignedIn: mockIsSignedIn,
    status: mockIsSignedIn ? 'signed-in' : 'signed-out',
    signInWithEmail: vi.fn(),
    signOut: vi.fn(),
  }),
}));

const { ShareQuoteButton } = await import('./ShareQuoteButton');

function makeQuote(overrides?: Partial<Quote>): Quote {
  return {
    id: 'quote-1',
    quoteNumber: 7,
    printJobId: 'job-1',
    customerSnapshot: { name: 'Jane Doe' },
    lineItemsSnapshot: {
      jobTitle: 'Bracket',
      sellingPrice: 10,
      shippingCost: 0,
      resolvedTaxRate: 0,
      taxAmount: 0,
      currency: 'USD',
      notes: '',
      terms: '',
    },
    status: 'sent',
    createdAt: new Date(),
    sentAt: new Date(),
    ...overrides,
  } as Quote;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockIsSignedIn = false;
});

afterEach(() => {
  if (root) {
    act(() => { root!.unmount(); });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  vi.clearAllMocks();
});

type PublishFn = (quote: Quote, options?: unknown) => Promise<string>;
type UnpublishFn = (quote: Quote) => Promise<void>;

function renderButton(props: { quote?: Quote; publish?: ReturnType<typeof vi.fn<PublishFn>>; unpublish?: ReturnType<typeof vi.fn<UnpublishFn>> } = {}) {
  const publish = props.publish ?? vi.fn<PublishFn>(async () => 'https://3dcoster.com/q/abc');
  const unpublish = props.unpublish ?? vi.fn<UnpublishFn>(async () => {});
  const quote = props.quote ?? makeQuote();
  act(() => {
    root!.render(
      <ToastProvider>
        <ShareQuoteButton quote={quote} publish={publish} unpublish={unpublish} />
      </ToastProvider>,
    );
  });
  return { publish, unpublish, quote };
}

function findButtonByLabel(label: string): HTMLButtonElement | null {
  return document.body.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

describe('ShareQuoteButton — desktop gate (D-12)', () => {
  it('renders nothing under __IS_TAURI__', () => {
    vi.stubGlobal('__IS_TAURI__', true);
    mockIsSignedIn = true;
    renderButton();
    expect(container!.textContent).toBe('');
    vi.stubGlobal('__IS_TAURI__', false);
  });
});

describe('ShareQuoteButton — signed-out / non-Pro (D-10)', () => {
  it('shows the Pro chip and opens the pitch modal on click, without publishing', async () => {
    mockIsSignedIn = false;
    const { publish } = renderButton();

    const btn = findButtonByLabel('Share quote Q-0007 (Pro feature)');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain('Pro');

    await act(async () => {
      btn!.click();
    });

    expect(document.body.textContent).toContain('Unlock 3DCoster Pro');
    expect(publish).not.toHaveBeenCalled();
  });

  it('opens sign-in from the pitch modal', async () => {
    mockIsSignedIn = false;
    renderButton();

    await act(async () => {
      findButtonByLabel('Share quote Q-0007 (Pro feature)')!.click();
    });
    await act(async () => {
      findButtonByLabel('Sign in for Pro')!.click();
    });

    expect(document.body.textContent).toContain('Sign in for Pro');
    expect(document.body.querySelector('input[type="email"]')).not.toBeNull();
  });
});

describe('ShareQuoteButton — signed-in (publish/unpublish)', () => {
  it('publishes an unpublished quote and shows a success toast', async () => {
    mockIsSignedIn = true;
    const { publish } = renderButton({ quote: makeQuote({ publishStatus: undefined }) });

    const btn = findButtonByLabel('Share quote Q-0007');
    expect(btn).not.toBeNull();

    await act(async () => {
      btn!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('unpublishes an already-published quote', async () => {
    mockIsSignedIn = true;
    const { unpublish } = renderButton({
      quote: makeQuote({ publishStatus: 'published', hostedToken: 'token-1' }),
    });

    const btn = findButtonByLabel('Unpublish quote Q-0007');
    expect(btn).not.toBeNull();

    await act(async () => {
      btn!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(unpublish).toHaveBeenCalledTimes(1);
  });

  it('surfaces a publish failure via toast without crashing', async () => {
    mockIsSignedIn = true;
    const publish = vi.fn<PublishFn>(async () => { throw new Error('An active Pro subscription is required to publish a new quote link.'); });
    renderButton({ quote: makeQuote({ publishStatus: undefined }), publish });

    await act(async () => {
      findButtonByLabel('Share quote Q-0007')!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('An active Pro subscription is required');
  });
});
