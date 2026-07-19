import type { Clock } from '../src/ports/clock.js';
import type { IdGenerator } from '../src/ports/id-generator.js';

export class FixedClock implements Clock {
  public now(): string {
    return '2026-07-19T12:00:00.000Z';
  }
}

export class SequentialIds implements IdGenerator {
  #value = 0;
  public next(prefix: string): string {
    this.#value += 1;
    return `${prefix}-${this.#value}`;
  }
}
