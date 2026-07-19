import type { EngineeringTask } from '../../domain/workflow.js';
import {
  type WorkflowRepository,
  VersionConflictError,
} from '../../ports/workflow-repository.js';

export class InMemoryWorkflowRepository implements WorkflowRepository {
  readonly #tasks = new Map<string, EngineeringTask>();

  public get(taskId: string): Promise<EngineeringTask | undefined> {
    return Promise.resolve(this.#tasks.get(taskId));
  }

  public save(task: EngineeringTask, expectedVersion?: number): Promise<void> {
    const current = this.#tasks.get(task.id);
    if (expectedVersion !== undefined && current?.version !== expectedVersion) {
      throw new VersionConflictError(task.id);
    }
    this.#tasks.set(task.id, structuredClone(task));
    return Promise.resolve();
  }
}
