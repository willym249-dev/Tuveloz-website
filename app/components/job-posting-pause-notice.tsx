import Link from "next/link";
import {
  CUSTOMER_JOB_POSTING_PAUSED_DETAIL,
  CUSTOMER_JOB_POSTING_PAUSED_MESSAGE,
} from "../../lib/launch-status";

export function JobPostingPauseNotice() {
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

        .tuveloz-launch-pause-copy strong {
          color: #ff6a00;
          font-size: 0.78rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
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
          }

          .tuveloz-launch-pause-actions a {
            flex: 1 1 11rem;
            justify-content: center;
          }
        }
      `}</style>
      <aside
        aria-label="Tuveloz customer launch update"
        className="tuveloz-launch-pause"
        role="status"
      >
        <div className="tuveloz-launch-pause-copy">
          <strong>Customer launch update</strong>
          <span>{CUSTOMER_JOB_POSTING_PAUSED_MESSAGE}</span>
          <span>{CUSTOMER_JOB_POSTING_PAUSED_DETAIL}</span>
        </div>
        <nav aria-label="Available Tuveloz signup options" className="tuveloz-launch-pause-actions">
          <Link href="/account?role=customer&mode=create">Create customer account</Link>
          <Link href="/join">Join as a provider</Link>
        </nav>
      </aside>
    </>
  );
}
