import { describe, expect, it } from 'vitest';

import { InMemoryAuditLog } from '../../src/adapters/memory/in-memory-audit-log.js';

describe('atomic audit sequencing', () => {
  it('allocates unique ordered sequences inside the repository', async () => {
    const audit = new InMemoryAuditLog();
    const base = {
      taskId: 'task-1',
      workflowState: 'created' as const,
      actorType: 'orchestrator' as const,
      actorId: 'orchestrator',
      action: 'action',
      timestamp: 'now',
      correlationId: 'task-1',
      inputSummary: 'input',
      outputSummary: 'output',
    };
    await Promise.all([
      audit.appendAtomically({ ...base, eventId: 'event-1' }),
      audit.appendAtomically({ ...base, eventId: 'event-2' }),
    ]);
    expect(
      (await audit.list('task-1')).map(({ sequence }) => sequence),
    ).toEqual([1, 2]);
  });
});
