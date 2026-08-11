import { Component } from '@angular/core';
import { CENTERED_BODY, usePage } from '../page';

@Component({
  selector: 'app-error-page',
  host: { style: 'display: contents' },
  template: `
    <div class="w-full max-w-[493px] flex flex-col items-center">
      <div class="box text-center">
        <div class="title">NOTHING TO SEE HERE</div>

        <div class="subtitle">MOVE ALONG</div>

        <div class="text">
          This page is empty,<br />
          unavailable, private,<br />
          or intentionally left blank.
        </div>

        <div class="flex flex-col gap-2">
          <a href="/" class="button w-full">GO BACK</a>
        </div>
      </div>
    </div>
  `,
})
export class ErrorPage {
  constructor() {
    usePage({ title: 'Nothing to see here', bodyClass: `page-error ${CENTERED_BODY}` });
  }
}
