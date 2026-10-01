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
  // Spanish mirrors serve full HTML, not vinext's client-navigation .rsc paths.
  const PolicyLink = spanish ? "a" : Link;
  return (
    <main className="policy-shell" data-manual-language={translated ? true : undefined} lang={spanish ? "es" : "en"}>
      <header className="policy-header">
        <PolicyLink className="brand" href={spanish ? "/es" : "/"} aria-label={spanish ? "Inicio de Tuveloz" : "Tuveloz home"}>
          <BrandMark />
          <span>Tuveloz</span>
        </PolicyLink>
        <div className="policy-header-actions">
          <SiteLanguageButton />
          <PolicyLink className="account-home-link" href={spanish ? "/es" : "/"}>{spanish ? "Inicio" : "Home"}</PolicyLink>
        </div>
      </header>

      <article className="policy-page">
        <div className="policy-intro">
          <span>{spanish ? ({ Legal: "Legal", Customers: "Clientes", Providers: "Proveedores", Privacy: "Privacidad", Money: "Pagos", "Providers • Operational review draft v0.11": "Proveedores • Borrador para revisión operativa v0.11" }[eyebrow] ?? eyebrow) : eyebrow}</span>
          <h1>{copy?.title ?? title}</h1>
          <p>{copy?.summary ?? summary}</p>
          <small>{spanish ? "Última actualización: " : "Last updated "}{copy?.updated ?? updated}</small>
        </div>
        <nav className="policy-links" aria-label={spanish ? "Políticas de Tuveloz" : "Tuveloz policies"}>
          <PolicyLink href={policyHref("/terms")}>{spanish ? "Términos" : "Terms"}</PolicyLink>
          <PolicyLink href={policyHref("/customer-agreement")}>{spanish ? "Clientes" : "Customers"}</PolicyLink>
          <PolicyLink href={policyHref("/provider-agreement")}>{spanish ? "Proveedores" : "Providers"}</PolicyLink>
          <PolicyLink href={policyHref("/privacy")}>{spanish ? "Privacidad" : "Privacy"}</PolicyLink>
          <PolicyLink href={policyHref("/payments")}>{spanish ? "Pagos" : "Payments"}</PolicyLink>
        </nav>
        {copy ? <div className="policy-content" data-spanish-policy dangerouslySetInnerHTML={{ __html: copy.html }} /> : <div className="policy-content">{children}</div>}
        <footer className="policy-contact">
          <strong>{spanish ? "¿Tiene preguntas?" : "Questions?"}</strong>
          <PolicyLink href={spanish ? "/es/ai" : "/ai"}>{spanish ? "Reciba ayuda con esta página" : "Get help with this page"}</PolicyLink>
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>
        </footer>
      </article>
    </main>
  );
}
