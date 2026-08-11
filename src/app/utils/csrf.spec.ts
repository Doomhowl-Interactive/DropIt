import { describe, expect, it } from 'vitest';
import { readCsrfToken } from './csrf';

const withCookie = (cookie: string) => ({ cookie }) as Document;

describe('readCsrfToken', () => {
  it('reads the token when it is the only cookie', () => {
    expect(readCsrfToken(withCookie('csrf_token=abc123'))).toBe('abc123');
  });

  it('finds the token among other cookies', () => {
    expect(readCsrfToken(withCookie('theme=dark; csrf_token=abc123; other=1'))).toBe('abc123');
  });

  it('tolerates missing whitespace after the separator', () => {
    expect(readCsrfToken(withCookie('theme=dark;csrf_token=abc123'))).toBe('abc123');
  });

  it('returns an empty string when the cookie is absent', () => {
    expect(readCsrfToken(withCookie(''))).toBe('');
    expect(readCsrfToken(withCookie('theme=dark'))).toBe('');
  });

  it('does not match a cookie that merely ends with the name', () => {
    expect(readCsrfToken(withCookie('not_csrf_token=nope'))).toBe('');
  });
});
