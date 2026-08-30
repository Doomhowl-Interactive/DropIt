import { HttpContextToken } from '@angular/common/http';

/** Marks same-origin SSR requests that may receive the incoming browser cookie. */
export const FORWARD_SSR_COOKIE = new HttpContextToken(() => false);
