import { Component, DOCUMENT, inject, signal, viewChild, type ElementRef } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { usePage } from '../page';
import { readCsrfToken } from '../csrf';

@Component({
  selector: 'app-login-page',
  host: { style: 'display: contents' },
  imports: [CardModule, ButtonModule, InputTextModule, MessageModule],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly document = inject(DOCUMENT);
  private readonly username = viewChild.required<ElementRef<HTMLInputElement>>('username');
  private readonly password = viewChild.required<ElementRef<HTMLInputElement>>('password');

  protected readonly failed = signal(false);

  constructor() {
    usePage({ title: 'Login', bodyClass: 'min-h-screen flex items-center justify-center p-4' });
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(this.document),
        },
        body: JSON.stringify({
          username: this.username().nativeElement.value,
          password: this.password().nativeElement.value,
        }),
      });

      if (!response.ok) {
        this.failed.set(true);
        return;
      }

      this.document.location.href = '/admin';
    } catch {
      this.failed.set(true);
    }
  }
}
