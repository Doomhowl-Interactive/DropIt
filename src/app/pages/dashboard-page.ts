import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import type { DashboardPageData } from '../utils/page-context';
import { UploadZone } from '../components/upload-zone/upload-zone';
import { FormatBytesPipe } from '../utils/format-bytes.pipe';
import { HttpClient, httpResource } from '@angular/common/http';
import { FileExportResponseSchema } from '../../shared/types';
import z from 'zod';
import { FormSubmittedEvent } from '@angular/forms';

const EMPTY: DashboardPageData = { files: [], page: 1, totalPages: 0 };

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.html',
  host: { style: 'display: contents' },
  imports: [
    RouterLink,
    DatePipe,
    FormatBytesPipe,
    CardModule,
    ButtonModule,
    DividerModule,
    TableModule,
    TagModule,
    DialogModule,
    UploadZone,
  ],
})
export class DashboardPage {
  private httpClient = inject(HttpClient);

  protected files = httpResource(() => ({ url: '/api/files/dashboard' }), {
    parse: (value) => FileExportResponseSchema.parse(value),
  });

  protected deleteFile(fileId: string) {
    console.log(`Deleting ${fileId}...`);
    this.httpClient.post(`/api/files/dashboard/delete/fr/${fileId}`, {}).subscribe({
      error: (e) => this.handleError(e),
      complete: () => this.files?.reload(),
    });
  }

  protected deactivateFile(fileId: string) {
    console.log(`Deactivating ${fileId}...`);
    this.httpClient.post(`/api/files/dashboard/delete/${fileId}`, {}).subscribe({
      error: (e) => this.handleError(e),
      complete: () => this.files?.reload(),
    });
  }

  private handleError(err: any) {
    console.error(err);
    alert('Failed to process file action.');
  }
}
