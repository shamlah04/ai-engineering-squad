export type WorkflowState =
  | 'created'
  | 'analyzing_requirements'
  | 'waiting_for_clarification'
  | 'requirements_ready'
  | 'planning'
  | 'waiting_for_plan_approval'
  | 'plan_approved'
  | 'implementing'
  | 'validating'
  | 'reviewing'
  | 'waiting_for_delivery_approval'
  | 'completed'
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

export interface ImplementationPlan {
  readonly version: number;
  readonly summary: string;
  readonly steps: readonly string[];
  readonly affectedComponents: readonly string[];
  readonly risks: readonly string[];
  readonly assumptions: readonly string[];
  readonly dependencies: readonly string[];
  readonly testStrategy: readonly string[];
  readonly rollbackConsiderations: readonly string[];
  readonly createdAt: string;
}

export interface PlanApproval {
  readonly decision: 'approved' | 'rejected';
  readonly planVersion: number;
  readonly actorId: string;
  readonly justification: string;
  readonly timestamp: string;
  readonly approvalReference: string;
}

export interface DeveloperExecution {
  readonly attempt: number;
  readonly summary: string;
  readonly instructions: readonly string[];
  readonly changedFiles: readonly string[];
  readonly commandResults: readonly {
    readonly command: string;
    readonly exitCode: number;
  }[];
  readonly failures: readonly string[];
}

export interface CriterionEvidence {
  readonly criterionId: string;
  readonly status: 'passed' | 'failed' | 'blocked';
  readonly evidenceReferences: readonly string[];
  readonly notes: string;
}

export interface QualityResult {
  readonly status: 'passed' | 'failed' | 'blocked';
  readonly criteria: readonly CriterionEvidence[];
  readonly regressionRisks: readonly string[];
  readonly missingEvidence: readonly string[];
}

export interface ReviewFinding {
  readonly id: string;
  readonly severity: 'blocking' | 'advisory';
  readonly category:
    | 'correctness'
    | 'maintainability'
    | 'security'
    | 'performance'
    | 'test_coverage'
    | 'architecture';
  readonly summary: string;
  readonly location?: string;
}

export interface ReviewResult {
  readonly findings: readonly ReviewFinding[];
  readonly recommendation: 'approve' | 'changes_required';
}

export interface DeliveryPackage {
  readonly title: string;
  readonly body: string;
  readonly changedFiles: readonly string[];
  readonly remainingRisks: readonly string[];
  readonly deploymentConsiderations: readonly string[];
  readonly createdAt: string;
}

export interface DeliveryDecision {
  readonly decision: 'approved' | 'rejected';
  readonly actorId: string;
  readonly justification: string;
  readonly timestamp: string;
  readonly approvalReference: string;
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
  readonly plans: readonly ImplementationPlan[];
  readonly planApproval?: PlanApproval;
  readonly developerExecutions: readonly DeveloperExecution[];
  readonly qualityResult?: QualityResult;
  readonly reviewResult?: ReviewResult;
  readonly deliveryPackage?: DeliveryPackage;
  readonly deliveryDecision?: DeliveryDecision;
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
  requirements_ready: ['planning', 'failed'],
  planning: ['waiting_for_plan_approval', 'failed'],
  waiting_for_plan_approval: ['planning', 'plan_approved', 'failed'],
  plan_approved: ['implementing', 'failed'],
  implementing: ['validating', 'failed'],
  validating: ['reviewing', 'implementing', 'failed'],
  reviewing: ['implementing', 'waiting_for_delivery_approval', 'failed'],
  waiting_for_delivery_approval: ['completed', 'failed'],
  completed: [],
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
