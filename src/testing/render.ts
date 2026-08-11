import { vi } from 'vitest';
import type { RenderPage } from '../server/render';

/**
 * Stands in for the Angular SSR renderer: instead of HTML it echoes the page
 * context back as JSON, so route tests can assert on what would have been
 * rendered without booting the application.
 */
export function fakeRenderer() {
  const render = vi.fn<RenderPage>(async (_req, res, context, status = 200) => {
    res.status(status).json(context);
  });
  return render;
}
