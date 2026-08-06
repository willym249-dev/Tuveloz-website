"use client";

import { useEffect } from "react";
import { attribution } from "../../lib/attribution";

/**
 * Records first-touch attribution on the first page a visitor lands on.
 *
 * This has to run from the root layout rather than from the signup form,
 * because the referrer that says "they came from Instagram" only exists on the
 * landing page. A visitor who lands on / and then clicks through to /join
 * arrives there with our own domain as the referrer — by the time the form is
 * on screen, the real source is gone. Capturing at the layout keeps it.
 *
 * Renders nothing and never blocks: lib/attribution.ts writes once, then every
 * later call is a read.
 */
export function AttributionCapture() {
  useEffect(() => {
    attribution();
  }, []);
  return null;
}
