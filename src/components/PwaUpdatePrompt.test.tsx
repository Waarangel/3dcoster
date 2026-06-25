import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

// ---------------------------------------------------------------------------
// PwaUpdatePrompt — Reload-button reliability.
//
// Regression lock for the bug where clicking "Reload" did nothing on an
// UNCONTROLLED page (fresh first load, or a hard refresh that bypasses the
// service worker). On such a page the newly-installed worker auto-activates
// with nothing left "waiting", so vite-plugin-pwa's updateServiceWorker() had
// no waiting worker to message and no `controllerchange` ever fired — the
// banner just sat there. The fix drives the reload explicitly:
//
//   - waiting worker present  -> skip-waiting + reload on controllerchange
//   - nothing waiting (uncontrolled / already-activated) -> reload immediately
//
// We mock the SW registration + virtual:pwa-register/react and assert the
// Reload click reaches window.location.reload() in BOTH shapes.
// ---------------------------------------------------------------------------

// `virtual:pwa-register/react` is aliased to this stub in vitest.config.ts.
import { __setMockState } from '../test/stubs/pwaRegister';
import { PwaUpdatePrompt } from './PwaUpdatePrompt';

const updateServiceWorkerSpy = vi.fn();

let container: HTMLDivElement;
let root: Root;
const reloadSpy = vi.fn();

function setRegistration(waiting: { postMessage: () => void } | null) {
  const registration = { waiting };
  const listeners: Record<string, ((e?: unknown) => void)[]> = {};
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: vi.fn().mockResolvedValue(registration),
      addEventListener: (type: string, cb: () => void) => {
        (listeners[type] ??= []).push(cb);
      },
      // expose so a test can fire controllerchange
      __fire: (type: string) => (listeners[type] ?? []).forEach((cb) => cb()),
    },
  });
}

beforeEach(() => {
  updateServiceWorkerSpy.mockClear();
  reloadSpy.mockClear();
  // Banner always renders (needRefresh = true); inject the spy updater.
  __setMockState({ needRefresh: true, updateServiceWorker: updateServiceWorkerSpy });
  // window.location.reload is non-writable in jsdom — redefine it.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: reloadSpy },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function clickReload() {
  await act(async () => {
    root.render(<PwaUpdatePrompt />);
  });
  const reloadBtn = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === 'Reload',
  );
  expect(reloadBtn, 'Reload button should render').toBeTruthy();
  await act(async () => {
    reloadBtn!.click();
    // let the async handler (getRegistration await) resolve
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('PwaUpdatePrompt Reload button', () => {
  it('reloads immediately when no worker is waiting (uncontrolled page — the bug)', async () => {
    setRegistration(null); // nothing waiting => the broken case
    await clickReload();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('asks the waiting worker to take over, then reloads on controllerchange', async () => {
    const postMessage = vi.fn();
    setRegistration({ postMessage }); // a worker is waiting
    await clickReload();

    // It should message the waiting worker (via updateServiceWorker) and NOT
    // reload until the new worker actually takes control.
    expect(updateServiceWorkerSpy).toHaveBeenCalledWith(true);
    expect(reloadSpy).not.toHaveBeenCalled();

    // Fire controllerchange -> now it reloads.
    act(() => {
      (navigator.serviceWorker as unknown as { __fire: (t: string) => void }).__fire(
        'controllerchange',
      );
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
