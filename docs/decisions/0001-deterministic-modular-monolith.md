# ADR 0001: Deterministic modular-monolith control plane

- Status: Accepted
- Date: 2026-07-19

## Context

The MVP needs a human-controlled multi-role workflow with strict ownership, auditability, provider neutrality, and no production or external-write authority. Distributed orchestration would add operational complexity before product behavior is validated.

## Decision

Use one TypeScript process organized into domain, application, port, and adapter boundaries. The Team Orchestrator alone validates and applies transitions, retries, and approvals. Specialists consume versioned assignments and return structured results through `AgentRunner`. Begin with deterministic specialists and in-memory repositories. Use a root-confined, allowlisted local workspace adapter for bounded commands.

## Consequences

- Core behavior is deterministic and testable without network access or credentials.
- Provider, storage, and interface adapters can be replaced without changing domain rules.
- In-memory state is not durable and one process supports only a single local operator.
- The command policy is not equivalent to OS sandboxing.
- Distributed workers, durable persistence, authentication, and real provider execution remain production milestones.
