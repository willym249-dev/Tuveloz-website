import { getDb } from "../../../db";
import { launchFeedback } from "../../../db/schema";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const audience = clean(body.audience, 30);
    const featureWanted = clean(body.featureWanted, 800);
    const problemToSolve = clean(body.problemToSolve, 800);
    const trustBuilder = clean(body.trustBuilder, 800);
    const email = clean(body.email, 180).toLowerCase();

    if (!["Customer", "Provider", "Both"].includes(audience)) {
      return Response.json({ error: "Tell us which group best describes you." }, { status: 400 });
    }
    if (!featureWanted || !problemToSolve || !trustBuilder) {
      return Response.json({ error: "Please complete all three feedback sections." }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email or leave it blank." }, { status: 400 });
    }

    await getDb().insert(launchFeedback).values({
      id: crypto.randomUUID(),
      audience,
      featureWanted,
      problemToSolve,
      trustBuilder,
      email,
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to save launch feedback", error);
    return Response.json(
      { error: "We could not save your feedback. Please try again." },
      { status: 500 },
    );
  }
}
