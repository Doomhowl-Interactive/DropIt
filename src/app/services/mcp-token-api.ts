import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CreatedMcpToken, McpTokenRow } from '../../shared/page-context';

const BASE = '/api/mcp-tokens';

/**
 * Talks to the MCP token endpoints. The CSRF header is attached by Angular's
 * XSRF interceptor (configured in app.config.ts), so nothing here handles it.
 */
@Injectable({ providedIn: 'root' })
export class McpTokenApi {
  private readonly http = inject(HttpClient);

  list(): Promise<McpTokenRow[]> {
    return firstValueFrom(this.http.get<McpTokenRow[]>(BASE));
  }

  /** The response carries the plaintext secret; it is not recoverable later. */
  create(name: string, expiresInDays: number | null): Promise<CreatedMcpToken> {
    return firstValueFrom(this.http.post<CreatedMcpToken>(BASE, { name, expiresInDays }));
  }

  revoke(id: string): Promise<McpTokenRow> {
    return firstValueFrom(this.http.post<McpTokenRow>(`${BASE}/${id}/revoke`, {}));
  }
}
