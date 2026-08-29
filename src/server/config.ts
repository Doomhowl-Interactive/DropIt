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
  /** MySQL or TiDB connection string, e.g. mysql://user:pass@host:3306/dropit. */
  get databaseUrl(): string {
    return process.env['DATABASE_URL'] || '';
  },
  /** Optional PEM CA certificate path for verified MySQL/TiDB TLS. */
  get databaseSslCa(): string {
    return process.env['DATABASE_SSL_CA'] || '';
  },
  get storageDir(): string {
    return process.env['STORAGE_DIR'] || './uploads';
  },

  /**
   * Where uploads are kept: `local` writes to `STORAGE_DIR`, `s3` writes to an
   * S3-compatible bucket. Defaults to `s3` as soon as `S3_BUCKET` is set, so
   * configuring a bucket is all it takes to switch.
   */
  get storageDriver(): 'local' | 's3' {
    const configured = (process.env['STORAGE_DRIVER'] || '').trim().toLowerCase();
    if (configured === 's3' || configured === 'local') return configured;
    return config.s3.bucket ? 's3' : 'local';
  },

  /**
   * S3-compatible object storage. `S3_ENDPOINT` is what points the client at
   * MinIO, Cloudflare R2, Backblaze B2 or Garage instead of AWS; leave it
   * empty for AWS itself. Credentials may be omitted, in which case the SDK's
   * own chain (instance role, ~/.aws/credentials, AWS_*) applies.
   */
  get s3() {
    return {
      bucket: process.env['S3_BUCKET'] || '',
      prefix: process.env['S3_PREFIX'] || '',
      region: process.env['S3_REGION'] || 'us-east-1',
      endpoint: process.env['S3_ENDPOINT'] || '',
      accessKeyId: process.env['S3_ACCESS_KEY_ID'] || '',
      secretAccessKey: process.env['S3_SECRET_ACCESS_KEY'] || '',
      forcePathStyle: parseBoolean(process.env['S3_FORCE_PATH_STYLE']),
    };
  },
  get staticDir(): string {
    return process.env['STATIC_DIR'] || './static';
  },

  /**
   * Host header allow-list, shared by the Angular SSR engine and the MCP
   * transport's DNS-rebinding check. `*` — the default — accepts any Host,
   * matching how the Go server behaved.
   */
  get allowedHosts(): string[] {
    return splitList(process.env['ALLOWED_HOSTS'] ?? '*');
  },
  get trustProxyHeaders(): boolean {
    return process.env['TRUST_PROXY_HEADERS'] === 'true';
  },

  /**
   * Body limit for /mcp. Files arrive base64-encoded inside the JSON-RPC
   * envelope, so this has to be roughly 4/3 of the largest upload allowed.
   */
  get mcpMaxBody(): string {
    return process.env['MCP_MAX_BODY'] || '35mb';
  },
  /** Largest file `upload_file` will accept, and `get_file` will return. */
  get mcpMaxUploadBytes(): number {
    return Number(process.env['MCP_MAX_UPLOAD_BYTES'] ?? 25 * 1024 * 1024);
  },
  /** Origin allow-list for MCP requests; empty means "don't check Origin". */
  get mcpAllowedOrigins(): string[] {
    return splitList(process.env['MCP_ALLOWED_ORIGINS'] ?? '');
  },
};

/** Tri-state flag: `undefined` when unset, so a default can still apply. */
function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  return value.trim().toLowerCase() === 'true';
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
