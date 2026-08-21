import { eq } from 'drizzle-orm';
import { fromDbDate, toDbDate, type Db } from '../db/db';
import { apiTokens } from '../db/schema';

export class ApiTokenNotFoundError extends Error {
  constructor() {
    super('api token not found');
    this.name = 'ApiTokenNotFoundError';
  }
}

export interface ApiToken {
  id: string;
  name: string;
  /** sha-256 hex of the secret. The secret itself is never stored. */
  tokenHash: string;
  /** Leading characters of the secret, so the UI can tell tokens apart. */
  prefix: string;
  userId: number;
  createdAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

type Row = typeof apiTokens.$inferSelect;

function mapRow(row: Row): ApiToken {
  return {
    id: row.id,
    name: row.name,
    tokenHash: row.tokenHash,
    prefix: row.prefix,
    userId: row.userId,
    createdAt: fromDbDate(row.createdAt),
    lastUsedAt: fromDbDate(row.lastUsedAt),
    revokedAt: fromDbDate(row.revokedAt),
  };
}

export class ApiTokenRepository {
  constructor(private readonly db: Db) {}

  async create(token: ApiToken): Promise<ApiToken> {
    await this.db.insert(apiTokens).values({
      id: token.id,
      name: token.name,
      tokenHash: token.tokenHash,
      prefix: token.prefix,
      userId: token.userId,
      createdAt: token.createdAt ? toDbDate(token.createdAt) : null,
      lastUsedAt: null,
      revokedAt: null,
    });
    return token;
  }

  async findById(id: string): Promise<ApiToken> {
    const [row] = await this.db.select().from(apiTokens).where(eq(apiTokens.id, id));
    if (!row) throw new ApiTokenNotFoundError();
    return mapRow(row);
  }

  /** Returns null rather than throwing: a bad token is a 401, not an error. */
  async findByHash(tokenHash: string): Promise<ApiToken | null> {
    const [row] = await this.db.select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash));
    return row ? mapRow(row) : null;
  }

  async getAll(): Promise<ApiToken[]> {
    const rows = await this.db.select().from(apiTokens);
    return rows.map(mapRow);
  }

  async revoke(id: string): Promise<void> {
    await this.db
      .update(apiTokens)
      .set({ revokedAt: toDbDate(new Date()) })
      .where(eq(apiTokens.id, id));
  }

  async touchLastUsed(id: string, when: Date): Promise<void> {
    await this.db
      .update(apiTokens)
      .set({ lastUsedAt: toDbDate(when) })
      .where(eq(apiTokens.id, id));
  }
}
