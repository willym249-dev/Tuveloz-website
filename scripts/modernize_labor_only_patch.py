from pathlib import Path


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


core_path = Path("scripts/apply_labor_only_core.py")
core = core_path.read_text()

core = replace_exact(
    core,
    '''    const businessHours = clean(payload.businessHours, 220);
    const publicStatus = payload.publicStatus === "published" ? "published" : "draft";
''',
    '''    const businessHours = clean(payload.businessHours, 220);
    const publicationRequested = payload.publicStatus === "published";
''',
    "provider-profile current parsing marker",
)
core = replace_exact(
    core,
    '''    const businessHours = clean(payload.businessHours, 220);
    const customerSuppliedPartsPolicy = clean(
      payload.customerSuppliedPartsPolicy,
      40,
    );
    const publicStatus = payload.publicStatus === "published" ? "published" : "draft";
''',
    '''    const businessHours = clean(payload.businessHours, 220);
    const customerSuppliedPartsPolicy = clean(
      payload.customerSuppliedPartsPolicy,
      40,
    );
    const publicationRequested = payload.publicStatus === "published";
''',
    "provider-profile current parsing replacement",
)

append_block = '''
replace_once(
    "app/api/provider-profile/route.ts",
    ''' + "'''" + '''      existing.businessHours !== businessHours,
    ].some(Boolean);
''' + "'''" + ''',
    ''' + "'''" + '''      existing.businessHours !== businessHours,
      existing.customerSuppliedPartsPolicy !== customerSuppliedPartsPolicy,
    ].some(Boolean);
''' + "'''" + ''',
)
'''
marker = "\n# Quote API: no provider-supplied parts or hidden parts amount.\n"
if append_block not in core:
    count = core.count(marker)
    if count != 1:
        raise SystemExit(f"provider-profile public-claims insertion marker: found {count}")
    core = core.replace(marker, append_block + marker, 1)

core = core.replace(
    "0045_customer_supplied_parts_preferences",
    "0047_customer_supplied_parts_preferences",
)
core = replace_exact(
    core,
    '        "idx": 45,\n',
    '        "idx": 47,\n',
    "migration journal index",
)
core = replace_exact(
    core,
    '        "when": 1785550000300,\n',
    '        "when": 1785590000000,\n',
    "migration journal timestamp",
)
core = replace_exact(
    core,
    '''    "0044_final_provider_invoice_legal_fields_immutable",
  ];
''',
    '''    "0044_final_provider_invoice_legal_fields_immutable",
    "0045_chilly_maginty",
    "0046_volatile_liz_osborn",
  ];
''',
    "migration history current marker",
)
core = replace_exact(
    core,
    '''    "0044_final_provider_invoice_legal_fields_immutable",
    "0047_customer_supplied_parts_preferences",
  ];
''',
    '''    "0044_final_provider_invoice_legal_fields_immutable",
    "0045_chilly_maginty",
    "0046_volatile_liz_osborn",
    "0047_customer_supplied_parts_preferences",
  ];
''',
    "migration history current replacement",
)
core_path.write_text(core)

hardening_path = Path("scripts/apply_labor_only_hardening.py")
hardening = hardening_path.read_text().replace(
    "0045_customer_supplied_parts_preferences",
    "0047_customer_supplied_parts_preferences",
)
hardening_path.write_text(hardening)

print("Modernized labor-only patch scripts for current main.")
