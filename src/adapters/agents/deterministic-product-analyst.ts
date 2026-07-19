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

  public runDeveloper(
    assignment: DeveloperAssignment,
  ): Promise<DeveloperResult> {
    return Promise.resolve({
      assignmentId: assignment.assignmentId,
      taskId: assignment.taskId,
      agentRole: 'developer',
      contractVersion: '1.0',
      status: 'completed',
      summary: `Prepared bounded implementation attempt ${assignment.input.attempt}.`,
      assumptions: [],
      risks: [],
      evidenceReferences: [`plan-v${assignment.input.planVersion}`],
      requestedNextAction: 'run_quality_validation',
      output: {
        instructions: assignment.input.planSteps,
        expectedChangedFiles: [],
      },
    });
  }

  public runQualityEngineer(
    assignment: QualityEngineerAssignment,
  ): Promise<QualityEngineerResult> {
    const commandsPassed = assignment.input.commandResults.every(
      ({ exitCode }) => exitCode === 0,
    );
    const hasEvidence = assignment.input.commandResults.length > 0;
    const status: 'passed' | 'failed' | 'blocked' = !hasEvidence
      ? 'blocked'
      : commandsPassed
        ? 'passed'
        : 'failed';
    const criteria = assignment.input.acceptanceCriteria.map((criterion) => ({
      criterionId: criterion.id,
      status,
      evidenceReferences: hasEvidence
        ? assignment.input.commandResults.map(({ command }) => command)
        : [],
      notes: hasEvidence
        ? commandsPassed
          ? 'All collected validation commands passed.'
          : 'At least one validation command failed.'
        : 'No validation evidence was collected.',
    }));
    return Promise.resolve({
      assignmentId: assignment.assignmentId,
      taskId: assignment.taskId,
      agentRole: 'quality_engineer',
      contractVersion: '1.0',
      status: status === 'passed' ? 'completed' : status,
      summary: `Quality validation ${status}.`,
      assumptions: [],
      risks: status === 'passed' ? [] : ['Acceptance evidence is incomplete.'],
      evidenceReferences: criteria.flatMap(
        ({ evidenceReferences }) => evidenceReferences,
      ),
      requestedNextAction:
        status === 'passed' ? 'begin_code_review' : 'return_to_developer',
      output: {
        status,
        criteria,
        regressionRisks:
          status === 'passed' ? [] : ['Unvalidated regression risk.'],
        missingEvidence: criteria
          .filter((criterion) => criterion.evidenceReferences.length === 0)
          .map(({ criterionId }) => criterionId),
      },
    });
  }

  public runCodeReviewer(
    assignment: CodeReviewerAssignment,
  ): Promise<CodeReviewerResult> {
    const failedCriteria = assignment.input.qualityEvidence.filter(
      ({ status }) => status !== 'passed',
    );
    const newFindings = failedCriteria.map((criterion) => ({
      id: `quality-${criterion.criterionId}`,
      severity: 'blocking' as const,
      category: 'test_coverage' as const,
      summary: `Acceptance criterion ${criterion.criterionId} lacks passing evidence.`,
    }));
    const byId = new Map(
      [...assignment.input.previousFindings, ...newFindings].map((finding) => [
        finding.id,
        finding,
      ]),
    );
    const findings = [...byId.values()].filter((finding) =>
      newFindings.some(({ id }) => id === finding.id),
    );
    return Promise.resolve({
      assignmentId: assignment.assignmentId,
      taskId: assignment.taskId,
      agentRole: 'code_reviewer',
      contractVersion: '1.0',
      status: 'completed',
      summary:
        findings.length === 0
          ? 'Review found no blocking issues.'
          : 'Review requires remediation.',
      assumptions: [],
      risks: [],
      evidenceReferences: assignment.input.changedFiles,
      requestedNextAction:
        findings.length === 0 ? 'prepare_delivery' : 'remediate_findings',
      output: {
        findings,
        recommendation: findings.length === 0 ? 'approve' : 'changes_required',
      },
    });
  }
}
