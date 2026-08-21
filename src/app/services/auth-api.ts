import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ChangePasswordResponseSchema,
  type ChangePasswordRequest,
  type ChangePasswordResponse,
} from '../../shared/change-password.types';

const BASE = '/api/auth';

/**
 * Talks to the auth endpoints. Every response is validated against the same
 * Zod schema the server used to build it, so a shape mismatch surfaces here
 * instead of downstream.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  async changePassword(newPassword: string): Promise<ChangePasswordResponse> {
    const request: ChangePasswordRequest = { newPassword };
    const body = await firstValueFrom(this.http.post(`${BASE}/change-password`, request));
    return ChangePasswordResponseSchema.parse(body);
  }
}
