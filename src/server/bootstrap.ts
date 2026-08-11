import { randomBytes } from 'node:crypto';
import { UserNotFoundError, type UserService } from './users/service';

function generateRandomPassword(length: number): string {
  return randomBytes(length).toString('base64url').slice(0, length);
}

/**
 * Makes sure an `admin` account exists. Its password comes from
 * ADMIN_PASSWORD when set, otherwise a random one is generated and printed
 * once, with a forced change on first use.
 */
export async function createAdminUser(users: UserService): Promise<void> {
  try {
    await users.findByUsername('admin');
    console.log('Admin user already exists, skipping creation');
    return;
  } catch (err) {
    if (!(err instanceof UserNotFoundError)) {
      console.error('Error checking for admin user:', err);
      return;
    }
  }

  console.log('Admin user not found, creating new admin user');

  const configured = process.env['ADMIN_PASSWORD'] ?? '';
  const password = configured || generateRandomPassword(16);

  try {
    const admin = await users.createUser('admin', password, 'admin');

    if (!configured) {
      admin.forceChangePassword = true;
      await users.updateUser(admin);
      console.log(`Admin user created with random password: ${password}`);
    } else {
      console.log('Admin user created with password from ADMIN_PASSWORD');
    }
  } catch (err) {
    console.error('Error creating admin user:', err);
  }
}
