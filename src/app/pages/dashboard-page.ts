import { DatePipe } from '@angular/common';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ArchiveTree } from '../components/archive-tree/archive-tree';
import { UploadZone } from '../components/upload-zone/upload-zone';
import { PasteZone } from '../components/paste-zone/paste-zone';
import { FileDashboardApi } from '../services/file-dashboard-api';
import { FormatBytesPipe } from '../utils/format-bytes.pipe';
import { FileExportResponseSchema, type FileExportRecord } from '../../shared/types';

type PendingFileAction = { id: string; mode: 'force-delete' };

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
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    ArchiveTree,
    UploadZone,
    PasteZone,
  ],
})
export class DashboardPage {
  private readonly api = inject(FileDashboardApi);

  protected readonly files = httpResource(() => ({ url: '/api/files' }), {
    parse: (value) => FileExportResponseSchema.parse(value),
    defaultValue: [],
  });

  protected readonly search = signal('');
  /** Files whose name or id contains the search text, ignoring case. */
  protected readonly visibleFiles = computed(() => {
    const query = this.search().trim().toLowerCase();
    const files = this.files.value();
    if (!query) return files;
    return files.filter(
      (file) =>
        file.filename.toLowerCase().includes(query) || file.id.toLowerCase().includes(query),
    );
  });

  protected readonly modalOpen = signal(false);
  protected readonly modalTitle = signal('Confirm action');
  protected readonly modalMessage = signal('');
  protected readonly mutating = signal(false);
  protected readonly busy = computed(() => this.mutating() || this.files.isLoading());
  protected readonly error = signal('');
  private readonly pendingAction = signal<PendingFileAction | null>(null);

  /** Keeps rows (and an open archive tree) in place when the list reloads. */
  protected readonly trackById = (_index: number, file: FileExportRecord) => file.id;

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

  protected async setFileActive(id: string, active: boolean): Promise<void> {
    await this.run(() => this.api.setActive(id, active));
  }

  protected async setFileHosted(id: string, hosted: boolean): Promise<void> {
    await this.run(() => this.api.setHosted(id, hosted));
  }

  protected async confirm(): Promise<void> {
    const action = this.pendingAction();
    if (!action || this.mutating()) return;

    await this.run(() => this.api.forceDelete(action.id));
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
      this.files.reload();
    } finally {
      this.mutating.set(false);
    }
  }
}
