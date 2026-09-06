"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "../components/tuveloz-icons";
import { FollowAlong } from "../components/social-links";

export default function WelcomePage() {
  const searchParams = useSearchParams();
  const role = searchParams.get("role") === "provider" ? "provider" : "customer";
  const isProvider = role === "provider";

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/"><BrandMark /><span>Tuveloz</span></Link>
      </header>
      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Account created</span>
          <h1>Thank you for joining Tuveloz.</h1>
          <p>
            {isProvider
              ? "Your provider account is ready. Start with the services you offer, then complete the application steps for those services. You can return to your account as you work through them. Customer bookings and payments are not open yet."
              : "Your customer account is ready. You can manage your details now. When bookings open, you'll be able to request service, compare quotes, and choose an independent provider. Customer bookings and payments are not open yet."}
          </p>
        </div>
        <section className="account-card">
          {isProvider ? (
            <>
              <h2>Build your provider profile</h2>
              <p>
                Choose the services you offer and add your prices, availability, and service area.
                We&apos;ll show you the documents needed for those services. Any required
                credentials must be verified before you can offer the related work.
              </p>
              <div className="legal-actions">
                <Link className="button primary" href="/provider-services">Add services and prices</Link>
                <Link className="button secondary" href="/provider-jobs">Open provider workspace</Link>
              </div>
            </>
          ) : (
            <>
              <h2>Start with your customer workspace</h2>
              <p>
                Open your account to review your details, or check our launch page
                to see what&apos;s available. Creating an account is free and
                does not book a service.
              </p>
              <div className="legal-actions">
                <Link className="button primary" href="/post-job">View customer launch status</Link>
                <Link className="button secondary" href="/customer">Open customer workspace</Link>
              </div>
            </>
          )}
          <p>
            Tuveloz is an online marketplace that connects customers with independent
            businesses. The provider you choose performs the vehicle service.
          </p>
        </section>
        <FollowAlong
          source={isProvider ? "welcome_provider" : "welcome_customer"}
          email={!isProvider}
        />
      </section>
    </main>
  );
}
