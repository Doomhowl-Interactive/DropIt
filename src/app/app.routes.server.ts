import { RenderMode, ServerRoute } from '@angular/ssr';

/** Every page depends on per-request data, so nothing is prerendered. */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
