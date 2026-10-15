import { config } from '../config';
import { isZipArchive } from '../files/archive';
import type { FileRecord } from '../files/repository';

/**
 * Only a record id can claim a site host. Ids are UUIDs, so a broad template
 * such as `*.example.com` still leaves the app's own `drop.example.com` alone.
 */
const ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ID_PATTERN = new RegExp(`^${ID}$`);

/** One `*` in the first label, at least one more label, optionally a port. */
const TEMPLATE_PATTERN = /^[a-z0-9-]*\*[a-z0-9-]*(\.[a-z0-9-]+)+(:\d+)?$/;

let compiled: { template: string; pattern: RegExp } | undefined;

/**
 * `SITES_HOST` as a matcher whose first group is the file id, or `undefined`
 * when hosting is turned off. Throws when the template is malformed, which
 * `createApp` relies on to refuse to start with it.
 */
export function sitesHostPattern(): RegExp | undefined {
  const template = config.sitesHost;
  if (!template) return undefined;
  if (compiled?.template === template) return compiled.pattern;

  if (!TEMPLATE_PATTERN.test(template)) {
    throw new Error(
      `SITES_HOST must be a host with a single * in its first label, such as *.sites.example.com; got "${template}"`,
    );
  }

  const escaped = template.replace(/[.]/g, '\\.').replace('*', `(${ID})`);
  compiled = { template, pattern: new RegExp(`^${escaped}$`) };
  return compiled.pattern;
}

/**
 * The file id a request's host names, when it is addressed to a site.
 *
 * Only the `Host` header counts unless the operator vouched for a proxy: an
 * `X-Forwarded-Host` taken at face value would let any client — or a cache in
 * front of us — get a site's pages answered under the app's own origin.
 */
export function siteIdFromRequest(req: {
  get(name: string): string | undefined;
}): string | undefined {
  const pattern = sitesHostPattern();
  if (!pattern) return undefined;

  const forwarded = config.trustProxyHeaders
    ? req.get('x-forwarded-host')?.split(',')[0]?.trim()
    : undefined;
  const host = (forwarded || req.get('host') || '').toLowerCase();

  return pattern.exec(host)?.[1];
}

/**
 * Where a hosted archive's contents are served, using the scheme of `origin`
 * (the address the caller reached us on). `null` when the record is not
 * hosted or hosting is turned off.
 */
export function siteUrl(record: FileRecord, origin: string): string | null {
  const template = config.sitesHost;
  const id = record.id.toLowerCase();

  if (!template || !record.hosted || !isZipArchive(record.filename) || !ID_PATTERN.test(id)) {
    return null;
  }

  return `${new URL(origin).protocol}//${template.replace('*', id)}/`;
}
