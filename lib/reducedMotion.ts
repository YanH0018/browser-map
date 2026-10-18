/**
 * Accessibility (M5 item 4, D15): true when the user's OS/browser requests
 * reduced motion. Guarded so it is safe in non-browser environments and in
 * browsers without matchMedia (returns false = motion allowed). Read at
 * render time by the canvas; a change listener is out of scope for M5.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
