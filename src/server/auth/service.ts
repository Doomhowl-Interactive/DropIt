import { checkPassword } from '../security/password';
import { UserNotFoundError, type UserService } from '../users/service';
import { generateJwt } from './jwt';

export class InvalidCredentialsError extends Error {
  constructor() {
    super('invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export class AuthService {
  constructor(private readonly users: UserService) {}

  async login(username: string, password: string): Promise<string> {
    const user = await this.users.findByUsername(username).catch((err) => {
      // A missing user and a wrong password must be indistinguishable.
      if (err instanceof UserNotFoundError) throw new InvalidCredentialsError();
      throw err;
    });

    if (!(await checkPassword(password, user.passwordHash))) {
      throw new InvalidCredentialsError();
    }

    return generateJwt(String(user.id), user.username, user.role);
  }
}
