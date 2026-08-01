from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative_path: str, old: str, new: str) -> None:
    path = ROOT / relative_path
    text = path.read_text(encoding="utf-8")
    if new in text:
        print(f"already patched: {relative_path}")
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"Expected one match in {relative_path}, found {count}.\n--- old ---\n{old[:500]}"
        )
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"patched: {relative_path}")


for policy_file in (
    "app/terms/page.tsx",
    "app/provider-agreement/page.tsx",
    "app/customer-agreement/page.tsx",
    "app/payments/page.tsx",
):
    replace_once(policy_file, 'updated="July 31, 2026"', 'updated="August 1, 2026"')

replace_once(
    "app/terms/page.tsx",
    '''        <p>
          Providers set their own quotes and must describe labor, parts, material
          assumptions, timing, and added costs clearly. Work or price outside the
          accepted quote requires the customer&apos;s approval. Provider businesses
          must satisfy the estimate, authorization, invoice, disclosure, repair
          record, parts, warranty, and disposal duties applicable to their work.
        </p>
''',
    '''        <p>
          Providers set their own quotes and must describe the exact service,
          parts arrangement, included items, assumptions, timing, exclusions,
          and provider warranty clearly. Work, a substitute part, a separate
          goods charge, or a price outside the accepted quote requires a new
          customer authorization. Provider businesses must satisfy the estimate,
          authorization, invoice, disclosure, repair-record, parts, warranty,
          tax, and disposal duties applicable to their work.
        </p>
        <p>
          Under the currently permitted parts flow, a quote may use customer-supplied
          parts, no new parts, or provider-supplied parts and materials included in
          one all-inclusive lump-sum repair-service price. The provider may identify
          the included part name, brand, quality, number, supplier, and warranty but
          may not assign a separate parts, materials, reimbursement, parts-markup,
          core-charge, tire-fee, or other goods amount through Tuveloz. Separately
          itemized parts sales, over-the-counter sales, new-tire sales, fuel sales,
          core-charge transactions, and fabrication transactions remain disabled
          unless Tuveloz deliberately activates a compliant flow for them.
        </p>
''',
)

replace_once(
    "app/terms/page.tsx",
    '''        <p>
          Any enabled payment authorization, transfer, cancellation, refund,
          dispute, or chargeback process will also be governed by the{" "}
          <a href="/payments">Payment, Cancellation, and Refund Policy</a>.
          Operating a payment flow would not make Tuveloz the vehicle-service
          provider, and it would not remove any payment-related duty that law
          places directly on Tuveloz.
        </p>
''',
    '''        <p>
          Any enabled payment authorization, transfer, cancellation, refund,
          dispute, or chargeback process will also be governed by the{" "}
          <a href="/payments">Payment, Cancellation, and Refund Policy</a>.
          For a provider-supplied-parts lump-sum repair, the provider must pay or
          accrue applicable sales or use tax when acquiring the parts and supplies
          used in that repair and may not use a resale exemption for those items
          under this billing method. Operating a payment flow would not make
          Tuveloz the vehicle-service provider, and it would not remove any
          payment-related duty that law places directly on Tuveloz.
        </p>
''',
)

replace_once(
    "app/provider-agreement/page.tsx",
    '''        <p>
          The provider business sets or approves each quote and must clearly state
          the enabled service code, labor, parts and part type, assumptions,
          exclusions, timing, taxes, other lawful charges, and provider warranty.
          Customer acceptance forms a direct service agreement with the provider
          business. Added work, a substituted part, a different person, or a
          price change requires the provider business&apos;s approval and the
          customer&apos;s documented authorization when applicable.
        </p>
''',
    '''        <p>
          The provider business sets or approves each quote and must clearly state
          the enabled service code, one provider service price, parts arrangement,
          included items, assumptions, exclusions, timing, and provider warranty.
          Customer acceptance forms a direct service agreement with the provider
          business. Added work, a substituted part, a different person, a separate
          goods charge, or a price change requires the provider business&apos;s approval
          and the customer&apos;s documented authorization when applicable.
        </p>
        <p>
          A provider may buy parts from a retail or wholesale supplier and may
          include sourcing cost and profit in its one all-inclusive repair-service
          price. When the provider supplies parts under this lump-sum method, the
          provider must pay or accrue all applicable sales or use tax on the parts
          and supplies it purchases for the job and must not use a resale certificate
          or resale exemption for those items. The provider must retain supplier
          invoices or receipts and provide relevant proof to Tuveloz when reasonably
          required for a tax, payment, customer, warranty, or audit review.
        </p>
        <p>
          The provider may describe the included part name, brand, quality, part
          number, supplier, and warranty, but it may not enter or collect a separate
          parts, materials, reimbursement, parts-markup, core-charge, tire-fee, or
          other goods amount through Tuveloz. Separately itemized parts sales,
          over-the-counter parts, new-tire sales, fuel sales, core-charge transactions,
          and fabrication transactions are disabled until Tuveloz activates a
          separately reviewed and compliant flow.
        </p>
''',
)

replace_once(
    "app/provider-agreement/page.tsx",
    '''          Payment administration does not shift invoicing, warranty, payroll, or
          service responsibility away from the provider business.
''',
    '''          Payment administration does not shift invoicing, warranty, payroll,
          parts-purchase tax, recordkeeping, or service responsibility away from
          the provider business. The provider must not redirect a customer to a
          second payment link, cash reimbursement, message-based collection, or
          off-platform charge to evade the accepted one-price parts arrangement.
''',
)

replace_once(
    "app/customer-agreement/page.tsx",
    '''        <p>
          A diagnosis or pre-purchase opinion may be limited by what can
          reasonably be observed and tested at the location. It is not an
          official state inspection unless an authorized provider expressly says
          so. The provider business should identify parts and who offers any
          express warranty in the service records. Implied or statutory warranty
          rights and duties remain governed by applicable law.
        </p>
''',
    '''        <p>
          A diagnosis or pre-purchase opinion may be limited by what can
          reasonably be observed and tested at the location. It is not an
          official state inspection unless an authorized provider expressly says
          so. The provider business should identify parts and who offers any
          express warranty in the service records. Implied or statutory warranty
          rights and duties remain governed by applicable law.
        </p>
        <p>
          Each selectable quote must state one of the current parts arrangements:
          you supply all required parts; no new parts are needed; or the provider
          supplies the described parts and materials within one all-inclusive
          repair-service price. Under the provider-supplied option, no separate
          parts, materials, reimbursement, parts-markup, core-charge, tire-fee,
          or other goods amount is authorized through Tuveloz. You must approve a
          new recorded quote or change before any added work, substitute part, or
          price increase is charged.
        </p>
''',
)

replace_once(
    "app/customer-agreement/page.tsx",
    '''          operational approval. If that pricing is adopted, the provider
          subtotal, separate fee, and total must be displayed conspicuously before
          you choose whether to authorize checkout. The{" "}
''',
    '''          operational approval. If that pricing is adopted, the provider&apos;s
          one service price, exact parts arrangement, separate Tuveloz fee, and
          total must be displayed conspicuously before you choose whether to
          authorize checkout. A provider may not use a second Tuveloz payment,
          cash request, reimbursement request, or off-platform collection to add
          a separate parts charge to the accepted one-price arrangement. The{" "}
''',
)

replace_once(
    "app/payments/page.tsx",
    '''          final approval, the customer must see the provider subtotal, separate
          Tuveloz fee, and total conspicuously before choosing whether to proceed.
          Tuveloz must not add work or parts to an accepted quote, and a scope or
          price change requires the customer&apos;s express approval before any
          additional charge.
''',
    '''          final approval, the customer must see the provider&apos;s one service
          price, exact parts arrangement, separate Tuveloz fee, and total
          conspicuously before choosing whether to proceed. Tuveloz must not add
          work, a substitute part, a separate goods charge, or a price to an
          accepted quote, and every material scope or price change requires the
          customer&apos;s express recorded approval before any additional charge.
''',
)

replace_once(
    "app/payments/page.tsx",
    '''        <p>
          Provider businesses set their own labor and parts quotes. The proposed
          product design separately tracks the accepted provider subtotal and a
          10% customer service fee for marketplace and transaction support. The
          percentage, transfer calculation, adjustments, and accounting treatment
          remain subject to documented compliance with applicable law and final
          CPA or tax-adviser, processor, insurance, and operational approval.
          Product configuration alone does not establish a legal or tax
          characterization or promise a particular provider payout.
        </p>
''',
    '''        <p>
          Provider businesses set their own service prices. The current guarded
          product design permits customer-supplied parts, no new parts, or
          provider-supplied parts and materials included in one all-inclusive
          lump-sum repair-service price. It does not permit a separate parts,
          materials, reimbursement, parts-markup, core-charge, tire-fee, or other
          goods line. The accepted provider service price is tracked separately
          from the proposed 10% customer service fee for marketplace and
          transaction support.
        </p>
        <p>
          A provider using the all-inclusive method may obtain parts at retail or
          wholesale, but must pay or accrue applicable sales or use tax on the
          parts and supplies purchased for the lump-sum repair, must not use a
          resale exemption for those items, and must retain supplier records.
          Separately itemized parts sales remain disabled until Tuveloz has an
          approved registration, tax-calculation, collection, withholding,
          reporting, refund, and remittance process for that flow. The fee
          percentage, transfer calculation, adjustments, and accounting treatment
          remain subject to documented compliance with applicable law and final
          CPA or tax-adviser, processor, insurance, and operational approval.
        </p>
''',
)

replace_once(
    "app/payments/page.tsx",
    '''          If payments are
          enabled, the selected provider business remains the party that accepts
          and performs the vehicle-service agreement, supplies listed parts, and
          honors any provider warranty it expressly offers. Nothing in this draft
          decides a non-waivable warranty right or responsibility.
''',
    '''          If payments are enabled, the selected provider business remains
          the party that accepts and performs the vehicle-service agreement,
          acquires and supplies listed parts, pays or accrues the parts-purchase
          tax required under the selected billing method, preserves supplier
          records, and honors any provider warranty it expressly offers. Nothing
          in this draft decides a non-waivable warranty right or responsibility.
''',
)

replace_once(
    "app/payments/page.tsx",
    '''          Provider
          businesses remain responsible for accurate business records and for
          duties the law places on them. Customers and providers should keep
          their quote, approval, invoice, receipt, and service records.
''',
    '''          Provider businesses remain responsible for accurate business,
          supplier, tax, warranty, and service records and for duties the law
          places on them. For an all-inclusive provider-parts repair, the stored
          record must preserve the parts arrangement, included-item description,
          provider certifications, one service price, customer acceptance, and
          supplier receipt reference. Customers and providers should keep their
          quote, approval, invoice, receipt, and service records.
''',
)

print("All-inclusive parts legal policy patch completed.")
