import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ApiTokenRowSchema,
  ApiTokensListResponseSchema,
  CreatedApiTokenSchema,
  type ApiTokenRow,
  type CreateApiTokenRequest,
  type CreatedApiToken,
} from '../../shared/types';

const BASE = '/api/tokens';

/**
 * Talks to the API token endpoints. The CSRF header is attached by Angular's
 * XSRF interceptor (configured in app.config.ts), so nothing here handles it.
 * Every response is validated against the same Zod schema the server used to
 * build it, so a shape mismatch surfaces here instead of downstream.
 */
@Injectable({ providedIn: 'root' })
export class ApiTokenApi {
  private readonly http = inject(HttpClient);

  async list(): Promise<ApiTokenRow[]> {
    const body = await firstValueFrom(this.http.get(BASE));
    return ApiTokensListResponseSchema.parse(body);
  }

  /** The response carries the plaintext secret; it is not recoverable later. */
  async create(name: string, expiresInDays: number | null): Promise<CreatedApiToken> {
    const request: CreateApiTokenRequest = { name, expiresInDays };
    const body = await firstValueFrom(this.http.post(BASE, request));
    return CreatedApiTokenSchema.parse(body);
  }

  async revoke(id: string): Promise<ApiTokenRow> {
    const body = await firstValueFrom(this.http.post(`${BASE}/${id}/revoke`, {}));
    return ApiTokenRowSchema.parse(body);
  }
}
