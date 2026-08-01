/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { flushPendingEmailNotifications } from "../lib/email-notifications";
import { isVerifiedOwnerRequest } from "../lib/owner-auth";
import { processDueProviderReminders } from "../lib/request-reminders";
import { processDueComplianceReminders } from "../lib/compliance-reminder-delivery";

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
    ctx.waitUntil((async () => {
      await processDueComplianceReminders();
      await flushPendingEmailNotifications(20);
    })().catch((error) => {
      console.error("Unable to run TUVELOZ scheduled compliance delivery", error);
    }));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html") === true;
    const staging = isStagingRequest(url, env);

    // Staging is deny-by-default at the application layer. Even if a DNS or
    // Cloudflare Access rule is misconfigured, no staging page or API is served
    // unless the signed owner token is valid.
    if (staging && !(await isVerifiedOwnerRequest(request))) {
      return securedResponse(stagingAccessDenied(acceptsHtml), url, true);
    }

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

    return securedResponse(response, url, staging);
  },
};

export default worker;