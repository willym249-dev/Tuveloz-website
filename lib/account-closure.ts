import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { accountClosures } from "../db/schema";

// Closure applies to the shared login, including provider privacy-session
// fallback. Recording/reopening a closure requires a separate reviewed flow.
export async function accountIsClosed(email: string) {
  const [closure] = await getDb().select({ email: accountClosures.email })
    .from(accountClosures).where(eq(accountClosures.email, email.trim().toLowerCase())).limit(1);
  return Boolean(closure);
}
