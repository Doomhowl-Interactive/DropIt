import { describe, expect, it } from 'vitest';
import { formatTimestamp, humanSize, param, safeFilename } from './util';

describe('humanSize', () => {
  it('reports anything under a kilobyte in bytes', () => {
    expect(humanSize(0)).toBe('0 B');
    expect(humanSize(1)).toBe('1 B');
    expect(humanSize(1023)).toBe('1023 B');
  });

  it('switches unit at every 1024 boundary', () => {
    expect(humanSize(1024)).toBe('1.0 KB');
    expect(humanSize(1024 ** 2)).toBe('1.0 MB');
    expect(humanSize(1024 ** 3)).toBe('1.0 GB');
    expect(humanSize(1024 ** 4)).toBe('1.0 TB');
    expect(humanSize(1024 ** 5)).toBe('1.0 PB');
    expect(humanSize(1024 ** 6)).toBe('1.0 EB');
  });

  it('keeps one decimal place', () => {
    expect(humanSize(543000)).toBe('530.3 KB');
    expect(humanSize(1536)).toBe('1.5 KB');
  });
});

describe('formatTimestamp', () => {
  it('renders DD/MM/YY HH:MM with zero padding', () => {
    expect(formatTimestamp(new Date(2026, 7, 3, 9, 5))).toBe('03/08/26 09:05');
  });

  it('takes the last two digits of the year', () => {
    expect(formatTimestamp(new Date(2001, 11, 25, 23, 59))).toBe('25/12/01 23:59');
  });
});

describe('param', () => {
  it('returns a plain string param unchanged', () => {
    expect(param({ params: { id: 'abc' } }, 'id')).toBe('abc');
  });

  it('takes the first entry when Express hands back an array', () => {
    expect(param({ params: { id: ['first', 'second'] } }, 'id')).toBe('first');
  });

  it('yields an empty string for a missing or empty param', () => {
    expect(param({ params: {} }, 'id')).toBe('');
    expect(param({ params: { id: [] } }, 'id')).toBe('');
  });

  it('stringifies non-string values', () => {
    expect(param({ params: { id: 42 } }, 'id')).toBe('42');
  });
});

describe('safeFilename', () => {
  it('passes ordinary names through', () => {
    expect(safeFilename('report.pdf')).toBe('report.pdf');
  });

  it('keeps non-ASCII characters', () => {
    expect(safeFilename('résumé — 2026.pdf')).toBe('résumé — 2026.pdf');
  });

  it('strips the characters that would break out of a quoted header', () => {
    expect(safeFilename('a"b\\c.txt')).toBe('abc.txt');
  });

  it('strips control characters, including DEL', () => {
    expect(safeFilename('a\nb\tcd.txt')).toBe('abcd.txt');
  });

  it('falls back to "file" when nothing survives', () => {
    expect(safeFilename('"\\\n')).toBe('file');
    expect(safeFilename('')).toBe('file');
  });
});
