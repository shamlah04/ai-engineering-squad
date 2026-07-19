import { describe, expect, it } from 'vitest';

import { DeterministicProductAnalyst } from '../../src/adapters/agents/deterministic-product-analyst.js';
import { InMemoryAuditLog } from '../../src/adapters/memory/in-memory-audit-log.js';
import { InMemoryWorkflowRepository } from '../../src/adapters/memory/in-memory-workflow-repository.js';
import { TeamOrchestrator } from '../../src/application/team-orchestrator.js';
import type { RepositoryWorkspace } from '../../src/ports/repository-workspace.js';
import { FixedClock, SequentialIds } from '../helpers.js';

const workspace: RepositoryWorkspace = {
  inspect: () =>
    Promise.resolve({ root: '/workspace', files: ['src/feature.ts'] }),
  run: (request) =>
    Promise.resolve({
      command: [request.command, ...request.args].join(' '),
      exitCode: 0,
      stdout: 'passed',
      stderr: '',
      durationMs: 1,
      truncated: false,
    }),
  changedFiles: () =>
    Promise.resolve(['src/feature.ts', 'tests/feature.test.ts']),
  changes: () =>
    Promise.resolve([
      {
        path: 'src/feature.ts',
        indexStatus: ' ',
        worktreeStatus: 'M',
        kind: 'modified',
      },
    ]),
};

describe('main MVP lifecycle', () => {
  it('moves from ready requirements through approved local delivery', async () => {
    const orchestrator = new TeamOrchestrator(
      new InMemoryWorkflowRepository(),
      new InMemoryAuditLog(),
      new DeterministicProductAnalyst(),
      new FixedClock(),
      new SequentialIds(),
      workspace,
    );
    const ready = await orchestrator.createTask({
      title: 'Feature',
      objective: 'Deliver safe feature',
      technicalContext: 'TypeScript repository',
      acceptanceCriteria: [{ description: 'Automated tests pass' }],
      actorId: 'human',
    });
    const plan = await orchestrator.createPlan(ready.id, ready.version);
    const approvedPlan = await orchestrator.decidePlan(
      plan.id,
      plan.version,
      'human',
      'approved',
      'Plan reviewed.',
    );
    const implemented = await orchestrator.executeDevelopment(
      approvedPlan.id,
      approvedPlan.version,
    );
    expect(implemented.state).toBe('validating');
    const validated = await orchestrator.validateQuality(
      implemented.id,
      implemented.version,
    );
    expect(
      validated.qualityResult?.criteria.every(
        ({ status }) => status === 'passed',
      ),
    ).toBe(true);
    const reviewed = await orchestrator.reviewCode(
      validated.id,
      validated.version,
    );
    expect(reviewed.state).toBe('waiting_for_delivery_approval');
    expect(reviewed.deliveryPackage?.body).toContain('Automated tests');
    const completed = await orchestrator.decideDelivery(
      reviewed.id,
      reviewed.version,
      'human',
      'approved',
      'Evidence and risks reviewed.',
    );
    expect(completed.state).toBe('completed');
    expect(completed.deliveryDecision?.approvalReference).toBeDefined();
    const actions = (await orchestrator.getAudit(completed.id)).map(
      ({ action }) => action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        'tool.command_executed',
        'delivery.approval_requested',
        'delivery.approved',
      ]),
    );
  });
});
