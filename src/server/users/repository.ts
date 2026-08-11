import { and, eq, isNull } from 'drizzle-orm';
import { fromDbDate, toDbDate, type Db } from '../db/db';
import { users } from '../db/schema';

export class UserNotFoundError extends Error {
  constructor() {
    super('user not found');
    this.name = 'UserNotFoundError';
  }
}

export interface User {
  id: number;
  username: string;
  passwordHash: string;
  role: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

type Row = typeof users.$inferSelect;

function mapRow(row: Row): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    role: row.role,
    createdAt: fromDbDate(row.createdAt),
    updatedAt: fromDbDate(row.updatedAt),
  };
}

/** `deletedAt IS NULL` mirrors GORM's soft-delete semantics. */
export class UserRepository {
  constructor(private readonly db: Db) {}

  async findByUsername(username: string): Promise<User> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.username, username), isNull(users.deletedAt)));
    if (!row) throw new UserNotFoundError();
    return mapRow(row);
  }

  async findById(id: number | string): Promise<User> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, Number(id)), isNull(users.deletedAt)));
    if (!row) throw new UserNotFoundError();
    return mapRow(row);
  }

  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = toDbDate(new Date());
    await this.db.insert(users).values({
      createdAt: now,
      updatedAt: now,
      username: user.username,
      passwordHash: user.passwordHash,
      role: user.role,
    });
    return this.findByUsername(user.username);
  }

  async update(user: User): Promise<void> {
    await this.db
      .update(users)
      .set({
        username: user.username,
        passwordHash: user.passwordHash,
        role: user.role,
        updatedAt: toDbDate(new Date()),
      })
      .where(eq(users.id, user.id));
  }

  async getAll(): Promise<User[]> {
    const rows = await this.db.select().from(users).where(isNull(users.deletedAt));
    return rows.map(mapRow);
  }

  async delete(id: number): Promise<void> {
    await this.db
      .update(users)
      .set({ deletedAt: toDbDate(new Date()) })
      .where(eq(users.id, id));
  }
}
