import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { CENTERED_BODY, usePage } from '../page';

@Component({
  selector: 'app-file-not-found-page',
  host: { style: 'display: contents' },
  imports: [CardModule, ButtonModule],
  template: `
    <div class="w-full max-w-[493px]">
      <p-card styleClass="text-center">
        <div class="text-6xl font-black mb-2">404</div>

        <div class="font-bold uppercase mb-4">FILE NOT FOUND 💀</div>

        <div class="text-sm mb-6 text-surface-500">
          The requested file does not exist,<br />
          has expired, or was obliterated,<br />or my db is fucked. We'll never know :D
        </div>

        <a href="/" pButton class="w-full justify-center">
          <span pButtonLabel>RETURN TO UPLOADER</span>
        </a>
      </p-card>
    </div>
  `,
})
export class FileNotFoundPage {
  constructor() {
    usePage({
      title: '404 — File Not Found',
      bodyClass: CENTERED_BODY,
    });
  }
}
