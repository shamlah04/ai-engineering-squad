import { describe, expect, it } from 'vitest';

import { DeterministicProductAnalyst } from '../../src/adapters/agents/deterministic-product-analyst.js';
import { InMemoryAuditLog } from '../../src/adapters/memory/in-memory-audit-log.js';
import { InMemoryWorkflowRepository } from '../../src/adapters/memory/in-memory-workflow-repository.js';
import { TeamOrchestrator } from '../../src/application/team-orchestrator.js';
import { FixedClock, SequentialIds } from '../helpers.js';

function setup() {
  const audit = new InMemoryAuditLog();
  const orchestrator = new TeamOrchestrator(
    new InMemoryWorkflowRepository(),
    audit,
    new DeterministicProductAnalyst(),
    new FixedClock(),
    new SequentialIds(),
  );
  return { audit, orchestrator };
}

describe('requirement clarification flow', () => {
  it('pauses, accepts mapped and free-form clarification, resumes, and audits the flow', async () => {
    const { orchestrator } = setup();
    const waiting = await orchestrator.createTask({
      title: 'Add workflow',
      objective: 'Create a safe workflow',
      technicalContext: '',
      acceptanceCriteria: [
        { description: 'The workflow pauses for clarification' },
      ],
      actorId: 'human-1',
    });
    expect(waiting.state).toBe('waiting_for_clarification');
    expect(
      waiting.readiness?.blockingQuestions.map((question) => question.id),
    ).toContain('technical-context');

    const ready = await orchestrator.submitClarification({
      taskId: waiting.id,
      expectedVersion: waiting.version,
      actorId: 'human-1',
      answers: [
        {
          questionId: 'technical-context',
          answer: 'Node.js TypeScript repository',
        },
      ],
      freeForm: 'Keep the implementation provider-neutral.',
    });
    expect(ready.state).toBe('requirements_ready');
    expect(ready.clarifications[0]?.answers[0]?.questionId).toBe(
      'technical-context',
    );

    const events = await orchestrator.getAudit(ready.id);
    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        'task.created',
        'specialist.assignment_created',
        'specialist.result_received',
        'requirements.clarification_requested',
        'human.clarification_submitted',
        'requirements.ready',
      ]),
    );
    expect(events.map((event) => event.sequence)).toEqual(
      events.map((_, index) => index + 1),
    );
  });

  it('supports an explicitly audited human readiness override', async () => {
    const { orchestrator } = setup();
    const waiting = await orchestrator.createTask({
      title: 'Unclear task',
      objective: '',
      technicalContext: '',
      acceptanceCriteria: [],
      actorId: 'human-1',
    });
    const ready = await orchestrator.overrideReadiness(
      waiting.id,
      waiting.version,
      'human-1',
      'Proceed with documented assumptions.',
    );
    expect(ready.state).toBe('requirements_ready');
    expect(ready.readinessOverride?.justification).toContain(
      'documented assumptions',
    );
    expect(
      (await orchestrator.getAudit(ready.id)).at(-1)?.approvalReference,
    ).toBeDefined();
  });

  it('rejects clarification outside the waiting state and audits the rejection', async () => {
    const { orchestrator } = setup();
    const ready = await orchestrator.createTask({
      title: 'Ready task',
      objective: 'Deliver behavior',
      technicalContext: 'TypeScript',
      acceptanceCriteria: [{ description: 'It works' }],
      actorId: 'human-1',
    });
    await expect(
      orchestrator.submitClarification({
        taskId: ready.id,
        expectedVersion: ready.version,
        answers: [],
        actorId: 'human-1',
      }),
    ).rejects.toThrow('not waiting');
    expect((await orchestrator.getAudit(ready.id)).at(-1)?.action).toBe(
      'command.rejected',
    );
  });
});
