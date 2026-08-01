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
    "  assert.ok(providerSource.includes(\"Customer sees\"));",
    "  assert.ok(providerSource.includes(\"customer-visible status\"));",
)

print("Reconciled regression tests with the labor-only model.")
