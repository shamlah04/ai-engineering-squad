export type ControlledAction =
  | 'approve_significant_plan'
  | 'install_runtime_dependency'
  | 'external_write'
  | 'create_remote_branch'
  | 'publish_pull_request'
  | 'update_project_management'
  | 'use_credentials'
  | 'access_production'
  | 'deploy'
  | 'rollback'
  | 'merge'
  | 'destructive_command'
  | 'expand_scope';

const approvalRequired = new Set<ControlledAction>([
  'approve_significant_plan',
  'install_runtime_dependency',
  'external_write',
  'create_remote_branch',
  'publish_pull_request',
  'update_project_management',
  'use_credentials',
  'access_production',
  'deploy',
  'rollback',
  'merge',
  'destructive_command',
  'expand_scope',
]);

export interface Approval {
  readonly reference: string;
  readonly action: ControlledAction;
  readonly target: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
}

export function requiresHumanApproval(action: ControlledAction): boolean {
  return approvalRequired.has(action);
}

export function approvalAuthorizes(
  approval: Approval | undefined,
  action: ControlledAction,
  target: string,
): boolean {
  return approval?.action === action && approval.target === target;
}
