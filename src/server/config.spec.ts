import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from './config';

const KEYS = [
  'PORT',
  'JWT_SECRET',
  'USE_HTTPS',
  'DOMAIN',
  'DATABASE_URL',
  'DATABASE_SSL_CA',
  'STORAGE_DIR',
  'STATIC_DIR',
] as const;

describe('config', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
    for (const key of KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('falls back to defaults when nothing is set', () => {
    expect(config.port).toBe(8080);
    expect(config.jwtSecret).toBe('');
    expect(config.useHttps).toBe(false);
    expect(config.domain).toBe('');
    expect(config.databaseUrl).toBe('');
    expect(config.databaseSslCa).toBe('');
    expect(config.storageDir).toBe('./uploads');
    expect(config.staticDir).toBe('./static');
  });

  it('reads every value from the environment', () => {
    process.env['PORT'] = '3000';
    process.env['JWT_SECRET'] = 's3cret';
    process.env['USE_HTTPS'] = 'true';
    process.env['DOMAIN'] = 'drop.example';
    process.env['DATABASE_URL'] = '/var/lib/dropit.db';
    process.env['DATABASE_SSL_CA'] = '/etc/ssl/tidb-ca.pem';
    process.env['STORAGE_DIR'] = '/var/lib/uploads';
    process.env['STATIC_DIR'] = '/srv/static';

    expect(config.port).toBe(3000);
    expect(config.jwtSecret).toBe('s3cret');
    expect(config.useHttps).toBe(true);
    expect(config.domain).toBe('drop.example');
    expect(config.databaseUrl).toBe('/var/lib/dropit.db');
    expect(config.databaseSslCa).toBe('/etc/ssl/tidb-ca.pem');
    expect(config.storageDir).toBe('/var/lib/uploads');
    expect(config.staticDir).toBe('/srv/static');
  });

  it('treats useHttps as opt-in via the exact string "true"', () => {
    process.env['USE_HTTPS'] = '1';
    expect(config.useHttps).toBe(false);
    process.env['USE_HTTPS'] = 'TRUE';
    expect(config.useHttps).toBe(false);
  });

  it('falls back to the default for empty path-like values', () => {
    process.env['DATABASE_URL'] = '';
    process.env['STORAGE_DIR'] = '';
    process.env['STATIC_DIR'] = '';

    expect(config.databaseUrl).toBe('');
    expect(config.storageDir).toBe('./uploads');
    expect(config.staticDir).toBe('./static');
  });

  it('keeps an explicitly empty DOMAIN and PORT distinguishable', () => {
    process.env['DOMAIN'] = '';
    expect(config.domain).toBe('');

    process.env['PORT'] = '';
    expect(config.port).toBe(0);
  });
});
