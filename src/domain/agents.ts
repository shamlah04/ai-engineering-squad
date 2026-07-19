import type {
  AcceptanceCriterion,
  Clarification,
  CriterionEvidence,
  ReadinessAssessment,
  ReviewFinding,
} from './workflow.js';

export type AgentRole =
  | 'product_analyst'
  | 'solution_architect'
  | 'developer'
  | 'quality_engineer'
  | 'code_reviewer';

export interface AgentAssignmentBase {
  readonly assignmentId: string;
  readonly taskId: string;
  readonly agentRole: AgentRole;
  readonly contractVersion: '1.0';
}

export interface ProductAnalystAssignment extends AgentAssignmentBase {
  readonly agentRole: 'product_analyst';
  readonly input: {
    readonly title: string;
    readonly objective: string;
    readonly technicalContext: string;
    readonly acceptanceCriteria: readonly AcceptanceCriterion[];
    readonly blockingDependencies: readonly string[];
    readonly contradictions: readonly string[];
    readonly clarifications: readonly Clarification[];
  };
}

export interface AgentResultBase {
  readonly assignmentId: string;
  readonly taskId: string;
  readonly agentRole: AgentRole;
  readonly contractVersion: '1.0';
  readonly status: 'completed' | 'failed' | 'blocked';
  readonly summary: string;
  readonly assumptions: readonly string[];
  readonly risks: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly requestedNextAction: string;
  readonly errorDetails?: string;
}

export interface ProductAnalystResult extends AgentResultBase {
  readonly agentRole: 'product_analyst';
  readonly output: ReadinessAssessment;
}

export interface SolutionArchitectAssignment extends AgentAssignmentBase {
  readonly agentRole: 'solution_architect';
  readonly input: {
    readonly objective: string;
    readonly technicalContext: string;
    readonly acceptanceCriteria: readonly AcceptanceCriterion[];
    readonly priorPlanVersion?: number;
    readonly requestedChanges?: string;
  };
}

export interface SolutionArchitectResult extends AgentResultBase {
  readonly agentRole: 'solution_architect';
  readonly output: {
    readonly summary: string;
    readonly steps: readonly string[];
    readonly affectedComponents: readonly string[];
    readonly risks: readonly string[];
    readonly assumptions: readonly string[];
    readonly dependencies: readonly string[];
    readonly testStrategy: readonly string[];
    readonly rollbackConsiderations: readonly string[];
  };
}

export interface DeveloperAssignment extends AgentAssignmentBase {
  readonly agentRole: 'developer';
  readonly input: {
    readonly objective: string;
    readonly planVersion: number;
    readonly planSteps: readonly string[];
    readonly attempt: number;
    readonly remediationFindings: readonly ReviewFinding[];
  };
}

export interface DeveloperResult extends AgentResultBase {
  readonly agentRole: 'developer';
  readonly output: {
    readonly instructions: readonly string[];
    readonly expectedChangedFiles: readonly string[];
  };
}

export interface QualityEngineerAssignment extends AgentAssignmentBase {
  readonly agentRole: 'quality_engineer';
  readonly input: {
    readonly acceptanceCriteria: readonly AcceptanceCriterion[];
    readonly changedFiles: readonly string[];
    readonly commandResults: readonly {
      readonly gateId: string;
      readonly command: string;
      readonly exitCode: number;
      readonly required: boolean;
    }[];
  };
}

export interface QualityEngineerResult extends AgentResultBase {
  readonly agentRole: 'quality_engineer';
  readonly output: {
    readonly status: 'passed' | 'failed' | 'blocked';
    readonly criteria: readonly CriterionEvidence[];
    readonly regressionRisks: readonly string[];
    readonly missingEvidence: readonly string[];
  };
}

export interface CodeReviewerAssignment extends AgentAssignmentBase {
  readonly agentRole: 'code_reviewer';
  readonly input: {
    readonly changedFiles: readonly string[];
    readonly qualityEvidence: readonly CriterionEvidence[];
    readonly previousFindings: readonly ReviewFinding[];
  };
}

export interface CodeReviewerResult extends AgentResultBase {
  readonly agentRole: 'code_reviewer';
  readonly output: {
    readonly findings: readonly ReviewFinding[];
    readonly recommendation: 'approve' | 'changes_required';
  };
}
