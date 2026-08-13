/**
 * The email the /account sign-in form prefills. One shared key: /account
 * writes it when "remember me" is on, and a just-verified provider
 * application writes it so the sign-in that immediately follows starts with
 * the address already filled instead of asking the applicant to retype the
 * email they proved control of moments earlier.
 */
export const REMEMBERED_EMAIL_KEY = "tuveloz.remembered-email";

export function rememberEmailForSignIn(email: string) {
  const value = email.trim().toLowerCase();
  if (!value) return;
  try {
    window.localStorage.setItem(REMEMBERED_EMAIL_KEY, value);
  } catch {
    // Prefill is a convenience; blocked storage never breaks the flow.
  }
}
