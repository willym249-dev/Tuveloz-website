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

ui_path = Path("scripts/apply_labor_only_ui.py")
ui = ui_path.read_text()

ui = replace_exact(
    ui,
    '''    ''' + "'''" + '''              I am 18 or older and agree to the <Link href="/terms">Terms</Link>,{" "}
              <Link href="/customer-agreement">Customer Agreement</Link>, and{" "}
              <Link href="/payments">Payment Policy</Link>.
''' + "'''" + ''',
    '''    ''' + "'''" + '''                <span>
                  {checkoutAcceptance.presentedText}{" "}
                  <Link href="/terms">Terms of Use</Link>{" · "}
                  <Link href="/customer-agreement">Customer Agreement</Link>{" · "}
                  <Link href="/payments">Payment, Cancellation and Refund Policy</Link>
                </span>
''' + "'''" + ''',
    "checkout consent current marker",
)
ui = replace_exact(
    ui,
    '''    ''' + "'''" + '''              I confirm this payment includes vehicle-service labor only and no
              provider-supplied parts, parts reimbursement, parts tax, or parts charge.
              I am 18 or older and agree to the <Link href="/terms">Terms</Link>,{" "}
              <Link href="/customer-agreement">Customer Agreement</Link>, and{" "}
              <Link href="/payments">Payment Policy</Link>.
''' + "'''" + ''',
    '''    ''' + "'''" + '''                <span>
                  I confirm this payment includes vehicle-service labor only and no
                  provider-supplied parts, parts reimbursement, parts tax, or parts charge.{" "}
                  {checkoutAcceptance.presentedText}{" "}
                  <Link href="/terms">Terms of Use</Link>{" · "}
                  <Link href="/customer-agreement">Customer Agreement</Link>{" · "}
                  <Link href="/payments">Payment, Cancellation and Refund Policy</Link>
                </span>
''' + "'''" + ''',
    "checkout consent labor-only replacement",
)
ui = replace_exact(
    ui,
    "    '            disabled={!checkoutAllowed || !acceptedPaymentPolicy || busy}\\n',\n",
    "    '            disabled={!checkoutAllowed || !checkoutAcceptance || !acceptedPaymentPolicy || busy}\\n',\n",
    "checkout disabled current marker",
)
ui = replace_exact(
    ui,
    "    '            disabled={!checkoutAllowed || !laborOnlyQuote || !acceptedPaymentPolicy || busy}\\n',\n",
    "    '            disabled={!checkoutAllowed || !checkoutAcceptance || !laborOnlyQuote || !acceptedPaymentPolicy || busy}\\n',\n",
    "checkout disabled labor-only replacement",
)
ui = replace_exact(
    ui,
    '''    ''' + "'''" + '''              <span>{data.services.length} approved {data.services.length === 1 ? "service" : "services"}</span>
              <span>{displayLocation}</span>
''' + "'''" + ''',
    '''    ''' + "'''" + '''              <span>{data.services.length} currently listed {data.services.length === 1 ? "service" : "services"}</span>
              <span>{displayLocation}</span>
''' + "'''" + ''',
    "provider preview current service marker",
)
ui = replace_exact(
    ui,
    '''    ''' + "'''" + '''              <span>{data.services.length} approved {data.services.length === 1 ? "service" : "services"}</span>
              <span>Customer-supplied parts: {profile.customerSuppliedPartsPolicy}</span>
              <span>{displayLocation}</span>
''' + "'''" + ''',
    '''    ''' + "'''" + '''              <span>{data.services.length} currently listed {data.services.length === 1 ? "service" : "services"}</span>
              <span>Customer-supplied parts: {profile.customerSuppliedPartsPolicy}</span>
              <span>{displayLocation}</span>
''' + "'''" + ''',
    "provider preview labor-only replacement",
)
ui = replace_exact(
    ui,
    '''              <div><strong>Page visibility</strong><small>You control when customers can see it</small></div>
''',
    '''              <div><strong>Page visibility</strong><small>Publication requires TUVELOZ content review</small></div>
''',
    "provider publication current wording",
)
ui = replace_exact(
    ui,
    '''          <p>These are the services Tuveloz has approved this provider to quote.</p>
''',
    '''          <p>
            These exact services are recorded on this profile for possible quote eligibility after
            marketplace launch. A listing is not a guarantee of licensing, insurance, skill,
            quality, safety, or lawful performance; review the dated records and official sources above.
          </p>
''',
    "public provider services current marker",
)
ui = replace_exact(
    ui,
    '''          <p>
            These are the services Tuveloz has approved this provider to quote for labor.
            Any required parts are purchased separately by the customer.
          </p>
''',
    '''          <p>
            These exact services are recorded on this profile for possible labor-quote eligibility after
            marketplace launch. Any required parts are purchased separately by the customer. A listing is
            not a guarantee of licensing, insurance, skill, quality, safety, or lawful performance; review
            the dated records and official sources above.
          </p>
''',
    "public provider services labor-only replacement",
)
ui_path.write_text(ui)

hardening_path = Path("scripts/apply_labor_only_hardening.py")
hardening = hardening_path.read_text().replace(
    "0045_customer_supplied_parts_preferences",
    "0047_customer_supplied_parts_preferences",
)
hardening_path.write_text(hardening)

print("Modernized labor-only patch scripts for current main.")
