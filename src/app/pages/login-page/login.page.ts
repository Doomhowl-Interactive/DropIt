import { Component, DOCUMENT, inject, signal, viewChild, type ElementRef } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { Location } from '@angular/common';

@Component({
  selector: 'app-login-page',
  imports: [CardModule, ButtonModule, InputTextModule, MessageModule],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly document = inject(DOCUMENT);
  private readonly username = viewChild.required<ElementRef<HTMLInputElement>>('username');
  private readonly password = viewChild.required<ElementRef<HTMLInputElement>>('password');
  private readonly location = inject(Location);

  protected readonly failed = signal(false);

  constructor() {}

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

      this.document.location.href = '/dashboard';
    } catch {
      this.failed.set(true);
    }
  }

  protected goBack(): void {
    this.location.back();
  }
}
