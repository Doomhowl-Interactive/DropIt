import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ApiTokenNotFoundError, ApiTokenRepository, type ApiToken } from './repository';

/** Recognisable in a config file, and greppable if one ever leaks. */
const TOKEN_PREFIX = 'dropit_api_';
const SECRET_BYTES = 32;
const DISPLAY_PREFIX_LENGTH = TOKEN_PREFIX.length + 6;

/**
 * How stale `lastUsedAt` is allowed to get. A busy agent issues many calls a
 * minute and every one of them would otherwise be a write.
 */
const TOUCH_INTERVAL_MS = 60_000;

export interface IssuedToken {
  token: ApiToken;
  /** The plaintext secret. Returned here once and never recoverable again. */
  secret: string;
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export class ApiTokenService {
  constructor(private readonly repo: ApiTokenRepository) {}

  async issue(input: { name: string; userId: number }): Promise<IssuedToken> {
    const name = input.name.trim();
    if (!name) throw new Error('token name is required');

    const secret = TOKEN_PREFIX + randomBytes(SECRET_BYTES).toString('base64url');

    const token = await this.repo.create({
      id: randomUUID(),
      name,
      tokenHash: hashSecret(secret),
      prefix: secret.slice(0, DISPLAY_PREFIX_LENGTH),
      userId: input.userId,
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
    });

    return { token, secret };
  }

  /**
   * Resolves a bearer secret to a live token, or null when it is unknown or
   * revoked. The lookup is a single indexed match on the hash of a 256-bit
   * secret, so there is no guessable prefix to time against.
   */
  async verify(secret: string): Promise<ApiToken | null> {
    if (!secret) return null;

    const token = await this.repo.findByHash(hashSecret(secret));
    if (!token) return null;
    if (token.revokedAt) return null;

    await this.touch(token);
    return token;
  }

  list(): Promise<ApiToken[]> {
    return this.repo.getAll();
  }

  async revoke(id: string): Promise<ApiToken> {
    const token = await this.repo.findById(id);
    if (token.revokedAt) return token;

    await this.repo.revoke(id);
    return this.repo.findById(id);
  }

  /** Best-effort last-seen bookkeeping; never blocks or fails a request. */
  private async touch(token: ApiToken): Promise<void> {
    const now = new Date();
    const last = token.lastUsedAt?.getTime() ?? 0;
    if (now.getTime() - last < TOUCH_INTERVAL_MS) return;

    try {
      await this.repo.touchLastUsed(token.id, now);
      token.lastUsedAt = now;
    } catch {
      // A missed timestamp is not worth failing an otherwise valid call.
    }
  }
}

export { ApiTokenNotFoundError };
export type { ApiToken };
