import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ApiTokenRow, CreatedApiToken } from '../utils/page-context';

const BASE = '/api/tokens';

/**
 * Talks to the API token endpoints. The CSRF header is attached by Angular's
 * XSRF interceptor (configured in app.config.ts), so nothing here handles it.
 */
@Injectable({ providedIn: 'root' })
export class ApiTokenApi {
  private readonly http = inject(HttpClient);

  list(): Promise<ApiTokenRow[]> {
    return firstValueFrom(this.http.get<ApiTokenRow[]>(BASE));
  }

  /** The response carries the plaintext secret; it is not recoverable later. */
  create(name: string, expiresInDays: number | null): Promise<CreatedApiToken> {
    return firstValueFrom(this.http.post<CreatedApiToken>(BASE, { name, expiresInDays }));
  }

  revoke(id: string): Promise<ApiTokenRow> {
    return firstValueFrom(this.http.post<ApiTokenRow>(`${BASE}/${id}/revoke`, {}));
  }
}
