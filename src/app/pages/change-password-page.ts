import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ZodError } from 'zod';

import { AuthApi } from '../services/auth-api';
import { usePage } from '../utils/page';

@Component({
  selector: 'app-change-password-page',
  templateUrl: './change-password-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [ButtonModule, CardModule, InputTextModule, MessageModule],
})
export class ChangePasswordPage {
  private readonly api = inject(AuthApi);

  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal(false);

  constructor() {
    usePage({ title: 'Change Password', bodyClass: 'min-h-screen p-4' });
  }

  protected onNewPasswordInput(event: Event): void {
    this.newPassword.set((event.target as HTMLInputElement).value);
  }

  protected onConfirmPasswordInput(event: Event): void {
    this.confirmPassword.set((event.target as HTMLInputElement).value);
  }

  protected async change(): Promise<void> {
    if (this.busy()) return;

    if (this.newPassword() !== this.confirmPassword()) {
      this.error.set('New password and confirmation do not match.');
      return;
    }

    this.busy.set(true);
    this.error.set('');
    this.done.set(false);

    try {
      await this.api.changePassword(this.newPassword());
      this.done.set(true);
      this.newPassword.set('');
      this.confirmPassword.set('');
    } catch (err) {
      this.error.set(this.messageFor(err, 'Could not change the password.'));
    } finally {
      this.busy.set(false);
    }
  }

  private messageFor(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const detail: unknown = err.error?.error;
      if (typeof detail === 'string' && detail) return `${fallback} ${detail}`;
    } else if (err instanceof ZodError) {
      return `${fallback} The server sent an unexpected response.`;
    }
    return fallback;
  }
}
