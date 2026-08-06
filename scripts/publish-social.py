#!/usr/bin/env python3
"""Publish a Tuveloz reel to Instagram and/or a Facebook Page via the Meta Graph API.

    python3 scripts/publish-social.py --post ad-01 --dry-run
    python3 scripts/publish-social.py --post ad-01 --targets ig,fb

Why this exists: there is no Instagram/TikTok/Facebook MCP connector, so posting
has to go through Meta's own API. This does that end to end - no browser, no
copy-paste.

--------------------------------------------------------------------------------
WHAT YOU NEED ONCE (about 15 minutes, all on Meta's side)
--------------------------------------------------------------------------------
1. Instagram account switched to Business or Creator, and linked to the Tuveloz
   Facebook Page. Personal IG accounts cannot publish through the API at all.
2. A Meta app at developers.facebook.com with the Instagram Graph API product.
3. A Page access token with these scopes:
       instagram_basic, instagram_content_publish,
       pages_show_list, pages_read_engagement, pages_manage_posts
   Generate in Graph API Explorer, then exchange for a long-lived token
   (60 days) - the short-lived one expires in about an hour.
4. Your IG Business account ID and Facebook Page ID:
       GET /me/accounts                       -> Page ID
       GET /{page-id}?fields=instagram_business_account  -> IG user ID

Then set these, ideally in .dev.vars or your shell profile - never commit them:

    export META_ACCESS_TOKEN="EAA..."
    export IG_USER_ID="1784..."
    export FB_PAGE_ID="1015..."

--------------------------------------------------------------------------------
THE VIDEO HAS TO BE AT A PUBLIC URL - already handled
--------------------------------------------------------------------------------
Meta's API does not accept file uploads for Reels - it fetches the media from a
URL you give it, so each MP4 has to be publicly reachable over HTTPS first.

The ads are already staged in `public/media/`, which the site serves as static
assets. Merge to main, let the deploy workflow run, and they are live at
https://tuveloz.com/media/<file> - which is what MEDIA_BASE_URL defaults to.
Nothing else to set up.

Do NOT make the `tuveloz-uploads` R2 bucket public as an alternative. That
bucket holds customer uploads.

Delete `public/media/` once the posts are live - Meta copies the file at publish
time, so the URL only needs to be up during the API call.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

GRAPH = "https://graph.facebook.com/v21.0"
ROOT = Path(__file__).resolve().parents[1]

# Each post: the rendered file, and the ready-to-publish caption for each
# platform. Captions live in brand/ so the marketing kit stays the single source
# of truth, and each carries exactly five hashtags (Instagram's cap since Dec 2025).
CAPS = "brand/outreach/media/captions"
POSTS: dict[str, dict[str, str]] = {
    "ad-01": {
        "file": "brand/ads/ad-01-9x16.mp4",
        "caption": f"{CAPS}/ad-01-ig.txt",
        "note": "Provider recruitment. Captions burned in. Epidemic music - publish before Aug 9.",
    },
    "reel-deadbattery": {
        "file": "brand/outreach/media/tuveloz-reel-deadbattery-v2.mp4",
        "caption": f"{CAPS}/reel-deadbattery-ig.txt",
        "note": "Needs on-screen text added in the app editor before posting.",
    },
    "ad-03": {
        "file": "brand/ads/ad-03-9x16.mp4",
        "caption": f"{CAPS}/ad-03-ig-en.txt",
        "note": "Price transparency, 43s. Silent - add a trending sound if posting manually.",
    },
    "ad-03-es": {
        "file": "brand/ads/ad-03-9x16.mp4",
        "caption": f"{CAPS}/ad-03-ig-es.txt",
        "note": "Spanish price transparency. Post as its own reel, not a re-caption.",
    },
    "ad-03-short": {
        "file": "brand/ads/ad-03-short-9x16.mp4",
        "caption": f"{CAPS}/ad-03-tiktok-en.txt",
        "note": "TikTok cut, 14s. TikTok has no API path here - this is for IG/FB reuse.",
    },
}


def api(path: str, params: dict, method: str = "GET") -> dict:
    token = os.environ["META_ACCESS_TOKEN"]
    params = {**params, "access_token": token}
    if method == "GET":
        url = f"{GRAPH}/{path}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url)
    else:
        req = urllib.request.Request(
            f"{GRAPH}/{path}",
            data=urllib.parse.urlencode(params).encode(),
            method="POST",
        )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        # Meta puts the actionable part in error.message; surface it rather than
        # a bare 400, which tells you nothing about which scope is missing.
        try:
            msg = json.loads(body)["error"]["message"]
        except Exception:
            msg = body
        sys.exit(f"Graph API {exc.code} on {method} /{path}:\n  {msg}")
    except urllib.error.URLError as exc:
        sys.exit(
            f"Cannot reach {GRAPH} ({exc.reason}).\n"
            "If you are running this inside a Claude Code web session, the "
            "environment's network policy is blocking graph.facebook.com - "
            "widen it in the environment settings, or run this script locally."
        )


def publish_instagram(video_url: str, caption: str) -> str:
    """Create a Reels container, wait for Meta to ingest it, then publish."""
    ig_user = os.environ["IG_USER_ID"]
    print("  creating media container...")
    container = api(
        f"{ig_user}/media",
        {"media_type": "REELS", "video_url": video_url, "caption": caption},
        method="POST",
    )["id"]

    # Meta downloads and transcodes asynchronously. Publishing before it reports
    # FINISHED fails, so poll - a 45s reel typically lands inside a minute.
    print("  waiting for Meta to ingest the video", end="", flush=True)
    for _ in range(60):
        time.sleep(5)
        status = api(container, {"fields": "status_code,status"})
        code = status.get("status_code")
        if code == "FINISHED":
            print(" done")
            break
        if code == "ERROR":
            sys.exit(f"\nMeta rejected the video: {status.get('status')}")
        print(".", end="", flush=True)
    else:
        sys.exit("\nTimed out waiting for Meta to process the video.")

    print("  publishing...")
    return api(f"{ig_user}/media_publish", {"creation_id": container}, method="POST")["id"]


def publish_facebook(video_url: str, caption: str) -> str:
    page = os.environ["FB_PAGE_ID"]
    print("  posting to Page...")
    return api(f"{page}/videos", {"file_url": video_url, "description": caption}, method="POST")["id"]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--post", required=True, choices=sorted(POSTS), help="which post to publish")
    ap.add_argument("--targets", default="ig,fb", help="comma-separated: ig, fb")
    ap.add_argument("--caption-file", help="read the caption from this file instead of stdin")
    ap.add_argument("--media-url", help="override the public media URL")
    ap.add_argument("--dry-run", action="store_true", help="validate everything, publish nothing")
    args = ap.parse_args()

    post = POSTS[args.post]
    media = ROOT / post["file"]
    if not media.exists():
        sys.exit(f"Missing video: {media}\nRun the build script for this ad first.")

    base = os.environ.get("MEDIA_BASE_URL", "https://tuveloz.com/media").rstrip("/")
    url = args.media_url or f"{base}/{media.name}"
    if not url.startswith("https://"):
        sys.exit(f"MEDIA_BASE_URL must be an https:// origin; got {url!r}")

    # Default to the post's own caption file; --caption-file overrides for
    # one-offs. Deliberately no implicit stdin read - it blocks forever wherever
    # stdin is not a terminal (CI, cron, a non-interactive shell).
    caption_path = Path(args.caption_file) if args.caption_file else ROOT / post["caption"]
    if not caption_path.exists():
        sys.exit(f"Missing caption file: {caption_path}")
    caption = caption_path.read_text().strip()

    tags = caption.count("#")
    if tags > 5:
        sys.exit(
            f"{tags} hashtags in the caption. Instagram caps posts at five and stops\n"
            "surfacing over-capped posts in Explore, hashtag browse, and Reels\n"
            f"recommendations. Trim it, or use the ready sets in {CAPS}/."
        )

    targets = [t.strip() for t in args.targets.split(",") if t.strip()]
    print(f"\n{args.post}: {media.name}  ({media.stat().st_size / 1e6:.1f} MB)")
    print(f"note:    {post['note']}")
    print(f"url:     {url}")
    print(f"targets: {', '.join(targets)}")
    print(f"caption: {len(caption)} chars, {tags} hashtags — {caption.splitlines()[0][:60]}...")

    if args.dry_run:
        print("\nDry run. Nothing published.")
        missing = [v for v in ("META_ACCESS_TOKEN", "IG_USER_ID", "FB_PAGE_ID") if not os.environ.get(v)]
        print("Missing env vars: " + (", ".join(missing) if missing else "none - ready to publish."))
        return

    for var in ("META_ACCESS_TOKEN",) + (("IG_USER_ID",) if "ig" in targets else ()) \
            + (("FB_PAGE_ID",) if "fb" in targets else ()):
        if not os.environ.get(var):
            sys.exit(f"{var} is not set. See the header of this file for how to get it.")

    if "ig" in targets:
        print("\nInstagram:")
        print(f"  published: https://www.instagram.com/reel/{publish_instagram(url, caption)}")
    if "fb" in targets:
        print("\nFacebook:")
        print(f"  published: post id {publish_facebook(url, caption)}")

    print("\nDone. Turn the AI-content label on in the app if the post needs one -")
    print("the API does not expose that flag, and our honesty rules require it.")


if __name__ == "__main__":
    main()
