import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, form, minLength, required, validate } from '@angular/forms/signals';
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
  imports: [ButtonModule, CardModule, FormField, FormRoot, InputTextModule, MessageModule],
})
export class ChangePasswordPage {
  private readonly api = inject(AuthApi);

  protected readonly error = signal('');
  protected readonly done = signal(false);
  private readonly passwordModel = signal({ newPassword: '', confirmPassword: '' });
  protected readonly passwordForm = form(
    this.passwordModel,
    (passwords) => {
      required(passwords.newPassword, { message: 'New password is required.' });
      minLength(passwords.newPassword, 6, { message: 'Use at least 6 characters.' });
      required(passwords.confirmPassword, { message: 'Password confirmation is required.' });
      validate(passwords.confirmPassword, ({ value }) =>
        value() === this.passwordModel().newPassword
          ? undefined
          : { kind: 'passwordMismatch', message: 'Passwords do not match.' },
      );
    },
    {
      submission: {
        action: async () => {
          this.error.set('');
          this.done.set(false);

          try {
            await this.api.changePassword(this.passwordModel().newPassword);
            this.done.set(true);
            this.passwordModel.set({ newPassword: '', confirmPassword: '' });
            this.passwordForm.newPassword().reset();
            this.passwordForm.confirmPassword().reset();
          } catch (err) {
            this.error.set(this.messageFor(err, 'Could not change the password.'));
          }
        },
      },
    },
  );

  constructor() {
    usePage({ title: 'Change Password', bodyClass: 'min-h-screen p-4' });
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
