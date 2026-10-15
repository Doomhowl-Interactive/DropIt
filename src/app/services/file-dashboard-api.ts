import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  FileDeleteResponseSchema,
  FileUpdateResponseSchema,
  OrphansResponseSchema,
  type FileUpdateRequest,
} from '../../shared/types';

const BASE = '/api/files';

@Injectable({ providedIn: 'root' })
export class FileDashboardApi {
  private readonly http = inject(HttpClient);

  async addOrphans(): Promise<void> {
    OrphansResponseSchema.parse(await firstValueFrom(this.http.post(`${BASE}/orphans`, null)));
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.update(id, { active });
  }

  async setHosted(id: string, hosted: boolean): Promise<void> {
    await this.update(id, { hosted });
  }

  async forceDelete(id: string): Promise<void> {
    FileDeleteResponseSchema.parse(
      await firstValueFrom(this.http.delete(`${BASE}/${encodeURIComponent(id)}`)),
    );
  }

  private async update(id: string, changes: FileUpdateRequest): Promise<void> {
    FileUpdateResponseSchema.parse(
      await firstValueFrom(this.http.patch(`${BASE}/${encodeURIComponent(id)}`, changes)),
    );
  }
}
