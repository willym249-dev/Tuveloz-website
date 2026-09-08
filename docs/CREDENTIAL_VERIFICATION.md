# Provider credential checks

The private owner compliance queue has a county registration check for Montgomery County repair and towing evidence. It queries the county's OCP-linked public dataset, compares the exact registration number and legal business name, checks the listed dates and records a receipt bound to the provider, document hash, service and jurisdiction. It does not upload the document to the county. The only query value sent is the registration number.

## What the county check establishes

- A `record_match` means one unexpired record with the expected number and legal name was returned from the official dataset. It is not provider approval, proof that an uploaded PDF is authentic, or proof of current standing, authorized services or insurance.
- Missing records, name mismatches, duplicates and expired entries need follow-up; they are not automatic fraud findings.
- Missing, future or older-than-14-day dataset update times block a current match. Fourteen days is Tuveloz's operational freshness ceiling, not a county guarantee. Timeouts, redirects, malformed records and oversized responses fail closed.
- The dataset's `registration_type` is business structure (corporation, partnership or sole proprietor). It must never be interpreted as repair versus towing authorization.
- A source receipt changes no application, evidence decision, service activation or payment setting. Replacing the document hash prevents displaying the receipt as belonging to the replacement file.

Before acceptance, obtain OCP confirmation of current standing and exact service scope. Record the actual confirmation reference and source. The public county dataset URL alone is blocked as an acceptance source.

Official sources:

- https://www.montgomerycountymd.gov/OCP/bear/mvrt-repairs.html
- https://data.montgomerycountymd.gov/Consumer-Housing/Motor-Vehicle-Repair-and-Towing/dngn-wp3e
- https://www.montgomerycountymd.gov/OCP/licensing/mvr_tow_main.html

## Insurance confirmation

Insurance evidence cannot be accepted using a government business lookup, antivirus scan or an unconnected verification-vendor label. The reviewer must obtain actual confirmation from the insurer or licensed broker, using contact details independently found on their official website, and record:

1. The insurer or broker and verified business contact/portal.
2. Confirmation of the exact named insured and policy.
3. Current policy status, dates and required limits.
4. Coverage for the application's exact service, locations and relevant exclusions.
5. The external case/reference, source, checked date and review validity dates.

These are reviewer-recorded confirmations, not an automated insurer API. Do not check the boxes unless the issuer actually confirmed the facts. A company/producer license search does not establish that a provider's policy exists or covers its services. An uploaded certificate does not guarantee a claim will be paid.

No response: leave pending. A mismatch: request clarification or correction. A confirmed false document: record the actual reason and rejection. Do not infer fraud from a missing public record alone. Do not contact an issuer or transmit applicant documents without applicable authorization.

## Verification and operating limits

Unit tests exercise county responses and insurance validation. `tests/provider-credential-checks.test.mjs` runs the actual owner route and SQL against a fresh migrated in-memory database with synthetic authentication, issuer responses and notification boundaries. `npm run test:e2e:credentials` exercises the actual county-check component in Chromium and WebKit with synthetic HTTP responses.

These tests do not validate any real applicant's insurance, license, certificate or identity. Other credentials still require their actual issuing authority's confirmation. Launch and payment gates remain independent of this tool.
