import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

export interface TestServer {
  /** Absolute base URL, e.g. `http://127.0.0.1:41234`. */
  url: string;
  fetch(path: string, init?: RequestInit): Promise<Response>;
  close(): Promise<void>;
}

/**
 * Listens on an ephemeral port so route tests go through the real Express
 * stack — routing, body parsing, cookies and all — instead of a fake req/res.
 */
export function listen(app: Express): Promise<TestServer> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const url = `http://127.0.0.1:${port}`;

      resolve({
        url,
        fetch: (path, init) => fetch(`${url}${path}`, { redirect: 'manual', ...init }),
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

export interface MultipartFile {
  field: string;
  filename: string;
  contents: string;
  contentType?: string;
}

/**
 * Builds a multipart/form-data body by hand.
 *
 * The global `FormData` here comes from jsdom, which Node's `fetch` does not
 * recognise as a spec form and silently sends as an empty body — so the
 * encoding is spelled out instead.
 */
export function multipart(
  files: MultipartFile[],
  fields: Record<string, string> = {},
): { body: string; headers: Record<string, string> } {
  const boundary = `----dropit${Math.random().toString(36).slice(2)}`;
  const parts: string[] = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    );
  }

  for (const file of files) {
    parts.push(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\n` +
        `Content-Type: ${file.contentType ?? 'text/plain'}\r\n\r\n` +
        `${file.contents}\r\n`,
    );
  }

  parts.push(`--${boundary}--\r\n`);

  // A string body, which fetch encodes as UTF-8 — matching the `utf8`
  // parameter charset the upload route configures multer with.
  return {
    body: parts.join(''),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

/** Extracts a cookie value from the `set-cookie` headers of a response. */
export function cookieValue(response: Response, name: string): string {
  for (const header of response.headers.getSetCookie()) {
    const match = header.match(new RegExp(`^${name}=([^;]*)`));
    if (match) return decodeURIComponent(match[1]!);
  }
  return '';
}
