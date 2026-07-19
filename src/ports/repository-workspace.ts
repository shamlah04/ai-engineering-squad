export interface RepositoryInspection {
  readonly root: string;
  readonly files: readonly string[];
}

export interface CommandRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly timeoutMs?: number;
}

export interface CommandResult {
  readonly command: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly truncated: boolean;
}

export interface WorkspaceChange {
  readonly path: string;
  readonly indexStatus: string;
  readonly worktreeStatus: string;
  readonly kind:
    'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'other';
}

export interface RepositoryWorkspace {
  inspect(): Promise<RepositoryInspection>;
  run(request: CommandRequest): Promise<CommandResult>;
  changedFiles(): Promise<readonly string[]>;
  changes(): Promise<readonly WorkspaceChange[]>;
}
