import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  SafeLocalWorkspace,
  UnsafeCommandError,
} from '../../src/adapters/workspace/safe-local-workspace.js';

describe('safe local workspace', () => {
  it('inspects files and runs an allowlisted bounded command', async () => {
    const root = await mkdtemp(join(tmpdir(), 'squad-workspace-'));
    await writeFile(join(root, 'README.md'), 'safe');
    const workspace = new SafeLocalWorkspace(root, { maxOutputBytes: 10 });
    expect((await workspace.inspect()).files).toEqual(['README.md']);
    const result = await workspace.run({
      command: 'node',
      args: ['-e', "console.log('123456789012345')"],
    });
    expect(result.exitCode).toBe(0);
    expect(result.truncated).toBe(true);
  });

  it('rejects commands outside the allowlist and destructive subcommands', async () => {
    const workspace = new SafeLocalWorkspace(process.cwd());
    await expect(
      workspace.run({ command: 'rm', args: ['file'] }),
    ).rejects.toThrow(UnsafeCommandError);
    await expect(
      workspace.run({ command: 'git', args: ['push'] }),
    ).rejects.toThrow('denied');
  });

  it('redacts secrets from command output', async () => {
    const workspace = new SafeLocalWorkspace(process.cwd());
    const result = await workspace.run({
      command: 'node',
      args: ['-e', "console.log('api_key=topsecret')"],
    });
    expect(result.stdout).toContain('[REDACTED]');
    expect(result.stdout).not.toContain('topsecret');
  });
});
