import { writeFile } from "node:fs/promises";
import process from "node:process";

const outputPath = process.argv[2] || ".wrangler-staging.generated.json";

function required(name) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`${name} is required to generate the staging configuration.`);
  return value;
}

const databaseId = required("STAGING_D1_DATABASE_ID");
const bucketName = required("STAGING_R2_BUCKET_NAME");
const ownerEmail = required("STAGING_OWNER_EMAIL").toLowerCase();
const ownerAccessAudience = required("STAGING_OWNER_ACCESS_AUD");
const teamDomain = required("STAGING_TEAM_DOMAIN").replace(/\/+$/, "");

if (!/^[0-9a-f-]{36}$/i.test(databaseId)) {
  throw new Error("STAGING_D1_DATABASE_ID must be a Cloudflare D1 database UUID.");
}
if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucketName)) {
  throw new Error("STAGING_R2_BUCKET_NAME must be a valid lowercase R2 bucket name.");
}
if (!ownerEmail.includes("@")) {
  throw new Error("STAGING_OWNER_EMAIL must be an email address.");
}
if (!teamDomain.startsWith("https://") || !teamDomain.endsWith(".cloudflareaccess.com")) {
  throw new Error("STAGING_TEAM_DOMAIN must be an https://*.cloudflareaccess.com origin.");
}

const config = {
  $schema: "node_modules/wrangler/config-schema.json",
  name: "tuveloz-staging",
  compatibility_date: "2026-07-27",
  compatibility_flags: ["nodejs_compat"],
  main: "./worker/index.ts",
  workers_dev: false,
  routes: [
    {
      pattern: "staging.tuveloz.com",
      custom_domain: true,
    },
  ],
  assets: {
    directory: "dist/client",
    not_found_handling: "none",
    binding: "ASSETS",
  },
  images: {
    binding: "IMAGES",
  },
  d1_databases: [
    {
      binding: "DB",
      database_name: "tuveloz-staging-db",
      database_id: databaseId,
      migrations_dir: "drizzle",
    },
  ],
  r2_buckets: [
    {
      binding: "BUCKET",
      bucket_name: bucketName,
    },
  ],
  vars: {
    APP_ENVIRONMENT: "staging",
    AUTH_EMAIL_HEADER: "cf-access-authenticated-user-email",
    EVIDENCE_SCAN_PROVIDER: "unconfigured",
    IDENTITY_VERIFICATION_PROVIDERS: "",
    OWNER_EMAIL: ownerEmail,
    OWNER_ACCESS_AUD: ownerAccessAudience,
    RESEND_FROM_EMAIL: "",
    SITE_URL: "https://staging.tuveloz.com",
    STRIPE_ALLOW_LIVE_MODE: "false",
    STRIPE_IDENTITY_ALLOW_LIVE_MODE: "false",
    TEAM_DOMAIN: teamDomain,
  },
};

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Generated isolated staging configuration at ${outputPath}.`);
