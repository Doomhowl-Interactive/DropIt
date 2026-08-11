import { Component, DOCUMENT, computed, inject } from '@angular/core';
import { CENTERED_BODY, PageDataService, usePage } from '../page';
import type { CompletePageData } from '../../shared/page-context';

@Component({
  selector: 'app-complete-page',
  templateUrl: './complete-page.html',
  host: { style: 'display: contents' },
})
export class CompletePage {
  private readonly document = inject(DOCUMENT);
  private readonly context = inject(PageDataService).context;

  private readonly data = computed<CompletePageData | null>(() =>
    this.context?.page === 'complete' ? this.context.data : null,
  );

  protected readonly downloadUrl = computed(() => {
    const data = this.data();
    return data ? `${data.origin}/api/files/view/${data.downloadId}` : '';
  });

  protected readonly deleteUrl = computed(() => {
    const data = this.data();
    return data ? `${data.origin}/api/files/delete/${data.deleteId}` : '';
  });

  constructor() {
    usePage({ title: 'Send.it - File Ready', bodyClass: `page-complete ${CENTERED_BODY}` });
  }

  protected copy(input: HTMLInputElement): void {
    input.select();
    input.setSelectionRange(0, 99999); // mobile support
    this.document.execCommand('copy');
  }
}
