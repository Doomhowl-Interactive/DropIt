import { Component, computed, inject } from '@angular/core';
import { PageDataService } from '../page';
import { DeletedPage } from './deleted-page';
import { FileNotFoundPage } from './file-not-found-page';

/** `/api/files/delete/:id` — confirmation of a deletion, or the 404 page. */
@Component({
  selector: 'app-delete-result-page',
  imports: [DeletedPage, FileNotFoundPage],
  host: { style: 'display: contents' },
  template: `
    @if (deleted()) {
      <app-deleted-page />
    } @else {
      <app-file-not-found-page />
    }
  `,
})
export class DeleteResultPage {
  private readonly context = inject(PageDataService).context;

  protected readonly deleted = computed(() => this.context?.page === 'deleted');
}
