import { describe, expect, it } from 'vitest';
import { fill } from '../format';

describe('fill', () => {
  it('replaces known placeholders and leaves unknown ones visible', () => {
    expect(fill('Slide {n} of {total}', { n: 2, total: 3 })).toBe('Slide 2 of 3');
    expect(fill('Hello {who}', {})).toBe('Hello {who}');
  });
});
