import { Component } from '@angular/core';
import { CENTERED_BODY, usePage } from '../page';

@Component({
  selector: 'app-file-not-found-page',
  host: { style: 'display: contents' },
  template: `
    <div class="w-full max-w-[493px] flex flex-col items-center">
      <div class="box text-center">
        <div class="error-code">404</div>

        <div class="error-text mb-4">FILE NOT FOUND 💀</div>

        <div class="text-xs mb-6 uppercase">
          The requested file does not exist,<br />
          has expired, or was obliterated,<br />or my db is fucked. We'll never know :D
        </div>

        <div class="flex flex-col gap-2">
          <a href="/" class="button w-full">RETURN TO UPLOADER</a>
        </div>
      </div>
    </div>
  `,
})
export class FileNotFoundPage {
  constructor() {
    usePage({
      title: '404 — File Not Found',
      bodyClass: `page-file-not-found ${CENTERED_BODY}`,
    });
  }
}
