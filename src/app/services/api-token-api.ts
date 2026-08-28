import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ApiTokenRowSchema,
  CreatedApiTokenSchema,
  type ApiTokenRow,
  type CreateApiTokenRequest,
  type CreatedApiToken,
} from '../../shared/types';

const BASE = '/api/tokens';

/**
 * The token mutations. Reading the list is a `httpResource` on the page
 * itself; only the writes need a service. Every response is validated against
 * the same Zod schema the server used to build it, so a shape mismatch
 * surfaces here instead of downstream.
 */
@Injectable({ providedIn: 'root' })
export class ApiTokenApi {
  private readonly http = inject(HttpClient);

  /** The response carries the plaintext secret; it is not recoverable later. */
  async create(name: string): Promise<CreatedApiToken> {
    const request: CreateApiTokenRequest = { name };
    const body = await firstValueFrom(this.http.post(BASE, request));
    return CreatedApiTokenSchema.parse(body);
  }

  async revoke(id: string): Promise<ApiTokenRow> {
    const body = await firstValueFrom(this.http.post(`${BASE}/${id}/revoke`, {}));
    return ApiTokenRowSchema.parse(body);
  }
}
