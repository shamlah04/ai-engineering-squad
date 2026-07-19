import type { AuditEvent } from '../domain/audit.js';

export interface AuditLog {
  appendAtomically(event: Omit<AuditEvent, 'sequence'>): Promise<AuditEvent>;
  list(taskId: string): Promise<readonly AuditEvent[]>;
}
