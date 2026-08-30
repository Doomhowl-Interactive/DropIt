import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FileDeleteResponseSchema, OrphansResponseSchema } from '../../shared/types';

const BASE = '/api/files/dashboard';

@Injectable({ providedIn: 'root' })
export class FileDashboardApi {
  private readonly http = inject(HttpClient);

  async addOrphans(): Promise<void> {
    OrphansResponseSchema.parse(await firstValueFrom(this.http.post(`${BASE}/orphans`, null)));
  }

  async softDelete(id: string): Promise<void> {
    FileDeleteResponseSchema.parse(
      await firstValueFrom(this.http.post(`${BASE}/delete/${encodeURIComponent(id)}`, null)),
    );
  }

  async restore(id: string): Promise<void> {
    FileDeleteResponseSchema.parse(
      await firstValueFrom(this.http.post(`${BASE}/restore/${encodeURIComponent(id)}`, null)),
    );
  }

  async forceDelete(id: string): Promise<void> {
    FileDeleteResponseSchema.parse(
      await firstValueFrom(this.http.post(`${BASE}/delete/fr/${encodeURIComponent(id)}`, null)),
    );
  }
}
