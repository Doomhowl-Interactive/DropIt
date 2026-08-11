/** Runtime configuration, read from the environment (see .env.example). */

export const config = {
  get port(): number {
    return Number(process.env['PORT'] ?? 8080);
  },
  get jwtSecret(): string {
    return process.env['JWT_SECRET'] ?? '';
  },
  get useHttps(): boolean {
    return process.env['USE_HTTPS'] === 'true';
  },
  /** Cookie domain; empty means "host-only cookie". */
  get domain(): string {
    return process.env['DOMAIN'] ?? '';
  },
  /** Path to the SQLite database file. */
  get databaseUrl(): string {
    return process.env['DATABASE_URL'] || '';
  },
  get storageDir(): string {
    return process.env['STORAGE_DIR'] || './uploads';
  },
  get staticDir(): string {
    return process.env['STATIC_DIR'] || './static';
  },
};
