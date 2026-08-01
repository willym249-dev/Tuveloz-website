from pathlib import Path

path = Path(__file__).resolve().parents[1] / "app/payments/page.tsx"
text = path.read_text(encoding="utf-8")
old = '''          processor, insurance, and operational review. If payments are
          enabled, the selected provider business remains the party that accepts
          and performs the vehicle-service agreement, supplies listed parts, and
          honors any provider warranty it expressly offers. Nothing in this draft
          decides a non-waivable warranty right or responsibility.
'''
new = '''          processor, insurance, and operational review.
          If payments are enabled, the selected provider business remains
          the party that accepts and performs the vehicle-service agreement,
          acquires and supplies listed parts, pays or accrues the parts-purchase
          tax required under the selected billing method, preserves supplier
          records, and honors any provider warranty it expressly offers. Nothing
          in this draft decides a non-waivable warranty right or responsibility.
'''
if new not in text:
    if text.count(old) != 1:
        raise RuntimeError("Unable to locate the payment-policy processor paragraph.")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Payment policy wording normalized.")
