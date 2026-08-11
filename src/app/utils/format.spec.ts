import { describe, expect, it } from 'vitest';
import { formatBytes, formatTime } from './format';

describe('formatBytes', () => {
  it('special-cases zero', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('picks the largest unit that fits', () => {
    expect(formatBytes(512)).toBe('512 Bytes');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 ** 2)).toBe('1 MB');
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
    expect(formatBytes(1024 ** 4)).toBe('1 TB');
  });

  it('rounds to two decimals by default and drops trailing zeros', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1_572_864)).toBe('1.5 MB');
    expect(formatBytes(1234)).toBe('1.21 KB');
  });

  it('honours an explicit precision', () => {
    expect(formatBytes(1234, 0)).toBe('1 KB');
    expect(formatBytes(1234, 3)).toBe('1.205 KB');
  });

  it('treats a negative precision as zero', () => {
    expect(formatBytes(1234, -2)).toBe('1 KB');
  });
});

describe('formatTime', () => {
  it('renders M:SS below an hour', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9)).toBe('0:09');
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(3599)).toBe('59:59');
  });

  it('adds an hours field and pads the minutes past an hour', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(45296)).toBe('12:34:56');
  });

  it('truncates fractional seconds', () => {
    expect(formatTime(59.9)).toBe('0:59');
  });

  it('returns a placeholder for negative and non-finite input', () => {
    expect(formatTime(-1)).toBe('--:--');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('--:--');
    expect(formatTime(Number.NaN)).toBe('--:--');
  });
});
