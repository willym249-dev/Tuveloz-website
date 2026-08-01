import type {
  OwnerVerificationFailure,
  OwnerVerificationResult,
} from "./owner-auth";

export const OWNER_NO_STORE_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
  "content-type": "application/json; charset=utf-8",
} as const;

export type OwnerFailureCode =
  | "OWNER_ACCESS_CONFIGURATION_MISSING"
  | "OWNER_SESSION_REQUIRED"
  | "OWNER_SESSION_INVALID"
  | "OWNER_ACCOUNT_NOT_ALLOWED"
  | "OWNER_SCHEMA_MIGRATION_REQUIRED"
  | "OWNER_DATABASE_UNAVAILABLE"
  | "OWNER_DATA_TEMPORARILY_UNAVAILABLE";

export type OwnerFailureCategory =
  | "access"
  | "configuration"
  | "schema"
  | "database"
  | "temporary";

type OwnerFailure = {
  code: OwnerFailureCode;
  category: OwnerFailureCategory;
  error: string;
  retryable: boolean;
  reauthenticate: boolean;
};

function verificationFailure(reason: OwnerVerificationFailure): {
  status: number;
  body: OwnerFailure;
} {
  if (reason === "owner-config-missing") {
    return {
      status: 503,
      body: {
        code: "OWNER_ACCESS_CONFIGURATION_MISSING",
        category: "configuration",
        error: "Owner access is not fully configured on this deployment.",
        retryable: false,
        reauthenticate: false,
      },
    };
  }
  if (reason === "owner-email-mismatch") {
    return {
      status: 403,
      body: {
        code: "OWNER_ACCOUNT_NOT_ALLOWED",
        category: "access",
        error: "This Cloudflare Access account is not authorized for Owner Tools.",
        retryable: false,
        reauthenticate: true,
      },
    };
  }
  if (reason === "access-token-invalid") {
    return {
      status: 401,
      body: {
        code: "OWNER_SESSION_INVALID",
        category: "access",
        error: "The Owner Access session is invalid or expired.",
        retryable: false,
        reauthenticate: true,
      },
    };
  }
  return {
    status: 401,
    body: {
      code: "OWNER_SESSION_REQUIRED",
      category: "access",
      error: "A current Cloudflare Owner Access session is required.",
      retryable: false,
      reauthenticate: true,
    },
  };
}

export function ownerVerificationFailureResponse(
  verification: Extract<OwnerVerificationResult, { ok: false }>,
) {
  const failure = verificationFailure(verification.reason);
  return Response.json(failure.body, {
    status: failure.status,
    headers: OWNER_NO_STORE_HEADERS,
  });
}

function errorText(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

export function ownerDataFailureResponse(error: unknown, operation: string) {
  const details = errorText(error);
  console.error(`Owner dashboard ${operation} failed`, error);

  const schemaFailure = /no such table|no such column|has no column named|migration|schema/i.test(details);
  if (schemaFailure) {
    return Response.json(
      {
        code: "OWNER_SCHEMA_MIGRATION_REQUIRED",
        category: "schema",
        error: "The owner dashboard database needs the current application migration.",
        retryable: false,
        reauthenticate: false,
      } satisfies OwnerFailure,
      { status: 503, headers: OWNER_NO_STORE_HEADERS },
    );
  }

  const databaseFailure = /D1_ERROR|database|SQLITE|prepare|binding/i.test(details);
  if (databaseFailure) {
    return Response.json(
      {
        code: "OWNER_DATABASE_UNAVAILABLE",
        category: "database",
        error: "The owner dashboard database is temporarily unavailable.",
        retryable: true,
        reauthenticate: false,
      } satisfies OwnerFailure,
      { status: 503, headers: OWNER_NO_STORE_HEADERS },
    );
  }

  return Response.json(
    {
      code: "OWNER_DATA_TEMPORARILY_UNAVAILABLE",
      category: "temporary",
      error: "Owner data could not be loaded right now.",
      retryable: true,
      reauthenticate: false,
    } satisfies OwnerFailure,
    { status: 503, headers: OWNER_NO_STORE_HEADERS },
  );
}
