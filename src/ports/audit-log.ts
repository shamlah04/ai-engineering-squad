import type { AuditEvent } from '../domain/audit.js';

export interface AuditLog {
  append(event: AuditEvent): Promise<void>;
  list(taskId: string): Promise<readonly AuditEvent[]>;
}
