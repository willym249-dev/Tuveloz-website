import { env } from "cloudflare:workers";

const DEFAULT_AUTH_EMAIL_HEADER = "cf-access-authenticated-user-email";

function runtimeVariables() {
  return env as unknown as Record<string, string | undefined>;
}

export function getAuthenticatedEmail(request: Request): string {
  const headerName =
    runtimeVariables().AUTH_EMAIL_HEADER?.trim() || DEFAULT_AUTH_EMAIL_HEADER;
  return request.headers.get(headerName)?.trim().toLowerCase() ?? "";
}

export function isOwnerRequest(request: Request): boolean {
  const ownerEmail = runtimeVariables().OWNER_EMAIL?.trim().toLowerCase() ?? "";
  return Boolean(ownerEmail) && getAuthenticatedEmail(request) === ownerEmail;
}
