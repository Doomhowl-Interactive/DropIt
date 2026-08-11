import { describe, expect, it } from 'vitest';
import { checkPassword, hashPassword } from './password';

describe('password hashing', () => {
  it('produces a cost-10 bcrypt hash', async () => {
    const hash = await hashPassword('hunter2');
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });

  it('salts, so the same password hashes differently each time', async () => {
    const [a, b] = await Promise.all([hashPassword('hunter2'), hashPassword('hunter2')]);
    expect(a).not.toBe(b);
  });

  it('accepts the password it hashed', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(checkPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('hunter2');
    await expect(checkPassword('hunter3', hash)).resolves.toBe(false);
    await expect(checkPassword('', hash)).resolves.toBe(false);
  });

  it('resolves to false rather than throwing on a malformed hash', async () => {
    await expect(checkPassword('hunter2', 'not-a-bcrypt-hash')).resolves.toBe(false);
    await expect(checkPassword('hunter2', '')).resolves.toBe(false);
  });
});
