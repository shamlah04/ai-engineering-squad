import { describe, expect, it } from 'vitest';

import { redactSecrets } from '../../src/domain/audit.js';

describe('audit redaction', () => {
  it('redacts common secret formats', () => {
    const value = 'api_key=abc123 password: hunter2 Bearer abc.def.ghi';
    const redacted = redactSecrets(value);
    expect(redacted).not.toContain('abc123');
    expect(redacted).not.toContain('hunter2');
    expect(redacted).not.toContain('abc.def.ghi');
  });
});
