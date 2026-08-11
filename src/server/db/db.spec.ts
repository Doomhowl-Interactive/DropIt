import { afterEach, describe, expect, it } from 'vitest';
import { connect, fromDbDate, toDbDate } from './db';

describe('toDbDate', () => {
  it('writes an ISO-8601 UTC string', () => {
    expect(toDbDate(new Date(Date.UTC(2026, 7, 11, 12, 30, 5)))).toBe('2026-08-11T12:30:05.000Z');
  });

  it('round-trips through fromDbDate', () => {
    const date = new Date('2026-08-11T12:30:05.123Z');
    expect(fromDbDate(toDbDate(date))?.getTime()).toBe(date.getTime());
  });
});

describe('fromDbDate', () => {
  it('returns null for null and undefined', () => {
    expect(fromDbDate(null)).toBeNull();
    expect(fromDbDate(undefined)).toBeNull();
  });

  it('passes a Date straight through', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(fromDbDate(date)).toBe(date);
  });

  it('treats a number as epoch milliseconds', () => {
    expect(fromDbDate(1_770_000_000_000)?.toISOString()).toBe(
      new Date(1_770_000_000_000).toISOString(),
    );
  });

  it('returns null for values that are neither string, number nor Date', () => {
    expect(fromDbDate({})).toBeNull();
    expect(fromDbDate(true)).toBeNull();
  });

  it('parses ISO strings directly', () => {
    expect(fromDbDate('2026-08-11T12:30:05.000Z')?.toISOString()).toBe('2026-08-11T12:30:05.000Z');
  });

  it('parses the GORM layout with nanoseconds and an offset', () => {
    const parsed = fromDbDate('2026-08-11 00:39:09.044218258+02:00');
    expect(parsed?.toISOString()).toBe('2026-08-10T22:39:09.044Z');
  });

  it('parses a GORM offset written without a colon', () => {
    const parsed = fromDbDate('2026-08-11 00:39:09.044218258+0200');
    expect(parsed?.toISOString()).toBe('2026-08-10T22:39:09.044Z');
  });

  it('returns null for an unparseable string', () => {
    expect(fromDbDate('not a date')).toBeNull();
    expect(fromDbDate('')).toBeNull();
  });
});

describe('connect', () => {
  const saved = process.env['DATABASE_URL'];

  afterEach(() => {
    if (saved === undefined) delete process.env['DATABASE_URL'];
    else process.env['DATABASE_URL'] = saved;
  });

  it('requires DATABASE_URL to be set', async () => {
    delete process.env['DATABASE_URL'];
    await expect(connect()).rejects.toThrow(/DATABASE_URL/);
  });

  it('requires DATABASE_URL to be non-empty', async () => {
    process.env['DATABASE_URL'] = '';
    await expect(connect()).rejects.toThrow(/DATABASE_URL/);
  });
});
