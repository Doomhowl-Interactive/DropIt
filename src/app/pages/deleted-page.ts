import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { CENTERED_BODY, usePage } from '../utils/page';

@Component({
  selector: 'app-deleted-page',
  host: { style: 'display: contents' },
  imports: [CardModule, ButtonModule],
  template: `
    <div class="w-full max-w-[520px]">
      <p-card styleClass="text-center">
        <div class="text-2xl font-black uppercase mb-2">FILE DELETED SUCESSFULL</div>

        <div class="text-sm font-bold uppercase mb-6 text-surface-500">
          The file has been absolutely obliterated.
        </div>

        <a href="/" pButton class="w-full justify-center">
          <span pButtonLabel>Pretend Nothing Happened</span>
        </a>
      </p-card>
    </div>
  `,
})
export class DeletedPage {
  constructor() {
    usePage({ title: 'File Deleted sucessfull', bodyClass: CENTERED_BODY });
  }
}
