import { env } from "cloudflare:workers";
import { isSameOriginRequest } from "../../../../lib/request-security";

// Montgomery County, Maryland bounding box. Suggestions are restricted to
// this rectangle so the autocomplete UX reinforces the same service-area
// limit that areaForZip already enforces server-side on submission.
const MONTGOMERY_COUNTY_MD_BOUNDS = {
  low: { latitude: 38.93, longitude: -77.53 },
  high: { latitude: 39.37, longitude: -76.87 },
};

type RuntimeEnv = Record<string, string | undefined>;

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const input = new URL(request.url).searchParams.get("input")?.trim().slice(0, 200) ?? "";
  if (input.length < 3) {
    return Response.json({ suggestions: [] }, { headers: { "cache-control": "no-store" } });
  }

  const apiKey = runtimeEnv().GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return Response.json({ suggestions: [] }, { headers: { "cache-control": "no-store" } });
  }

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ["us"],
        languageCode: "en",
        locationRestriction: {
          rectangle: MONTGOMERY_COUNTY_MD_BOUNDS,
        },
      }),
    });
    if (!response.ok) {
      console.error("Google Places autocomplete request failed", {
        status: response.status,
        responseBody: await response.text(),
      });
      return Response.json({ suggestions: [] }, { headers: { "cache-control": "no-store" } });
    }
    const payload = (await response.json()) as {
      suggestions?: Array<{ placePrediction?: { text?: { text?: string } } }>;
    };
    const suggestions = (payload.suggestions ?? [])
      .map((suggestion) => suggestion.placePrediction?.text?.text ?? "")
      .filter(Boolean)
      .slice(0, 5);
    return Response.json({ suggestions }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to reach Google Places autocomplete", error);
    return Response.json({ suggestions: [] }, { headers: { "cache-control": "no-store" } });
  }
}
