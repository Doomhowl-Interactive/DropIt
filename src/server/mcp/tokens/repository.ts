import { eq } from 'drizzle-orm';
import { fromDbDate, toDbDate, type Db } from '../../db/db';
import { mcpTokens } from '../../db/schema';

export class McpTokenNotFoundError extends Error {
  constructor() {
    super('mcp token not found');
    this.name = 'McpTokenNotFoundError';
  }
}

export interface McpToken {
  id: string;
  name: string;
  /** sha-256 hex of the secret. The secret itself is never stored. */
  tokenHash: string;
  /** Leading characters of the secret, so the UI can tell tokens apart. */
  prefix: string;
  userId: number;
  createdAt: Date | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

type Row = typeof mcpTokens.$inferSelect;

function mapRow(row: Row): McpToken {
  return {
    id: row.id,
    name: row.name,
    tokenHash: row.tokenHash,
    prefix: row.prefix,
    userId: row.userId,
    createdAt: fromDbDate(row.createdAt),
    lastUsedAt: fromDbDate(row.lastUsedAt),
    expiresAt: fromDbDate(row.expiresAt),
    revokedAt: fromDbDate(row.revokedAt),
  };
}

export class McpTokenRepository {
  constructor(private readonly db: Db) {}

  async create(token: McpToken): Promise<McpToken> {
    await this.db.insert(mcpTokens).values({
      id: token.id,
      name: token.name,
      tokenHash: token.tokenHash,
      prefix: token.prefix,
      userId: token.userId,
      createdAt: token.createdAt ? toDbDate(token.createdAt) : null,
      lastUsedAt: null,
      expiresAt: token.expiresAt ? toDbDate(token.expiresAt) : null,
      revokedAt: null,
    });
    return token;
  }

  async findById(id: string): Promise<McpToken> {
    const [row] = await this.db.select().from(mcpTokens).where(eq(mcpTokens.id, id));
    if (!row) throw new McpTokenNotFoundError();
    return mapRow(row);
  }

  /** Returns null rather than throwing: a bad token is a 401, not an error. */
  async findByHash(tokenHash: string): Promise<McpToken | null> {
    const [row] = await this.db.select().from(mcpTokens).where(eq(mcpTokens.tokenHash, tokenHash));
    return row ? mapRow(row) : null;
  }

  async getAll(): Promise<McpToken[]> {
    const rows = await this.db.select().from(mcpTokens);
    return rows.map(mapRow);
  }

  async revoke(id: string): Promise<void> {
    await this.db
      .update(mcpTokens)
      .set({ revokedAt: toDbDate(new Date()) })
      .where(eq(mcpTokens.id, id));
  }

  async touchLastUsed(id: string, when: Date): Promise<void> {
    await this.db
      .update(mcpTokens)
      .set({ lastUsedAt: toDbDate(when) })
      .where(eq(mcpTokens.id, id));
  }
}
