import type {
  ProductAnalystAssignment,
  ProductAnalystResult,
} from '../domain/agents.js';

export interface AgentRunner {
  runProductAnalyst(
    assignment: ProductAnalystAssignment,
  ): Promise<ProductAnalystResult>;
}
