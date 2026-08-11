import { Component, computed, inject } from '@angular/core';
import { PageDataService } from '../page';
import { CompletePage } from './complete-page';
import { FileNotFoundPage } from './file-not-found-page';

/** `/f/:id` — the share page, or the 404 when the key is unknown. */
@Component({
  selector: 'app-file-view-page',
  imports: [CompletePage, FileNotFoundPage],
  host: { style: 'display: contents' },
  template: `
    @if (found()) {
      <app-complete-page />
    } @else {
      <app-file-not-found-page />
    }
  `,
})
export class FileViewPage {
  private readonly context = inject(PageDataService).context;

  protected readonly found = computed(() => this.context?.page === 'complete');
}
