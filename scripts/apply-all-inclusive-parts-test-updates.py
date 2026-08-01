from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative_path: str, old: str, new: str) -> None:
    path = ROOT / relative_path
    text = path.read_text(encoding="utf-8")
    if new and new in text:
        print(f"already patched: {relative_path}")
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"Expected one match in {relative_path}, found {count}.\n--- old ---\n{old[:500]}"
        )
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"patched: {relative_path}")


replace_once(
    "app/provider-jobs/page.tsx",
    '''  const completedLaborCents = completedJobs.reduce(
    (total, job) => total + Number(job.laborPriceCents),
    0,
  );
  const completedPartsCents = completedJobs.reduce(
    (total, job) => total + Number(job.partsPriceCents),
    0,
  );
''',
    "",
)

replace_once(
    "app/page.tsx",
    '''                  <small>
                    If the provider supplies parts, the quote will show separate labor
                    and parts charges before you choose.
                  </small>
''',
    '''                  <small>
                    If the provider supplies parts, the quote will show the included
                    items and one all-inclusive provider service price before you choose.
                  </small>
''',
)

replace_once(
    "tests/job-operations-controls.test.mjs",
    '''  assert.match(card, /Authorized tax and other charges/);
  assert.match(card, /Authorized job scope version/);
''',
    '''  assert.match(card, /Parts arrangement/);
  assert.match(card, /Provider service price/);
  assert.match(card, /Authorized job scope version/);
''',
)

replace_once(
    "tests/migration-history-integration.test.mjs",
    '''    "0040_living_gressill",
    "0041_real_only_accepted_quote_authorizations",
  ];
''',
    '''    "0040_living_gressill",
    "0041_real_only_accepted_quote_authorizations",
    "0042_all_inclusive_parts_guard",
  ];
''',
)

replace_once(
    "tests/parts-billing.test.mjs",
    '''  assert.match(payments, /one all-inclusive lump-sum repair-service price/);
''',
    '''  assert.match(payments, /one all-inclusive\s+lump-sum repair-service price/);
''',
)

replace_once(
    "tests/rendered-html.test.mjs",
    '''test("build itemizes provider-supplied parts separately from labor", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\\n");

  assert.ok(contents.includes("If the provider supplies parts, the quote will show separate labor"));
  assert.ok(contents.includes("Labor ($)"));
  assert.ok(contents.includes("Parts price ($)"));
  assert.ok(contents.includes("laborPriceCents"));
  assert.ok(contents.includes("partsPriceCents"));
});
''',
    '''test("build enforces one all-inclusive provider service price with no separate goods charge", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\\n");

  assert.ok(contents.includes("one all-inclusive provider service price"));
  assert.ok(contents.includes("One provider service price ($)"));
  assert.ok(contents.includes("Provider supplies parts in one all-inclusive repair price"));
  assert.ok(contents.includes("Do not enter a separate parts, materials, reimbursement, core, or tire amount."));
  assert.ok(contents.includes("provider_all_inclusive"));
});
''',
)

print("All-inclusive parts integration tests and public copy updated.")
