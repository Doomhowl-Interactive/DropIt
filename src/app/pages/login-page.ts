import { Component, DOCUMENT, inject, signal, viewChild, type ElementRef } from '@angular/core';
import { usePage } from '../page';
import { readCsrfToken } from '../csrf';

@Component({
  selector: 'app-login-page',
  host: { style: 'display: contents' },
  template: `
    <div class="max-w-md mx-auto">
      <header class="mb-8 border-b-4 border-black pb-2 flex justify-between items-end">
        <h1 class="text-3xl font-black uppercase tracking-tighter">System Access</h1>

        <a href="/" class="nav-link">← BACK</a>
      </header>

      <div class="box p-4">
        <form id="login-form" class="space-y-3" (submit)="submit($event)">
          @if (failed()) {
            <div id="error-box" class="error">ACCESS DENIED</div>
          }

          <div>
            <div class="label">Username</div>
            <input id="username" required autocomplete="username" #username />
          </div>

          <div>
            <div class="label">Password</div>
            <input
              id="password"
              type="password"
              required
              autocomplete="current-password"
              #password
            />
          </div>

          <div class="pt-2">
            <button type="submit">AUTHENTICATE</button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class LoginPage {
  private readonly document = inject(DOCUMENT);
  private readonly username = viewChild.required<ElementRef<HTMLInputElement>>('username');
  private readonly password = viewChild.required<ElementRef<HTMLInputElement>>('password');

  protected readonly failed = signal(false);

  constructor() {
    usePage({ title: 'Login', bodyClass: 'page-login' });
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
