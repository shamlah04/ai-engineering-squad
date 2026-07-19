import { execFile } from 'node:child_process';
import { readdir, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

import { redactSecrets } from '../../domain/audit.js';
import type {
  CommandRequest,
  CommandResult,
  RepositoryInspection,
  RepositoryWorkspace,
} from '../../ports/repository-workspace.js';

const execFileAsync = promisify(execFile);
const allowedCommands = new Set(['git', 'npm', 'node', 'npx']);
const destructiveTokens = new Set([
  'clean',
  'deploy',
  'merge',
  'publish',
  'push',
  'reset',
  'rm',
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
    } = {},
  ) {
    this.#maxOutputBytes = options.maxOutputBytes ?? 64_000;
    this.#maxTimeoutMs = options.maxTimeoutMs ?? 30_000;
    this.onToolAction = options.onToolAction;
  }

  private readonly onToolAction:
    ((result: CommandResult) => Promise<void>) | undefined;

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
    const result = await this.run({
      command: 'git',
      args: ['diff', '--name-only'],
    });
    return result.stdout
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private validate(request: CommandRequest): void {
    if (!allowedCommands.has(request.command))
      throw new UnsafeCommandError(
        `Command is not allowlisted: ${request.command}`,
      );
    const normalized = request.args.map((value) =>
      value.toLowerCase().replace(/^--?/, ''),
    );
    const prohibited = normalized.find((value) => destructiveTokens.has(value));
    if (prohibited)
      throw new UnsafeCommandError(
        `Potentially destructive or external command denied: ${prohibited}`,
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
