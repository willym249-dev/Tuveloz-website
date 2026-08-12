"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccountHeaderState } from "./account-header-state";
// The banner sits above every page, so it is the first voice a visitor hears.
// It says the same two things the API-facing constants say — you cannot post a
// job yet, and signing up books nothing and costs nothing — in the words a
// person would actually use.
const LAUNCH_BANNER_MESSAGE =
  "Local pros near you are signing up right now. As soon as we open, you'll be able to say what your car needs and get prices back.";

const LAUNCH_BANNER_DETAIL =
  "Making an account today is free, and it doesn't book anything or charge you.";

// The same message for someone already signed in. Telling a customer who is
// signed in to go make an account is what makes a public page read as a
// sign-out, so the banner speaks to the session it can actually see.
const SIGNED_IN_BANNER_DETAIL =
  "You're signed in and your spot is saved. Nothing here books anything or charges you.";

// Pages where a banner button would duplicate what the page already offers:
// the provider pages carry "Apply free" in a sticky header, and /account is
// itself the sign-up form the banner would be linking to. Signed-out provider
// routes redirect to /account, so it has to be on this list or a mechanic
// lands on a page telling them to create a customer account.
const PAGES_WITH_THEIR_OWN_CTA = [
  "/join",
  "/account",
  // Owner tooling. A "save my spot" button on the private dashboard is noise.
  "/admin",
  "/provider-onboarding",
  "/provider-jobs",
  "/provider-services",
  "/provider-service-area",
];

export function JobPostingPauseNotice() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const { accountHref, signedIn, state } = useAccountHeaderState();
  const pageHasItsOwnCta = PAGES_WITH_THEIR_OWN_CTA.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  return (
    <>
      <style>{`
        .tuveloz-launch-pause {
          position: relative;
          z-index: 90;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.85rem clamp(1rem, 4vw, 3rem);
          border-bottom: 1px solid rgba(255, 106, 0, 0.5);
          background: #07182d;
          color: white;
        }

        .tuveloz-launch-pause-copy {
          display: grid;
          gap: 0.2rem;
          max-width: 70rem;
        }

        .tuveloz-launch-pause-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .tuveloz-launch-pause-heading strong {
          color: #ff6a00;
          font-size: 0.78rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .tuveloz-launch-pause-toggle {
          display: none;
          align-items: center;
          gap: 0.3rem;
          min-height: 2.25rem;
          padding: 0.3rem 0.6rem;
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 0.7rem;
          background: transparent;
          color: white;
          font-size: 0.78rem;
          font-weight: 750;
          cursor: pointer;
        }

        .tuveloz-launch-pause-copy span {
          font-size: 0.95rem;
          line-height: 1.45;
        }

        .tuveloz-launch-pause-actions {
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          gap: 0.55rem;
        }

        .tuveloz-launch-pause-actions a {
          display: inline-flex;
          align-items: center;
          min-height: 2.5rem;
          padding: 0.55rem 0.8rem;
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 0.7rem;
          color: white;
          font-size: 0.85rem;
          font-weight: 750;
          text-decoration: none;
        }

        .tuveloz-launch-pause-actions a:first-child {
          border-color: #ff6a00;
          background: #ff6a00;
          color: #07182d;
        }

        @media (max-width: 760px) {
          .tuveloz-launch-pause {
            align-items: stretch;
            flex-direction: column;
            gap: 0.75rem;
            padding-top: 0.6rem;
            padding-bottom: 0.6rem;
          }

          .tuveloz-launch-pause-toggle {
            display: inline-flex;
          }

          .tuveloz-launch-pause:not(.expanded) .tuveloz-launch-pause-copy span,
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
          <span id="tuveloz-launch-pause-details">{LAUNCH_BANNER_MESSAGE}</span>
          <span>{signedIn ? SIGNED_IN_BANNER_DETAIL : LAUNCH_BANNER_DETAIL}</span>
        </div>
        {!pageHasItsOwnCta && (
          <nav aria-label="Available Tuveloz account options" className="tuveloz-launch-pause-actions">
            {signedIn ? (
              <Link href={accountHref}>
                {state === "provider" ? "Go to your provider workspace" : "Go to your account"}
              </Link>
            ) : (
              <Link href="/account?role=customer&mode=create">Save my spot — free</Link>
            )}
          </nav>
        )}
      </aside>
    </>
  );
}
