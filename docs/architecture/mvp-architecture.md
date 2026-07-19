# AI Engineering Squad — MVP Architecture

Status: Implemented MVP
Last updated: 2026-07-19

## 1. Purpose and scope

AI Engineering Squad is a human-controlled workflow for moving an engineering task through analysis, design, implementation, testing, review, and a validated pull-request proposal. The MVP must make agent work inspectable, bounded, resumable, and subject to explicit human approval.

The implemented MVP covers requirement clarification, versioned planning and approval, bounded local execution, quality evidence, code review, delivery approval, local PR-proposal export, and a terminal demonstration without changing the workflow ownership model.

## 2. Repository assessment

### Current structure

```text
.
├── .env.example
├── .gitignore
├── .nvmrc
├── .prettierrc.json
├── AGENTS.md
├── README.md
├── docs/
│   ├── architecture/
│   │   └── mvp-architecture.md
│   └── product/
│       └── mvp-backlog.md
├── eslint.config.js
├── package.json
├── package-lock.json
├── src/
│   └── index.ts
├── tests/
│   └── index.test.ts
├── tsconfig.build.json
├── tsconfig.json
└── vitest.config.ts
```

The root `AGENTS.md` defines repository-wide product, safety, engineering, quality, and change-discipline rules. There are no commits or remote branches yet; the local repository is on an unborn `master` branch and points at the empty GitHub repository as `origin`.

### Existing technology choices

- Node.js 22+ and npm with a committed lockfile.
- TypeScript 5 in strict mode, NodeNext modules, ESM, and additional safety checks such as `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
- `tsx` for local watch execution.
- Vitest for tests.
- ESLint flat configuration with type-aware TypeScript rules.
- Prettier for formatting.
- Plain source and test directories; no application framework, database, API server, or AI-provider SDK.

### Current health

- Dependency installation succeeds with no reported vulnerabilities.
- Type checking succeeds.
- Production compilation succeeds.
- ESLint passes after excluding its JavaScript configuration file from type-aware self-linting.
- The formatting check passes.
- The existing unit test passes.
- The existing `greeting` function and test are scaffold placeholders, not product behavior.

## 3. Missing setup, risks, and assumptions

### Missing setup

- Domain types, workflow state machine, role contracts, and audit events.
- Durable persistence. The first slice can use in-memory adapters for speed, but durability is required before workflows are trusted across process restarts.
- A provider-neutral model invocation port and a deterministic fake for tests.
- A human-facing transport. Start with a CLI or direct application service; defer HTTP/UI until it provides user value.
- Runtime validation for data crossing process/provider boundaries.
- Stable error taxonomy, identifiers, clock/ID abstractions, and structured logging.
- CI and branch protection.
- Security documentation covering prompt injection, untrusted repository content, credentials, external writes, and approval records.

### Architectural risks

1. **Implicit workflow changes:** If specialists can mutate workflow state, ownership becomes ambiguous and transitions become hard to audit. Only the Team Orchestrator may apply transitions.
2. **Provider leakage:** Provider response types or SDKs in domain code would make behavior difficult to test and replace. Provider calls must sit behind a small port returning validated role outputs.
3. **Unstructured model output:** Natural-language-only responses cannot safely drive state. Every specialist response needs a discriminated, versioned contract and runtime validation at the boundary.
4. **Non-atomic audit records:** State changes without corresponding audit events create unverifiable histories. Persist transition and event atomically when durable storage is introduced.
5. **Unsafe tool authority:** Model-generated requests must never imply permission. External writes, credentials, production access, deployment, merge, or equivalent consequential actions require a recorded, scoped human approval checked by deterministic code.
6. **Concurrent resume attempts:** Duplicate human responses or workers could advance a task twice. Commands need expected-version checks and idempotency keys before concurrent operation.
7. **Prompt injection and data exfiltration:** Task text and repository content are untrusted input. Specialists receive only bounded context and no ambient credentials or tools.
8. **Premature platform design:** Queues, microservices, orchestration frameworks, vector databases, and multi-provider routing would slow learning without helping the first slice.

### Assumptions to validate

- The MVP runs as one Node.js process for one trusted human/operator at a time.
- A CLI or application-service API is adequate for the first slice.
- In-memory persistence is acceptable for the executable first slice if repository interfaces make later durable storage straightforward.
- Product Analyst readiness is advisory but deterministically mapped by the orchestrator: `needs_clarification` pauses; `ready` advances.
- Human clarification is append-only; the original requirement is retained rather than overwritten.
- Specialist agents do not call one another. They receive a bounded assignment from the orchestrator and return a structured result.
- “Pull-request proposal” initially means a validated title, description, diff summary, evidence, and risks. Publishing an actual pull request is a separate external write requiring approval.

## 4. Architecture principles

- **Human authority:** Humans create work, clarify requirements, and approve consequential actions.
- **Single workflow owner:** The Team Orchestrator owns workflow state and is the only component allowed to transition it.
- **Bounded specialists:** Each specialist accepts one typed assignment and returns one typed result. It cannot mutate workflow state or invoke another specialist.
- **Deterministic control plane:** State transitions, permission checks, retries, and validation are regular TypeScript code, never delegated to a model.
- **Provider neutrality:** Domain and application layers depend on an `AgentRunner` port, not on a model vendor or SDK.
- **Audit by construction:** Every command, specialist request/result, human response, approval decision, failure, and state transition emits an ordered audit event.
- **Least authority:** No agent has ambient network, credentials, production, merge, deploy, or external-write access.
- **Simple deployment:** Begin as a modular monolith with replaceable adapters.

## 5. Proposed modular-monolith design

```text
Human / CLI
    |
    v
Application commands
    |
    v
Team Orchestrator ---------------------> Audit Log
    |                                      ^
    | bounded assignment                   | structured event
    v                                      |
Specialist port (AgentRunner) -----------+
    |
    +-- Deterministic fake (tests / local demo)
    +-- Provider adapter (later, explicitly configured)

Repositories
  - WorkflowRepository
  - AuditLogRepository
  - ApprovalRepository (when consequential actions arrive)
```

Suggested source boundaries:

```text
src/
├── domain/
│   ├── workflow.ts          # states, commands, transitions, invariants
│   ├── roles.ts             # role names and versioned assignment/result types
│   ├── audit.ts             # append-only event types
│   └── approval.ts          # prohibited capabilities and approval policy
├── application/
│   ├── team-orchestrator.ts # sole workflow-state owner
│   ├── create-task.ts
│   └── submit-clarification.ts
├── ports/
│   ├── agent-runner.ts
│   ├── workflow-repository.ts
│   ├── audit-log.ts
│   ├── clock.ts
│   └── id-generator.ts
├── adapters/
│   ├── memory/
│   └── agents/              # fake first; provider adapters later
└── cli/
    └── index.ts
```

Dependencies point inward: adapters depend on ports and application/domain contracts; domain code imports no provider, transport, or persistence code.

## 6. Team roles and contracts

All role outputs include `schemaVersion`, `role`, `taskId`, `assignmentId`, `summary`, `findings`, `risks`, and `recommendedNextAction`. Role-specific payloads use a discriminated union.

### Team Orchestrator

- Owns the authoritative workflow state and version.
- Validates commands and legal transitions.
- Creates bounded specialist assignments with the minimum necessary context.
- Validates specialist results before applying them.
- Pauses and resumes workflows.
- Enforces approval policy.
- Records every action and transition.
- Does not perform specialist analysis itself.

### Product Analyst

- Evaluates requirement readiness against explicit criteria: goal, users, scope, acceptance evidence, constraints, and unresolved ambiguity.
- Returns either `ready` with normalized requirements and acceptance criteria, or `needs_clarification` with prioritized questions.
- Cannot change task state.

### Solution Architect

- Proposes a bounded technical approach, affected components, interfaces, risks, and validation strategy.
- Cannot grant permissions or perform implementation.

### Developer

- Produces a change proposal or workspace-local implementation within the approved scope.
- Reports changed files, assumptions, and test instructions.
- Has no merge, deploy, production, credential, or unapproved external-write authority.

### Quality Engineer

- Derives and executes an approved validation plan in the permitted environment.
- Returns structured evidence, failures, and coverage gaps.

### Code Reviewer

- Reviews requirements, architecture, diff, and test evidence.
- Returns findings with severity and a recommendation; it cannot approve on behalf of a human, merge, or publish externally.

## 7. Workflow model

Implemented states:

```text
created
  -> analyzing_requirements
  -> awaiting_clarification
  -> analyzing_requirements  (after human response)
  -> requirements_ready
  -> planning
  -> waiting_for_plan_approval
  -> plan_approved
  -> implementing
  -> validating
  -> reviewing
  -> waiting_for_delivery_approval
  -> completed

Any active state -> failed (with a recorded reason)
```

First-slice commands:

- `CreateEngineeringTask`: creates the task and records the human-provided requirement.
- `EvaluateRequirements`: orchestrator assigns the Product Analyst and records its validated result.
- `SubmitClarification`: accepted only in `awaiting_clarification`; appends answers and resumes analysis.

Core invariants:

- Every workflow has a stable ID, monotonic version, current state, and creation/update timestamps.
- Only the orchestrator writes workflow state.
- A state transition records `from`, `to`, `reason`, `actor`, `correlationId`, timestamp, and resulting workflow version.
- A clarification response cannot erase earlier requirements or questions.
- Invalid or stale commands fail without changing workflow state and still produce an attempted-action audit event where appropriate.
- A specialist output is data, not authority.

## 8. First-slice behavior

1. Human submits a task title and requirement.
2. Orchestrator creates the workflow in `created` and appends `task.created`.
3. Orchestrator transitions to `analyzing_requirements` and assigns the Product Analyst.
4. The Product Analyst returns a validated readiness result.
5. If questions remain, the orchestrator records the result, transitions to `awaiting_clarification`, and returns the questions to the human.
6. Human submits answers tied to the outstanding question IDs.
7. Orchestrator appends the response, transitions to `analyzing_requirements`, and issues a new bounded assignment containing the original requirement plus clarification history.
8. When the Product Analyst returns `ready`, the orchestrator transitions to `requirements_ready` and returns normalized requirements and acceptance criteria.
9. The audit log can be queried in order to reconstruct every action and state transition.

The acceptance test should use a deterministic scripted Product Analyst: first return two questions, then return ready after clarification. This tests orchestration without requiring network access or an AI provider.

## 9. Audit model

Use append-only typed events with at least:

- `eventId`, `eventType`, `schemaVersion`
- `workflowId`, `workflowVersion`, `sequence`
- `timestamp`
- `actor` (`human`, `orchestrator`, or a named specialist)
- `correlationId` and optional `causationId`
- redacted, event-specific payload

First-slice event types:

- `task.created`
- `workflow.transitioned`
- `specialist.assignment_created`
- `specialist.result_received`
- `requirements.clarification_requested`
- `human.clarification_submitted`
- `requirements.ready`
- `command.rejected`
- `workflow.failed`

Do not store credentials, secrets, raw provider headers, or unrestricted model context in audit payloads. Later durable storage must append the audit event and update the workflow in one transaction or use an event-store model.

## 10. Safety and approval boundary

The default policy denies these capabilities to every agent:

- Merge or push protected changes.
- Deploy or access production systems/data.
- Read or use credentials and secrets.
- Perform external writes, including publishing pull requests, comments, tickets, messages, or changing remote resources.

If a later workflow needs one of these actions, the orchestrator must create a precise proposed action, pause, obtain explicit human approval scoped to that action, validate that approval immediately before execution, and audit the proposal, decision, and outcome. Approval is never inferred from a task description or specialist recommendation.

## 11. Deferred production capabilities

- HTTP API and web UI.
- Database choice and distributed workers.
- Real model provider and model-selection policy.
- Durable transactional workflow and audit persistence.
- OS-level sandboxing for implementation tools.
- Sandboxed repository tooling.
- Git hosting integration and pull-request publishing.
- Authentication, multi-tenancy, quotas, and billing.
- Queues, event brokers, containers, Kubernetes, and observability platforms.

These are intentionally deferred until a vertical slice demonstrates a concrete need.

## 12. Architecture acceptance criteria

- TypeScript strict mode remains enabled.
- The domain and orchestrator compile without importing provider SDKs.
- Tests prove specialists cannot directly mutate workflow state.
- Tests prove invalid transitions and stale workflow versions are rejected.
- The first slice pauses, resumes, and reaches `requirements_ready` through a deterministic fake analyst.
- The ordered audit log contains the task, assignments, results, human response, and every transition.
- No execution path provides merge, deploy, production, credential, or external-write authority.
