"use client";

import { InterfaceCopy } from "./interface-copy";
import { SiteLink as Link } from "./site-link";

export function LaunchHelpNotice({ updatesHref }: { updatesHref: string }) {
  return (
    <InterfaceCopy><section className="launch-help-section" aria-labelledby="launch-help-heading">
      <div>
        <h2 id="launch-help-heading">Need help with your car today?</h2>
      </div>
      <div>
        <p>
          For service now, contact a local repair shop, mobile mechanic, or towing
          service directly. If you&apos;re unsure whether your car is safe to drive,
          have it checked before continuing your trip.
        </p>
        <Link className="text-link" href={updatesHref}>Get launch updates →</Link>
      </div>
    </section></InterfaceCopy>
  );
}
