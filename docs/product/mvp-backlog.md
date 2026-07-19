# AI Engineering Squad — MVP Backlog

Status: Proposed  
Last updated: 2026-07-19

## 1. MVP outcome

A human can submit an engineering task and supervise a six-role AI workflow that produces a validated pull-request proposal. The system preserves human authority, structured specialist boundaries, deterministic workflow state, and a complete audit history.

The backlog is organized as independently demonstrable vertical slices. Each slice should leave the repository runnable and tested. Infrastructure is added only when the next user-visible behavior requires it.

## 2. Definition of done for every slice

- Acceptance behavior is covered by automated tests.
- Type checking, linting, formatting, tests, and production build pass.
- Inputs and outputs crossing a provider or transport boundary are runtime-validated.
- State changes and human/agent actions produce ordered audit events.
- Safety policy remains deny-by-default.
- Documentation describes any new command, state, role contract, or operator step.
- No agent merges, deploys, accesses production, uses credentials, or performs an external write without explicit, scoped human approval.

## 3. Vertical slices

### Slice 0 — Make the scaffold trustworthy

**Goal:** Establish a green, minimal TypeScript foundation before product code.

Work:

- [x] Add `AGENTS.md` with repository conventions, role boundaries, and safety constraints.
- [x] Fix the ESLint project-service configuration.
- [x] Format the existing files and make `npm run check`, `npm run format:check`, and `npm run build` pass.
- Replace the placeholder greeting only when Slice 1 introduces the real entry point.
- [x] Add a CI workflow now that the commands are green locally.
- [x] Rename the unborn local branch to `main` before the initial commit.

Acceptance:

- A clean install followed by the documented verification commands succeeds.
- No runtime framework or production dependency is added.

Implementation note (2026-07-19): completed with a minimal GitHub Actions workflow using Node.js 22 and the repository's existing npm quality commands. The baseline has no runtime dependencies.

### Slice 1 — Requirement clarification loop with audit trail (recommended first working slice)

**Status: Complete (2026-07-19).**

**User outcome:** A human creates a task, receives missing requirement questions, answers them, and sees the workflow resume to requirement readiness with a complete audit trail.

Work:

- Define strict domain types for workflow IDs, versions, states, commands, actors, and audit events.
- Implement legal transition rules owned exclusively by `TeamOrchestrator`.
- Define versioned, discriminated Product Analyst assignment/result contracts.
- Add `AgentRunner`, workflow repository, audit log, clock, and ID-generator ports.
- Add in-memory adapters and deterministic clock/ID/test doubles.
- Implement `CreateEngineeringTask`, `EvaluateRequirements`, and `SubmitClarification` application commands.
- Add a scripted Product Analyst adapter that returns missing questions before clarification and readiness afterward.
- Provide a minimal CLI or executable demonstration of create → pause → clarify → resume.
- Return the current workflow view and ordered audit log to the human.

Acceptance scenarios:

1. Creating a valid task records `task.created` and begins requirement analysis.
2. A `needs_clarification` analyst result records its questions and pauses in `awaiting_clarification`.
3. Clarification answers are appended, not substituted for the original requirement.
4. Submitting clarification in any other state is rejected without advancing the workflow.
5. Re-analysis receives the original requirement and clarification history.
6. A `ready` result transitions to `requirements_ready` with normalized requirements and acceptance criteria.
7. Audit events are ordered and contain every assignment, result, human response, and transition.
8. A specialist has no state repository write capability.
9. The end-to-end acceptance test requires no network, credentials, or model provider.

Implementation note: delivered as an application-service boundary with strict workflow and agent contracts, optimistic versions, in-memory repositories, a deterministic Product Analyst, mapped plus free-form clarification, explicit readiness override, secret-redacted append-only audit events, and unit/integration coverage. No provider SDK or runtime dependency was added.

### Slice 2 — Planning and architecture approval

**Status: Complete (2026-07-19).**

**User outcome:** A human can review, revise, approve, or reject a structured technical plan produced by a bounded Solution Architect.

Work:

- Define a versioned Solution Architect assignment/result behind `AgentRunner`.
- Produce risks, assumptions, dependencies, affected components, test strategy, and rollback considerations.
- Version revised plans and retain their history.
- Require audited human approval before implementation may begin.

Acceptance:

- The architect cannot transition workflow state or approve its own plan.
- Approval, rejection, and requested changes use validated transitions.
- Every plan assignment, result, revision, and decision is audited.

Implementation note: the provider-neutral `AgentRunner` now includes a versioned Solution Architect contract and deterministic adapter. Plans are versioned, contain the required risks, assumptions, dependencies, components, test strategy, and rollback considerations, and cannot advance until an explicit audited human approval. Rejection and requested-change paths are deterministic.

### Slice 3 — Repository workspace and safe tools

**Status: Complete (2026-07-19).**

**User outcome:** Approved local work can inspect the repository and execute bounded validation commands without obtaining external or destructive authority.

Implementation note: a standard-library `RepositoryWorkspace` port and root-confined local adapter provide filtered inspection, changed-file detection, command allowlisting, destructive/external command rejection, timeouts, output limits, secret redaction, and a tool-action audit callback. No remote access, credentials, or runtime dependency was added.

Acceptance:

- Repository inspection excludes generated, dependency, and Git-internal content.
- Only allowlisted local commands execute within the configured workspace root.
- Destructive and external-write command tokens are denied before execution.
- Results are time-bounded, size-bounded, redacted, and available to an audit sink.

### Slice 4 — Workspace-local implementation proposal

**User outcome:** The Developer creates a scoped implementation in an isolated local workspace and reports the exact changes.

Work:

- Define Developer assignment/result contracts and permitted local tool operations.
- Introduce a workspace port with path/scope controls.
- Capture base revision, changed files, diff summary, assumptions, and requested validation.
- Add deterministic policy checks that deny credentials, production, deployment, merge, and unapproved external writes.

Acceptance:

- Changes are confined to the approved workspace and task scope.
- Attempts to use prohibited capabilities are denied and audited.
- No remote branch, pull request, or message is created.

### Slice 5 — Quality validation

**User outcome:** The Quality Engineer validates the implementation against acceptance criteria and returns evidence.

Work:

- Define Quality Engineer assignment/result contracts.
- Derive a bounded test plan from requirements, architecture, and developer result.
- Run approved local checks and capture command, exit status, summarized output, and coverage gaps.
- Route failures back to the Developer with a bounded remediation assignment and iteration limit.

Acceptance:

- Evidence is reproducible and linked to acceptance criteria.
- Failed checks cannot be reported as successful.
- Retry/repair loops are bounded and fully audited.

### Slice 6 — Independent code review

**User outcome:** The Code Reviewer returns actionable findings and a go/no-go recommendation based on the diff and evidence.

Work:

- Define Code Reviewer assignment/result contracts with finding severity and location.
- Give the reviewer read-only access to requirements, architecture, diff, and quality evidence.
- Route blocking findings into a bounded developer/test loop.
- Preserve separation between reviewer recommendation and human approval.

Acceptance:

- Findings are structured, traceable, and deduplicated across iterations.
- The reviewer cannot edit, merge, publish, or approve on behalf of the human.

### Slice 7 — Validated pull-request proposal

**User outcome:** The human receives a complete, validated proposal suitable for manually creating a pull request.

Work:

- Assemble title, description, requirement links, architecture summary, changed files, test evidence, reviewer findings, residual risks, and rollback notes.
- Add deterministic completeness checks.
- Transition to `pr_proposal_ready` only when required evidence exists and no unresolved blocking finding remains.
- Export the proposal locally as text/JSON.

Acceptance:

- The proposal is reproducible from audited workflow artifacts.
- The system performs no external write and does not create a remote pull request.
- The human can see unresolved risks and the complete workflow history.

### Slice 8 — Explicitly approved external publication (post-MVP candidate)

**User outcome:** A human may explicitly approve publishing one already-validated pull-request proposal.

Work:

- Introduce scoped, expiring approval records and an approval-checking capability gateway.
- Present the exact repository, branch, title, body, and write operation before approval.
- Add a Git host adapter outside the domain/application core.
- Revalidate scope and approval immediately before the external write.

Acceptance:

- No approval means no external write.
- Approval for one action cannot authorize another action or credential use.
- Proposal, decision, attempted write, and result are audited.

This slice is deliberately outside the initial MVP unless user validation shows that publication is essential.

## 4. Recommended first slice

Finish the two remaining **Slice 0** repository tasks, then implement **Slice 1**. Slice 0 is a short prerequisite to make the repository trustworthy; Slice 1 is the first product increment.

Slice 1 is the best starting point because it validates the hardest architectural decisions early:

- Team Orchestrator ownership of workflow state.
- Structured, bounded specialist output.
- Human pause/resume semantics.
- Provider-neutral ports.
- Complete auditability.
- Deterministic testing without credentials or external writes.

It also creates a reusable spine for every later specialist without committing to an API framework, database, queue, UI, or model vendor.

## 5. Suggested implementation order for the next task

1. Complete Slice 0 and keep the toolchain green.
2. Write failing acceptance tests for the clarification loop and audit sequence.
3. Implement domain contracts and pure transition rules.
4. Implement ports and in-memory adapters.
5. Implement the Team Orchestrator and application commands.
6. Add the scripted Product Analyst.
7. Add the minimal CLI/demo composition root.
8. Run all checks and document the demonstrated flow.

## 6. Open product questions

1. Is a CLI the intended first human interface, or should Slice 1 expose only an application service for a later UI/API?
2. Is in-memory state acceptable for the first demo, or must workflows survive process restarts from the first slice?
3. What exact readiness rubric should the Product Analyst enforce, and may a human override a `needs_clarification` result?
4. Should clarifications be free-form text, answers mapped to question IDs, or both?
5. Is one active workflow/operator sufficient for the MVP, or is concurrent multi-user operation required?
6. What repository context, if any, may the Product Analyst inspect in Slice 1?
7. Which AI provider should be the first adapter after the deterministic fake, and what budget/latency limits apply?
8. How long must audit history be retained, and what data requires redaction or deletion?
9. Does “validated pull-request proposal” explicitly exclude remote PR creation for the MVP, as assumed here?
10. Which actions beyond external writes require a human checkpoint: architecture acceptance, implementation start, test execution, or each phase transition?
