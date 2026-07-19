import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { exportDeliveryProposal } from '../../src/application/export-delivery-proposal.js';
import type { EngineeringTask } from '../../src/domain/workflow.js';

describe('local delivery proposal', () => {
  it('exports a local-only PR proposal without an external write', async () => {
    const task = {
      id: 'task-1',
      title: 'Feature',
      objective: 'Objective',
      technicalContext: 'Context',
      acceptanceCriteria: [],
      blockingDependencies: [],
      contradictions: [],
      clarifications: [],
      plans: [],
      developerExecutions: [],
      state: 'waiting_for_delivery_approval',
      version: 10,
      createdAt: 'now',
      updatedAt: 'now',
      deliveryPackage: {
        title: 'Feature',
        body: 'Validated change',
        changedFiles: ['src/a.ts'],
        remainingRisks: [],
        deploymentConsiderations: ['Manual deployment only.'],
        createdAt: 'now',
      },
    } satisfies EngineeringTask;
    const directory = await mkdtemp(join(tmpdir(), 'squad-proposal-'));
    const path = await exportDeliveryProposal(task, directory);
    const content = await readFile(path, 'utf8');
    expect(content).toContain('Validated change');
    expect(content).toContain('No remote branch or pull request was created');
  });
});
