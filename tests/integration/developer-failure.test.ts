import { describe, expect, it } from 'vitest';

import { DeterministicProductAnalyst } from '../../src/adapters/agents/deterministic-product-analyst.js';
import { InMemoryAuditLog } from '../../src/adapters/memory/in-memory-audit-log.js';
import { InMemoryWorkflowRepository } from '../../src/adapters/memory/in-memory-workflow-repository.js';
import { TeamOrchestrator } from '../../src/application/team-orchestrator.js';
import type { RepositoryWorkspace } from '../../src/ports/repository-workspace.js';
import { FixedClock, SequentialIds } from '../helpers.js';

const failingWorkspace: RepositoryWorkspace = {
  inspect: () => Promise.resolve({ root: '/workspace', files: [] }),
  run: (request) =>
    Promise.resolve({
      command: [request.command, ...request.args].join(' '),
      exitCode: 1,
      stdout: '',
      stderr: 'gate failed',
      durationMs: 1,
      truncated: false,
    }),
  changedFiles: () => Promise.resolve(['src/failed.ts']),
  changes: () =>
    Promise.resolve([
      {
        path: 'src/failed.ts',
        indexStatus: ' ',
        worktreeStatus: 'M',
        kind: 'modified',
      },
    ]),
};

describe('developer failure semantics', () => {
  it('does not advance failed gates and blocks after the retry limit', async () => {
    const orchestrator = new TeamOrchestrator(
      new InMemoryWorkflowRepository(),
      new InMemoryAuditLog(),
      new DeterministicProductAnalyst(),
      new FixedClock(),
      new SequentialIds(),
      failingWorkspace,
    );
    const ready = await orchestrator.createTask({
      title: 'Feature',
      objective: 'Deliver feature',
      technicalContext: 'TypeScript',
      acceptanceCriteria: [{ description: 'All gates pass' }],
      actorId: 'human',
    });
    const plan = await orchestrator.createPlan(ready.id, ready.version);
    let task = await orchestrator.decidePlan(
      plan.id,
      plan.version,
      'human',
      'approved',
      'Approved',
    );
    task = await orchestrator.executeDevelopment(task.id, task.version);
    expect(task.state).toBe('implementing');
    expect(task.failure).toMatchObject({
      code: 'QUALITY_GATE_FAILED',
      recoverable: true,
    });
    task = await orchestrator.executeDevelopment(task.id, task.version);
    expect(task.state).toBe('implementing');
    task = await orchestrator.executeDevelopment(task.id, task.version);
    expect(task.state).toBe('blocked');
    expect(task.failure?.recoverable).toBe(false);
    expect(task.developerExecutions).toHaveLength(3);
    expect(task.developerExecutions[0]?.commandResults).toHaveLength(5);
  });
});
