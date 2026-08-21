import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { TokenSecretDialog } from '../components/token-secret-dialog/token-secret-dialog';
import { PageDataService, usePage } from '../utils/page';
import { ApiTokenApi } from '../services/api-token-api';
import type { ApiTokenRow, ApiTokensPageData } from '../utils/page-context';

const EMPTY: ApiTokensPageData = { tokens: [], endpoint: '' };

@Component({
  selector: 'app-api-tokens-page',
  templateUrl: './api-tokens-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [
    ButtonModule,
    CardModule,
    FormsModule,
    InputTextModule,
    MessageModule,
    TableModule,
    TagModule,
    TokenSecretDialog,
  ],
})
export class ApiTokensPage {
  private readonly api = inject(ApiTokenApi);
  private readonly context = inject(PageDataService).context;

  private readonly data = computed<ApiTokensPageData>(() =>
    this.context?.page === 'api-tokens' ? this.context.data : EMPTY,
  );

  /** Seeded from the server render, then kept up to date locally. */
  protected readonly tokens = signal<ApiTokenRow[]>(this.data().tokens);
  protected readonly endpoint = computed(() => this.data().endpoint);

  protected readonly newName = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal(this.data().error ?? '');

  /** Non-null only while a freshly created secret is waiting to be copied. */
  protected readonly issuedSecret = signal<string | null>(null);

  constructor() {
    usePage({ title: 'API Tokens', bodyClass: 'min-h-screen p-4' });
  }

  protected async create(): Promise<void> {
    const name = this.newName().trim();
    if (!name || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    try {
      const created = await this.api.create(name);

      this.tokens.update((tokens) => [created.token, ...tokens]);
      this.issuedSecret.set(created.secret);
      this.newName.set('');
    } catch (err) {
      this.error.set(this.messageFor(err, 'Could not create the token.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async revoke(token: ApiTokenRow): Promise<void> {
    if (token.revoked || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    try {
      const updated = await this.api.revoke(token.id);
      this.tokens.update((tokens) => tokens.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      this.error.set(this.messageFor(err, 'Could not revoke the token.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected dismissSecret(): void {
    this.issuedSecret.set(null);
  }

  private messageFor(err: unknown, fallback: string): string {
    const detail = (err as { error?: { error?: string } })?.error?.error;
    return detail ? `${fallback} ${detail}` : fallback;
  }
}
