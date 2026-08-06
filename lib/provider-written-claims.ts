export type ProviderProfileClaims = {
  businessName: string;
  headline: string;
  about: string;
  yearsExperience: string;
  availabilityStatus: string;
  availabilityNote: string;
  businessHours: string;
  logoImageKey?: string;
};

export type ProviderProfileGalleryClaim = {
  id: string;
  caption: string;
  service: string;
  imageKey?: string;
};

type ProhibitedClaimRule = {
  label: string;
  pattern: RegExp;
};

// TUVELOZ polices only claims spoken in TUVELOZ's voice. A provider's own
// statements about its licenses, insurance, certifications, warranty, or
// hiring practices are the provider's commercial speech: the Marketplace
// Conduct Policy requires them to be true, owner content review checks every
// exact version before publication, and the public page labels them as
// provider-supplied rather than TUVELOZ-confirmed. What stays blocked here is
// copy that puts a claim in TUVELOZ's mouth — platform approval, verification,
// screening, or affiliation — plus badge-style status words with no named
// credential behind them and promises nobody can substantiate.
const PLATFORM_PATTERN = String.raw`(?:tuveloz|(?:this|the)\s+(?:platform|marketplace|app|site))`;
const ENDORSEMENT_PATTERN = String.raw`(?:approved|verified|vetted|certified|screened|endorsed|recommended|licensed|insured|guaranteed|background[-\s]?checked)`;

const PROHIBITED_PROVIDER_WRITTEN_CLAIMS: readonly ProhibitedClaimRule[] = [
  {
    label: "TUVELOZ approval or verification claim",
    pattern: new RegExp(String.raw`\b${PLATFORM_PATTERN}[\s-]+${ENDORSEMENT_PATTERN}\b`, "i"),
  },
  {
    label: "TUVELOZ approval or verification claim",
    pattern: new RegExp(String.raw`\b${ENDORSEMENT_PATTERN}\s+(?:by|through|via|with|on|for)\s+${PLATFORM_PATTERN}\b`, "i"),
  },
  {
    label: "TUVELOZ affiliation claim",
    pattern: new RegExp(String.raw`\b${PLATFORM_PATTERN}(?:['’]s)?\s+(?:employee|staff|team|partner|official|agent)\b`, "i"),
  },
  {
    label: "badge-style status wording (name the actual credential instead)",
    pattern: /\b(?:verified|vetted)\b/i,
  },
  {
    label: "absolute safety claim",
    pattern: /\b(?:completely|fully|100\s*%)\s+safe\b/i,
  },
] as const;

export function prohibitedProviderWrittenClaims(values: readonly string[]) {
  const claimsText = values.join("\n");
  return PROHIBITED_PROVIDER_WRITTEN_CLAIMS
    .filter((rule) => rule.pattern.test(claimsText))
    .map((rule) => rule.label);
}

export function prohibitedProviderProfileClaims(input: ProviderProfileClaims) {
  // A registered business name is retained as an identity fact. The provider's
  // descriptive and promotional fields are the fields screened as claims.
  return prohibitedProviderWrittenClaims([
    input.headline,
    input.about,
    input.yearsExperience,
    input.availabilityNote,
    input.businessHours,
  ]);
}
