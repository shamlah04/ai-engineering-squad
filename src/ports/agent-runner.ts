import type {
  ProductAnalystAssignment,
  ProductAnalystResult,
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
}
