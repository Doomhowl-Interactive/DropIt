import { Component, DOCUMENT, inject, signal } from '@angular/core';
import { FormField, FormRoot, form, required, submit } from '@angular/forms/signals';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { Location } from '@angular/common';

@Component({
  selector: 'app-login-page',
  imports: [
    CardModule,
    ButtonModule,
    InputTextModule,
    FormField,
    FormRoot,
    PasswordModule,
    MessageModule,
  ],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly document = inject(DOCUMENT);
  private readonly location = inject(Location);

  protected readonly failed = signal(false);
  private readonly credentialsModel = signal({ username: '', password: '' });
  protected readonly credentialsForm = form(this.credentialsModel, (credentials) => {
    required(credentials.username, { message: 'Username is required' });
    required(credentials.password, { message: 'Password is required' });
  });

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.failed.set(false);

    try {
      await submit(this.credentialsForm, {
        action: async () => {
          const credentials = this.credentialsModel();
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
          });

          if (!response.ok) {
            this.failed.set(true);
            return [];
          }

          this.document.location.href = '/dashboard';
          return [];
        },
      });
    } catch {
      this.failed.set(true);
    }
  }

  protected goBack(): void {
    this.location.back();
  }
}
