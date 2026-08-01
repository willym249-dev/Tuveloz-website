from hashlib import sha256
import json
from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one test marker, found {count}: {old}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "tests/job-operations-controls.test.mjs",
    "  assert.match(card, /Authorized tax and other charges/);",
    "  assert.match(card, /Provider labor/);\n"
    "  assert.match(card, /Parts charged through Tuveloz/);\n"
    "  assert.match(card, /Complete authorized labor amount/);\n"
    "  assert.doesNotMatch(card, /Authorized tax and other charges/);",
)
replace_once(
    "tests/maryland-repair-records.test.mjs",
    "  assert.match(page, /Itemized estimate lines/);",
    "  assert.match(page, /Labor lines and optional customer-supplied-part descriptions/);\n"
    "  assert.match(page, /part amounts must be 0/);",
)
replace_once(
    "tests/maryland-repair-records.test.mjs",
    "  assert.match(page, /mechanic&apos;s work was performed satisfactorily/);",
    "  assert.match(page, /work was performed satisfactorily/);",
)
replace_once(
    "tests/provider-freedom-authorizations.test.mjs",
    "  assert.match(page, /Set your own scope, price, timing, and warranty/);",
    "  assert.match(page, /Set your own labor scope, labor price, timing, and workmanship warranty/);",
)
replace_once(
    "tests/rendered-html.test.mjs",
    "  assert.ok(contents.includes(\"Compare parts before you decide\"));\n"
    "  assert.ok(contents.includes(\"before choosing whether you or the provider should supply the parts\"));",
    "  assert.ok(contents.includes(\"OEM and aftermarket are communication preferences only\"));\n"
    "  assert.ok(contents.includes(\"They do not add a parts charge to Tuveloz\"));\n"
    "  assert.ok(contents.includes(\"customer purchases separately\"));",
)
replace_once(
    "tests/rendered-html.test.mjs",
    "  assert.ok(contents.includes(\"Any special equipment or rental cost must be disclosed in the quote.\"));",
    "  assert.ok(contents.includes(\"Any required parts must be purchased separately by the customer and cannot be included in a Tuveloz quote or payment.\"));",
)
replace_once(
    "tests/rendered-html.test.mjs",
    "  assert.ok(providerSource.includes(\"Customer sees\"));",
    "  assert.ok(providerSource.includes(\"customer-visible status\"));",
)

# The labor-only update changes four draft policy documents. Bind each draft
# review record to the exact updated source without activating it or inventing
# an effective date. An already-active document must go through a separate
# release/version process rather than silently changing underneath its release.
manifest_path = Path("config/policy-releases.json")
manifest = json.loads(manifest_path.read_text())
changed_policy_keys = (
    "terms",
    "customer_agreement",
    "provider_agreement",
    "payment_policy",
)
for key in changed_policy_keys:
    release = manifest[key]
    if release["releaseStatus"] != "draft":
        raise SystemExit(
            f"{key} is {release['releaseStatus']}; do not rewrite an existing policy release in place"
        )
    source = Path(release["sourceFile"]).read_text().replace("\r\n", "\n")
    release["reviewBodyHash"] = sha256(source.encode()).hexdigest()
    release["effectiveAt"] = ""
    release["releaseId"] = ""
    release["canonicalBodyHash"] = ""
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

print("Reconciled labor-only tests and bound updated draft policy review hashes.")
