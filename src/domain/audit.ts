import type { WorkflowState } from './workflow.js';

export type ActorType = 'human' | 'orchestrator' | 'specialist' | 'tool';

export interface AuditEvent {
  readonly eventId: string;
  readonly taskId: string;
  readonly workflowState: WorkflowState;
  readonly actorType: ActorType;
  readonly actorId: string;
  readonly action: string;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly inputSummary: string;
  readonly outputSummary: string;
  readonly approvalReference?: string;
  readonly errorInformation?: string;
  readonly sequence: number;
}

const secretPatterns = [
  /\b(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*[^\s,;]+/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{12,}\b/g,
];

export function redactSecrets(value: string): string {
  return secretPatterns.reduce(
    (redacted, pattern) => redacted.replace(pattern, '[REDACTED]'),
    value,
  );
}
