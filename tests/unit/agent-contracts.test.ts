import { describe, expect, it } from 'vitest';

import { DeterministicProductAnalyst } from '../../src/adapters/agents/deterministic-product-analyst.js';

describe('specialist contracts', () => {
  it('returns identity and version fields unchanged', async () => {
    const agent = new DeterministicProductAnalyst();
    const result = await agent.runDeveloper({
      assignmentId: 'assignment-1',
      taskId: 'task-1',
      agentRole: 'developer',
      contractVersion: '1.0',
      input: {
        objective: 'Implement',
        planVersion: 1,
        planSteps: ['test-first'],
        attempt: 1,
        remediationFindings: [],
      },
    });
    expect(result).toMatchObject({
      assignmentId: 'assignment-1',
      taskId: 'task-1',
      agentRole: 'developer',
      contractVersion: '1.0',
    });
  });
});
