from pathlib import Path


def one(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if label == "publication wording" and count == 2:
        return text.replace(old, new)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


core_path = Path("scripts/apply_labor_only_core.py")
core = core_path.read_text()
core_pairs = [
    (
        '''    const businessHours = clean(payload.businessHours, 220);
    const publicStatus = payload.publicStatus === "published" ? "published" : "draft";
''',
        '''    const businessHours = clean(payload.businessHours, 220);
    const publicationRequested = payload.publicStatus === "published";
''',
        "profile parse target",
    ),
    (
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
        "profile parse replacement",
    ),
    ('        "idx": 45,\n', '        "idx": 48,\n', "journal index"),
    ('        "when": 1785550000300,\n', '        "when": 1785591000000,\n', "journal time"),
    (
        '''    "0044_final_provider_invoice_legal_fields_immutable",
  ];
''',
        '''    "0044_final_provider_invoice_legal_fields_immutable",
    "0045_chilly_maginty",
    "0046_volatile_liz_osborn",
    "0047_perfect_orphan",
  ];
''',
        "history old list",
    ),
    (
        '''    "0044_final_provider_invoice_legal_fields_immutable",
    "0045_customer_supplied_parts_preferences",
  ];
''',
        '''    "0044_final_provider_invoice_legal_fields_immutable",
    "0045_chilly_maginty",
    "0046_volatile_liz_osborn",
    "0047_perfect_orphan",
    "0048_customer_supplied_parts_preferences",
  ];
''',
        "history new list",
    ),
]
for old, new, label in core_pairs:
    core = one(core, old, new, label)
append = """
replace_once(
    \"app/api/provider-profile/route.ts\",
    '''      existing.businessHours !== businessHours,
    ].some(Boolean);
''',
    '''      existing.businessHours !== businessHours,
      existing.customerSuppliedPartsPolicy !== customerSuppliedPartsPolicy,
    ].some(Boolean);
''',
)
"""
marker = "\n# Quote API: no provider-supplied parts or hidden parts amount.\n"
if append not in core:
    core = one(core, marker, append + marker, "profile claims insertion")
core = core.replace("0045_customer_supplied_parts_preferences", "0048_customer_supplied_parts_preferences")
core_path.write_text(core)

ui_path = Path("scripts/apply_labor_only_ui.py")
ui = ui_path.read_text()
ui_pairs = [
    (
        """    '''              I am 18 or older and agree to the <Link href=\"/terms\">Terms</Link>,{\" \"}
              <Link href=\"/customer-agreement\">Customer Agreement</Link>, and{\" \"}
              <Link href=\"/payments\">Payment Policy</Link>.
''',""",
        """    '''                <span>
                  {checkoutAcceptance.presentedText}{\" \"}
                  <Link href=\"/terms\">Terms of Use</Link>{\" · \"}
                  <Link href=\"/customer-agreement\">Customer Agreement</Link>{\" · \"}
                  <Link href=\"/payments\">Payment, Cancellation and Refund Policy</Link>
                </span>
''',""",
        "checkout consent target",
    ),
    (
        """    '''              I confirm this payment includes vehicle-service labor only and no
              provider-supplied parts, parts reimbursement, parts tax, or parts charge.
              I am 18 or older and agree to the <Link href=\"/terms\">Terms</Link>,{\" \"}
              <Link href=\"/customer-agreement\">Customer Agreement</Link>, and{\" \"}
              <Link href=\"/payments\">Payment Policy</Link>.
''',""",
        """    '''                <span>
                  I confirm this payment includes vehicle-service labor only and no
                  provider-supplied parts, parts reimbursement, parts tax, or parts charge.{\" \"}
                  {checkoutAcceptance.presentedText}{\" \"}
                  <Link href=\"/terms\">Terms of Use</Link>{\" · \"}
                  <Link href=\"/customer-agreement\">Customer Agreement</Link>{\" · \"}
                  <Link href=\"/payments\">Payment, Cancellation and Refund Policy</Link>
                </span>
''',""",
        "checkout consent replacement",
    ),
    (
        "    '            disabled={!checkoutAllowed || !acceptedPaymentPolicy || busy}\\n',\n",
        "    '            disabled={!checkoutAllowed || !checkoutAcceptance || !acceptedPaymentPolicy || busy}\\n',\n",
        "checkout button target",
    ),
    (
        "    '            disabled={!checkoutAllowed || !laborOnlyQuote || !acceptedPaymentPolicy || busy}\\n',\n",
        "    '            disabled={!checkoutAllowed || !checkoutAcceptance || !laborOnlyQuote || !acceptedPaymentPolicy || busy}\\n',\n",
        "checkout button replacement",
    ),
    (
        """    '''              <span>{data.services.length} approved {data.services.length === 1 ? \"service\" : \"services\"}</span>
              <span>{displayLocation}</span>
''',""",
        """    '''              <span>{data.services.length} currently listed {data.services.length === 1 ? \"service\" : \"services\"}</span>
              <span>{displayLocation}</span>
''',""",
        "profile preview target",
    ),
    (
        """    '''              <span>{data.services.length} approved {data.services.length === 1 ? \"service\" : \"services\"}</span>
              <span>Customer-supplied parts: {profile.customerSuppliedPartsPolicy}</span>
              <span>{displayLocation}</span>
''',""",
        """    '''              <span>{data.services.length} currently listed {data.services.length === 1 ? \"service\" : \"services\"}</span>
              <span>Customer-supplied parts: {profile.customerSuppliedPartsPolicy}</span>
              <span>{displayLocation}</span>
''',""",
        "profile preview replacement",
    ),
    (
        "              <div><strong>Page visibility</strong><small>You control when customers can see it</small></div>\n",
        "              <div><strong>Page visibility</strong><small>Publication requires TUVELOZ content review</small></div>\n",
        "publication wording",
    ),
    (
        """          <p>These are the services Tuveloz has approved this provider to quote.</p>
""",
        """          <p>
            These exact services are recorded on this profile for possible quote eligibility after
            marketplace launch. A listing is not a guarantee of licensing, insurance, skill,
            quality, safety, or lawful performance; review the dated records and official sources above.
          </p>
""",
        "storefront target",
    ),
    (
        """          <p>
            These are the services Tuveloz has approved this provider to quote for labor.
            Any required parts are purchased separately by the customer.
          </p>
""",
        """          <p>
            These exact services are recorded on this profile for possible labor-quote eligibility after
            marketplace launch. Any required parts are purchased separately by the customer. A listing is
            not a guarantee of licensing, insurance, skill, quality, safety, or lawful performance; review
            the dated records and official sources above.
          </p>
""",
        "storefront replacement",
    ),
]
for old, new, label in ui_pairs:
    ui = one(ui, old, new, label)
ui_path.write_text(ui)

hardening_path = Path("scripts/apply_labor_only_hardening.py")
hardening_path.write_text(
    hardening_path.read_text().replace(
        "0045_customer_supplied_parts_preferences",
        "0048_customer_supplied_parts_preferences",
    )
)
print("Modernized labor-only patch scripts for current main.")
