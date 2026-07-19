# Security and approval model

## Default-deny authority

Specialists receive data-only assignments. They have no authority to assign another specialist, transition workflow state, approve their own output, access credentials or production, deploy, merge, or perform external writes.

The MVP contains no remote-write adapter. Local commits used to build the repository are engineering activity, not an agent runtime capability.

## Human checkpoints

The workflow requires explicit, justified, audited human decisions for:

- Requirement-readiness override.
- Significant implementation-plan approval or rejection.
- Delivery approval or rejection.

Future external operations additionally require an approval scoped to the exact target and action, checked immediately before execution. Approval cannot be inferred or reused for unrelated work.

## Tool controls

The local workspace adapter:

- Restricts execution to `git`, `npm`, `node`, and `npx`.
- Rejects destructive and external-write subcommands such as `reset`, `clean`, `push`, `merge`, `publish`, and `deploy`.
- Uses argument arrays rather than a shell.
- Applies timeout and output-size limits.
- Redacts known token, password, secret, API-key, and bearer-token patterns.
- Filters dependencies, builds, coverage, and Git internals from inspection.
- Exposes command results to an audit callback.

This is a policy boundary, not an OS sandbox. Production use requires stronger process isolation and a narrower operation-level capability model.

## Prompt injection

Repository, ticket, user, and provider content is untrusted data. It is never interpreted as authorization. Deterministic workflow code enforces transitions, retries, and approvals. Specialists receive bounded fields rather than ambient credentials or unrestricted tools. Provider output cannot directly invoke tools or change state.

## Audit data

Audit events are append-only and include event/task identity, workflow state, actor, action, timestamp, correlation ID, input/output summaries, sequence, optional approval reference, and optional error information. Known secrets are redacted. Raw credentials, tokens, and unnecessary repository contents must not be stored.

The in-memory audit log is suitable only for the MVP demo. Durable deployment must atomically persist workflow updates and events and define access, retention, and deletion policies.
