"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "../components/tuveloz-icons";

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
              ? "Use your provider workspace to complete onboarding, submit evidence, list services for review, set future pricing and availability, and manage your business profile. Customer jobs, quotes, appointments, payments, and payouts open only after launch approval."
              : "Your customer account is ready for account management now. After launch, you will be able to request service, compare independent providers and quotes, request appointments, and follow job updates; those customer actions and payments are not open yet."}
          </p>
        </div>
        <section className="account-card">
          {isProvider ? (
            <>
              <h2>Build your provider profile</h2>
              <p>
                Add the services you want reviewed, provider-set prices, availability, service area,
                and optional credentials. A credential that is legally required still needs
                Tuveloz&apos;s separate official verification before the related service is activated.
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
                Keep your account information together now. After customer launch,
                you will be able to request an enabled exact service, compare eligible
                independent providers, and choose whether to proceed.
              </p>
              <div className="legal-actions">
                <Link className="button primary" href="/post-job">View customer launch status</Link>
                <Link className="button secondary" href="/customer">Open customer workspace</Link>
              </div>
            </>
          )}
          <p>
            Tuveloz is an online marketplace. Independent providers—not Tuveloz—perform the vehicle services.
          </p>
        </section>
      </section>
    </main>
  );
}
