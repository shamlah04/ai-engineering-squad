import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { EngineeringTask } from '../domain/workflow.js';

export async function exportDeliveryProposal(
  task: EngineeringTask,
  outputDirectory: string,
): Promise<string> {
  if (!task.deliveryPackage)
    throw new Error('No delivery package is available.');
  if (
    task.state !== 'waiting_for_delivery_approval' &&
    task.state !== 'completed'
  )
    throw new Error('Delivery proposal is not ready for export.');
  await mkdir(outputDirectory, { recursive: true });
  const path = join(outputDirectory, `${task.id}-pull-request-proposal.md`);
  const content = [
    `# ${task.deliveryPackage.title}`,
    task.deliveryPackage.body,
    `## Remaining risks\n${task.deliveryPackage.remainingRisks.map((risk) => `- ${risk}`).join('\n') || '- None reported.'}`,
    `## Deployment considerations\n${task.deliveryPackage.deploymentConsiderations.map((item) => `- ${item}`).join('\n')}`,
    '\n> Local proposal only. No remote branch or pull request was created.',
  ].join('\n\n');
  await writeFile(path, content, { encoding: 'utf8', flag: 'wx' });
  return path;
}
