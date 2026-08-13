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

  /** Serve the MCP endpoint at /mcp. */
  get mcpEnabled(): boolean {
    return (process.env['MCP_ENABLED'] ?? 'true') !== 'false';
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

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
