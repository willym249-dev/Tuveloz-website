"use client";

import { useCallback, useEffect, useState } from "react";

type ReferralInfo = {
  role: "provider" | "customer";
  code: string;
  shareUrl: string;
  signupCount: number;
};

const COPY: Record<ReferralInfo["role"], { heading: string; blurb: string; counted: string }> = {
  provider: {
    heading: "Invite another provider",
    blurb:
      "Independent operators hear about work from each other before they hear about it from an ad. Share your link with someone who runs their own vehicle-service business.",
    counted: "provider applications credited to your link",
  },
  customer: {
    heading: "Tell someone about Tuveloz",
    blurb:
      "If you know someone in Montgomery County who is tired of arranging a shop trip, send them your link.",
    counted: "signups credited to your link",
  },
};

/**
 * Share link and its credited-signup count.
 *
 * The panel states plainly what a referral does and does not do. Referrals
 * carry no payment and no ranking or routing preference — the founding-provider
 * policy refuses those outright, and this must not become a way around it.
 */
export function ReferralPanel({ role }: { role: "provider" | "customer" }) {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/referrals", { cache: "no-store" });
      const result = await response.json() as ReferralInfo & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load your share link.");
      setInfo(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load your share link.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const copy = COPY[info?.role ?? role];

  return (
    <section className="referral-panel" aria-labelledby="referral-heading">
      <span className="account-kicker">Share Tuveloz</span>
      <h3 id="referral-heading">{copy.heading}</h3>
      <p>{copy.blurb}</p>

      {error && <p className="form-error" role="alert">{error}</p>}

      {info && (
        <>
          <div className="referral-link-row">
            <input
              readOnly
              value={info.shareUrl}
              aria-label="Your share link"
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              className="button secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(info.shareUrl);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2500);
                } catch {
                  setError("Copying was blocked. Select the link and copy it manually.");
                }
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="referral-count">
            <strong>{info.signupCount}</strong> {copy.counted}
          </p>
        </>
      )}

      <p className="referral-disclaimer">
        Sharing your link records who told someone about Tuveloz, and nothing else.
        There is no referral payment, and a referral never affects search ranking,
        job routing, quote order, or how any application is reviewed. You are not
        told who signed up — only how many.
      </p>
    </section>
  );
}
