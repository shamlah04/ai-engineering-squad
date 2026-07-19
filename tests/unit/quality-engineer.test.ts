import { describe, expect, it } from 'vitest';

import { DeterministicProductAnalyst } from '../../src/adapters/agents/deterministic-product-analyst.js';

describe('Quality Engineer', () => {
  const agent = new DeterministicProductAnalyst();
  const base = {
    assignmentId: 'assignment-qe',
    taskId: 'task-1',
    agentRole: 'quality_engineer' as const,
    contractVersion: '1.0' as const,
    input: {
      acceptanceCriteria: [{ id: 'criterion-1', description: 'Tests pass' }],
      changedFiles: ['src/a.ts'],
    },
  };

  it('maps every criterion to passing evidence', async () => {
    const result = await agent.runQualityEngineer({
      ...base,
      input: {
        ...base.input,
        commandResults: [{ command: 'npm test', exitCode: 0 }],
      },
    });
    expect(result.output.status).toBe('passed');
    expect(result.output.criteria).toEqual([
      {
        criterionId: 'criterion-1',
        status: 'passed',
        evidenceReferences: ['npm test'],
        notes: 'All collected validation commands passed.',
      },
    ]);
  });

  it('reports missing evidence as blocked', async () => {
    const result = await agent.runQualityEngineer({
      ...base,
      input: { ...base.input, commandResults: [] },
    });
    expect(result.output.status).toBe('blocked');
    expect(result.output.missingEvidence).toEqual(['criterion-1']);
  });

  it('reports failing commands and regression risk', async () => {
    const result = await agent.runQualityEngineer({
      ...base,
      input: {
        ...base.input,
        commandResults: [{ command: 'npm test', exitCode: 1 }],
      },
    });
    expect(result.output.status).toBe('failed');
    expect(result.output.regressionRisks).not.toHaveLength(0);
  });
});
