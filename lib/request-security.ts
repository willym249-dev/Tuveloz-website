export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === new URL(request.url).origin;
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}

/**
 * Public, unauthenticated write endpoints require an explicit browser Origin.
 * Treating a missing Origin as trusted would let scripts outside the site omit
 * the header and submit records that look like they came from TUVELOZ.
 */
export function isStrictSameOriginWriteRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
