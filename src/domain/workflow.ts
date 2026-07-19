export type WorkflowState =
  | 'created'
  | 'analyzing_requirements'
  | 'waiting_for_clarification'
  | 'requirements_ready'
  | 'failed';

export interface AcceptanceCriterion {
  readonly id: string;
  readonly description: string;
}

export interface BlockingQuestion {
  readonly id: string;
  readonly text: string;
  readonly topic: string;
}

export interface ClarificationAnswer {
  readonly questionId: string;
  readonly answer: string;
}

export interface Clarification {
  readonly answers: readonly ClarificationAnswer[];
  readonly freeForm?: string;
  readonly submittedAt: string;
}

export interface ReadinessAssessment {
  readonly status: 'ready' | 'needs_clarification';
  readonly score: number;
  readonly missingInformation: readonly string[];
  readonly blockingQuestions: readonly BlockingQuestion[];
  readonly assumptions: readonly string[];
  readonly risks: readonly string[];
  readonly recommendedNextAction: string;
  readonly normalizedRequirements?: string;
}

export interface EngineeringTask {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  readonly technicalContext: string;
  readonly acceptanceCriteria: readonly AcceptanceCriterion[];
  readonly blockingDependencies: readonly string[];
  readonly contradictions: readonly string[];
  readonly clarifications: readonly Clarification[];
  readonly state: WorkflowState;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly readiness?: ReadinessAssessment;
  readonly readinessOverride?: {
    readonly justification: string;
    readonly actorId: string;
    readonly timestamp: string;
  };
}

const transitions: Readonly<Record<WorkflowState, readonly WorkflowState[]>> = {
  created: ['analyzing_requirements', 'failed'],
  analyzing_requirements: [
    'waiting_for_clarification',
    'requirements_ready',
    'failed',
  ],
  waiting_for_clarification: [
    'analyzing_requirements',
    'requirements_ready',
    'failed',
  ],
  requirements_ready: ['failed'],
  failed: [],
};

export class InvalidTransitionError extends Error {
  public constructor(from: WorkflowState, to: WorkflowState) {
    super(`Invalid workflow transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function transitionTask(
  task: EngineeringTask,
  to: WorkflowState,
  timestamp: string,
): EngineeringTask {
  if (!transitions[task.state].includes(to)) {
    throw new InvalidTransitionError(task.state, to);
  }
  return {
    ...task,
    state: to,
    version: task.version + 1,
    updatedAt: timestamp,
  };
}
