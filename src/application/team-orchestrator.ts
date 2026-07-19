import type { ProductAnalystAssignment } from '../domain/agents.js';
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
    actorType: 'human' | 'orchestrator' | 'specialist',
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
}
