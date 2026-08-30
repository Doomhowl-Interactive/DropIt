import { DatePipe } from '@angular/common';
import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { UploadZone } from '../components/upload-zone/upload-zone';
import { FileDashboardApi } from '../services/file-dashboard-api';
import { FormatBytesPipe } from '../utils/format-bytes.pipe';
import { FORWARD_SSR_COOKIE } from '../utils/ssr-cookie-forward';
import { FileExportResponseSchema } from '../../shared/types';

type PendingFileAction = { id: string; mode: 'soft-delete' | 'force-delete' };

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
    MessageModule,
    UploadZone,
  ],
})
export class DashboardPage {
  private readonly api = inject(FileDashboardApi);

  protected readonly files = httpResource(
    () => ({
      url: '/api/files/dashboard',
      context: new HttpContext().set(FORWARD_SSR_COOKIE, true),
    }),
    {
      parse: (value) => FileExportResponseSchema.parse(value),
      defaultValue: [],
    },
  );

  protected readonly modalOpen = signal(false);
  protected readonly modalTitle = signal('Confirm action');
  protected readonly modalMessage = signal('');
  protected readonly mutating = signal(false);
  protected readonly busy = computed(() => this.mutating() || this.files.isLoading());
  protected readonly error = signal('');
  private readonly pendingAction = signal<PendingFileAction | null>(null);

  protected openConfirm(action: PendingFileAction, title: string, message: string): void {
    this.pendingAction.set(action);
    this.modalTitle.set(title);
    this.modalMessage.set(message);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    if (this.mutating()) return;
    this.modalOpen.set(false);
    this.pendingAction.set(null);
  }

  protected async addOrphans(): Promise<void> {
    await this.run(() => this.api.addOrphans());
  }

  protected async confirm(): Promise<void> {
    const action = this.pendingAction();
    if (!action || this.mutating()) return;

    await this.run(() =>
      action.mode === 'soft-delete'
        ? this.api.softDelete(action.id)
        : this.api.forceDelete(action.id),
    );
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.mutating()) return;

    this.mutating.set(true);
    this.error.set('');

    try {
      await action();
      this.modalOpen.set(false);
      this.pendingAction.set(null);
      this.files.reload();
    } catch (err) {
      const detail = err instanceof HttpErrorResponse ? err.error?.error : undefined;
      this.error.set(typeof detail === 'string' ? detail : 'The dashboard action failed.');
    } finally {
      this.mutating.set(false);
    }
  }
}
