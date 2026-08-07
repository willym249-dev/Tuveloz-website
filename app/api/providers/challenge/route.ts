import {
  InvalidJsonBodyError,
  readLimitedJsonObject,
  RequestBodyTooLargeError,
} from "../../../../lib/limited-json";
import {
  issueProviderApplicationChallenge,
  normalizeProviderApplicationPayload,
  PROVIDER_APPLICATION_CHALLENGE_MESSAGE,
  PROVIDER_APPLICATION_MAX_JSON_BYTES,
  ProviderApplicationValidationError,
} from "../../../../lib/provider-application-verification";
import { isStrictSameOriginWriteRequest } from "../../../../lib/request-security";

const NO_STORE_HEADERS = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  if (!isStrictSameOriginWriteRequest(request)) {
    return Response.json(
      {
        error: "This verification request must come from TUVELOZ.",
        errorEs: "Esta solicitud de verificación debe venir de TUVELOZ.",
      },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const body = await readLimitedJsonObject(
      request,
      PROVIDER_APPLICATION_MAX_JSON_BYTES,
    );
    const application = normalizeProviderApplicationPayload(body);
    const challenge = await issueProviderApplicationChallenge(application, request);
    return Response.json({
      ok: true,
      challengeId: challenge.challengeId,
      message: PROVIDER_APPLICATION_CHALLENGE_MESSAGE,
      expiresInSeconds: 600,
    }, { status: 202, headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        {
          error: "The provider application is too large.",
          errorEs: "La solicitud del proveedor es demasiado grande.",
        },
        { status: 413, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof InvalidJsonBodyError) {
      return Response.json(
        { error: error.message, errorEs: error.message },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof ProviderApplicationValidationError) {
      return Response.json(
        { error: error.message, errorEs: error.messageEs || error.message },
        { status: error.status, headers: NO_STORE_HEADERS },
      );
    }
    console.error("Unable to request provider application email verification", error);
    return Response.json(
      {
        error: "Verification email is temporarily unavailable. Please try again.",
        errorEs: "El correo de verificación no está disponible por el momento. Por favor intente de nuevo.",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
