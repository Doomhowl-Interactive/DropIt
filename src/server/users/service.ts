import { checkPassword, hashPassword } from '../security/password';
import { UserNotFoundError, UserRepository, type User } from './repository';

export class InvalidPasswordError extends Error {
  constructor() {
    super('invalid password');
    this.name = 'InvalidPasswordError';
  }
}

export class PasswordsDoNotMatchError extends Error {
  constructor() {
    super('Incorrect old password');
    this.name = 'PasswordsDoNotMatchError';
  }
}

export class CannotDeleteSelfError extends Error {
  constructor() {
    super('cannot delete yourself');
    this.name = 'CannotDeleteSelfError';
  }
}

/** At least 8 characters with an upper, a lower and a digit — and not the old one. */
function validNewPassword(oldPassword: string, newPassword: string): boolean {
  if (oldPassword === newPassword) return false;
  if (newPassword.length < 8) return false;

  return /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[0-9]/.test(newPassword);
}

export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async createUser(username: string, password: string, role: string): Promise<User> {
    return this.repo.create({
      username,
      passwordHash: await hashPassword(password),
      role,
      forceChangePassword: false,
    });
  }

  async updateUser(user: User): Promise<User> {
    await this.repo.update(user);
    return user;
  }

  async changePassword(
    userId: string | number,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.repo.findById(userId);

    if (!validNewPassword(oldPassword, newPassword)) {
      throw new InvalidPasswordError();
    }
    if (!(await checkPassword(oldPassword, user.passwordHash))) {
      throw new PasswordsDoNotMatchError();
    }

    user.passwordHash = await hashPassword(newPassword);
    user.forceChangePassword = false;
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
