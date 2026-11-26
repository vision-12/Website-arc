import { describe, expect, it } from 'vitest';
import { formatFileSize } from '../file-size';

describe('formatFileSize', () => {
  it.each([
    [512, '512 bytes'],
    [245_760, '240 KB'],
    [1_258_291, '1.2 MB'],
    [18 * 1024 * 1024, '18 MB'],
    [-1, ''],
  ])('%d → %s', (bytes, label) => expect(formatFileSize(bytes)).toBe(label));
});
