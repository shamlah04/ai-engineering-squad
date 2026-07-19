import type {
  CodeReviewerAssignment,
  DeveloperAssignment,
  ProductAnalystAssignment,
  QualityEngineerAssignment,
  SolutionArchitectAssignment,
} from '../domain/agents.js';
import { redactSecrets } from '../domain/audit.js';
import {
  type AcceptanceCriterion,
  type ClarificationAnswer,
  type EngineeringTask,
  transitionTask,
} from '../domain/workflow.js';
import type { AgentRunner } from '../ports/agent-runner.js';
import type { AuditLog } from '../ports/audit-log.js';
import type { Clock } from '../ports/clock.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { RepositoryWorkspace } from '../ports/repository-workspace.js';
import type { WorkflowRepository } from '../ports/workflow-repository.js';

export interface CreateTaskInput {
  readonly title: string;
  readonly objective: string;
  readonly technicalContext: string;
  readonly acceptanceCriteria: readonly Omit<AcceptanceCriterion, 'id'>[];
  readonly blockingDependencies?: readonly string[];
  readonly contradictions?: readonly string[];
  readonly actorId: string;
}

export interface SubmitClarificationInput {
  readonly taskId: string;
  readonly expectedVersion: number;
  readonly answers: readonly ClarificationAnswer[];
  readonly freeForm?: string;
  readonly actorId: string;
}

export class TeamOrchestrator {
  public constructor(
    private readonly workflows: WorkflowRepository,
    private readonly audit: AuditLog,
    private readonly agents: AgentRunner,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly workspace?: RepositoryWorkspace,
  ) {}

  public async createTask(input: CreateTaskInput): Promise<EngineeringTask> {
    if (!input.title.trim()) throw new Error('Task title is required.');
    const timestamp = this.clock.now();
    const task: EngineeringTask = {
      id: this.ids.next('task'),
      title: input.title.trim(),
      objective: input.objective.trim(),
      technicalContext: input.technicalContext.trim(),
      acceptanceCriteria: input.acceptanceCriteria.map((criterion) => ({
        id: this.ids.next('criterion'),
        description: criterion.description.trim(),
      })),
      blockingDependencies: [...(input.blockingDependencies ?? [])],
      contradictions: [...(input.contradictions ?? [])],
      clarifications: [],
      plans: [],
      developerExecutions: [],
      state: 'created',
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.workflows.save(task);
    await this.record(
      task,
      'human',
      input.actorId,
      'task.created',
      input.title,
      'Task created',
    );
    return this.analyzeRequirements(task);
  }

  public async submitClarification(
    input: SubmitClarificationInput,
  ): Promise<EngineeringTask> {
    const existing = await this.requireTask(input.taskId);
    if (existing.version !== input.expectedVersion)
      throw new Error('Stale workflow version.');
    if (existing.state !== 'waiting_for_clarification') {
      await this.record(
        existing,
        'human',
        input.actorId,
        'command.rejected',
        'Submit clarification',
        'Invalid workflow state',
        undefined,
        'Task is not waiting for clarification',
      );
      throw new Error('Task is not waiting for clarification.');
    }
    const timestamp = this.clock.now();
    const clarified: EngineeringTask = {
      ...existing,
      clarifications: [
        ...existing.clarifications,
        {
          answers: [...input.answers],
          ...(input.freeForm?.trim()
            ? { freeForm: input.freeForm.trim() }
            : {}),
          submittedAt: timestamp,
        },
      ],
      version: existing.version + 1,
      updatedAt: timestamp,
    };
    await this.workflows.save(clarified, existing.version);
    await this.record(
      clarified,
      'human',
      input.actorId,
      'human.clarification_submitted',
      `${input.answers.length} mapped answers`,
      input.freeForm ?? 'No free-form clarification',
    );
    return this.analyzeRequirements(clarified);
  }

  public async overrideReadiness(
    taskId: string,
    expectedVersion: number,
    actorId: string,
    justification: string,
  ): Promise<EngineeringTask> {
    const existing = await this.requireTask(taskId);
    if (existing.version !== expectedVersion)
      throw new Error('Stale workflow version.');
    if (existing.state !== 'waiting_for_clarification' || !justification.trim())
      throw new Error('A waiting task and justification are required.');
    const timestamp = this.clock.now();
    const transitioned = transitionTask(
      existing,
      'requirements_ready',
      timestamp,
    );
    const overridden: EngineeringTask = {
      ...transitioned,
      readinessOverride: {
        justification: justification.trim(),
        actorId,
        timestamp,
      },
    };
    await this.workflows.save(overridden, existing.version);
    await this.record(
      overridden,
      'human',
      actorId,
      'requirements.readiness_overridden',
      justification,
      'Requirements marked ready by human',
      this.ids.next('approval'),
    );
    return overridden;
  }

  public async getTask(taskId: string): Promise<EngineeringTask> {
    return this.requireTask(taskId);
  }

  public async executeDevelopment(
    taskId: string,
    expectedVersion: number,
  ): Promise<EngineeringTask> {
    const existing = await this.requireTask(taskId);
    if (existing.version !== expectedVersion)
      throw new Error('Stale workflow version.');
    if (existing.state !== 'plan_approved' && existing.state !== 'implementing')
      throw new Error('Task is not approved for implementation.');
    if (!this.workspace)
      throw new Error('No repository workspace is configured.');
    const attempt = existing.developerExecutions.length + 1;
    if (attempt > 3) throw new Error('Developer retry limit reached.');
    const implementing =
      existing.state === 'implementing'
        ? existing
        : transitionTask(existing, 'implementing', this.clock.now());
    if (implementing !== existing)
      await this.workflows.save(implementing, existing.version);
    const plan = existing.plans.at(-1);
    if (!plan) throw new Error('No approved plan exists.');
    const assignment: DeveloperAssignment = {
      assignmentId: this.ids.next('assignment'),
      taskId,
      agentRole: 'developer',
      contractVersion: '1.0',
      input: {
        objective: existing.objective,
        planVersion: plan.version,
        planSteps: plan.steps,
        attempt,
        remediationFindings:
          existing.reviewResult?.findings.filter(
            ({ severity }) => severity === 'blocking',
          ) ?? [],
      },
    };
    await this.record(
      implementing,
      'orchestrator',
      'team-orchestrator',
      'specialist.assignment_created',
      assignment.assignmentId,
      assignment.agentRole,
    );
    const agentResult = await this.agents.runDeveloper(assignment);
    const commandResult = await this.workspace.run({
      command: 'npm',
      args: ['test'],
      timeoutMs: 30_000,
    });
    await this.record(
      implementing,
      'tool',
      'safe-command-runner',
      'tool.command_executed',
      commandResult.command,
      `exit=${commandResult.exitCode}`,
    );
    const changedFiles = await this.workspace.changedFiles();
    const withExecution: EngineeringTask = {
      ...implementing,
      developerExecutions: [
        ...implementing.developerExecutions,
        {
          attempt,
          summary: agentResult.summary,
          instructions: agentResult.output.instructions,
          changedFiles,
          commandResults: [
            {
              command: commandResult.command,
              exitCode: commandResult.exitCode,
            },
          ],
          failures:
            commandResult.exitCode === 0
              ? []
              : [commandResult.stderr || 'Validation command failed.'],
        },
      ],
    };
    await this.record(
      withExecution,
      'specialist',
      'developer',
      'specialist.result_received',
      agentResult.summary,
      agentResult.requestedNextAction,
    );
    const validating = transitionTask(
      withExecution,
      'validating',
      this.clock.now(),
    );
    await this.workflows.save(validating, implementing.version);
    return validating;
  }

  public async validateQuality(
    taskId: string,
    expectedVersion: number,
  ): Promise<EngineeringTask> {
    const existing = await this.requireTask(taskId);
    if (existing.version !== expectedVersion || existing.state !== 'validating')
      throw new Error('Task is not ready for validation.');
    const execution = existing.developerExecutions.at(-1);
    if (!execution) throw new Error('No developer execution exists.');
    const assignment: QualityEngineerAssignment = {
      assignmentId: this.ids.next('assignment'),
      taskId,
      agentRole: 'quality_engineer',
      contractVersion: '1.0',
      input: {
        acceptanceCriteria: existing.acceptanceCriteria,
        changedFiles: execution.changedFiles,
        commandResults: execution.commandResults,
      },
    };
    await this.record(
      existing,
      'orchestrator',
      'team-orchestrator',
      'specialist.assignment_created',
      assignment.assignmentId,
      assignment.agentRole,
    );
    const agentResult = await this.agents.runQualityEngineer(assignment);
    const nextState =
      agentResult.output.status === 'passed' ? 'reviewing' : 'implementing';
    const result = transitionTask(
      { ...existing, qualityResult: agentResult.output },
      nextState,
      this.clock.now(),
    );
    await this.workflows.save(result, existing.version);
    await this.record(
      result,
      'specialist',
      'quality-engineer',
      'specialist.result_received',
      agentResult.summary,
      agentResult.requestedNextAction,
    );
    return result;
  }

  public async reviewCode(
    taskId: string,
    expectedVersion: number,
  ): Promise<EngineeringTask> {
    const existing = await this.requireTask(taskId);
    if (
      existing.version !== expectedVersion ||
      existing.state !== 'reviewing' ||
      !existing.qualityResult
    )
      throw new Error('Task is not ready for review.');
    const execution = existing.developerExecutions.at(-1);
    if (!execution) throw new Error('No developer execution exists.');
    const assignment: CodeReviewerAssignment = {
      assignmentId: this.ids.next('assignment'),
      taskId,
      agentRole: 'code_reviewer',
      contractVersion: '1.0',
      input: {
        changedFiles: execution.changedFiles,
        qualityEvidence: existing.qualityResult.criteria,
        previousFindings: existing.reviewResult?.findings ?? [],
      },
    };
    await this.record(
      existing,
      'orchestrator',
      'team-orchestrator',
      'specialist.assignment_created',
      assignment.assignmentId,
      assignment.agentRole,
    );
    const agentResult = await this.agents.runCodeReviewer(assignment);
    if (agentResult.output.recommendation === 'changes_required') {
      const remediation = transitionTask(
        { ...existing, reviewResult: agentResult.output },
        'implementing',
        this.clock.now(),
      );
      await this.workflows.save(remediation, existing.version);
      await this.record(
        remediation,
        'specialist',
        'code-reviewer',
        'review.remediation_requested',
        agentResult.summary,
        agentResult.requestedNextAction,
      );
      return remediation;
    }
    const timestamp = this.clock.now();
    const ready = transitionTask(
      {
        ...existing,
        reviewResult: agentResult.output,
        deliveryPackage: {
          title: existing.title,
          body: this.buildDeliveryBody(existing, execution.changedFiles),
          changedFiles: execution.changedFiles,
          remainingRisks: [
            ...(existing.qualityResult.regressionRisks ?? []),
            ...existing.plans.at(-1)!.risks,
          ],
          deploymentConsiderations: ['No deployment is performed by the MVP.'],
          createdAt: timestamp,
        },
      },
      'waiting_for_delivery_approval',
      timestamp,
    );
    await this.workflows.save(ready, existing.version);
    await this.record(
      ready,
      'specialist',
      'code-reviewer',
      'specialist.result_received',
      agentResult.summary,
      agentResult.requestedNextAction,
    );
    await this.record(
      ready,
      'orchestrator',
      'team-orchestrator',
      'delivery.approval_requested',
      ready.deliveryPackage?.title ?? '',
      ready.state,
    );
    return ready;
  }

  public async decideDelivery(
    taskId: string,
    expectedVersion: number,
    actorId: string,
    decision: 'approved' | 'rejected',
    justification: string,
  ): Promise<EngineeringTask> {
    const existing = await this.requireTask(taskId);
    if (
      existing.version !== expectedVersion ||
      existing.state !== 'waiting_for_delivery_approval' ||
      !justification.trim()
    )
      throw new Error('A pending delivery and justification are required.');
    const timestamp = this.clock.now();
    const approvalReference = this.ids.next('approval');
    const result: EngineeringTask = {
      ...transitionTask(
        existing,
        decision === 'approved' ? 'completed' : 'failed',
        timestamp,
      ),
      deliveryDecision: {
        decision,
        actorId,
        justification: justification.trim(),
        timestamp,
        approvalReference,
      },
    };
    await this.workflows.save(result, existing.version);
    await this.record(
      result,
      'human',
      actorId,
      `delivery.${decision}`,
      justification,
      result.state,
      approvalReference,
    );
    return result;
  }

  public async createPlan(
    taskId: string,
    expectedVersion: number,
    requestedChanges?: string,
  ): Promise<EngineeringTask> {
    const existing = await this.requireTask(taskId);
    if (existing.version !== expectedVersion)
      throw new Error('Stale workflow version.');
    if (
      existing.state !== 'requirements_ready' &&
      existing.state !== 'waiting_for_plan_approval'
    )
      throw new Error('Task is not ready for planning.');
    const planning = transitionTask(existing, 'planning', this.clock.now());
    await this.workflows.save(planning, existing.version);
    await this.record(
      planning,
      'orchestrator',
      'team-orchestrator',
      'workflow.transitioned',
      existing.state,
      planning.state,
    );
    const prior = existing.plans.at(-1);
    const assignment: SolutionArchitectAssignment = {
      assignmentId: this.ids.next('assignment'),
      taskId,
      agentRole: 'solution_architect',
      contractVersion: '1.0',
      input: {
        objective: existing.objective,
        technicalContext: existing.technicalContext,
        acceptanceCriteria: existing.acceptanceCriteria,
        ...(prior ? { priorPlanVersion: prior.version } : {}),
        ...(requestedChanges?.trim()
          ? { requestedChanges: requestedChanges.trim() }
          : {}),
      },
    };
    await this.record(
      planning,
      'orchestrator',
      'team-orchestrator',
      'specialist.assignment_created',
      assignment.assignmentId,
      assignment.agentRole,
    );
    const result = await this.agents.runSolutionArchitect(assignment);
    await this.record(
      planning,
      'specialist',
      'solution-architect',
      'specialist.result_received',
      result.summary,
      result.requestedNextAction,
    );
    const timestamp = this.clock.now();
    const waiting = transitionTask(
      {
        ...planning,
        plans: [
          ...planning.plans,
          {
            version: (prior?.version ?? 0) + 1,
            ...result.output,
            createdAt: timestamp,
          },
        ],
      },
      'waiting_for_plan_approval',
      timestamp,
    );
    await this.workflows.save(waiting, planning.version);
    await this.record(
      waiting,
      'orchestrator',
      'team-orchestrator',
      'plan.approval_requested',
      `Plan version ${waiting.plans.at(-1)?.version ?? 0}`,
      waiting.state,
    );
    return waiting;
  }

  public async decidePlan(
    taskId: string,
    expectedVersion: number,
    actorId: string,
    decision: 'approved' | 'rejected' | 'changes_requested',
    justification: string,
  ): Promise<EngineeringTask> {
    const existing = await this.requireTask(taskId);
    if (existing.version !== expectedVersion)
      throw new Error('Stale workflow version.');
    if (existing.state !== 'waiting_for_plan_approval' || !justification.trim())
      throw new Error('A pending plan and justification are required.');
    if (decision === 'changes_requested') {
      await this.record(
        existing,
        'human',
        actorId,
        'plan.changes_requested',
        justification,
        'Plan revision requested',
      );
      return this.createPlan(taskId, expectedVersion, justification);
    }
    const plan = existing.plans.at(-1);
    if (!plan) throw new Error('No plan exists.');
    const timestamp = this.clock.now();
    const approvalReference = this.ids.next('approval');
    const nextState = decision === 'approved' ? 'plan_approved' : 'failed';
    const decided: EngineeringTask = {
      ...transitionTask(existing, nextState, timestamp),
      planApproval: {
        decision,
        planVersion: plan.version,
        actorId,
        justification: justification.trim(),
        timestamp,
        approvalReference,
      },
    };
    await this.workflows.save(decided, existing.version);
    await this.record(
      decided,
      'human',
      actorId,
      `plan.${decision}`,
      justification,
      nextState,
      approvalReference,
    );
    return decided;
  }

  public async getAudit(taskId: string) {
    return this.audit.list(taskId);
  }

  private async analyzeRequirements(
    task: EngineeringTask,
  ): Promise<EngineeringTask> {
    const timestamp = this.clock.now();
    const analyzing = transitionTask(task, 'analyzing_requirements', timestamp);
    await this.workflows.save(analyzing, task.version);
    await this.record(
      analyzing,
      'orchestrator',
      'team-orchestrator',
      'workflow.transitioned',
      task.state,
      analyzing.state,
    );
    const assignment: ProductAnalystAssignment = {
      assignmentId: this.ids.next('assignment'),
      taskId: analyzing.id,
      agentRole: 'product_analyst',
      contractVersion: '1.0',
      input: {
        title: analyzing.title,
        objective: analyzing.objective,
        technicalContext: analyzing.technicalContext,
        acceptanceCriteria: analyzing.acceptanceCriteria,
        blockingDependencies: analyzing.blockingDependencies,
        contradictions: analyzing.contradictions,
        clarifications: analyzing.clarifications,
      },
    };
    await this.record(
      analyzing,
      'orchestrator',
      'team-orchestrator',
      'specialist.assignment_created',
      assignment.assignmentId,
      assignment.agentRole,
    );
    const result = await this.agents.runProductAnalyst(assignment);
    await this.record(
      analyzing,
      'specialist',
      'product-analyst',
      'specialist.result_received',
      result.summary,
      result.requestedNextAction,
    );
    const nextState =
      result.output.status === 'ready'
        ? 'requirements_ready'
        : 'waiting_for_clarification';
    const transitioned = transitionTask(
      { ...analyzing, readiness: result.output },
      nextState,
      this.clock.now(),
    );
    await this.workflows.save(transitioned, analyzing.version);
    await this.record(
      transitioned,
      'orchestrator',
      'team-orchestrator',
      'workflow.transitioned',
      analyzing.state,
      nextState,
    );
    if (nextState === 'waiting_for_clarification') {
      await this.record(
        transitioned,
        'orchestrator',
        'team-orchestrator',
        'requirements.clarification_requested',
        `${result.output.blockingQuestions.length} questions`,
        result.output.recommendedNextAction,
      );
    } else {
      await this.record(
        transitioned,
        'orchestrator',
        'team-orchestrator',
        'requirements.ready',
        result.summary,
        result.output.recommendedNextAction,
      );
    }
    return transitioned;
  }

  private async requireTask(taskId: string): Promise<EngineeringTask> {
    const task = await this.workflows.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return task;
  }

  private async record(
    task: EngineeringTask,
    actorType: 'human' | 'orchestrator' | 'specialist' | 'tool',
    actorId: string,
    action: string,
    inputSummary: string,
    outputSummary: string,
    approvalReference?: string,
    errorInformation?: string,
  ): Promise<void> {
    const current = await this.audit.list(task.id);
    await this.audit.append({
      eventId: this.ids.next('event'),
      taskId: task.id,
      workflowState: task.state,
      actorType,
      actorId,
      action,
      timestamp: this.clock.now(),
      correlationId: task.id,
      inputSummary: redactSecrets(inputSummary),
      outputSummary: redactSecrets(outputSummary),
      ...(approvalReference ? { approvalReference } : {}),
      ...(errorInformation
        ? { errorInformation: redactSecrets(errorInformation) }
        : {}),
      sequence: current.length + 1,
    });
  }

  private buildDeliveryBody(
    task: EngineeringTask,
    changedFiles: readonly string[],
  ): string {
    const plan = task.plans.at(-1);
    return [
      `## Objective\n${task.objective}`,
      `## Approved plan\nVersion ${plan?.version ?? 'unknown'}`,
      `## Changed files\n${changedFiles.length ? changedFiles.join('\n') : 'No tracked changes reported.'}`,
      `## Validation\n${
        task.qualityResult?.criteria
          .map(({ criterionId, status }) => {
            const description =
              task.acceptanceCriteria.find(({ id }) => id === criterionId)
                ?.description ?? criterionId;
            return `${description} (${criterionId}): ${status}`;
          })
          .join('\n') ?? 'No evidence.'
      }`,
      '## Review\nNo unresolved blocking findings.',
    ].join('\n\n');
  }
}
