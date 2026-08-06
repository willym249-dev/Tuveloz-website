// Publish a rendered ad to a Facebook Page and/or an Instagram Business
// account via the Meta Graph API.
//
// This exists because posting cannot be automated from a Claude Code web
// session: `graph.facebook.com` is refused by the sandbox network policy.
// Run it from a machine with normal outbound access (e.g. Wil's PC).
//
//   node scripts/publish-ad.mjs --facebook --video brand/ads/ad-01-9x16.mp4 \
//     --caption-file brand/ads/ad-01-caption.txt
//
//   node scripts/publish-ad.mjs --instagram \
//     --video-url https://tuveloz.com/ad-01-9x16.mp4 \
//     --caption-file brand/ads/ad-01-caption.txt
//
// Required environment:
//   META_ACCESS_TOKEN   long-lived token with pages_manage_posts and,
//                       for Instagram, instagram_content_publish
//   META_PAGE_ID        numeric Facebook Page id       (--facebook only)
//   META_IG_USER_ID     Instagram Business account id  (--instagram only)
//
// Dry run first — it prints every request without sending anything:
//   node scripts/publish-ad.mjs --facebook --video ... --dry-run

import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";

const GRAPH = "https://graph.facebook.com/v21.0";

function parseArgs(argv) {
  const args = { facebook: false, instagram: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new Error(`${flag} needs a value`);
      }
      i += 1;
      return next;
    };
    if (flag === "--facebook") args.facebook = true;
    else if (flag === "--instagram") args.instagram = true;
    else if (flag === "--dry-run") args.dryRun = true;
    else if (flag === "--video") args.video = value();
    else if (flag === "--video-url") args.videoUrl = value();
    else if (flag === "--caption") args.caption = value();
    else if (flag === "--caption-file") args.captionFile = value();
    else throw new Error(`unknown flag: ${flag}`);
  }
  return args;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function resolveCaption(args) {
  if (args.caption) return args.caption;
  if (args.captionFile) return (await readFile(args.captionFile, "utf8")).trim();
  return "";
}

// Graph returns errors as 200-with-error-body often enough that checking
// response.ok alone silently swallows failures.
async function graph(url, init, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] ${init?.method ?? "GET"} ${url}`);
    return { id: "<dry-run>" };
  }
  const response = await fetch(url, init);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Graph returned non-JSON (${response.status}): ${text.slice(0, 400)}`);
  }
  if (body.error) {
    const { message, type, code, error_user_msg: userMessage } = body.error;
    throw new Error(`Graph error ${code} (${type}): ${userMessage ?? message}`);
  }
  if (!response.ok) {
    throw new Error(`Graph HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  return body;
}

// Facebook accepts the bytes directly, so the file never has to be public.
async function publishToFacebook({ video, caption, token, dryRun }) {
  const pageId = requireEnv("META_PAGE_ID");
  const info = await stat(video);
  console.log(`Facebook: uploading ${basename(video)} (${(info.size / 1e6).toFixed(1)} MB)`);

  const form = new FormData();
  form.append("access_token", token);
  form.append("description", caption);
  form.append("source", new Blob([await readFile(video)]), basename(video));

  const result = await graph(`${GRAPH}/${pageId}/videos`, { method: "POST", body: form }, dryRun);
  console.log(`Facebook: published, video id ${result.id}`);
  return result.id;
}

// Instagram will NOT accept raw bytes — the Content Publishing API only takes
// a publicly reachable HTTPS URL, so the mp4 has to be hosted somewhere first
// (e.g. dropped in public/ and deployed to tuveloz.com).
async function publishToInstagram({ videoUrl, caption, token, dryRun }) {
  const igUserId = requireEnv("META_IG_USER_ID");

  const createUrl = new URL(`${GRAPH}/${igUserId}/media`);
  createUrl.searchParams.set("media_type", "REELS");
  createUrl.searchParams.set("video_url", videoUrl);
  createUrl.searchParams.set("caption", caption);
  createUrl.searchParams.set("access_token", token);

  const container = await graph(createUrl.toString(), { method: "POST" }, dryRun);
  console.log(`Instagram: container ${container.id} created, waiting for transcode`);

  // Publishing before the container reports FINISHED fails, so poll.
  if (!dryRun) {
    const deadline = Date.now() + 5 * 60_000;
    for (;;) {
      const statusUrl = `${GRAPH}/${container.id}?fields=status_code,status&access_token=${token}`;
      const { status_code: code, status } = await graph(statusUrl, undefined, false);
      if (code === "FINISHED") break;
      if (code === "ERROR") throw new Error(`Instagram transcode failed: ${status ?? "no detail"}`);
      if (Date.now() > deadline) throw new Error("Instagram transcode timed out after 5 minutes");
      console.log(`Instagram: ${code}, checking again in 10s`);
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }

  const publishUrl = new URL(`${GRAPH}/${igUserId}/media_publish`);
  publishUrl.searchParams.set("creation_id", container.id);
  publishUrl.searchParams.set("access_token", token);
  const result = await graph(publishUrl.toString(), { method: "POST" }, dryRun);
  console.log(`Instagram: published, media id ${result.id}`);
  return result.id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.facebook && !args.instagram) {
    throw new Error("pick at least one of --facebook or --instagram");
  }
  if (args.facebook && !args.video) throw new Error("--facebook needs --video <path>");
  if (args.instagram && !args.videoUrl) {
    throw new Error("--instagram needs --video-url <public https url>; Instagram cannot take a local file");
  }

  const token = requireEnv("META_ACCESS_TOKEN");
  const caption = await resolveCaption(args);
  if (!caption) console.warn("warning: publishing with an empty caption");

  if (args.facebook) {
    await publishToFacebook({ video: args.video, caption, token, dryRun: args.dryRun });
  }
  if (args.instagram) {
    await publishToInstagram({ videoUrl: args.videoUrl, caption, token, dryRun: args.dryRun });
  }
}

main().catch((error) => {
  console.error(`publish-ad: ${error.message}`);
  process.exitCode = 1;
});
