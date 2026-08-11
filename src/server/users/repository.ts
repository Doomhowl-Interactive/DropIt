import { fromBool, fromDbDate, toBool, toDbDate, type Db } from '../db/db';

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
  forceChangePassword: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface Row {
  id: number | string;
  username: string;
  password_hash: string;
  role: string;
  force_change_password: unknown;
  created_at: unknown;
  updated_at: unknown;
}

function mapRow(row: Row): User {
  return {
    id: Number(row.id),
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    forceChangePassword: toBool(row.force_change_password),
    createdAt: fromDbDate(row.created_at),
    updatedAt: fromDbDate(row.updated_at),
  };
}

const COLUMNS = 'id, username, password_hash, role, force_change_password, created_at, updated_at';

/** `deleted_at IS NULL` mirrors GORM's soft-delete semantics. */
export class UserRepository {
  constructor(private readonly db: Db) {}

  async findByUsername(username: string): Promise<User> {
    const row = await this.db.get<Row>(
      `SELECT ${COLUMNS} FROM users WHERE username = ? AND deleted_at IS NULL`,
      [username],
    );
    if (!row) throw new UserNotFoundError();
    return mapRow(row);
  }

  async findById(id: number | string): Promise<User> {
    const row = await this.db.get<Row>(
      `SELECT ${COLUMNS} FROM users WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    if (!row) throw new UserNotFoundError();
    return mapRow(row);
  }

  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date();
    await this.db.run(
      `INSERT INTO users (created_at, updated_at, username, password_hash, role, force_change_password)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        toDbDate(now, this.db.dialect),
        toDbDate(now, this.db.dialect),
        user.username,
        user.passwordHash,
        user.role,
        fromBool(user.forceChangePassword, this.db.dialect),
      ],
    );
    return this.findByUsername(user.username);
  }

  async update(user: User): Promise<void> {
    await this.db.run(
      `UPDATE users
          SET username = ?, password_hash = ?, role = ?, force_change_password = ?, updated_at = ?
        WHERE id = ?`,
      [
        user.username,
        user.passwordHash,
        user.role,
        fromBool(user.forceChangePassword, this.db.dialect),
        toDbDate(new Date(), this.db.dialect),
        user.id,
      ],
    );
  }

  async getAll(): Promise<User[]> {
    const rows = await this.db.all<Row>(`SELECT ${COLUMNS} FROM users WHERE deleted_at IS NULL`);
    return rows.map(mapRow);
  }

  async delete(id: number): Promise<void> {
    await this.db.run('UPDATE users SET deleted_at = ? WHERE id = ?', [
      toDbDate(new Date(), this.db.dialect),
      id,
    ]);
  }
}
