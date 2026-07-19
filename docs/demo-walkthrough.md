# Local demo walkthrough

## Start

```bash
npm ci
npm run demo
```

## Suggested task

- Title: `Add health endpoint`
- Objective: `Expose a process health response`
- Technical context: leave empty to demonstrate clarification
- Acceptance criterion: `A local test verifies a healthy response`

The Product Analyst pauses and asks for missing technical context. Answer with `Node.js 22 TypeScript ESM repository`, then optionally add free-form clarification.

The Solution Architect produces a versioned plan. Choose `changes` to demonstrate revision or `approve` with a justification to continue. The safe workspace then runs the repository test command. The Quality Engineer maps the acceptance criterion to evidence, and the Code Reviewer reports findings or recommends delivery.

Approve delivery with a justification. The demo writes a local proposal under `.ai-squad-output/` and prints the complete audit timeline.

## Safety notes

- The demo is single-process and in-memory.
- It does not use an AI provider or credentials.
- It does not create a remote branch or pull request.
- It does not merge, deploy, access production, or perform rollback.
- Rejecting a plan or delivery ends the demo in a recorded failed state.
