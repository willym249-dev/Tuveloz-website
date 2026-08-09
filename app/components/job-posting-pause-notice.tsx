"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rememberAttribution, track } from "../../lib/analytics";
import {
  CUSTOMER_JOB_POSTING_PAUSED_DETAIL,
  CUSTOMER_JOB_POSTING_PAUSED_MESSAGE,
  CUSTOMER_JOB_POSTING_PAUSED_SUMMARY,
} from "../../lib/launch-status";

// Recorded on every banner event so a later copy test has something to compare
// against. Change this string only when the wording itself changes, or the two
// periods become indistinguishable in the data.
const BANNER_SURFACE = { surface: "launch_banner", variant: "baseline" } as const;

// Module scope, deliberately not a ref. This component mounts more than once per
// page load — StrictMode double-invokes effects, and the layout can remount —
// and a ref only dedupes within a single instance. Measured: a ref produced two
// impressions for one page view, which would have halved the reported
// click-through rate. A module flag lives as long as the JS context, so it
// resets on a real navigation and never on a remount.
let impressionSent = false;

export function JobPostingPauseNotice() {
  const [expanded, setExpanded] = useState(false);

  // Once per page load, not per render, so clicks over impressions is a real
  // click-through rate.
  useEffect(() => {
    if (impressionSent) return;
    impressionSent = true;
    track("launch_banner_impression", BANNER_SURFACE);
  }, []);

  return (
    <>
      <style>{`
        .tuveloz-launch-pause {
          position: relative;
          z-index: 90;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.9rem;
          padding: 0.45rem clamp(1rem, 4vw, 3rem);
          border-bottom: 1px solid rgba(255, 106, 0, 0.5);
          background: #07182d;
          color: white;
        }

        .tuveloz-launch-pause-copy {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.2rem 0.6rem;
          min-width: 0;
          max-width: 70rem;
        }

        .tuveloz-launch-pause-heading {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .tuveloz-launch-pause-heading strong {
          color: #ff6a00;
          font-size: 0.72rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .tuveloz-launch-pause-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          min-height: 1.9rem;
          padding: 0.15rem 0.55rem;
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 0.6rem;
          background: transparent;
          color: white;
          font-size: 0.74rem;
          font-weight: 750;
          white-space: nowrap;
          cursor: pointer;
        }

        .tuveloz-launch-pause-summary,
        .tuveloz-launch-pause-details span {
          font-size: 0.88rem;
          line-height: 1.4;
        }

        .tuveloz-launch-pause-details {
          display: grid;
          gap: 0.25rem;
          flex-basis: 100%;
          padding-bottom: 0.2rem;
        }

        /* Collapsed is the default at every width: one line, so the hero call
           to action stays above the fold on a short laptop screen. */
        .tuveloz-launch-pause:not(.expanded) .tuveloz-launch-pause-details {
          display: none;
        }

        .tuveloz-launch-pause.expanded .tuveloz-launch-pause-summary {
          display: none;
        }

        .tuveloz-launch-pause-actions {
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .tuveloz-launch-pause-actions a {
          display: inline-flex;
          align-items: center;
          min-height: 2rem;
          padding: 0.25rem 0.7rem;
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 0.6rem;
          color: white;
          font-size: 0.8rem;
          font-weight: 750;
          white-space: nowrap;
          text-decoration: none;
        }

        .tuveloz-launch-pause-actions a:first-child {
          border-color: #ff6a00;
          background: #ff6a00;
          color: #07182d;
        }

        @media (max-width: 900px) {
          .tuveloz-launch-pause-summary {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .tuveloz-launch-pause {
            align-items: stretch;
            flex-direction: column;
            gap: 0.55rem;
          }

          .tuveloz-launch-pause-heading {
            justify-content: space-between;
          }

          /* The label is long enough to overflow a 320px phone if it cannot
             break. Wrapping is preferable to a horizontal scrollbar. */
          .tuveloz-launch-pause-heading strong {
            white-space: normal;
          }

          .tuveloz-launch-pause:not(.expanded) .tuveloz-launch-pause-actions {
            display: none;
          }

          .tuveloz-launch-pause-actions a {
            flex: 1 1 11rem;
            justify-content: center;
          }
        }
      `}</style>
      <aside
        aria-label="Tuveloz customer launch update"
        className={expanded ? "tuveloz-launch-pause expanded" : "tuveloz-launch-pause"}
        role="status"
      >
        <div className="tuveloz-launch-pause-copy">
          <div className="tuveloz-launch-pause-heading">
            <strong>Almost open · Montgomery County, MD</strong>
            <span className="tuveloz-launch-pause-summary">
              {CUSTOMER_JOB_POSTING_PAUSED_SUMMARY}
            </span>
            <button
              aria-controls="tuveloz-launch-pause-details"
              aria-expanded={expanded}
              className="tuveloz-launch-pause-toggle"
              onClick={() => setExpanded((value) => !value)}
              type="button"
            >
              {expanded ? "Hide details" : "Details"} <span aria-hidden>{expanded ? "▴" : "▾"}</span>
            </button>
          </div>
          <div className="tuveloz-launch-pause-details" id="tuveloz-launch-pause-details">
            <span>{CUSTOMER_JOB_POSTING_PAUSED_MESSAGE}</span>
            <span>{CUSTOMER_JOB_POSTING_PAUSED_DETAIL}</span>
          </div>
        </div>
        {/* Customer account creation remains the primary action while requests
            are paused. The strip is sitewide, though, so it also keeps a
            provider route available on pages without the recruitment hero. */}
        <nav aria-label="Available Tuveloz account options" className="tuveloz-launch-pause-actions">
          <Link
            href="/account?role=customer&mode=create&source=launch_banner"
            onClick={() => {
              // Remember first, then count. If the navigation wins the race, the
              // attribution is already stored and account_created still lands
              // against the banner.
              rememberAttribution(BANNER_SURFACE);
              track("launch_banner_cta_clicked", { ...BANNER_SURFACE, cta: "save_my_spot_free" });
            }}
          >
            Save my spot — free
          </Link>
          <Link
            href="/join"
            onClick={() => {
              rememberAttribution(BANNER_SURFACE);
              track("launch_banner_cta_clicked", { ...BANNER_SURFACE, cta: "join_as_a_provider" });
            }}
          >
            Join as a provider
          </Link>
        </nav>
      </aside>
    </>
  );
}
