import type { EngineeringTask } from '../domain/workflow.js';

export class VersionConflictError extends Error {
  public constructor(taskId: string) {
    super(`Workflow version conflict for task ${taskId}`);
    this.name = 'VersionConflictError';
  }
}

export interface WorkflowRepository {
  get(taskId: string): Promise<EngineeringTask | undefined>;
  save(task: EngineeringTask, expectedVersion?: number): Promise<void>;
}
