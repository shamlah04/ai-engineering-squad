import type { AuditEvent } from '../../domain/audit.js';
import type { AuditLog } from '../../ports/audit-log.js';

export class InMemoryAuditLog implements AuditLog {
  readonly #events: AuditEvent[] = [];

  public append(event: AuditEvent): Promise<void> {
    this.#events.push(structuredClone(event));
    return Promise.resolve();
  }

  public list(taskId: string): Promise<readonly AuditEvent[]> {
    return Promise.resolve(
      this.#events.filter((event) => event.taskId === taskId),
    );
  }
}
