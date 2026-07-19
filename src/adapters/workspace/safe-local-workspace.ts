import { execFile } from 'node:child_process';
import { readdir, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

import { redactSecrets } from '../../domain/audit.js';
import type { RepositoryTrust } from '../../domain/execution-policy.js';
import type {
  CommandRequest,
  CommandResult,
  RepositoryInspection,
  RepositoryWorkspace,
  WorkspaceChange,
} from '../../ports/repository-workspace.js';

const execFileAsync = promisify(execFile);
const allowedPatterns = new Set([
  'npm\0test',
  'npm\0run\0build',
  'npm\0run\0format:check',
  'npm\0run\0lint',
  'npm\0run\0typecheck',
  'git\0diff\0--name-only',
  'git\0diff\0--stat',
  'git\0status\0--porcelain=v1',
]);

export class UnsafeCommandError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'UnsafeCommandError';
  }
}

export class SafeLocalWorkspace implements RepositoryWorkspace {
  readonly #maxOutputBytes: number;
  readonly #maxTimeoutMs: number;

  public constructor(
    private readonly root: string,
    options: {
      readonly maxOutputBytes?: number;
      readonly maxTimeoutMs?: number;
      readonly onToolAction?: (result: CommandResult) => Promise<void>;
      readonly repositoryTrust?: RepositoryTrust;
    } = {},
  ) {
    this.#maxOutputBytes = options.maxOutputBytes ?? 64_000;
    this.#maxTimeoutMs = options.maxTimeoutMs ?? 30_000;
    this.onToolAction = options.onToolAction;
    this.repositoryTrust = options.repositoryTrust ?? 'untrusted_external';
  }

  private readonly onToolAction:
    ((result: CommandResult) => Promise<void>) | undefined;
  private readonly repositoryTrust: RepositoryTrust;

  public async inspect(): Promise<RepositoryInspection> {
    const canonicalRoot = await realpath(this.root);
    const files = await this.walk(canonicalRoot, canonicalRoot);
    return { root: canonicalRoot, files };
  }

  public async run(request: CommandRequest): Promise<CommandResult> {
    this.validate(request);
    const started = Date.now();
    try {
      const result = await execFileAsync(request.command, [...request.args], {
        cwd: this.root,
        encoding: 'utf8',
        env: {
          CI: '1',
          NODE_ENV: 'test',
          PATH: process.env.PATH ?? '',
          npm_config_audit: 'false',
          npm_config_fund: 'false',
          npm_config_update_notifier: 'false',
        },
        maxBuffer: this.#maxOutputBytes * 2,
        timeout: Math.min(
          request.timeoutMs ?? this.#maxTimeoutMs,
          this.#maxTimeoutMs,
        ),
      });
      const commandResult = this.result(
        request,
        0,
        result.stdout,
        result.stderr,
        started,
      );
      await this.onToolAction?.(commandResult);
      return commandResult;
    } catch (error: unknown) {
      const failure = error as {
        readonly code?: number | string;
        readonly stdout?: string;
        readonly stderr?: string;
      };
      const exitCode = typeof failure.code === 'number' ? failure.code : 1;
      const commandResult = this.result(
        request,
        exitCode,
        failure.stdout ?? '',
        failure.stderr ?? String(error),
        started,
      );
      await this.onToolAction?.(commandResult);
      return commandResult;
    }
  }

  public async changedFiles(): Promise<readonly string[]> {
    return (await this.changes()).map(({ path }) => path);
  }

  public async changes(): Promise<readonly WorkspaceChange[]> {
    const result = await this.run({
      command: 'git',
      args: ['status', '--porcelain=v1'],
    });
    if (result.exitCode !== 0) return [];
    return result.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const indexStatus = line[0] ?? ' ';
        const worktreeStatus = line[1] ?? ' ';
        const rawPath = line.slice(3);
        const path = rawPath.includes(' -> ')
          ? (rawPath.split(' -> ').at(-1) ?? rawPath)
          : rawPath;
        const status = `${indexStatus}${worktreeStatus}`;
        const kind: WorkspaceChange['kind'] =
          status === '??'
            ? 'untracked'
            : status.includes('R')
              ? 'renamed'
              : status.includes('D')
                ? 'deleted'
                : status.includes('A')
                  ? 'added'
                  : status.includes('M')
                    ? 'modified'
                    : 'other';
        return { path, indexStatus, worktreeStatus, kind };
      });
  }

  private validate(request: CommandRequest): void {
    const pattern = [request.command, ...request.args].join('\0');
    if (!allowedPatterns.has(pattern))
      throw new UnsafeCommandError(
        `Command pattern is not allowlisted: ${[request.command, ...request.args].join(' ')}`,
      );
    if (
      request.command === 'npm' &&
      this.repositoryTrust !== 'trusted_internal'
    )
      throw new UnsafeCommandError(
        `Repository trust '${this.repositoryTrust}' requires a hardened network-disabled sandbox for npm scripts.`,
      );
    if ((request.timeoutMs ?? 0) < 0)
      throw new UnsafeCommandError('Timeout must be non-negative.');
  }

  private result(
    request: CommandRequest,
    exitCode: number,
    stdout: string,
    stderr: string,
    started: number,
  ): CommandResult {
    const trim = (value: string): { value: string; truncated: boolean } => {
      const redacted = redactSecrets(value);
      return {
        value: redacted.slice(0, this.#maxOutputBytes),
        truncated: redacted.length > this.#maxOutputBytes,
      };
    };
    const out = trim(stdout);
    const err = trim(stderr);
    return {
      command: [request.command, ...request.args].join(' '),
      exitCode,
      stdout: out.value,
      stderr: err.value,
      durationMs: Date.now() - started,
      truncated: out.truncated || err.truncated,
    };
  }

  private async walk(root: string, directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      if (['.git', 'coverage', 'dist', 'node_modules'].includes(entry.name))
        continue;
      const path = resolve(directory, entry.name);
      const relativePath = relative(root, path);
      if (relativePath.startsWith(`..${sep}`) || relativePath === '..')
        throw new UnsafeCommandError('Path escaped workspace root.');
      if (entry.isDirectory()) files.push(...(await this.walk(root, path)));
      else if (entry.isFile()) files.push(relativePath);
    }
    return files.sort();
  }
}
