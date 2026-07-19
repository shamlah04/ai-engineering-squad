# AI Engineering Squad

A human-controlled, provider-neutral TypeScript MVP that coordinates bounded AI team roles from requirement analysis through a validated local pull-request proposal.

The MVP does **not** merge, deploy, access production, use credentials, create remote branches, or publish pull requests.

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Setup

```bash
npm ci
cp .env.example .env
```

## Run the deterministic demo

```bash
npm run demo
```

The terminal demo uses in-memory state and deterministic specialist implementations. It walks through task creation, clarification, planning approval, bounded local validation, quality evidence, review, delivery approval, audit history, and a local Markdown PR proposal under `.ai-squad-output/`.

See [docs/demo-walkthrough.md](docs/demo-walkthrough.md) for the full walkthrough.

## Quality commands

- `npm run build` — compile TypeScript to `dist/`
- `npm run typecheck` — check strict TypeScript types
- `npm run lint` — lint the codebase
- `npm run format:check` — verify formatting
- `npm test` — run unit, integration, and end-to-end tests
- `npm run check` — run typecheck, lint, and tests
- `npm run format` — format project files

## Architecture

The Team Orchestrator is the only workflow-state owner. Product Analyst, Solution Architect, Developer, Quality Engineer, and Code Reviewer implementations receive versioned bounded assignments and return structured results. Domain/application code depends on ports rather than model providers, storage products, or external systems.

- [MVP architecture](docs/architecture/mvp-architecture.md)
- [Implementation backlog](docs/product/mvp-backlog.md)
- [Security and approval model](docs/security-and-approvals.md)
- [Architecture decisions](docs/decisions/)

## Current limitations

- State and audit events are in memory and are lost on process exit.
- Specialists are deterministic fakes; no real AI provider is configured.
- The safe workspace matches exact quality/read-only Git commands and requires trusted-repository classification, but is not an OS-level sandbox.
- The Developer produces bounded instructions and validation evidence; autonomous arbitrary code editing is intentionally not enabled.
- Authentication, multi-user concurrency, remote integrations, production access, deployment, merge, and remote PR publication are deferred.
