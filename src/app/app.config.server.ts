import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, mergeApplicationConfig, REQUEST } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

/** Carries the browser session to the same-origin dashboard data request during SSR. */
const forwardDashboardCookie: HttpInterceptorFn = (request, next) => {
  const browserRequest = inject(REQUEST, { optional: true });
  const cookie = browserRequest?.headers.get('cookie');
  if (!cookie || request.headers.has('cookie')) return next(request);

  const origin = new URL(browserRequest.url).origin;
  const target = new URL(request.url, browserRequest.url);
  if (target.origin !== origin || target.pathname !== '/api/files/dashboard') return next(request);

  return next(request.clone({ setHeaders: { Cookie: cookie } }));
};

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideHttpClient(withInterceptors([forwardDashboardCookie])),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
