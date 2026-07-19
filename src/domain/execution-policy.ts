export interface QualityGate {
  readonly id: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly required: boolean;
}

export const defaultQualityGates: readonly QualityGate[] = [
  {
    id: 'typecheck',
    command: 'npm',
    args: ['run', 'typecheck'],
    required: true,
  },
  { id: 'lint', command: 'npm', args: ['run', 'lint'], required: true },
  {
    id: 'format',
    command: 'npm',
    args: ['run', 'format:check'],
    required: true,
  },
  { id: 'test', command: 'npm', args: ['test'], required: true },
  { id: 'build', command: 'npm', args: ['run', 'build'], required: true },
];

export type RepositoryTrust =
  'trusted_internal' | 'partially_trusted' | 'untrusted_external';
