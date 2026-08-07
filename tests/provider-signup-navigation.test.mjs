import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/**
 * The provider application is the longest form on the site, and every one of
 * these guards exists because the form could otherwise strand someone
 * mid-application: a step that renders nothing, a filter that hides a checked
 * box, saved progress with no way to throw it away, or English copy at the one
 * moment a Spanish applicant has to act.
 */

test("the visible step is derived, so a stale draft can never render a blank step", async () => {
  const form = await read("app/components/provider-signup-form.tsx");

  // `step` may point at the requirements step for a service selection that no
  // longer triggers it. Rendering off `activeStep` collapses that to step 3
  // instead of showing a form body with no fields and no way forward.
  assert.match(form, /const activeStep: SignupStep = step === 2 && !showStep2 \? 3 : step;/);
  assert.match(form, /\{activeStep === 1 &&/);
  assert.match(form, /\{activeStep === 2 && showStep2 &&/);
  assert.match(form, /\{activeStep === 3 &&/);
  // No render branch may key off the raw step again.
  assert.doesNotMatch(form, /\{step === [123] &&/);
});

test("step changes move focus and scroll, but only when the applicant navigated", async () => {
  const form = await read("app/components/provider-signup-form.tsx");

  assert.match(form, /function moveToStep\(next: SignupStep\)/);
  assert.match(form, /stepScrollPending\.current = true;\s+setStep\(next\);/);
  // Restoring a draft sets the step directly and must not yank the page.
  assert.match(form, /if \(!stepScrollPending\.current\) return;/);
  assert.match(form, /heading\.scrollIntoView\(/);
  assert.match(form, /heading\.focus\(\{ preventScroll: true \}\)/);
});

test("the step indicator walks back to completed steps and never skips ahead", async () => {
  const form = await read("app/components/provider-signup-form.tsx");
  const css = await read("app/globals.css");

  assert.match(form, /function goBackToStep\(target: SignupStep\)/);
  // Forward jumps would skip the validation each Continue button runs.
  assert.match(form, /if \(target >= activeStep\) return;/);
  assert.match(form, /disabled=\{!isDone\}/);
  assert.match(form, /aria-current=\{isCurrent \? "step" : undefined\}/);
  // The indicator and the back/continue row were both rendering unstyled.
  assert.match(css, /^\.step-indicator \{/m);
  assert.match(css, /^\.form-nav \{/m);
});

test("the service filter never hides a service the applicant already checked", async () => {
  const form = await read("app/components/provider-signup-form.tsx");

  assert.match(form, /function serviceMatchesQuery\(/);
  assert.match(
    form,
    /if \(selectedProviderServices\.includes\(service\.code\)\) return true;/,
  );
  // A search opens the groups it matched, so results are not hidden behind a
  // collapsed accordion.
  assert.match(form, /open=\{selectedCount > 0 \|\| normalizedServiceQuery \? true : undefined\}/);
  assert.match(form, /visibleServiceCount === 0 &&/);
});

test("saved progress can be discarded, and the final step shows what was picked", async () => {
  const form = await read("app/components/provider-signup-form.tsx");

  assert.match(form, /function discardDraft\(\)/);
  assert.match(form, /clearSignupDraft\(\);\s+setDraftFields\(\{\}\);\s+setDraftRestored\(false\);/);
  assert.match(form, /Start over/);

  // The confirm dialog asks the applicant to check their answers, so the
  // services chosen two steps earlier have to be visible on the final step.
  assert.match(form, /className="signup-review-summary"/);
  assert.match(form, /Services you picked \(\$\{selectedServiceDetails\.length\}\)/);
});

test("the verification step speaks Spanish to a Spanish applicant", async () => {
  const form = await read("app/components/provider-signup-form.tsx");

  // These are the last controls before an application is submitted; an English
  // fallback here is where a Spanish applicant drops out.
  for (const spanish of [
    "Verificar correo y continuar",
    "Enviar el código otra vez",
    "Regresar y editar",
    "Código de verificación de 6 dígitos",
    "Escriba el código de 6 dígitos enviado al correo de la solicitud.",
  ]) {
    assert.ok(form.includes(spanish), `missing Spanish copy: ${spanish}`);
  }
  // The English side of each branch stays exactly as reviewed.
  assert.match(form, /Verify email and continue/);
  assert.match(form, /Send the code again/);
  assert.match(form, /Go back and edit/);
  // Retry copy is shared rather than hard-coded English in seven places.
  assert.match(form, /const retryMessage = providerFormIsSpanish/);
  assert.doesNotMatch(form, /\|\| "Please try again\."/);
});
