import type { Request, Response } from 'express';
import type { AngularNodeAppEngine } from '@angular/ssr/node';
import type { PageContext } from '../app/utils/page-context';

export type RenderPage = (
  req: Request,
  res: Response,
  context: PageContext,
  status?: number,
) => Promise<void>;

/**
 * Renders an Angular route on the server and hands the HTML back with a status
 * of our choosing. `context` reaches the component tree through
 * `REQUEST_CONTEXT` and is replayed to the browser via `TransferState`.
 */
export function createRenderer(angularApp: AngularNodeAppEngine): RenderPage {
  return async (req, res, context, status = 200) => {
    // Inside a mounted router Express trims req.url; the Angular router needs
    // the path the browser actually asked for.
    req.url = req.originalUrl;

    const response = await angularApp.handle(req, context);
    if (!response) {
      res.status(500).send('Rendering failed');
      return;
    }

    const html = await response.text();
    res.status(status);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  };
}
