import { describe, expect, it } from 'vitest';

import { DeterministicProductAnalyst } from '../../src/adapters/agents/deterministic-product-analyst.js';
import { InMemoryAuditLog } from '../../src/adapters/memory/in-memory-audit-log.js';
import { InMemoryWorkflowRepository } from '../../src/adapters/memory/in-memory-workflow-repository.js';
import { TeamOrchestrator } from '../../src/application/team-orchestrator.js';
import { FixedClock, SequentialIds } from '../helpers.js';

const setup = () =>
  new TeamOrchestrator(
    new InMemoryWorkflowRepository(),
    new InMemoryAuditLog(),
    new DeterministicProductAnalyst(),
    new FixedClock(),
    new SequentialIds(),
  );

describe('planning approval', () => {
  it('versions a revised plan and requires explicit approval', async () => {
    const orchestrator = setup();
    const ready = await orchestrator.createTask({
      title: 'Feature',
      objective: 'Deliver feature',
      technicalContext: 'TypeScript',
      acceptanceCriteria: [{ description: 'Feature works' }],
      actorId: 'human',
    });
    const first = await orchestrator.createPlan(ready.id, ready.version);
    expect(first.state).toBe('waiting_for_plan_approval');
    const revised = await orchestrator.decidePlan(
      first.id,
      first.version,
      'human',
      'changes_requested',
      'Add rollback detail.',
    );
    expect(revised.plans.map(({ version }) => version)).toEqual([1, 2]);
    const approved = await orchestrator.decidePlan(
      revised.id,
      revised.version,
      'human',
      'approved',
      'Plan is safe and scoped.',
    );
    expect(approved.state).toBe('plan_approved');
    expect(approved.planApproval?.approvalReference).toBeDefined();
    expect(
      (await orchestrator.getAudit(approved.id)).map(({ action }) => action),
    ).toContain('plan.approved');
  });
});
