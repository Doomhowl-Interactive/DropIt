import { Component, DOCUMENT, afterNextRender, computed, inject, signal } from '@angular/core';
import { PageDataService, usePage } from '../page';
import { readCsrfToken } from '../csrf';
import type { AdminPageData } from '../../shared/page-context';

const EMPTY: AdminPageData = { files: [], page: 1, totalPages: 0 };

@Component({
  selector: 'app-admin-page',
  templateUrl: './admin-page.html',
  host: { style: 'display: contents', '(click)': 'onDocumentClick($event)' },
})
export class AdminPage {
  private readonly document = inject(DOCUMENT);
  private readonly context = inject(PageDataService).context;

  private readonly data = computed<AdminPageData>(() =>
    this.context?.page === 'admin' ? this.context.data : EMPTY,
  );

  protected readonly files = computed(() => this.data().files);
  protected readonly page = computed(() => this.data().page);
  protected readonly totalPages = computed(() => this.data().totalPages);

  /** Double-submit token, read from the cookie once we are in the browser. */
  protected readonly csrf = signal('');

  protected readonly modalOpen = signal(false);
  protected readonly modalTitle = signal('CONFIRM_WIPE');
  protected readonly modalMessage = signal(
    'Awaiting system confirmation for permanent data erasure.',
  );

  private pendingForm: HTMLFormElement | null = null;

  constructor() {
    usePage({ title: 'Admin Console', bodyClass: 'page-admin' });
    afterNextRender(() => this.csrf.set(readCsrfToken(this.document)));
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

  /** Clicking the backdrop dismisses the dialog. */
  protected onDocumentClick(event: MouseEvent): void {
    if ((event.target as HTMLElement)?.id === 'modal-overlay') {
      this.closeModal();
    }
  }
}
