import type { AuditEvent } from '../../domain/audit.js';
import type { AuditLog } from '../../ports/audit-log.js';

export class InMemoryAuditLog implements AuditLog {
  readonly #events: AuditEvent[] = [];

  public appendAtomically(
    event: Omit<AuditEvent, 'sequence'>,
  ): Promise<AuditEvent> {
    const sequence =
      this.#events.filter(({ taskId }) => taskId === event.taskId).length + 1;
    const sequenced = { ...event, sequence };
    this.#events.push(structuredClone(sequenced));
    return Promise.resolve(sequenced);
  }

  public list(taskId: string): Promise<readonly AuditEvent[]> {
    return Promise.resolve(
      this.#events.filter((event) => event.taskId === taskId),
    );
  }
}
