import { checkPassword, hashPassword } from '../security/password';
import { UserNotFoundError, UserRepository, type User } from './repository';

export class InvalidPasswordError extends Error {
  constructor() {
    super('invalid password');
    this.name = 'InvalidPasswordError';
  }
}

export class CannotDeleteSelfError extends Error {
  constructor() {
    super('cannot delete yourself');
    this.name = 'CannotDeleteSelfError';
  }
}

/** At least 6 characters with an upper, a lower and a digit. */
function validNewPassword(newPassword: string): boolean {
  if (newPassword.length < 6) return false;

  return /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[0-9]/.test(newPassword);
}

export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async createUser(username: string, password: string, role: string): Promise<User> {
    return this.repo.create({
      username,
      passwordHash: await hashPassword(password),
      role,
    });
  }

  async updateUser(user: User): Promise<User> {
    await this.repo.update(user);
    return user;
  }

  async changePassword(userId: string | number, newPassword: string): Promise<void> {
    const user = await this.repo.findById(userId);

    if (!validNewPassword(newPassword)) {
      throw new InvalidPasswordError();
    }
    if (await checkPassword(newPassword, user.passwordHash)) {
      throw new InvalidPasswordError();
    }

    user.passwordHash = await hashPassword(newPassword);
    await this.repo.update(user);
  }

  getAllUsers() {
    return this.repo.getAll();
  }

  async deleteUser(requesterId: number, targetId: number): Promise<void> {
    if (requesterId === targetId) throw new CannotDeleteSelfError();
    await this.repo.delete(targetId);
  }

  findByUsername(username: string) {
    return this.repo.findByUsername(username);
  }

  findById(id: string | number) {
    return this.repo.findById(id);
  }
}

export { UserNotFoundError };
export type { User };
