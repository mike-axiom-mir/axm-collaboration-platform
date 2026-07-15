# Future company-mirror boundaries

The organisation/process schemas are a representation underlay only. No real company, employee, customer, finance, payroll, inbox, calendar, CRM, machine, or production system is connected.

## Allowed early scope

- User-authored organisation/project/process concepts.
- Public or synthetic fixture data.
- References to policies, tools, workspaces, roles, and evidence with privacy classifications.
- Read-only imports with an explicit purpose, minimal fields, retention, and consent.
- Proposals whose target operation is visible and reversible.

## Excluded without a dedicated domain integration

- Payroll, banking, tax, accounting entries, payments, or contracts.
- Hiring/firing, performance scoring, employee surveillance, or inferred sensitive traits.
- Customer identities, medical data, secrets, credentials, private communications, or unbounded document ingestion.
- Automatic task execution, outbound messages, publishing, purchasing, machine control, or physical work.

Every future company connector needs data-owner authority, purpose limitation, field minimisation, privacy classification, retention/deletion rules, recipient resolution, human review, domain-specific permissions, redacted logs, and revocation. Mirror approval alone is never sufficient authority for a consequential external action.
