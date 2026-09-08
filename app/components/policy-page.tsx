"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SiteLanguageButton, useSiteLanguage } from "./site-language";
import { spanishPolicyForTitle } from "../../lib/policy-spanish";
import { BrandMark } from "./tuveloz-icons";

type PolicyPageProps = {
  children: ReactNode;
  eyebrow: string;
  summary: string;
  title: string;
  updated: string;
};

export function PolicyPage({
  children,
  eyebrow,
  summary,
  title,
  updated,
}: PolicyPageProps) {
  const { language } = useSiteLanguage();
  const translated = spanishPolicyForTitle(title);
  const spanish = language === "es" && Boolean(translated);
  const copy = spanish ? translated : undefined;
  const policyHref = (path: string) => spanish ? `/es${path}` : path;
  return (
    <main className="policy-shell" data-manual-language={translated ? true : undefined} lang={spanish ? "es" : "en"}>
      <header className="policy-header">
        <Link className="brand" href={spanish ? "/es" : "/"} aria-label={spanish ? "Inicio de Tuveloz" : "Tuveloz home"}>
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="policy-header-actions">
          <SiteLanguageButton />
          <Link className="account-home-link" href={spanish ? "/es" : "/"}>{spanish ? "Inicio" : "Home"}</Link>
        </div>
      </header>

      <article className="policy-page">
        <div className="policy-intro">
          <span>{spanish ? ({ Legal: "Legal", Providers: "Proveedores", Privacy: "Privacidad", Money: "Pagos", "Providers • Operational review draft v0.11": "Proveedores • Borrador para revisión operativa v0.11" }[eyebrow] ?? eyebrow) : eyebrow}</span>
          <h1>{copy?.title ?? title}</h1>
          <p>{copy?.summary ?? summary}</p>
          <small>{spanish ? "Última actualización: " : "Last updated "}{copy?.updated ?? updated}</small>
        </div>
        <nav className="policy-links" aria-label={spanish ? "Políticas de Tuveloz" : "Tuveloz policies"}>
          <Link href={policyHref("/terms")}>{spanish ? "Términos" : "Terms"}</Link>
          <Link href="/customer-agreement">{spanish ? "Clientes (en inglés)" : "Customers"}</Link>
          <Link href={policyHref("/provider-agreement")}>{spanish ? "Proveedores" : "Providers"}</Link>
          <Link href={policyHref("/privacy")}>{spanish ? "Privacidad" : "Privacy"}</Link>
          <Link href={policyHref("/payments")}>{spanish ? "Pagos" : "Payments"}</Link>
        </nav>
        {copy ? <div className="policy-content" data-spanish-policy dangerouslySetInnerHTML={{ __html: copy.html }} /> : <div className="policy-content">{children}</div>}
        <footer className="policy-contact">
          <strong>{spanish ? "¿Tiene preguntas?" : "Questions?"}</strong>
          <Link href={spanish ? "/es/ai" : "/ai"}>{spanish ? "Reciba ayuda con esta página" : "Get help with this page"}</Link>
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>
        </footer>
      </article>
    </main>
  );
}
