import type { AuditEvent } from '../domain/audit.js';
import type { EngineeringTask } from '../domain/workflow.js';

export function renderTask(task: EngineeringTask): string {
  const sections = [
    `Task: ${task.title} (${task.id})`,
    `State: ${task.state} · version ${task.version}`,
    `Acceptance criteria:\n${task.acceptanceCriteria.map(({ id, description }) => `- ${id}: ${description}`).join('\n') || '- None'}`,
  ];
  if (task.readiness)
    sections.push(
      `Readiness: ${task.readiness.status} (${task.readiness.score}/100)`,
      `Blocking questions:\n${task.readiness.blockingQuestions.map(({ id, text }) => `- ${id}: ${text}`).join('\n') || '- None'}`,
    );
  if (task.plans.at(-1))
    sections.push(
      `Plan v${task.plans.at(-1)!.version}: ${task.plans.at(-1)!.summary}`,
    );
  if (task.qualityResult)
    sections.push(
      `Evidence:\n${task.qualityResult.criteria.map(({ criterionId, status, evidenceReferences }) => `- ${criterionId}: ${status} [${evidenceReferences.join(', ')}]`).join('\n')}`,
    );
  if (task.reviewResult)
    sections.push(
      `Review: ${task.reviewResult.recommendation}\n${task.reviewResult.findings.map(({ severity, category, summary }) => `- ${severity}/${category}: ${summary}`).join('\n') || '- No findings'}`,
    );
  if (task.deliveryPackage)
    sections.push(`Delivery proposal:\n${task.deliveryPackage.body}`);
  return sections.join('\n\n');
}

export function renderAudit(events: readonly AuditEvent[]): string {
  return events
    .map(
      (event) =>
        `${event.sequence}. ${event.timestamp} [${event.actorType}:${event.actorId}] ${event.action} — ${event.outputSummary}`,
    )
    .join('\n');
}
