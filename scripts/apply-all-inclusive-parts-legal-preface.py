from pathlib import Path

path = Path(__file__).resolve().parents[1] / "app/payments/page.tsx"
text = path.read_text(encoding="utf-8")

processor_old = '''          processor, insurance, and operational review. If payments are
          enabled, the selected provider business remains the party that accepts
          and performs the vehicle-service agreement, supplies listed parts, and
          honors any provider warranty it expressly offers. Nothing in this draft
          decides a non-waivable warranty right or responsibility.
'''
processor_new = '''          processor, insurance, and operational review.
          If payments are enabled, the selected provider business remains
          the party that accepts and performs the vehicle-service agreement,
          acquires and supplies listed parts, pays or accrues the parts-purchase
          tax required under the selected billing method, preserves supplier
          records, and honors any provider warranty it expressly offers. Nothing
          in this draft decides a non-waivable warranty right or responsibility.
'''
if processor_new not in text:
    if text.count(processor_old) != 1:
        raise RuntimeError("Unable to locate the payment-policy processor paragraph.")
    text = text.replace(processor_old, processor_new, 1)

records_old = '''          requirements, and configure the payment and reporting flow to match
          the responsibilities imposed by law. Provider
          businesses remain responsible for accurate business records and for
          duties the law places on them. Customers and providers should keep
          their quote, approval, invoice, receipt, and service records.
'''
records_new = '''          requirements, and configure the payment and reporting flow to match
          the responsibilities imposed by law.
          Provider businesses remain responsible for accurate business,
          supplier, tax, warranty, and service records and for duties the law
          places on them. For an all-inclusive provider-parts repair, the stored
          record must preserve the parts arrangement, included-item description,
          provider certifications, one service price, customer acceptance, and
          supplier receipt reference. Customers and providers should keep their
          quote, approval, invoice, receipt, and service records.
'''
if records_new not in text:
    if text.count(records_old) != 1:
        raise RuntimeError("Unable to locate the payment-policy records paragraph.")
    text = text.replace(records_old, records_new, 1)

path.write_text(text, encoding="utf-8")
print("Payment policy wording normalized.")
