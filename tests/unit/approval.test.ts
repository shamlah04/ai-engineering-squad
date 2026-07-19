import { describe, expect, it } from 'vitest';

import {
  approvalAuthorizes,
  requiresHumanApproval,
} from '../../src/domain/approval.js';

describe('human approval policy', () => {
  it('requires approval for consequential actions', () => {
    expect(requiresHumanApproval('external_write')).toBe(true);
    expect(requiresHumanApproval('merge')).toBe(true);
    expect(requiresHumanApproval('access_production')).toBe(true);
  });

  it('does not reuse approval across actions or targets', () => {
    const approval = {
      reference: 'approval-1',
      action: 'publish_pull_request' as const,
      target: 'repo-a/pr-1',
      approvedBy: 'human',
      approvedAt: 'now',
    };
    expect(
      approvalAuthorizes(approval, 'publish_pull_request', 'repo-a/pr-1'),
    ).toBe(true);
    expect(approvalAuthorizes(approval, 'merge', 'repo-a/pr-1')).toBe(false);
    expect(
      approvalAuthorizes(approval, 'publish_pull_request', 'repo-b/pr-2'),
    ).toBe(false);
  });
});
