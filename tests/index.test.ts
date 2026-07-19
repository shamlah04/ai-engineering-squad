import { describe, expect, it } from 'vitest';

import { greeting } from '../src/index.js';

describe('greeting', () => {
  it('greets the provided name', () => {
    expect(greeting('team')).toBe('Hello, team!');
  });
});
