import type {
  AcceptanceCriterion,
  Clarification,
  ReadinessAssessment,
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
