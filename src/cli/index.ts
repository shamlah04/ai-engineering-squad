import { createInterface } from 'node:readline/promises';

import { DeterministicProductAnalyst } from '../adapters/agents/deterministic-product-analyst.js';
import { InMemoryAuditLog } from '../adapters/memory/in-memory-audit-log.js';
import { InMemoryWorkflowRepository } from '../adapters/memory/in-memory-workflow-repository.js';
import { SystemClock, UuidGenerator } from '../adapters/platform/system.js';
import { SafeLocalWorkspace } from '../adapters/workspace/safe-local-workspace.js';
import { exportDeliveryProposal } from '../application/export-delivery-proposal.js';
import { TeamOrchestrator } from '../application/team-orchestrator.js';
import type { EngineeringTask } from '../domain/workflow.js';
import { renderAudit, renderTask } from './render.js';

const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = async (question: string): Promise<string> =>
  (await terminal.question(question)).trim();

async function main(): Promise<void> {
  const orchestrator = new TeamOrchestrator(
    new InMemoryWorkflowRepository(),
    new InMemoryAuditLog(),
    new DeterministicProductAnalyst(),
    new SystemClock(),
    new UuidGenerator(),
    new SafeLocalWorkspace(process.cwd()),
  );
  console.log('AI Engineering Squad — local deterministic demo');
  console.log(
    'No remote writes, credentials, merges, or deployments are available.\n',
  );
  const title = await ask('Task title: ');
  const objective = await ask('Objective: ');
  const technicalContext = await ask('Repository or technical context: ');
  const criterion = await ask(
    'Acceptance criterion (leave empty to clarify later): ',
  );
  let task = await orchestrator.createTask({
    title,
    objective,
    technicalContext,
    acceptanceCriteria: criterion ? [{ description: criterion }] : [],
    actorId: 'local-human',
  });
  while (task.state !== 'completed' && task.state !== 'failed') {
    console.log(`\n${renderTask(task)}\n`);
    console.log(
      `Audit timeline:\n${renderAudit(await orchestrator.getAudit(task.id))}\n`,
    );
    task = await advance(orchestrator, task);
  }
  console.log(`\n${renderTask(task)}`);
  if (task.state === 'completed') {
    const path = await exportDeliveryProposal(task, '.ai-squad-output');
    console.log(`\nLocal PR proposal written to ${path}`);
  }
  console.log(
    `\nFinal audit timeline:\n${renderAudit(await orchestrator.getAudit(task.id))}`,
  );
}

async function advance(
  orchestrator: TeamOrchestrator,
  task: EngineeringTask,
): Promise<EngineeringTask> {
  switch (task.state) {
    case 'waiting_for_clarification': {
      const answers = [];
      for (const question of task.readiness?.blockingQuestions ?? []) {
        answers.push({
          questionId: question.id,
          answer: await ask(`${question.text}\n> `),
        });
      }
      const freeForm = await ask('Optional additional clarification: ');
      return orchestrator.submitClarification({
        taskId: task.id,
        expectedVersion: task.version,
        answers,
        ...(freeForm ? { freeForm } : {}),
        actorId: 'local-human',
      });
    }
    case 'requirements_ready':
      await ask('Press Enter to request a technical plan.');
      return orchestrator.createPlan(task.id, task.version);
    case 'waiting_for_plan_approval': {
      const decision = await ask('Plan decision (approve/reject/changes): ');
      const justification = await ask('Decision justification: ');
      const normalized =
        decision === 'approve'
          ? 'approved'
          : decision === 'changes'
            ? 'changes_requested'
            : 'rejected';
      return orchestrator.decidePlan(
        task.id,
        task.version,
        'local-human',
        normalized,
        justification,
      );
    }
    case 'plan_approved':
    case 'implementing':
      await ask('Press Enter to run the bounded local Developer assignment.');
      return orchestrator.executeDevelopment(task.id, task.version);
    case 'validating':
      await ask('Press Enter to run Quality Engineer validation.');
      return orchestrator.validateQuality(task.id, task.version);
    case 'reviewing':
      await ask('Press Enter to run Code Reviewer analysis.');
      return orchestrator.reviewCode(task.id, task.version);
    case 'waiting_for_delivery_approval': {
      const decision = await ask('Delivery decision (approve/reject): ');
      const justification = await ask('Decision justification: ');
      return orchestrator.decideDelivery(
        task.id,
        task.version,
        'local-human',
        decision === 'approve' ? 'approved' : 'rejected',
        justification,
      );
    }
    default:
      throw new Error(`Demo cannot advance state: ${task.state}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => terminal.close());
