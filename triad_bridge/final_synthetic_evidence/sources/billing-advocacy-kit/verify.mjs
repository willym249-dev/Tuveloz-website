/**
 * Acceptance gate. Exit 0 is the only thing that authorises packing.
 *
 *   node verify.mjs
 *
 * Rebuilt after an audit found the previous version false-passing three ways:
 * it scanned only .md/.html/.mjs so a forbidden PDF could reappear unnoticed;
 * it treated any line containing a stray "not" or "never" as reviewed, which
 * is pattern-matching rather than review; and phrase sampling over PDFs was
 * reported as text equivalence when it was nothing of the kind.
 *
 * This version enumerates every entry type, requires an EXACT allowlist entry
 * naming file, pattern and reason for each permitted hit, and compares PDF
 * text to its HTML source with an extractor-stable flattened alphanumeric
 * edit distance, ordered heading anchors, ordered numeric literals and
 * spacing-insensitive policy anchors. Extractor-sensitive token gaps remain
 * visible as diagnostics but cannot decide the verdict.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, extname, basename, dirname, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// URL.pathname is not a Windows filesystem path: it leaves percent escapes in
// place and prefixes drive-letter paths with a slash. Always convert first.
const ROOT = dirname(fileURLToPath(import.meta.url));
const VERIFIER_PATH = fileURLToPath(import.meta.url);
const EXPECTED_FILES = [
  "MANIFEST.md", "README.md", "_style.css", "assistance-screen.mjs",
  "audit.mjs", "audit.test.mjs", "bill-audit-checklist.md", "brand.mjs",
  "build-vs-buy.md", "case-tracker.md", "claims-register.md",
  "client-report.html", "client-report.pdf", "de-identification.md",
  "finding-clients.md", "first-call.md", "fixtures/01_all_rules.json",
  "fixtures/02_clean_control.json", "fixtures/03_boundaries_nearmiss.json",
  "fixtures/04_multiple_and_ordering.json", "fixtures/05_invalid_shape.json",
  "fixtures/06_invalid_semantics.json", "handoff-brief.md",
  "intake-and-security.md", "letter-templates.md", "maryland-brief.md",
  "message-to-gpt.md", "ofr-email.md", "pilot-terms.html",
  "pilot-terms.pdf", "playbook.html", "referral-onepager.html",
  "referral-onepager.pdf", "site.html", "verify.mjs",
].sort();
const EXPECTED_TREE_PAYLOAD_SHA256 = "ac323e739daf41adb9f21adc0c98c0f64c91c5d0abefde135bad7fe32a5c363e";

/** Forms removed from distribution. Any reappearance, in any format, fails. */
const QUARANTINED = ["client-agreement", "appeal-representative", "hipaa-authorization"];

const BANNED = {
  "fee offer": /no win|contingenc|% of verified|capped percentage|success fee|we earn our fee|nothing unless it (works|drops)/i,
  "classification claim": /clearly outside|keeps (you|this|the work) outside|falls outside the act|not a debt settlement service/i,
  "prevalence": /most (hospital )?bills (have|contain)|most people (never|have never)|almost nobody|nobody (checks|tells)|plenty of people/i,
  "representation": /authorized representative|we represent\b|as your agent|on (your|their) behalf/i,
  "registration cost": /\$1,000|\$400 issuance|\$50,000 (surety )?bond|\$20[–-]50|\$250\b/i,
  "deadline overclaim": /cannot be repaired|ends the claim permanently|second and last bite|date on the (denial )?letter/i,
  "collection promise": /collections must (pause|stop)|hold billing and collection|stop the clock|collections need to stop/i,
  "privacy overclaim": /needs no BAA|no BAA is required|cannot be tied to a person|nothing identifying survives|makes the .{0,25}(question|BAA).{0,15}(moot|go away)|no monthly fee/i,
  "HEAU causal": /\$1,257|\$2\.6M|2,068 cases|20% contingency|roughly half of what reaches|we are the reason/i,
  "asserted finding": /what is wrong with it|the correct treatment is|billing errors\b|what was wrong/i,
  "stale form reference": /three forms|six client|records authorization|representative designation|service agreement|fee arithmetic/i,
  "insecure intake": /send us what you have|a photo is fine|email (me|us) (the|your) (bill|records)/i,
  "generic ambulance": /ambulance charges(?![^\n]*(ground|air))/i,
};

/**
 * Flattened equivalents catch extractor output that inserts spaces between
 * every glyph. They supplement the readable-text regexes above; counts are
 * compared with the vetted HTML source so an existing reviewed phrase is not
 * reclassified merely because punctuation disappeared during extraction.
 */
const BANNED_CANONICAL = {
  "fee offer": /nowin|contingenc|ofverified|cappedpercentage|successfee|weearnourfee|nothingunlessit(?:works|drops)/gi,
  "classification claim": /clearlyoutside|keeps(?:you|this|thework)outside|fallsoutsidetheact|notadebtsettlementservice/gi,
  prevalence: /most(?:hospital)?bills(?:have|contain)|mostpeople(?:never|havenever)|almostnobody|nobody(?:checks|tells)|plentyofpeople/gi,
  representation: /authorizedrepresentative|werepresent|asyouragent|onyourbehalf|ontheirbehalf/gi,
  "registration cost": /1000|400issuance|50000(?:surety)?bond|2050|250/gi,
  "deadline overclaim": /cannotberepaired|endstheclaimpermanently|secondandlastbite|dateonthe(?:denial)?letter/gi,
  "collection promise": /collectionsmust(?:pause|stop)|holdbillingandcollection|stoptheclock|collectionsneedtostop/gi,
  "privacy overclaim": /needsnobaa|nobaaisrequired|cannotbetiedtoaperson|nothingidentifyingsurvives|makesthe.{0,25}(?:question|baa).{0,15}(?:moot|goaway)|nomonthlyfee/gi,
  "HEAU causal": /1257|26m|2068cases|20contingency|roughlyhalfofwhatreaches|wearethereason/gi,
  "asserted finding": /whatiswrongwithit|thecorrecttreatmentis|billingerrors|whatwaswrong/gi,
  "stale form reference": /threeforms|sixclient|recordsauthorization|representativedesignation|serviceagreement|feearithmetic/gi,
  "insecure intake": /senduswhatyouhave|aphotoisfine|email(?:me|us)(?:the|your)(?:bill|records)/gi,
  "generic ambulance": /ambulancecharges/gi,
};

/**
 * Every permitted hit, named exactly. A hit not listed here fails the build —
 * there is no broad-negation escape hatch.
 */
const ALLOW_REASON_CATALOG = [
  ["claims-register.md", "registration cost", "records the withdrawn and the asserted figures side by side, both marked unverified"],
  ["claims-register.md", "representation", "verified-fact row: federal rules permit a non-lawyer representative"],
  ["claims-register.md", "collection promise", "records the federal PPDR description, explicitly barred from being told to a consumer"],
  ["claims-register.md", "fee offer", "records that no fee model is adopted"],
  ["claims-register.md", "HEAU causal", "records the figure being withdrawn"],
  ["claims-register.md", "classification claim", "records the retraction of the phrase"],
  ["claims-register.md", "prevalence", "records the removed headline claim"],
  ["MANIFEST.md", "registration cost", "historical record of what was withdrawn"],
  ["MANIFEST.md", "classification claim", "historical record of what was removed"],
  ["MANIFEST.md", "prevalence", "historical record of what was removed"],
  ["MANIFEST.md", "representation", "historical record of what was removed"],
  ["MANIFEST.md", "deadline overclaim", "historical record of what was removed"],
  ["MANIFEST.md", "stale form reference", "names the quarantined forms in order to say they are absent"],
  ["MANIFEST.md", "HEAU causal", "historical record of what was removed"],
  ["MANIFEST.md", "fee offer", "historical record of what was removed"],
  ["MANIFEST.md", "asserted finding", "historical record of what was removed"],
  ["MANIFEST.md", "privacy overclaim", "historical record of what was removed"],
  ["MANIFEST.md", "insecure intake", "historical record of what was removed"],
  ["README.md", "stale form reference", "instructs that the quarantined forms must not be used"],
  ["handoff-brief.md", "stale form reference", "instructs that the quarantined forms are quarantined"],
  ["message-to-gpt.md", "stale form reference", "instructs GPT that those forms are quarantined"],
  ["intake-and-security.md", "stale form reference", "instructs that only the pilot terms are sent"],
  ["first-call.md", "stale form reference", "instructs that nothing else exists to send"],
  ["letter-templates.md", "stale form reference", "instructs that nothing is attached"],
  ["pilot-terms.html", "fee offer", "the sentence establishing that no fee exists"],
  ["pilot-terms.html", "representation", "the sentence establishing that we do not act for anyone"],
  ["pilot-terms.html", "classification claim", "states the classification is unresolved"],
  ["site.html", "fee offer", "the sentence establishing that no fee exists"],
  ["referral-onepager.html", "fee offer", "the sentence establishing that no fee exists"],
  ["referral-onepager.html", "classification claim", "states the classification is unresolved"],
  ["maryland-brief.md", "classification claim", "explicitly denies that the structure places anything outside the Act"],
  ["maryland-brief.md", "registration cost", "records the withdrawn figure"],
  ["build-vs-buy.md", "privacy overclaim", "states what owning hardware does not settle"],
  ["build-vs-buy.md", "registration cost", "records the withdrawn cost estimate"],
  ["de-identification.md", "privacy overclaim", "states that identifiability is reduced, not eliminated"],
  ["case-tracker.md", "collection promise", "instructs that no collection protection may be promised"],
  ["ofr-email.md", "fee offer", "describes the pilot as charging nothing, and defers fee questions"],
  ["ofr-email.md", "registration cost", "instructs that no figure be stated to the regulator"],
  ["bill-audit-checklist.md", "collection promise", "instructs that collections protection must not be promised"],
  ["claims-register.md", "deadline overclaim", "records the audit's correction of the deadline rule, quoting the removed phrasing"],
  ["handoff-brief.md", "classification claim", "states that no service is classified as outside the Act, and retracts the earlier claim"],
  ["handoff-brief.md", "fee offer", "records that earlier drafts modelled a contingency that no longer exists"],
  ["handoff-brief.md", "HEAU causal", "records the withdrawn contingency figure"],
  ["maryland-brief.md", "fee offer", "records the quarantined fee agreement and the withdrawn pricing reasoning"],
  ["maryland-brief.md", "HEAU causal", "records the withdrawn contingency reasoning"],
  ["maryland-brief.md", "stale form reference", "names the fee agreement to say it is quarantined"],
  ["message-to-gpt.md", "fee offer", "names the quarantined contingency-fee agreement to prohibit its use"],
  ["playbook.html", "deadline overclaim", "instructs that the date on the letter must NOT be assumed to control"],
  ["playbook.html", "stale form reference", "names the quarantined forms to say none is used"],
  ["brand.mjs", "stale form reference", "comment naming the quarantined forms to explain their absence from TEMPLATES"],
  ["claims-register.md", "asserted finding", "quotes the statutory definition's 'represented, directly or by implication' clause"],
];

/**
 * Exact accepted occurrences. A filename/pattern pair is not enough: without
 * the line fingerprint, a newly introduced sentence in an already allowlisted
 * file would silently pass. `count` is explicit for the one duplicated line.
 */
const ALLOW = [
  ["brand.mjs", "stale form reference", "9ac132f6eb9f3abf256fbbc8a61432044fabc8256785075ccc53cf1e947959b5", 1],
  ["build-vs-buy.md", "privacy overclaim", "cbc38ab67ff85b6f76b1271713cac3080b49bdcc4b99f2326b0a76e2e2fbdda3", 1],
  ["build-vs-buy.md", "registration cost", "558ba5ab6d8cb1b3486b24582133e180db6b3ab758e97e7dbc5c4630b08242cc", 1],
  ["claims-register.md", "representation", "892fc507e26e1716ad9d9018df014c5554dceddedbdb1ce46ad090a1015fc15b", 1],
  ["claims-register.md", "registration cost", "18ad471298f175210ffef0d595cc490cf96ebec0c65cbe54c3aee7a6bf7d4283", 1],
  ["claims-register.md", "registration cost", "99be2f87f55000b0fc094c89ad816fb6f14eb8bf6197a07a24d837e15d9c62fc", 1],
  ["claims-register.md", "registration cost", "f280c2ff7f7fd10c37d4574907efec56075f96a3570163a2c699cd14c181e7bc", 1],
  ["claims-register.md", "registration cost", "39810b7b5face1304bfcf1dd66c1fc4717329ce1ccfde289a0cd8881e92935e5", 1],
  ["claims-register.md", "registration cost", "58e7fb514b2dc96d497dbd6230879c4249ea6e2ebaf315e0acf4dd462d3aafb0", 1],
  ["claims-register.md", "asserted finding", "3122895b8749f8fd6831335eb767c9a6c4140e9e124c70047b8996566f72708b", 1],
  ["claims-register.md", "classification claim", "29791d3b232c76768925c52ea113d0e09ba85c4178e62eb528edfa2a0e00de22", 1],
  ["claims-register.md", "prevalence", "f77fd199afd9179336d76f2b9a32b57cd79a9515146b08e26d8486ac172d0f08", 1],
  ["claims-register.md", "registration cost", "f3c27648f0f0fc25d7337409d2057080a5805799842a62e644cd3777ebdc59e6", 1],
  ["claims-register.md", "deadline overclaim", "5491ecdf5600c7d3701647d3541fa26bf1e8dc2be9ac17b465871f351f44ccfd", 1],
  ["first-call.md", "stale form reference", "d22e6824d7dbe7c60c3d5a94e0e37760009511e8f3b10102f5131d44bee35d3b", 1],
  ["handoff-brief.md", "classification claim", "eb800f75d1a812a627f2200c7509c72128839e32f459668a77bbc9a9cebe80c9", 1],
  ["handoff-brief.md", "classification claim", "ab7172471f73447c4421872c6a15d1af9eaaffa53ad67bd168a9674d797867f9", 1],
  ["handoff-brief.md", "fee offer", "635854c7b7fde8eeed76e3fca29612858a6a6fb38e63c2bc772ff2bc72e50828", 1],
  ["handoff-brief.md", "HEAU causal", "635854c7b7fde8eeed76e3fca29612858a6a6fb38e63c2bc772ff2bc72e50828", 1],
  ["handoff-brief.md", "stale form reference", "e08616a21b51cbc7c4b8f6c15b00c7b01f10e312c657859401c42de38742f18c", 1],
  ["handoff-brief.md", "stale form reference", "e14353eff696edc72788d17f7af911d7360d8fbe2040ff21d164efd75c989ec5", 1],
  ["intake-and-security.md", "stale form reference", "215afad6b89d5471dab205a5dd4808b266b7f51e3a0da4879435978279bca56c", 2],
  ["letter-templates.md", "stale form reference", "7044940b0cbb733d99ea38e6951149a07e38b844477c56529b8086a1177d1b0c", 1],
  ["MANIFEST.md", "classification claim", "dc87bf7d89917861b5e11ceb739d1c62ed54c74c9fbb8ccd9da3683cd319af72", 1],
  ["MANIFEST.md", "deadline overclaim", "dc87bf7d89917861b5e11ceb739d1c62ed54c74c9fbb8ccd9da3683cd319af72", 1],
  ["maryland-brief.md", "registration cost", "73ddaa66b64ab54eeebff3e9496abd44faf5cb3a31f71cb774905c6aae97080d", 1],
  ["maryland-brief.md", "fee offer", "01ba91d852c32532fcccfc65ca79a5feaa04996154382358a5a7c5108529919a", 1],
  ["maryland-brief.md", "fee offer", "681f0f364e5085ade7b33ace7cf26db5e5404c67444eaf4038ffc12ed298d12d", 1],
  ["maryland-brief.md", "HEAU causal", "681f0f364e5085ade7b33ace7cf26db5e5404c67444eaf4038ffc12ed298d12d", 1],
  ["message-to-gpt.md", "fee offer", "403efb708dc010339535e2f3fde64f0aba48196f135bb6e7ec53ae912f6024a4", 1],
  ["message-to-gpt.md", "stale form reference", "403efb708dc010339535e2f3fde64f0aba48196f135bb6e7ec53ae912f6024a4", 1],
  ["ofr-email.md", "fee offer", "b2a32851260ef73b403ad19bcd706b954f668c99443621784c8db2a6122a7768", 1],
  ["ofr-email.md", "fee offer", "d5656562b0d090d6bbcccca97312e348f6972983e04138a764024978d317954a", 1],
  ["pilot-terms.html", "fee offer", "b703caeaedcd5042ad129221384c2d18f2b8d26548fcd89e382b3a6f730d035d", 1],
  ["pilot-terms.html", "representation", "1f68fa15de621b8936083828c9aaa3aa14f0de0409a26501cfa4b0c7cc5b54f3", 1],
  ["playbook.html", "deadline overclaim", "97705e09b0ba6cb2d02700e93be901492ed81288cd60681b6ec39378e41e0a3b", 1],
  ["README.md", "stale form reference", "e31b66047922d6e686b26ca457a27b4b317539ac1704128072220f81664e138c", 1],
  ["README.md", "stale form reference", "780b9fdad7089b17bbec121e51ea5c332052a35d6d3e24da7b25df065b9b5705", 1],
  ["site.html", "fee offer", "312a61e0fc53953b389a1f6f5e4a580a25096fa0aef85dabfea9586918eb5b12", 1],
];

// Every exact occurrence must also map to a reviewed rationale.
for (const [path, label] of ALLOW) {
  if (!ALLOW_REASON_CATALOG.some(([catalogPath, catalogLabel]) => catalogPath === path && catalogLabel === label)) {
    throw new Error(`Missing allowlist rationale for ${path} [${label}]`);
  }
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const UTF8_ENV = {
  ...process.env,
  PYTHONUTF8: "1",
  PYTHONIOENCODING: "utf-8",
};

const PYTHON_CANDIDATES = [
  { command: "python3", prefix: [] },
  { command: "python", prefix: [] },
  { command: "py", prefix: ["-3"] },
  { command: "py", prefix: [] },
];

function detectPdfExtractor() {
  const probe = [
    "import json,sys,pypdf",
    "print(json.dumps({'python':sys.version.split()[0],'pypdf':getattr(pypdf,'__version__','unknown')}))",
  ].join(";");
  for (const candidate of PYTHON_CANDIDATES) {
    try {
      const raw = execFileSync(candidate.command, [...candidate.prefix, "-c", probe], {
        cwd: ROOT,
        encoding: "utf8",
        env: UTF8_ENV,
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 15_000,
      });
      return { ...candidate, ...JSON.parse(raw.trim()) };
    } catch {
      // A Windows Store alias can exist but be unlaunchable. Continue to the
      // next explicit fallback; absence of every candidate fails acceptance.
    }
  }
  return null;
}

function pdfText(file, extractor) {
  const script = [
    "import sys",
    "from pypdf import PdfReader",
    "print(' '.join((page.extract_text() or '') for page in PdfReader(sys.argv[1]).pages))",
  ].join(";");
  try {
    return execFileSync(extractor.command, [...extractor.prefix, "-c", script, file], {
      cwd: ROOT,
      encoding: "utf8",
      env: UTF8_ENV,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 30_000,
    });
  } catch {
    return null;
  }
}

function htmlText(html) {
  return html.replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&mdash;/gi, "—").replace(/&sect;/gi, "§")
    .replace(/&ldquo;|&rdquo;/gi, '"').replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#x?[0-9a-f]+;/gi, " ");
}

/** Browser-generated ordered-list markers appear in PDF text but are absent
 * when tags are stripped. Materialize them only for the numeric signature.
 */
function htmlNumericText(html) {
  const withMarkers = html.replace(/<ol\b([^>]*)>([\s\S]*?)<\/ol>/gi, (_whole, listAttributes, body) => {
    const startMatch = listAttributes.match(/\bstart\s*=\s*["']?(\d+)/i);
    let counter = startMatch ? Number(startMatch[1]) : 1;
    return body.replace(/<li\b([^>]*)>/gi, (_tag, itemAttributes) => {
      const valueMatch = itemAttributes.match(/\bvalue\s*=\s*["']?(\d+)/i);
      if (valueMatch) counter = Number(valueMatch[1]);
      const marker = counter;
      counter += 1;
      return ` ${marker}. `;
    });
  });
  return htmlText(withMarkers);
}

/**
 * Compatibility decomposition removes extractor-dependent ligature and accent
 * forms. The source is then flattened to letters/digits so PDF line wrapping,
 * punctuation placement and inter-glyph spacing cannot create false drift.
 */
function fold(text) {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

function comparisonTokens(text) {
  return (fold(text)
    .replace(/([\p{L}\p{N}])-\s+(?=[\p{L}\p{N}])/gu, "$1")
    .match(/[\p{L}\p{N}]+/gu) ?? []);
}

function comparisonStream(text) {
  return fold(text)
    .replace(/([\p{L}\p{N}])-\s+(?=[\p{L}\p{N}])/gu, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Preserve the order and punctuation that can materially change numbers.
 * Thousands separators and extractor-only spaces around numeric separators
 * are normalized, but decimal points, dates, ranges, ratios and signs remain.
 */
function numericSignature(text) {
  const compact = fold(text)
    .replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1")
    .replace(/(\d)\s*([./:\-])\s*(?=\d)/g, "$1$2");
  return compact.match(/\d+(?:[./:\-]\d+)*/g) ?? [];
}

function htmlHeadingStreams(html) {
  return [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((match) => {
      const label = htmlText(match[2]).trim().replace(/\s+/g, " ");
      return {
        level: Number(match[1]),
        label: label.slice(0, 100),
        stream: comparisonStream(label),
      };
    })
    .filter((heading) => heading.stream.length > 0);
}

function headingOrderEvidence(pdfStream, headings) {
  let cursor = 0;
  let matched = 0;
  const missing = [];
  const outOfOrder = [];
  for (const heading of headings) {
    const atOrAfterCursor = pdfStream.indexOf(heading.stream, cursor);
    if (atOrAfterCursor >= 0) {
      matched += 1;
      cursor = atOrAfterCursor + heading.stream.length;
      continue;
    }
    if (pdfStream.includes(heading.stream)) outOfOrder.push(heading.label);
    else missing.push(heading.label);
  }
  return { matched, missing, outOfOrder };
}

/** Wagner-Fischer distance with two rows: ordered and bidirectional without
 * allocating an O(n*m) matrix. The denominator below is the longer sequence,
 * so omissions and additions are penalised symmetrically.
 */
function tokenEditDistance(left, right) {
  if (left.length > right.length) return tokenEditDistance(right, left);
  let previous = Uint32Array.from({ length: left.length + 1 }, (_, i) => i);
  for (let j = 1; j <= right.length; j += 1) {
    const current = new Uint32Array(left.length + 1);
    current[0] = j;
    for (let i = 1; i <= left.length; i += 1) {
      current[i] = Math.min(
        current[i - 1] + 1,
        previous[i] + 1,
        previous[i - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[left.length];
}

/** Longest-common-subsequence backtrace exposes contiguous omissions/additions
 * that a percentage alone can hide in a long document.
 */
function sequenceGapEvidence(pdfTokens, sourceTokens) {
  const matrix = Array.from(
    { length: pdfTokens.length + 1 },
    () => new Uint16Array(sourceTokens.length + 1),
  );
  for (let i = pdfTokens.length - 1; i >= 0; i -= 1) {
    for (let j = sourceTokens.length - 1; j >= 0; j -= 1) {
      matrix[i][j] = pdfTokens[i] === sourceTokens[j]
        ? matrix[i + 1][j + 1] + 1
        : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  let pdfRun = 0;
  let sourceRun = 0;
  let maxPdfOnlyRun = 0;
  let maxSourceOnlyRun = 0;
  let pdfRunTokens = [];
  let sourceRunTokens = [];
  let maxPdfOnlyTokens = [];
  let maxSourceOnlyTokens = [];
  while (i < pdfTokens.length || j < sourceTokens.length) {
    if (i < pdfTokens.length && j < sourceTokens.length && pdfTokens[i] === sourceTokens[j]) {
      pdfRun = 0;
      sourceRun = 0;
      pdfRunTokens = [];
      sourceRunTokens = [];
      i += 1;
      j += 1;
    } else if (i < pdfTokens.length && (j === sourceTokens.length || matrix[i + 1][j] >= matrix[i][j + 1])) {
      pdfRun += 1;
      sourceRun = 0;
      pdfRunTokens.push(pdfTokens[i]);
      sourceRunTokens = [];
      maxPdfOnlyRun = Math.max(maxPdfOnlyRun, pdfRun);
      if (pdfRunTokens.length > maxPdfOnlyTokens.length) maxPdfOnlyTokens = [...pdfRunTokens];
      i += 1;
    } else {
      sourceRun += 1;
      pdfRun = 0;
      sourceRunTokens.push(sourceTokens[j]);
      pdfRunTokens = [];
      maxSourceOnlyRun = Math.max(maxSourceOnlyRun, sourceRun);
      if (sourceRunTokens.length > maxSourceOnlyTokens.length) maxSourceOnlyTokens = [...sourceRunTokens];
      j += 1;
    }
  }
  return { maxPdfOnlyRun, maxSourceOnlyRun, maxPdfOnlyTokens, maxSourceOnlyTokens };
}

function matchedPhrases(text, re) {
  const compact = fold(text).replace(/\s+/g, " ");
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  return [...compact.matchAll(new RegExp(re.source, flags))].map((match) => (
    match[0].trim().replace(/\s+/g, " ")
  ));
}

function matchedCanonicalPhrases(text, re) {
  return [...comparisonStream(text).matchAll(re)].map((match) => match[0]);
}

function occurrenceCounts(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function assertPdfComparatorContract() {
  const sourceHtml = "<h1>Bill Review</h1><p>Alpha beta.</p><h2>Next Step</h2><p>Gamma.</p>";
  const sourceStream = comparisonStream(htmlText(sourceHtml));
  const extractorSpaced = comparisonStream("B I L L R E V I E W Alpha beta N E X T S T E P Gamma");
  if (tokenEditDistance(Array.from(extractorSpaced), Array.from(sourceStream)) !== 0) {
    throw new Error("letter-spaced extractor text did not normalize to the source stream");
  }
  const headings = htmlHeadingStreams(sourceHtml);
  const good = headingOrderEvidence(extractorSpaced, headings);
  if (good.matched !== headings.length || good.missing.length || good.outOfOrder.length) {
    throw new Error("ordered heading anchors rejected equivalent extractor text");
  }
  const reversed = headingOrderEvidence(
    comparisonStream("Next Step Gamma Bill Review Alpha beta"),
    headings,
  );
  if (reversed.matched === headings.length) {
    throw new Error("ordered heading anchors accepted reversed headings");
  }
  const omitted = headingOrderEvidence(comparisonStream("Bill Review Alpha beta Gamma"), headings);
  if (!omitted.missing.includes("Next Step")) {
    throw new Error("ordered heading anchors accepted a missing heading");
  }
  const bodySource = comparisonStream(`Bill Review ${"abcdefghij".repeat(30)} Next Step`);
  const bodyOmission = bodySource.slice(0, 80) + bodySource.slice(140);
  const bodyDrift = tokenEditDistance(Array.from(bodyOmission), Array.from(bodySource)) / bodySource.length;
  if (bodyDrift <= 0.02) {
    throw new Error("canonical edit distance accepted a material body omission");
  }
  const thresholdSource = "a".repeat(100);
  const exactlyTwoPercent = `bb${"a".repeat(98)}`;
  const beyondTwoPercent = `bbb${"a".repeat(97)}`;
  if (tokenEditDistance(Array.from(exactlyTwoPercent), Array.from(thresholdSource)) / 100 > 0.02) {
    throw new Error("canonical edit distance rejected its documented 2 percent boundary");
  }
  if (tokenEditDistance(Array.from(beyondTwoPercent), Array.from(thresholdSource)) / 100 <= 0.02) {
    throw new Error("canonical edit distance accepted a change beyond 2 percent");
  }
  if (JSON.stringify(numericSignature("Amount $1,000.00 on 2026-08-24")) !== JSON.stringify(numericSignature("Amount $1000.00 on 2026 - 08 - 24"))) {
    throw new Error("numeric signature rejected equivalent extractor formatting");
  }
  if (JSON.stringify(numericSignature("Amount $1.00")) === JSON.stringify(numericSignature("Amount $100"))) {
    throw new Error("numeric signature accepted a materially changed amount");
  }
  if (!matchedCanonicalPhrases("w e r e p r e s e n t y o u", BANNED_CANONICAL.representation).length) {
    throw new Error("spacing-insensitive policy anchors missed letter-spaced representation text");
  }
  if (JSON.stringify(numericSignature(htmlNumericText("<ol><li>Alpha</li><li value='4'>Beta</li><li>Gamma</li></ol>"))) !== JSON.stringify(["1", "4", "5"])) {
    throw new Error("ordered-list markers were not materialized for numeric comparison");
  }
}

let fails = 0;
let pdfComparatorSelfTest = "PASS";
try {
  assertPdfComparatorContract();
} catch (error) {
  fails += 1;
  pdfComparatorSelfTest = "FAIL";
  console.log(`FAIL PDF comparator self-test: ${error.message}`);
}
const all = walk(ROOT);
const actualFiles = all.map((f) => relative(ROOT, f).replaceAll("\\", "/")).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(EXPECTED_FILES)) {
  fails += 1;
  console.log(`FAIL exact file inventory\n  expected ${JSON.stringify(EXPECTED_FILES)}\n  actual   ${JSON.stringify(actualFiles)}`);
}
const textExtensions = new Set([".css", ".html", ".json", ".md", ".mjs"]);
const scannable = all.filter((f) => textExtensions.has(extname(f).toLowerCase()) && basename(f).toLowerCase() !== "verify.mjs");
const treePayloadSha256 = createHash("sha256").update(
  actualFiles.filter((path) => path !== "verify.mjs").map((path) => {
    const sha256 = createHash("sha256").update(readFileSync(join(ROOT, path))).digest("hex");
    return `${path}\u0000${sha256}\n`;
  }).join(""),
).digest("hex");
if (treePayloadSha256 !== EXPECTED_TREE_PAYLOAD_SHA256) {
  fails += 1;
  console.log(`FAIL payload tree hash: expected ${EXPECTED_TREE_PAYLOAD_SHA256}, actual ${treePayloadSha256}`);
}
let regressionPassed = false;

// 0. the deterministic audit engine's regression suite is part of acceptance
try {
  const regressionOutput = execFileSync(process.execPath, ["--test", "audit.test.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  });
  regressionPassed = true;
  console.log("AUDIT REGRESSION\n" + regressionOutput.trim());
} catch (error) {
  fails += 1;
  const stdout = typeof error?.stdout === "string" ? error.stdout.trim() : "";
  const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
  console.log("FAIL audit regression suite");
  if (stdout) console.log(stdout);
  if (stderr) console.log(stderr);
}

// 1. quarantine, across EVERY file type
const breach = all.filter((f) => QUARANTINED.some((q) => basename(f).toLowerCase().startsWith(q)));
if (breach.length) { fails += breach.length; breach.forEach((f) => console.log(`FAIL quarantine breach: ${basename(f)}`)); }

// 2. banned phrases, exact allowlist only
let hits = 0, allowed = 0;
const observedAllowCounts = new Map();
const allowKey = (path, label, sha256) => `${path}\u0000${label}\u0000${sha256}`;
for (const f of scannable) {
  const name = relative(ROOT, f).replaceAll("\\", "/");
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    for (const [label, re] of Object.entries(BANNED)) {
      if (!re.test(line)) continue;
      hits += 1;
      const normalized = line.trim().replace(/\s+/g, " ");
      const sha256 = createHash("sha256").update(normalized).digest("hex");
      const rule = ALLOW.find(([path, allowedLabel, allowedHash]) => (
        path === name && allowedLabel === label && allowedHash === sha256
      ));
      if (rule) {
        const key = allowKey(name, label, sha256);
        const nextCount = (observedAllowCounts.get(key) ?? 0) + 1;
        observedAllowCounts.set(key, nextCount);
        if (nextCount <= rule[3]) {
          allowed += 1;
          continue;
        }
      }
      fails += 1;
      console.log(`FAIL ${name}:${i + 1} [${label}] ${line.replace(/<[^>]*>/g, "").trim().slice(0, 88)}`);
    }
  });
}

for (const [path, label, sha256, expectedCount] of ALLOW) {
  const actualCount = observedAllowCounts.get(allowKey(path, label, sha256)) ?? 0;
  if (actualCount < expectedCount) {
    fails += 1;
    console.log(`FAIL stale allowlist occurrence: ${path} [${label}] expected ${expectedCount}, found ${actualCount}`);
  }
}

// 3. every PDF must correspond to its HTML source in both directions and order
const pdfs = all.filter((f) => extname(f).toLowerCase() === ".pdf");
const extractor = detectPdfExtractor();
const pdfComparisons = [];
let pdfBannedHits = 0;
let pdfExtraBannedHits = 0;
let pdfCanonicalBannedHits = 0;
let pdfExtraCanonicalBannedHits = 0;
if (!extractor) {
  fails += 1;
  console.log("FAIL no usable python3/python/py runtime with pypdf (PDF comparison inconclusive)");
}
for (const p of pdfs) {
  const src = p.replace(/\.pdf$/i, ".html");
  if (!all.includes(src)) { fails += 1; console.log(`FAIL orphan PDF with no HTML source: ${basename(p)}`); continue; }
  if (!extractor) continue;
  const text = pdfText(p, extractor);
  if (text === null) { fails += 1; console.log(`FAIL could not extract text: ${basename(p)} (comparison inconclusive)`); continue; }
  const sourceHtml = readFileSync(src, "utf8");
  const sourceText = htmlText(sourceHtml);
  const pdfTokens = comparisonTokens(text);
  const sourceTokens = comparisonTokens(sourceText);
  const orderedTokenEditDistance = tokenEditDistance(pdfTokens, sourceTokens);
  const orderedTokenDrift = pdfTokens.length && sourceTokens.length
    ? orderedTokenEditDistance / Math.max(pdfTokens.length, sourceTokens.length)
    : 1;
  const gaps = sequenceGapEvidence(pdfTokens, sourceTokens);
  const pdfTokenSha256 = createHash("sha256").update(JSON.stringify(pdfTokens)).digest("hex");
  const sourceTokenSha256 = createHash("sha256").update(JSON.stringify(sourceTokens)).digest("hex");
  const pdfStream = comparisonStream(text);
  const sourceStream = comparisonStream(sourceText);
  const canonicalEditDistance = tokenEditDistance(Array.from(pdfStream), Array.from(sourceStream));
  const canonicalDrift = pdfStream.length && sourceStream.length
    ? canonicalEditDistance / Math.max(pdfStream.length, sourceStream.length)
    : 1;
  const headings = htmlHeadingStreams(sourceHtml);
  const headingEvidence = headingOrderEvidence(pdfStream, headings);
  const pdfNumbers = numericSignature(text);
  const sourceNumbers = numericSignature(htmlNumericText(sourceHtml));
  const numericSignatureMatch = JSON.stringify(pdfNumbers) === JSON.stringify(sourceNumbers);
  let extraBanned = 0;
  for (const [label, re] of Object.entries(BANNED)) {
    const pdfPhrases = matchedPhrases(text, re);
    const sourcePhraseCounts = occurrenceCounts(matchedPhrases(sourceText, re));
    pdfBannedHits += pdfPhrases.length;
    const seenPdfPhrases = occurrenceCounts(pdfPhrases);
    let rawExtraForLabel = 0;
    for (const [phrase, count] of seenPdfPhrases) {
      const excess = Math.max(0, count - (sourcePhraseCounts.get(phrase) ?? 0));
      if (!excess) continue;
      rawExtraForLabel += excess;
      extraBanned += excess;
      pdfExtraBannedHits += excess;
      fails += excess;
      console.log(`FAIL PDF-only banned phrase ${basename(p)} [${label}] ${phrase.slice(0, 88)}`);
    }
    const canonicalRe = BANNED_CANONICAL[label];
    const pdfCanonicalPhrases = matchedCanonicalPhrases(text, canonicalRe);
    const sourceCanonicalCounts = occurrenceCounts(matchedCanonicalPhrases(sourceText, canonicalRe));
    pdfCanonicalBannedHits += pdfCanonicalPhrases.length;
    const seenPdfCanonical = occurrenceCounts(pdfCanonicalPhrases);
    let canonicalExcess = 0;
    for (const [phrase, count] of seenPdfCanonical) {
      canonicalExcess += Math.max(0, count - (sourceCanonicalCounts.get(phrase) ?? 0));
    }
    const uncoveredCanonicalExcess = Math.max(0, canonicalExcess - rawExtraForLabel);
    if (uncoveredCanonicalExcess) {
      extraBanned += uncoveredCanonicalExcess;
      pdfExtraBannedHits += uncoveredCanonicalExcess;
      pdfExtraCanonicalBannedHits += uncoveredCanonicalExcess;
      fails += uncoveredCanonicalExcess;
      console.log(`FAIL PDF-only spacing-insensitive banned phrase ${basename(p)} [${label}] excess ${uncoveredCanonicalExcess}`);
    }
  }
  pdfComparisons.push({
    pdf: basename(p),
    source: basename(src),
    pdfTokens: pdfTokens.length,
    sourceTokens: sourceTokens.length,
    orderedTokenEditDistance,
    orderedTokenDrift: Number(orderedTokenDrift.toFixed(6)),
    pdfTokenSha256,
    sourceTokenSha256,
    maxPdfOnlyRun: gaps.maxPdfOnlyRun,
    maxSourceOnlyRun: gaps.maxSourceOnlyRun,
    pdfCanonicalChars: pdfStream.length,
    sourceCanonicalChars: sourceStream.length,
    canonicalEditDistance,
    canonicalDrift: Number(canonicalDrift.toFixed(6)),
    pdfCanonicalSha256: createHash("sha256").update(pdfStream).digest("hex"),
    sourceCanonicalSha256: createHash("sha256").update(sourceStream).digest("hex"),
    headingsExpected: headings.length,
    headingsMatched: headingEvidence.matched,
    missingHeadings: headingEvidence.missing,
    outOfOrderHeadings: headingEvidence.outOfOrder,
    numericLiterals: pdfNumbers.length,
    sourceNumericLiterals: sourceNumbers.length,
    numericSignatureMatch,
    pdfNumericSha256: createHash("sha256").update(JSON.stringify(pdfNumbers)).digest("hex"),
    sourceNumericSha256: createHash("sha256").update(JSON.stringify(sourceNumbers)).digest("hex"),
    extraBanned,
  });
  if (canonicalDrift > 0.02) {
    fails += 1;
    console.log(`FAIL PDF canonical drift ${basename(p)}: ${(canonicalDrift * 100).toFixed(2)}% flattened-alphanumeric edit distance (regenerate)`);
  }
  if (!headings.length || headingEvidence.matched !== headings.length) {
    fails += 1;
    console.log(`FAIL PDF heading order ${basename(p)}: matched ${headingEvidence.matched}/${headings.length}`);
    if (headingEvidence.missing.length) console.log(`  missing: ${headingEvidence.missing.join(" | ")}`);
    if (headingEvidence.outOfOrder.length) console.log(`  out of order: ${headingEvidence.outOfOrder.join(" | ")}`);
  }
  if (!numericSignatureMatch) {
    fails += 1;
    const mismatch = Math.max(pdfNumbers.length, sourceNumbers.length) === 0
      ? -1
      : Array.from({ length: Math.max(pdfNumbers.length, sourceNumbers.length) }, (_, i) => i)
        .find((i) => pdfNumbers[i] !== sourceNumbers[i]);
    console.log(`FAIL PDF numeric signature ${basename(p)}: ordered literal mismatch at index ${mismatch ?? -1}`);
  }
  if (orderedTokenDrift > 0.02 || gaps.maxPdfOnlyRun > 1 || gaps.maxSourceOnlyRun > 1) {
    console.log(`WARN extractor-sensitive PDF token diagnostics ${basename(p)}: ${(orderedTokenDrift * 100).toFixed(1)}% drift; PDF-only run ${gaps.maxPdfOnlyRun}; source-only run ${gaps.maxSourceOnlyRun}`);
  }
}

const evidence = {
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  verifierSha256: createHash("sha256").update(readFileSync(VERIFIER_PATH)).digest("hex"),
  pdfComparator: "flattened-alphanumeric-edit-v2+ordered-headings+numeric-signature+canonical-policy-anchors",
  pdfComparatorSelfTest,
  pdfExtractor: extractor ? [extractor.command, ...extractor.prefix].join(" ") : null,
  python: extractor?.python ?? null,
  pypdf: extractor?.pypdf ?? null,
  entries: all.length,
  exactInventory: JSON.stringify(actualFiles) === JSON.stringify(EXPECTED_FILES) ? "PASS" : "FAIL",
  treePayloadSha256,
  treePayloadExpected: EXPECTED_TREE_PAYLOAD_SHA256,
  treePayloadIntegrity: treePayloadSha256 === EXPECTED_TREE_PAYLOAD_SHA256 ? "PASS" : "FAIL",
  scanned: scannable.length,
  pdfs: pdfs.length,
  bannedHits: hits,
  allowlistedHits: allowed,
  unlistedHits: hits - allowed,
  quarantineBreaches: breach.length,
  auditRegression: regressionPassed ? "PASS" : "FAIL",
  pdfBannedHits,
  pdfExtraBannedHits,
  pdfCanonicalBannedHits,
  pdfExtraCanonicalBannedHits,
  pdfComparisons,
};

console.log(`\nentries ${all.length} · scanned ${scannable.length} · pdfs ${pdfs.length} · banned-hits ${hits} (${allowed} allowlisted, ${hits - allowed} unlisted)`);
console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
console.log(`VERDICT: ${fails === 0 ? "PASS" : `FAIL — ${fails}`}`);
process.exit(fails === 0 ? 0 : 1);
