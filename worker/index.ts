/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { flushPendingEmailNotifications } from "../lib/email-notifications";
import { processDueLaunchUpdates } from "../lib/launch-update-delivery";
import { isVerifiedOwnerRequest } from "../lib/owner-auth";
import { processDueProviderReminders } from "../lib/request-reminders";
import { processDueAppointmentReminders } from "../lib/appointment-reminders";
import { processDueComplianceReminders } from "../lib/compliance-reminder-delivery";
import { cleanupProviderApplicationVerificationState } from "../lib/provider-application-verification";
import { processPendingCloudmersiveEvidenceScans } from "../lib/cloudmersive-evidence-scanner";
import { processPendingMessageImageScans } from "../lib/message-image-scanner";
import { cleanupSupersededStripeIdentitySessions } from "../lib/stripe-identity-verification";
import { englishPageAlternates, spanishPageResponse } from "./spanish-page";

interface Env {
  APP_ENVIRONMENT?: string;
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const PRIVATE_PATH_PREFIXES = [
  "/account",
  "/admin",
  "/customer",
  "/job-authorizations",
  "/job-evidence",
  "/my-request",
  "/privacy-center",
  "/provider-jobs",
  "/repair-records",
  "/success",
  "/api/",
];

// ai.tuveloz.com points at this same Worker. Landing on its root drops you
// straight into the assistant; every other path is served normally so the
// links the assistant hands out (/payments, /faq, ...) keep working on the
// host the visitor is already on.
const AI_HOSTNAMES = new Set(["ai.tuveloz.com"]);

function aiHostRedirect(requestUrl: URL) {
  if (!AI_HOSTNAMES.has(requestUrl.hostname.toLowerCase())) return null;
  if (requestUrl.pathname !== "/") return null;
  const target = new URL(requestUrl);
  target.pathname = "/ai";
  // Deliberately temporary: a permanent redirect would be cached in browsers
  // long after any decision to use this host differently.
  return Response.redirect(target.toString(), 302);
}

function isStagingRequest(requestUrl: URL, env: Env) {
  const configuredEnvironment = env.APP_ENVIRONMENT?.trim().toLowerCase();
  const hostname = requestUrl.hostname.toLowerCase();
  return configuredEnvironment === "staging"
    || hostname === "staging.tuveloz.com"
    || (hostname.endsWith(".workers.dev") && hostname.includes("tuveloz-staging"));
}

function securedResponse(response: Response, requestUrl: URL, staging = false) {
  const secured = new Response(response.body, response);
  secured.headers.set("Content-Security-Policy", [
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com",
    "upgrade-insecure-requests",
  ].join("; "));
  secured.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("X-Frame-Options", "DENY");
  if (staging) {
    secured.headers.set("Cache-Control", "private, no-store");
    secured.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    secured.headers.set("X-Tuveloz-Environment", "staging");
  }
  if (requestUrl.protocol === "https:") {
    secured.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000",
    );
  }
  if (PRIVATE_PATH_PREFIXES.some((prefix) => requestUrl.pathname.startsWith(prefix))) {
    secured.headers.set("Cache-Control", "private, no-store");
  }
  return secured;
}

function stagingAccessDenied(acceptsHtml: boolean) {
  if (!acceptsHtml) {
    return Response.json(
      { error: "Tuveloz staging requires signed owner verification." },
      { status: 403, headers: { "cache-control": "private, no-store" } },
    );
  }

  return new Response(
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\"><title>Tuveloz Staging Locked</title></head><body style=\"margin:0;background:#07182d;color:#fff;font-family:system-ui;padding:3rem\"><main style=\"max-width:42rem;margin:auto;background:#111;border:1px solid #ff6a00;border-radius:1rem;padding:1.5rem\"><strong style=\"color:#ff8b3d\">OWNER ACCESS REQUIRED</strong><h1>Tuveloz staging is locked</h1><p>Cloudflare Access must verify the Tuveloz owner before this testing environment can be opened.</p></main></body></html>",
    {
      status: 403,
      headers: {
        "cache-control": "private, no-store",
        "content-type": "text/html; charset=utf-8",
      },
    },
  );
}

const worker = {
  async scheduled(
    _controller: ScheduledController,
    _env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const scheduledTask = (label: string, task: () => Promise<unknown>) => (
      task().catch((error) => {
        console.error(`Unable to run scheduled ${label}`, error);
      })
    );
    ctx.waitUntil(Promise.allSettled([
      scheduledTask("compliance reminders", () => processDueComplianceReminders()),
      scheduledTask("appointment reminders", () => processDueAppointmentReminders()),
      scheduledTask("provider application verification cleanup", () => (
        cleanupProviderApplicationVerificationState()
      )),
      scheduledTask("superseded Stripe Identity session cleanup", () => (
        cleanupSupersededStripeIdentitySessions(5)
      )),
      // Queue due launch updates before the flush, so a step that comes due
      // this tick goes out on this tick rather than waiting fifteen minutes.
      scheduledTask("launch update sequence", () => processDueLaunchUpdates(50)),
      scheduledTask("email notification delivery", () => flushPendingEmailNotifications(20)),
      scheduledTask("quarantined provider evidence scans", () => (
        processPendingCloudmersiveEvidenceScans()
      )),
      scheduledTask("pending message image scans", () => processPendingMessageImageScans()),
    ]).then(() => undefined));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    request = new Request(request);
    request.headers.delete("x-tuveloz-render-language");
    request.headers.delete("x-tuveloz-render-path");
    const url = new URL(request.url);

    // Keep one public origin. Cloudflare's custom-domain Worker can receive
    // direct HTTP requests, so enforce HTTPS here instead of relying on a
    // dashboard setting that could be changed independently of the site.
    if (url.protocol === "http:" && url.hostname.toLowerCase() === "tuveloz.com") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 308);
    }

    const acceptsHtml = request.headers.get("accept")?.includes("text/html") === true;
    const staging = isStagingRequest(url, env);

    // Staging is deny-by-default at the application layer. Even if a DNS or
    // Cloudflare Access rule is misconfigured, no staging page or API is served
    // unless the signed owner token is valid.
    if (staging && !(await isVerifiedOwnerRequest(request))) {
      return securedResponse(stagingAccessDenied(acceptsHtml), url, true);
    }

    const aiRedirect = aiHostRedirect(url);
    if (aiRedirect) return securedResponse(aiRedirect, url, staging);

    if (!staging && request.method === "GET" && acceptsHtml && env.DB) {
      ctx.waitUntil(
        processDueProviderReminders().catch((error) => {
          console.error("Unable to process provider reminders", error);
        }),
      );
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return securedResponse(response, url, staging);
    }

    // The crawlable Spanish twin. Renders the English page and translates it on
    // the way out, so /es/join is a Spanish document rather than an English one
    // that becomes Spanish after a script runs. Only reviewed paths have a twin;
    // anything else under /es is a 404 rather than an untranslated page wearing
    // a Spanish URL.
    // Crawlers can send */* or no Accept header. The Spanish handler itself
    // checks reviewed paths and the returned content type before translating.
    if (request.method === "GET" || request.method === "HEAD") {
      const spanish = await spanishPageResponse(url, request, (englishRequest) =>
        handler.fetch(englishRequest, env, ctx));
      if (spanish) return securedResponse(spanish, url, staging);
    }

    const response = await handler.fetch(request, env, ctx);

    // Database triggers can queue customer emails while an API action is being
    // handled (for example: on my way, arrived, and completed). Flush after the
    // route finishes so the newly queued event is attempted immediately. The
    // separate staging Worker never runs this background delivery path.
    if (!staging && env.DB && (request.method !== "GET" || acceptsHtml)) {
      ctx.waitUntil(
        flushPendingEmailNotifications(10).catch((error) => {
          console.error("Unable to flush queued Tuveloz emails", error);
        }),
      );
    }

    const pageResponse = request.method === "GET" || request.method === "HEAD"
      ? englishPageAlternates(url, response)
      : response;
    return securedResponse(pageResponse, url, staging);
  },
};

export default worker;
