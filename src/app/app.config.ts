import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Lara from '@primeuix/themes/lara';

const RedLara = definePreset(Lara, {
  semantic: {
    primary: {
      50: '{red.50}',
      100: '{red.100}',
      200: '{red.200}',
      300: '{red.300}',
      400: '{red.400}',
      500: '{red.500}',
      600: '{red.600}',
      700: '{red.700}',
      800: '{red.800}',
      900: '{red.900}',
      950: '{red.950}',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    providePrimeNG({ theme: { preset: RedLara } }),
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
