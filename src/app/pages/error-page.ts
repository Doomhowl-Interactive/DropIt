import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { CENTERED_BODY, usePage } from '../page';

@Component({
  selector: 'app-error-page',
  host: { style: 'display: contents' },
  imports: [CardModule, ButtonModule],
  template: `
    <div class="w-full max-w-[493px]">
      <p-card styleClass="text-center">
        <div class="text-2xl font-black uppercase mb-2">NOTHING TO SEE HERE</div>

        <div class="text-sm font-bold uppercase mb-4 text-surface-500">MOVE ALONG</div>

        <div class="text-sm mb-6">
          This page is empty,<br />
          unavailable, private,<br />
          or intentionally left blank.
        </div>

        <a href="/" pButton class="w-full justify-center">
          <span pButtonLabel>GO BACK</span>
        </a>
      </p-card>
    </div>
  `,
})
export class ErrorPage {
  constructor() {
    usePage({ title: 'Nothing to see here', bodyClass: CENTERED_BODY });
  }
}
