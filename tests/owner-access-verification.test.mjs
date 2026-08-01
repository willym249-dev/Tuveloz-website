import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("a forged Cloudflare email header alone cannot reveal owner access", async () => {
  const [route, ownerAuth] = await Promise.all([
    source("app/api/owner-access/route.ts"),
    source("lib/owner-auth.ts"),
  ]);

  assert.match(route, /await isVerifiedOwnerRequest\(request\)/);
  assert.doesNotMatch(route, /\bisOwnerRequest\(request\)/);
  assert.match(ownerAuth, /request\.headers\.get\("cf-access-jwt-assertion"\)/);
  assert.match(ownerAuth, /const access = accessTokenFrom\(request\)/);
  assert.match(ownerAuth, /if \(!access\.token \|\| !access\.source\) \{\s*return \{ ok: false, reason: "access-token-missing" \};/);
  assert.match(ownerAuth, /jwtVerify\(access\.token,[\s\S]*issuer: teamDomain,[\s\S]*audience/);
});

test("a forged Cloudflare email header alone cannot expose a private job image", async () => {
  const route = await source("app/api/job-images/route.ts");
  const get = route.slice(route.indexOf("export async function GET"));

  assert.match(route, /import \{ isVerifiedOwnerRequest \} from "\.\.\/\.\.\/\.\.\/lib\/owner-auth";/);
  assert.doesNotMatch(route, /\bisOwnerRequest\(request\)/);
  assert.match(get, /let allowed = Boolean\(token\) && token === job\.accessToken;/);
  assert.match(get, /session\?\.role === "customer"/);
  assert.match(get, /session\?\.role === "provider"/);
  assert.match(get, /if \(!allowed\) \{\s*allowed = await isVerifiedOwnerRequest\(request\);\s*\}/);
  assert.ok(
    get.indexOf("await isVerifiedOwnerRequest(request)")
      < get.indexOf('privateError("Private image access required.", 403)'),
  );
});
