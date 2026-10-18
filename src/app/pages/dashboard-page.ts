import { DatePipe } from '@angular/common';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import type { SortMeta } from 'primeng/api';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ArchiveTree } from '../components/archive-tree/archive-tree';
import { UploadZone } from '../components/upload-zone/upload-zone';
import { PasteZone } from '../components/paste-zone/paste-zone';
import { FileDashboardApi } from '../services/file-dashboard-api';
import { FormatBytesPipe } from '../utils/format-bytes.pipe';
import { FileExportResponseSchema, type FileExportRecord } from '../../shared/types';

type PendingFileAction = { id: string; mode: 'force-delete' };

/** A file as the table sorts and filters it: dates as `Date`, status as a boolean. */
type FileRow = FileExportRecord & { created: Date; online: boolean };

/**
 * Newest first, matching the order the API returns. A fresh array each time,
 * since the table edits its sort metadata in place.
 */
const newestFirst = (): SortMeta[] => [{ field: 'created', order: -1 }];

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.html',
  host: { style: 'display: contents' },
  imports: [
    RouterLink,
    FormsModule,
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
    SelectModule,
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

  protected readonly rows = computed<FileRow[]>(() =>
    this.files.value().map((file) => ({
      ...file,
      created: new Date(file.createdAt),
      online: !file.deleted,
    })),
  );

  protected readonly initialSort = newestFirst();
  protected readonly statusOptions = [
    { label: 'Online', value: true },
    { label: 'Offline', value: false },
  ];
  protected readonly search = signal('');
  /** How many files the search and column filters leave; `null` when nothing is hidden. */
  protected readonly shownCount = signal<number | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly modalTitle = signal('Confirm action');
  protected readonly modalMessage = signal('');
  protected readonly mutating = signal(false);
  protected readonly busy = computed(() => this.mutating() || this.files.isLoading());
  protected readonly error = signal('');
  private readonly pendingAction = signal<PendingFileAction | null>(null);

  /** Keeps rows (and an open archive tree) in place when the list reloads. */
  protected readonly trackById = (_index: number, file: FileRow) => file.id;

  /** Clears the search and column filters and goes back to newest first. */
  protected resetTable(table: Table): void {
    table.clear();
    table.multiSortMeta = newestFirst();
    table.sortMultiple();
    this.search.set('');
    this.shownCount.set(null);
  }

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
