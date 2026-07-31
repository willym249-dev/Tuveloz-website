/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { flushPendingEmailNotifications } from "../lib/email-notifications";
import { processDueProviderReminders } from "../lib/request-reminders";

interface Env {
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
  "/appointments",
  "/customer",
  "/job-authorizations",
  "/job-evidence",
  "/my-request",
  "/notifications",
  "/privacy-center",
  "/provider-jobs",
  "/provider-service-area",
  "/provider-services",
  "/service-reminders",
  "/success",
  "/tracking",
  "/api/",
];

function securedResponse(response: Response, requestUrl: URL) {
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

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (request.method === "GET" && acceptsHtml && env.DB) {
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
      return securedResponse(response, url);
    }

    const response = await handler.fetch(request, env, ctx);

    // Database triggers can queue customer emails while an API action is being
    // handled (for example: on my way, arrived, and completed). Flush after the
    // route finishes so the newly queued event is attempted immediately.
    if (env.DB && (request.method !== "GET" || acceptsHtml)) {
      ctx.waitUntil(
        flushPendingEmailNotifications(10).catch((error) => {
          console.error("Unable to flush queued Tuveloz emails", error);
        }),
      );
    }

    return securedResponse(response, url);
  },
};

export default worker;
