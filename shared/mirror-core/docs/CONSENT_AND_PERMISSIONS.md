# Consent and permissions

Permission and consent are independent requirements.

- Permission answers: may this actor perform this kind of action in this scope?
- Consent answers: may this local service use this adapter, system, data category, operation, mode, and purpose now?

Both must pass. Missing rules deny by default.

## Permission scopes

Grants can be global or scoped to a system, project, entity type, entity, relation, operation, or expiring session. A matching deny wins over an allow. `read_entity`, `create_proposal`, `review_proposal`, `approve_proposal`, `apply_change`, `rollback_change`, and `connect_adapter` are separate permissions.

Consequences:

- Read never implies propose.
- Propose never implies approve or apply.
- Approval never connects an adapter.
- Adapter connection never implies an operation is approved.
- Human and AI actor types use the same evaluation path; their configured grants may differ and remain visible.

## Consent receipt

A receipt records grantor, grantee service, adapter, native system, scope, allowed and denied operations, connection mode, start/expiry, data categories, purpose, audit reference, and revocation route. The demo receipts explicitly deny `bounded_auto_apply`.

Consent is checked when an adapter connects and again when a packet applies or rolls back. Revocation or expiry blocks the next operation even if the packet was approved earlier. Authority changes increment `authority_revision`, causing an older proposal to conflict and require revalidation.

## Connection modes

| Mode | Read | Propose | Apply |
|---|---:|---:|---:|
| `disconnected` | No | No | No |
| `read_only` | Yes, within receipt | No | No |
| `proposal_only` | Yes | Yes | No |
| `approved_apply` | Yes | Yes | Approved packet only |
| `bounded_auto_apply` | Reserved/disabled in this build | Reserved | No implementation |

The review UI keeps Reject and Approve equally visible. Approval records who decided and why, but the target is unchanged until a separate Apply action rechecks every gate.
