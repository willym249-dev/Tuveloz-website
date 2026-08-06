/**
 * "Has this already happened in this browser session?"
 *
 * Funnel stages are only comparable if each one counts people rather than page
 * loads. Awareness fired on every render would climb with refreshes and
 * back-button presses, and because it is the denominator for every stage under
 * it, all of those rates would sag for a reason that has nothing to do with the
 * marketing.
 *
 * Session storage is the closest honest stand-in for "a visit" without giving
 * anyone a tracking identity: it clears itself when the tab closes, is never
 * sent anywhere, and cannot be joined up across sites.
 */
const ONCE_PREFIX = "tuveloz-seen-";

export function firstTimeThisSession(name: string) {
  if (typeof window === "undefined") return false;
  const key = `${ONCE_PREFIX}${name}`;
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    // Storage blocked (private mode, etc.). Counting it again is better than
    // going blind: a slight over-count is visible and correctable, a stage
    // that silently reports nothing reads as "nobody came".
    return true;
  }
}
