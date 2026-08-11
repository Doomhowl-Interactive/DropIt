/** 1024-based size, one decimal — e.g. `530.2 KB`. */
export function humanSize(size: number): string {
  const unit = 1024;
  if (size < unit) return `${size} B`;

  let div = unit;
  let exp = 0;
  for (let n = Math.floor(size / unit); n >= unit; n = Math.floor(n / unit)) {
    div *= unit;
    exp++;
  }
  return `${(size / div).toFixed(1)} ${'KMGTPE'[exp]}B`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `DD/MM/YY HH:MM` in the server's local timezone. */
export function formatTimestamp(date: Date): string {
  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${pad(date.getFullYear() % 100)} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Express 5 types route params as `string | string[]`; we only ever use one. */
export function param(req: { params: Record<string, unknown> }, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

/**
 * The origin the caller actually used, so links we hand back match what the
 * browser (or MCP client) would have built for itself.
 */
export function requestOrigin(req: {
  protocol: string;
  get(name: string): string | undefined;
}): string {
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
  const host = req.get('x-forwarded-host')?.split(',')[0]?.trim() || req.get('host') || '';
  return `${proto}://${host}`;
}

/** Strips characters that would break out of a quoted header value. */
export function safeFilename(name: string): string {
  const cleaned = [...name]
    .filter((ch) => {
      const code = ch.codePointAt(0)!;
      return code >= 32 && code !== 127 && ch !== '"' && ch !== '\\';
    })
    .join('');
  return cleaned || 'file';
}
