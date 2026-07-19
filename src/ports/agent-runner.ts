import type {
  CodeReviewerAssignment,
  CodeReviewerResult,
  DeveloperAssignment,
  DeveloperResult,
  ProductAnalystAssignment,
  ProductAnalystResult,
  QualityEngineerAssignment,
  QualityEngineerResult,
  SolutionArchitectAssignment,
  SolutionArchitectResult,
} from '../domain/agents.js';

export interface AgentRunner {
  runProductAnalyst(
    assignment: ProductAnalystAssignment,
  ): Promise<ProductAnalystResult>;
  runSolutionArchitect(
    assignment: SolutionArchitectAssignment,
  ): Promise<SolutionArchitectResult>;
  runDeveloper(assignment: DeveloperAssignment): Promise<DeveloperResult>;
  runQualityEngineer(
    assignment: QualityEngineerAssignment,
  ): Promise<QualityEngineerResult>;
  runCodeReviewer(
    assignment: CodeReviewerAssignment,
  ): Promise<CodeReviewerResult>;
}
