import { describe, expect, it } from 'vitest';

import { renderAudit, renderTask } from '../../src/cli/render.js';
import type { AuditEvent } from '../../src/domain/audit.js';
import type { EngineeringTask } from '../../src/domain/workflow.js';

describe('demo rendering', () => {
  it('shows workflow state, criteria, evidence, findings, and delivery', () => {
    const task = {
      id: 'task-1',
      title: 'Feature',
      objective: 'Objective',
      technicalContext: 'Context',
      acceptanceCriteria: [{ id: 'criterion-1', description: 'Works' }],
      blockingDependencies: [],
      contradictions: [],
      clarifications: [],
      plans: [],
      developerExecutions: [],
      state: 'waiting_for_delivery_approval',
      version: 10,
      createdAt: 'now',
      updatedAt: 'now',
      qualityResult: {
        status: 'passed',
        criteria: [
          {
            criterionId: 'criterion-1',
            status: 'passed',
            evidenceReferences: ['npm test'],
            notes: 'passed',
          },
        ],
        regressionRisks: [],
        missingEvidence: [],
      },
      reviewResult: { recommendation: 'approve', findings: [] },
      deliveryPackage: {
        title: 'Feature',
        body: 'Proposal body',
        changedFiles: [],
        remainingRisks: [],
        deploymentConsiderations: [],
        createdAt: 'now',
      },
    } satisfies EngineeringTask;
    const rendered = renderTask(task);
    expect(rendered).toContain('waiting_for_delivery_approval');
    expect(rendered).toContain('criterion-1: passed [npm test]');
    expect(rendered).toContain('No findings');
    expect(rendered).toContain('Proposal body');
  });

  it('renders the ordered audit timeline with actors and actions', () => {
    const event = {
      eventId: 'event-1',
      taskId: 'task-1',
      workflowState: 'created',
      actorType: 'human',
      actorId: 'human-1',
      action: 'task.created',
      timestamp: 'now',
      correlationId: 'task-1',
      inputSummary: 'input',
      outputSummary: 'created',
      sequence: 1,
    } satisfies AuditEvent;
    expect(renderAudit([event])).toBe(
      '1. now [human:human-1] task.created — created',
    );
  });
});
