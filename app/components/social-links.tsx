import type { SVGProps } from "react";
import { track } from "../../lib/analytics";
import { LaunchUpdatesForm } from "./launch-updates-form";

type SocialPlatform = "facebook" | "instagram" | "x" | "tiktok" | "google";

const SOCIAL_LINKS: Array<{ platform: SocialPlatform; label: string; href: string }> = [
  { platform: "instagram", label: "Instagram", href: "https://www.instagram.com/tuveloz/" },
  { platform: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@tuveloz" },
  { platform: "facebook", label: "Facebook", href: "https://www.facebook.com/profile.php?id=61592855153188" },
  { platform: "x", label: "X", href: "https://x.com/TuvelozApp" },
  // Google Business Profile link pending — add here once available:
  // { platform: "google", label: "Google", href: "" },
];

function SocialIcon({ platform, ...props }: { platform: SocialPlatform } & SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" className="social-icon" fill="none" focusable="false" viewBox="0 0 24 24" {...props}>
      {platform === "instagram" && (
        <>
          <rect className="icon-stroke" x="3.6" y="3.6" width="16.8" height="16.8" rx="5" />
          <circle className="icon-stroke" cx="12" cy="12" r="4.2" />
          <circle cx="17.1" cy="6.9" r="1.2" />
        </>
      )}
      {platform === "tiktok" && (
        <path d="M13.5 3.2c.5 2.1 1.9 3.5 4.3 3.7v3c-1.6 0-3-.5-4.3-1.4v6.4a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v3.1a2.3 2.3 0 1 0 1.6 2.2V3.2h2.9Z" />
      )}
      {platform === "facebook" && (
        <path d="M14.5 21v-7.6h2.6l.4-3h-3v-1.9c0-.9.2-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8.5v3H11V21h3.5Z" />
      )}
      {platform === "x" && (
        <path d="M4.4 4.2h4.2l4 5.4 4.6-5.4H19l-6.4 7.4L19.4 19.8h-4.2l-4.3-5.8-5 5.8H3.6l6.8-7.9L4.4 4.2Z" />
      )}
      {platform === "google" && (
        <path d="M20.3 12.2c0-.7-.1-1.4-.2-2H12v3.8h4.7a4 4 0 0 1-1.7 2.6v2.2h2.8c1.6-1.5 2.5-3.7 2.5-6.6ZM12 20.6c2.3 0 4.2-.8 5.6-2.1l-2.8-2.2c-.8.5-1.7.8-2.8.8-2.2 0-4-1.5-4.6-3.4H4.4v2.3A8.6 8.6 0 0 0 12 20.6ZM7.4 13.7a5.2 5.2 0 0 1 0-3.4V8H4.4a8.6 8.6 0 0 0 0 7.7l3-2Z" />
      )}
    </svg>
  );
}

export function SocialLinks({ className = "", source }: { className?: string; source?: string }) {
  return (
    <div className={`footer-social ${className}`.trim()}>
      {SOCIAL_LINKS.map(({ platform, label, href }) => (
        <a
          key={platform}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Tuveloz on ${label}`}
          className="footer-social-link"
          // Only placements that pass a source are measured, so the footer
          // keeps its existing (untracked) behavior.
          onClick={source ? () => track("social_follow_clicked", { platform, source }) : undefined}
        >
          <SocialIcon platform={platform} />
        </a>
      ))}
    </div>
  );
}

/**
 * Follow prompt for the moments right after someone commits — a submitted
 * provider application or a created account. That is the highest intent a
 * visitor will ever have, and until now the only place we asked for the
 * follow was the site footer.
 *
 * Pre-launch honesty rules apply to the copy here (see
 * brand/outreach/audience-growth-playbook.md): never imply customer requests
 * are open, only that following is how you hear when they are.
 */
export function FollowAlong({
  source,
  spanish = false,
  tone = "shell",
  email = false,
}: {
  source: string;
  spanish?: boolean;
  /** "shell" = navy account pages, "panel" = warm dark form cards. */
  tone?: "shell" | "panel";
  /** Also offer the email list. Social is rented reach; the list is owned. */
  email?: boolean;
}) {
  return (
    <aside className={`follow-along follow-along-${tone}`}>
      <div className="follow-along-copy">
        <h3>{spanish ? "Síganos hasta el lanzamiento" : "Follow along until launch"}</h3>
        <p>
          {spanish
            ? "Publicamos novedades del lanzamiento y perfiles de proveedores. Es la forma más rápida de enterarse el día que se abran las solicitudes de clientes."
            : "We post launch updates and provider spotlights. It's the fastest way to hear the day customer requests open."}
        </p>
      </div>
      <SocialLinks source={source} />
      {email && (
        <div className="follow-along-email">
          <LaunchUpdatesForm source={source} spanish={spanish} />
        </div>
      )}
    </aside>
  );
}
