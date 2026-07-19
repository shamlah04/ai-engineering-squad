import { describe, expect, it } from 'vitest';

import { DeterministicProductAnalyst } from '../../src/adapters/agents/deterministic-product-analyst.js';

describe('Code Reviewer', () => {
  const agent = new DeterministicProductAnalyst();

  it('deduplicates blocking findings and requests remediation', async () => {
    const result = await agent.runCodeReviewer({
      assignmentId: 'review-1',
      taskId: 'task-1',
      agentRole: 'code_reviewer',
      contractVersion: '1.0',
      input: {
        changedFiles: ['src/a.ts'],
        qualityEvidence: [
          {
            criterionId: 'criterion-1',
            status: 'failed',
            evidenceReferences: ['npm test'],
            notes: 'failed',
          },
        ],
        previousFindings: [
          {
            id: 'quality-criterion-1',
            severity: 'blocking',
            category: 'test_coverage',
            summary: 'Existing finding',
          },
        ],
      },
    });
    expect(result.output.recommendation).toBe('changes_required');
    expect(result.output.findings).toHaveLength(1);
    expect(result.output.findings[0]).toMatchObject({
      severity: 'blocking',
      category: 'test_coverage',
    });
  });

  it('recommends approval only with passing evidence', async () => {
    const result = await agent.runCodeReviewer({
      assignmentId: 'review-2',
      taskId: 'task-1',
      agentRole: 'code_reviewer',
      contractVersion: '1.0',
      input: {
        changedFiles: ['src/a.ts'],
        qualityEvidence: [
          {
            criterionId: 'criterion-1',
            status: 'passed',
            evidenceReferences: ['npm test'],
            notes: 'passed',
          },
        ],
        previousFindings: [],
      },
    });
    expect(result.output).toEqual({ findings: [], recommendation: 'approve' });
  });
});
