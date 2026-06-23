import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldShowSupportNudge,
  markSupportNudgeShown,
  markSupportNudgeClicked,
  SUPPORT_NUDGE_COOLDOWN_DAYS,
  _resetSupportNudgeSessionForTest,
} from './supportNudge';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('supportNudge gate', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetSupportNudgeSessionForTest();
  });

  it('shows on a fresh state (never shown, never clicked)', () => {
    expect(shouldShowSupportNudge()).toBe(true);
  });

  it('does not show twice in the same session, even before persisting cooldown', () => {
    markSupportNudgeShown();
    expect(shouldShowSupportNudge()).toBe(false);
  });

  it('stays suppressed within the cooldown window across sessions', () => {
    const now = Date.UTC(2026, 0, 1);
    markSupportNudgeShown(now);
    _resetSupportNudgeSessionForTest(); // simulate a page reload

    const oneDayLater = now + DAY_MS;
    expect(shouldShowSupportNudge(oneDayLater)).toBe(false);

    const justBeforeCooldownEnds = now + (SUPPORT_NUDGE_COOLDOWN_DAYS - 1) * DAY_MS;
    expect(shouldShowSupportNudge(justBeforeCooldownEnds)).toBe(false);
  });

  it('shows again once the cooldown has fully elapsed', () => {
    const now = Date.UTC(2026, 0, 1);
    markSupportNudgeShown(now);
    _resetSupportNudgeSessionForTest();

    const afterCooldown = now + (SUPPORT_NUDGE_COOLDOWN_DAYS + 1) * DAY_MS;
    expect(shouldShowSupportNudge(afterCooldown)).toBe(true);
  });

  it('is suppressed permanently once the user clicks through', () => {
    markSupportNudgeClicked();
    _resetSupportNudgeSessionForTest();

    // Even years later, a clicked-through user is never nudged again.
    const farFuture = Date.now() + 1000 * DAY_MS;
    expect(shouldShowSupportNudge(farFuture)).toBe(false);
  });

  it('tolerates malformed localStorage by treating it as fresh', () => {
    localStorage.setItem('3dcoster-support-nudge', '{not valid json');
    expect(shouldShowSupportNudge()).toBe(true);
  });
});
