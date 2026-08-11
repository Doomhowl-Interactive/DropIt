import { beforeEach, describe, expect, it } from 'vitest';

import { testDb } from '../../testing/db';
import { McpTokenRepository } from './repository';
import { hashSecret, McpTokenService } from './service';

describe('McpTokenService', () => {
  let repo: McpTokenRepository;
  let service: McpTokenService;

  beforeEach(() => {
    repo = new McpTokenRepository(testDb());
    service = new McpTokenService(repo);
  });

  it('returns a secret that is not itself stored', async () => {
    const { token, secret } = await service.issue({ name: 'laptop', userId: 1 });

    expect(secret).toMatch(/^dropit_mcp_/);
    expect(token.tokenHash).toBe(hashSecret(secret));

    const stored = await repo.findById(token.id);
    expect(stored.tokenHash).not.toContain(secret);
    expect(Object.values(stored)).not.toContain(secret);
    expect(token.prefix).toBe(secret.slice(0, token.prefix.length));
  });

  it('accepts a freshly issued secret', async () => {
    const { token, secret } = await service.issue({ name: 'laptop', userId: 1 });

    await expect(service.verify(secret)).resolves.toMatchObject({ id: token.id });
  });

  it('rejects unknown, revoked and expired secrets', async () => {
    await expect(service.verify('dropit_mcp_nope')).resolves.toBeNull();
    await expect(service.verify('')).resolves.toBeNull();

    const revoked = await service.issue({ name: 'revoked', userId: 1 });
    await service.revoke(revoked.token.id);
    await expect(service.verify(revoked.secret)).resolves.toBeNull();

    const expired = await service.issue({
      name: 'expired',
      userId: 1,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.verify(expired.secret)).resolves.toBeNull();
  });

  it('records when a token was last used', async () => {
    const { token, secret } = await service.issue({ name: 'laptop', userId: 1 });
    expect(token.lastUsedAt).toBeNull();

    await service.verify(secret);

    const stored = await repo.findById(token.id);
    expect(stored.lastUsedAt).toBeInstanceOf(Date);
  });

  it('refuses a blank name', async () => {
    await expect(service.issue({ name: '   ', userId: 1 })).rejects.toThrow(/name is required/);
  });
});
