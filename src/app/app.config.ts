import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideAnimationsAsync(),
    providePrimeNG({ theme: { preset: Aura } }),
    /**
     * The XSRF interceptor reads the same non-HttpOnly `csrf_token` cookie the
     * server issues (see server/middleware/csrf.ts) and sends it back under the
     * header that middleware already accepts, on same-origin mutating requests.
     * That replaces the manual token plumbing older pages do by hand.
     */
    provideHttpClient(
      withFetch(),
      withXsrfConfiguration({ cookieName: 'csrf_token', headerName: 'X-CSRF-Token' }),
    ),
  ],
};
