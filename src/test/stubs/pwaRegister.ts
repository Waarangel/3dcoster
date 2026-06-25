// Test stub for vite-plugin-pwa's virtual module `virtual:pwa-register/react`.
//
// The real virtual module is provided by the VitePWA plugin, which only runs in
// the production build — not under vitest. vitest.config.ts aliases the virtual
// id to this file so component tests that import PwaUpdatePrompt can resolve and
// drive the hook. Tests set the returned values via __setMockState().

type Updater = (reloadPage?: boolean) => unknown;

interface MockState {
  needRefresh: boolean;
  updateServiceWorker: Updater;
}

const state: MockState = {
  needRefresh: true,
  updateServiceWorker: () => {},
};

/** Test hook: override what useRegisterSW() returns. */
export function __setMockState(next: Partial<MockState>): void {
  Object.assign(state, next);
}

export function useRegisterSW() {
  return {
    needRefresh: [state.needRefresh, () => {}] as [boolean, () => void],
    offlineReady: [false, () => {}] as [boolean, () => void],
    updateServiceWorker: state.updateServiceWorker,
  };
}
