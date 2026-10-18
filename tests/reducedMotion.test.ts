import { afterEach, describe, expect, it } from 'vitest';
import { prefersReducedMotion } from '../lib/reducedMotion';

/**
 * M5 item 4 (D15): the reduced-motion helper must be safe in non-browser
 * environments and report the OS preference when matchMedia exists.
 */

// Cast through unknown: `typeof globalThis` declares a non-optional
// `window`, which would block both the assignment and the delete below.
const g = globalThis as unknown as { window?: unknown };

function setMatchMedia(impl: ((query: string) => { matches: boolean }) | undefined): void {
  g.window = impl === undefined ? {} : { matchMedia: impl };
}

afterEach(() => {
  delete g.window;
});

describe('prefersReducedMotion', () => {
  it('is false when window is unavailable (non-browser environment)', () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it('is false when window exists but matchMedia does not', () => {
    setMatchMedia(undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('is true when the OS requests reduced motion', () => {
    setMatchMedia((query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    expect(prefersReducedMotion()).toBe(true);
  });

  it('is false when motion is allowed', () => {
    setMatchMedia(() => ({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
  });

  it('is false when matchMedia throws', () => {
    setMatchMedia(() => {
      throw new Error('matchMedia unavailable');
    });
    expect(prefersReducedMotion()).toBe(false);
  });
});
