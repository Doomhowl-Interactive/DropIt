import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  FileActiveResponseSchema,
  FileDeleteResponseSchema,
  OrphansResponseSchema,
} from '../../shared/types';

const BASE = '/api/files/dashboard';

@Injectable({ providedIn: 'root' })
export class FileDashboardApi {
  private readonly http = inject(HttpClient);

  async addOrphans(): Promise<void> {
    OrphansResponseSchema.parse(await firstValueFrom(this.http.post(`${BASE}/orphans`, null)));
  }

  async setActive(id: string, active: boolean): Promise<void> {
    FileActiveResponseSchema.parse(
      await firstValueFrom(
        this.http.patch(`${BASE}/${encodeURIComponent(id)}`, { active }),
      ),
    );
  }

  async forceDelete(id: string): Promise<void> {
    FileDeleteResponseSchema.parse(
      await firstValueFrom(this.http.post(`${BASE}/delete/fr/${encodeURIComponent(id)}`, null)),
    );
  }
}
