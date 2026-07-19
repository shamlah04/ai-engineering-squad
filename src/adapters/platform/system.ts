import { randomUUID } from 'node:crypto';

import type { Clock } from '../../ports/clock.js';
import type { IdGenerator } from '../../ports/id-generator.js';

export class SystemClock implements Clock {
  public now(): string {
    return new Date().toISOString();
  }
}

export class UuidGenerator implements IdGenerator {
  public next(prefix: string): string {
    return `${prefix}-${randomUUID()}`;
  }
}
