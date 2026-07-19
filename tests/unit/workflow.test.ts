import { describe, expect, it } from 'vitest';

import {
  InvalidTransitionError,
  transitionTask,
} from '../../src/domain/workflow.js';

describe('workflow transitions', () => {
  const task = {
    id: 'task-1',
    title: 'Task',
    objective: 'Objective',
    technicalContext: 'Context',
    acceptanceCriteria: [],
    blockingDependencies: [],
    contradictions: [],
    clarifications: [],
    state: 'created' as const,
    version: 1,
    createdAt: 'now',
    updatedAt: 'now',
  };

  it('applies a legal transition and increments the version', () => {
    expect(
      transitionTask(task, 'analyzing_requirements', 'later'),
    ).toMatchObject({
      state: 'analyzing_requirements',
      version: 2,
      updatedAt: 'later',
    });
  });

  it('rejects an invalid transition', () => {
    expect(() => transitionTask(task, 'requirements_ready', 'later')).toThrow(
      InvalidTransitionError,
    );
  });
});
