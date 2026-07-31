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
              ? "Your provider workspace helps you receive matching requests, set your own services and prices, request appointments, and manage customer updates."
              : "Tuveloz helps you request vehicle work, compare independent providers and quotes, request appointments, and follow job updates in one place."}
          </p>
        </div>
        <section className="account-card">
          {isProvider ? (
            <>
              <h2>Build your provider presence</h2>
              <p>
                Add your approved services, provider-set prices, availability, service area,
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
                Post a vehicle-service request when customer job posting is available, compare
                independent-provider quotes, choose a provider, and follow appointments and job updates.
              </p>
              <div className="legal-actions">
                <Link className="button primary" href="/post-job">Post a vehicle-service request</Link>
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
