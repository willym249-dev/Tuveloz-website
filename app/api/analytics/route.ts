const KNOWN_EVENTS = new Set([
  "provider_signup_started",
  "provider_step1_completed",
  "provider_step2_completed",
  "provider_step2_abandoned",
  "provider_signup_completed",
  "provider_first_quote_sent",
  "customer_request_started",
  "customer_request_posted",
  "quote_received",
  "quote_accepted",
  "job_completed",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const event = typeof body.event === "string" ? body.event : "";
    if (!KNOWN_EVENTS.has(event)) {
      return Response.json({ error: "Unknown event." }, { status: 400 });
    }
    // Structured console logging only today — no analytics tool is wired in
    // yet. This is intentionally schema-free; add persistence once a real
    // tool (Plausible, PostHog, GA4) is chosen.
    console.log("[analytics]", JSON.stringify({
      event,
      props: body.props ?? {},
      at: typeof body.at === "string" ? body.at : new Date().toISOString(),
    }));
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    console.error("Unable to record analytics event", error);
    return Response.json({ error: "Could not record event." }, { status: 400 });
  }
}
