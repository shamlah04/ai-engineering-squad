import type {
  ProductAnalystAssignment,
  ProductAnalystResult,
  SolutionArchitectAssignment,
  SolutionArchitectResult,
} from '../../domain/agents.js';
import type { BlockingQuestion } from '../../domain/workflow.js';
import type { AgentRunner } from '../../ports/agent-runner.js';

export class DeterministicProductAnalyst implements AgentRunner {
  public runProductAnalyst(
    assignment: ProductAnalystAssignment,
  ): Promise<ProductAnalystResult> {
    const input = assignment.input;
    const answered = new Set(
      input.clarifications.flatMap((item) =>
        item.answers
          .filter((answer) => answer.answer.trim())
          .map((answer) => answer.questionId),
      ),
    );
    const questions: BlockingQuestion[] = [];
    const missing: string[] = [];
    const addMissing = (id: string, topic: string, text: string): void => {
      if (!answered.has(id)) {
        missing.push(topic);
        questions.push({ id, topic, text });
      }
    };

    if (!input.objective.trim())
      addMissing(
        'objective',
        'objective',
        'What objective should this task achieve?',
      );
    if (input.acceptanceCriteria.length === 0)
      addMissing(
        'acceptance-criteria',
        'acceptance criteria',
        'What observable acceptance criterion defines success?',
      );
    if (!input.technicalContext.trim())
      addMissing(
        'technical-context',
        'technical context',
        'What repository or technical context is needed to begin planning?',
      );
    if (input.blockingDependencies.length > 0)
      addMissing(
        'blocking-dependencies',
        'blocking dependencies',
        'How should the listed blocking dependencies be resolved?',
      );
    if (input.contradictions.length > 0)
      addMissing(
        'contradictions',
        'contradictory requirements',
        'Which interpretation resolves the contradictory requirements?',
      );

    const ready = questions.length === 0;
    const score = Math.max(0, 100 - questions.length * 20);
    return Promise.resolve({
      assignmentId: assignment.assignmentId,
      taskId: assignment.taskId,
      agentRole: 'product_analyst',
      contractVersion: '1.0',
      status: 'completed',
      summary: ready
        ? 'Requirements are ready for planning.'
        : 'Requirements need human clarification.',
      assumptions: [],
      risks:
        input.contradictions.length > 0
          ? ['Contradictory requirements may cause rework.']
          : [],
      evidenceReferences: input.acceptanceCriteria.map(
        (criterion) => criterion.id,
      ),
      requestedNextAction: ready
        ? 'begin_planning'
        : 'request_human_clarification',
      output: {
        status: ready ? 'ready' : 'needs_clarification',
        score,
        missingInformation: missing,
        blockingQuestions: questions,
        assumptions: [],
        risks:
          input.contradictions.length > 0
            ? ['Contradictory requirements may cause rework.']
            : [],
        recommendedNextAction: ready
          ? 'Begin technical planning.'
          : 'Answer the blocking questions.',
        ...(ready
          ? {
              normalizedRequirements: `${input.objective.trim()}\n\n${input.technicalContext.trim()}`,
            }
          : {}),
      },
    });
  }

  public runSolutionArchitect(
    assignment: SolutionArchitectAssignment,
  ): Promise<SolutionArchitectResult> {
    const change = assignment.input.requestedChanges?.trim();
    return Promise.resolve({
      assignmentId: assignment.assignmentId,
      taskId: assignment.taskId,
      agentRole: 'solution_architect',
      contractVersion: '1.0',
      status: 'completed',
      summary: change
        ? `Plan revised: ${change}`
        : 'Implementation plan prepared.',
      assumptions: ['Single-process MVP execution.'],
      risks: ['In-memory state is not durable.'],
      evidenceReferences: assignment.input.acceptanceCriteria.map(
        ({ id }) => id,
      ),
      requestedNextAction: 'request_plan_approval',
      output: {
        summary: change
          ? `Revised plan incorporating: ${change}`
          : 'Implement a tested provider-neutral vertical slice.',
        steps: [
          'Extend typed contracts.',
          'Implement through ports.',
          'Validate acceptance criteria.',
        ],
        affectedComponents: ['domain', 'application', 'adapters', 'tests'],
        risks: ['In-memory state is lost on process exit.'],
        assumptions: ['One local human operator.'],
        dependencies: [],
        testStrategy: ['Unit-test rules.', 'Integration-test the workflow.'],
        rollbackConsiderations: [
          'Revert local changes; no external system is modified.',
        ],
      },
    });
  }
}
