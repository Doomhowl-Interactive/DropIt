import { defineConfig } from 'drizzle-kit';
import { readFileSync } from 'node:fs';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const databaseSslCa = process.env['DATABASE_SSL_CA'] ?? '';

function databaseCredentials() {
  if (!databaseSslCa) return { url: databaseUrl };

  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: {
      ca: readFileSync(databaseSslCa, 'utf8'),
      rejectUnauthorized: true,
      verifyIdentity: true,
    },
  };
}

export default defineConfig({
  dialect: 'mysql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: databaseCredentials(),
});
