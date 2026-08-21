import { Component, computed, inject, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { PageDataService, usePage } from '../utils/page';
import type { DashboardPageData } from '../utils/page-context';
import { UploadZone } from '../components/upload-zone/upload-zone';

const EMPTY: DashboardPageData = { files: [], page: 1, totalPages: 0 };

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.html',
  host: { style: 'display: contents' },
  imports: [
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
  private readonly context = inject(PageDataService).context;

  private readonly data = computed<DashboardPageData>(() =>
    this.context?.page === 'dashboard' ? this.context.data : EMPTY,
  );

  protected readonly files = computed(() => this.data().files);
  protected readonly page = computed(() => this.data().page);
  protected readonly totalPages = computed(() => this.data().totalPages);

  protected readonly modalOpen = signal(false);
  protected readonly modalTitle = signal('Confirm wipe');
  protected readonly modalMessage = signal(
    'Awaiting system confirmation for permanent data erasure.',
  );

  private pendingForm: HTMLFormElement | null = null;

  constructor() {
    usePage({ title: 'Dashboard', bodyClass: 'min-h-screen p-4' });
  }

  /** Holds the submit back until the operator confirms in the modal. */
  protected openConfirm(event: Event, title: string, message: string): boolean {
    event.preventDefault();

    this.pendingForm = event.target as HTMLFormElement;
    this.modalTitle.set(title);
    this.modalMessage.set(message);
    this.modalOpen.set(true);

    return false;
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.pendingForm = null;
  }

  protected confirm(): void {
    this.pendingForm?.submit();
  }
}
