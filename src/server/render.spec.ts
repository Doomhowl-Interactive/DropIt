import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AngularNodeAppEngine } from '@angular/ssr/node';
import { listen, type TestServer } from '../testing/http';
import type { PageContext } from '../shared/page-context';
import { createRenderer } from './render';

/** A stand-in for the Angular SSR engine, returning whatever the test wants. */
function fakeEngine(response: Response | null, onHandle?: (url: string) => void) {
  return {
    handle: vi.fn(async (req: { url: string }) => {
      onHandle?.(req.url);
      return response;
    }),
  } as unknown as AngularNodeAppEngine;
}

const html = (body: string) => new Response(body, { status: 200 });

describe('createRenderer', () => {
  let server: TestServer;

  afterEach(() => server?.close());

  /** Mounts the renderer under `mountPath` so route-trimming is exercised. */
  const start = async (
    engine: AngularNodeAppEngine,
    context: PageContext = { page: 'index' },
    status?: number,
    mountPath = '/',
  ) => {
    const app = express();
    const render = createRenderer(engine);
    app.use(mountPath, (req, res) => {
      void render(req, res, context, status);
    });
    server = await listen(app);
    return server;
  };

  it('sends the rendered HTML with a 200 by default', async () => {
    await start(fakeEngine(html('<h1>Drop.it</h1>')));

    const response = await server.fetch('/');
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('<h1>Drop.it</h1>');
  });

  it('declares UTF-8 HTML', async () => {
    await start(fakeEngine(html('<h1>Drop.it</h1>')));

    const response = await server.fetch('/');
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });

  it('honours an explicit status', async () => {
    await start(fakeEngine(html('<h1>404</h1>')), { page: 'file-not-found' }, 404);

    const response = await server.fetch('/');
    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('<h1>404</h1>');
  });

  it('hands the page context to the engine', async () => {
    const engine = fakeEngine(html('ok'));
    const context: PageContext = { page: 'login', error: true };
    await start(engine, context);

    await server.fetch('/');

    expect(engine.handle).toHaveBeenCalledWith(expect.anything(), context);
  });

  it('restores the full path that Express trimmed inside a mounted router', async () => {
    const seen: string[] = [];
    await start(fakeEngine(html('ok'), (url) => seen.push(url)), { page: 'index' }, 200, '/admin');

    await server.fetch('/admin/deep/path?page=2');

    expect(seen).toEqual(['/admin/deep/path?page=2']);
  });

  it('answers 500 when the engine cannot render the route', async () => {
    await start(fakeEngine(null));

    const response = await server.fetch('/');
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe('Rendering failed');
  });

  it('passes an empty body through unchanged', async () => {
    await start(fakeEngine(html('')));

    const response = await server.fetch('/');
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('');
  });
});
