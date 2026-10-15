import type { Request, RequestHandler, Response } from 'express';
import { posix } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { ArchiveError, type ZipIndex } from '../files/archive';
import type { FileService } from '../files/service';
import { isNotFoundError } from '../files/storage';
import { guessMimeType } from '../mcp/content';
import { humanSize } from '../util';
import { siteIdFromRequest } from './host';

type ArchiveEntry = NonNullable<ReturnType<ZipIndex['file']>>;

/**
 * Serves hosted zip archives at `<id>.<SITES_HOST>` — a request on any other
 * host passes straight through to the app.
 *
 * This runs ahead of every other middleware. A site host never sees the API,
 * the dashboard or even the cookie parser: whatever a hosted page asks for,
 * it gets an answer from its own archive or nothing.
 */
export function siteRoutes(files: FileService): RequestHandler {
  return (req, res, next) => {
    const id = siteIdFromRequest(req);
    if (!id) {
      next();
      return;
    }

    serveSite(files, id, req, res).catch((err: unknown) => {
      console.error(`Hosted site ${id} failed to serve ${req.path}:`, err);
      if (res.headersSent) res.destroy();
      else fail(res, 500, 'Internal server error');
    });
  };
}

async function serveSite(files: FileService, id: string, req: Request, res: Response) {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    fail(res, 405, 'Method not allowed');
    return;
  }

  const record = await files.getFileById(id).catch(() => null);
  if (!record || record.deleted || !record.hosted) {
    fail(res, 404, 'Not found');
    return;
  }

  let index: ZipIndex;
  try {
    index = await files.archive(record);
  } catch (err) {
    if (isNotFoundError(err)) fail(res, 404, 'Not found');
    else if (err instanceof ArchiveError) fail(res, 500, 'This archive cannot be read');
    else fail(res, 502, 'Storage unavailable');
    return;
  }

  let path: string;
  try {
    path = decodeURIComponent(req.path).slice(1);
  } catch {
    fail(res, 400, 'Bad request');
    return;
  }

  if (path === '' || path.endsWith('/')) {
    if (index.isDirectory(path)) {
      const page = index.file(`${path}index.html`);
      if (page) await sendEntry(index, page, 'index.html', req, res);
      else sendListing(index, path, res);
      return;
    }
  } else {
    const entry = index.file(path);
    if (entry) {
      await sendEntry(index, entry, path, req, res);
      return;
    }

    // Without the slash, relative links on the directory's index page would
    // resolve against its parent.
    if (index.isDirectory(`${path}/`)) {
      const query = req.originalUrl.indexOf('?');
      const search = query === -1 ? '' : req.originalUrl.slice(query);
      res.redirect(301, `/${encodePath(path)}/${search}`);
      return;
    }
  }

  // Client-side routers own every path that does not look like a file.
  const app = !posix.extname(path) ? index.file('index.html') : undefined;
  if (app) {
    await sendEntry(index, app, 'index.html', req, res);
    return;
  }

  const missing = index.file('404.html');
  if (missing) await sendEntry(index, missing, '404.html', req, res, 404);
  else fail(res, 404, 'Not found');
}

/**
 * Streams one archive entry. Entries are inflated on the fly, so ranges are
 * not offered; the CRC the zip already carries makes for a free ETag, which
 * keeps revisits down to a 304.
 */
async function sendEntry(
  index: ZipIndex,
  entry: ArchiveEntry,
  name: string,
  req: Request,
  res: Response,
  status = 200,
): Promise<void> {
  res.status(status);
  res.setHeader('Content-Type', contentType(name));
  res.setHeader('Content-Length', String(entry.uncompressedSize));
  res.setHeader('ETag', `"${entry.crc32.toString(16)}-${entry.uncompressedSize.toString(16)}"`);
  res.setHeader('Cache-Control', 'no-cache');

  if (status === 200 && req.fresh) {
    res.removeHeader('Content-Type');
    res.removeHeader('Content-Length');
    res.status(304).end();
    return;
  }
  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  let body;
  try {
    body = await index.open(entry);
  } catch (err) {
    // Encrypted entries and unknown compression methods end up here.
    console.error(`Could not open ${name} in a hosted archive:`, err);
    fail(res, 500, 'This file cannot be read from the archive');
    return;
  }

  await pipeline(body, res);
}

/** A plain listing for directories without an `index.html`. */
function sendListing(index: ZipIndex, dir: string, res: Response): void {
  const { directories, files } = index.list(dir);
  const title = escapeHtml(`Index of /${dir}`);

  const rows = [
    ...(dir ? [row('../', '../', '')] : []),
    ...directories.map((name) => row(`${encodeURIComponent(name.slice(0, -1))}/`, name, '')),
    ...files.map((file) => row(encodeURIComponent(file.path), file.path, humanSize(file.size))),
  ];

  res
    .status(200)
    .type('text/html; charset=utf-8')
    .set('Cache-Control', 'no-cache')
    .send(
      '<!doctype html><html><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        `<title>${title}</title><style>` +
        'body{font:14px/1.5 system-ui,sans-serif;margin:2rem}' +
        'td{padding:.1rem 2rem .1rem 0}td+td{text-align:right;color:#666}' +
        `</style></head><body><h1>${title}</h1><table>${rows.join('')}</table></body></html>`,
    );
}

function row(href: string, label: string, size: string): string {
  return `<tr><td><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></td><td>${size}</td></tr>`;
}

/** Hosted pages are UTF-8 unless they say otherwise; tell the browser so. */
function contentType(name: string): string {
  const type = guessMimeType(name);
  return type.startsWith('text/') || type === 'application/json' ? `${type}; charset=utf-8` : type;
}

/** Answers with a plain-text error, dropping whatever an entry had already set. */
function fail(res: Response, status: number, message: string): void {
  for (const header of ['Content-Length', 'Content-Type', 'ETag', 'Cache-Control']) {
    res.removeHeader(header);
  }
  res.status(status).type('text/plain; charset=utf-8').send(message);
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
