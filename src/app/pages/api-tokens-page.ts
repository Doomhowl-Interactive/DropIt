import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, FormRoot, form, validate } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { TokenSecretDialog } from '../components/token-secret-dialog/token-secret-dialog';
import { PageDataService, usePage } from '../utils/page';
import { ApiTokenApi } from '../services/api-token-api';
import { ApiTokensListResponseSchema, type ApiTokenRow } from '../../shared/types';

@Component({
  selector: 'app-api-tokens-page',
  templateUrl: './api-tokens-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [
    ButtonModule,
    CardModule,
    FormField,
    FormRoot,
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

  /** Absolute MCP endpoint URL — only the SSR layer knows the request origin. */
  protected readonly endpoint =
    this.context?.page === 'api-tokens' ? this.context.data.endpoint : '';

  protected readonly tokens = httpResource(() => ({ url: '/api/tokens' }), {
    parse: (value) => ApiTokensListResponseSchema.parse(value),
    defaultValue: [],
  });

  protected readonly issuing = signal(false);
  protected readonly actionError = signal('');
  private readonly tokenModel = signal({ name: '' });
  protected readonly tokenForm = form(
    this.tokenModel,
    (token) =>
      validate(token.name, ({ value }) =>
        value().trim() ? undefined : { kind: 'required', message: 'A token label is required.' },
      ),
    {
      submission: {
        action: async () => {
          this.actionError.set('');

          try {
            const created = await this.api.create(this.tokenModel().name.trim());
            if (this.tokens.hasValue()) {
              this.tokens.value.update((tokens) => [created.token, ...tokens]);
            } else {
              this.tokens.reload();
            }
            this.issuedSecret.set(created.secret);
            this.tokenModel.set({ name: '' });
          } catch (err) {
            this.actionError.set(this.messageFor(err, 'Could not create the token.'));
          }
        },
      },
    },
  );
  protected readonly busy = computed(
    () => this.issuing() || this.tokenForm().submitting() || this.tokens.isLoading(),
  );
  protected readonly error = computed(
    () => this.actionError() || (this.tokens.error() ? 'Could not load the tokens.' : ''),
  );

  /** Non-null only while a freshly created secret is waiting to be copied. */
  protected readonly issuedSecret = signal<string | null>(null);

  constructor() {
    usePage({ title: 'API tokens', bodyClass: 'min-h-screen p-4' });
  }

  protected async revoke(token: ApiTokenRow): Promise<void> {
    if (token.revoked || this.busy()) return;

    this.issuing.set(true);
    this.actionError.set('');

    try {
      const updated = await this.api.revoke(token.id);
      if (this.tokens.hasValue()) {
        this.tokens.value.update((tokens) =>
          tokens.map((row) => (row.id === updated.id ? updated : row)),
        );
      } else {
        this.tokens.reload();
      }
    } catch (err) {
      this.actionError.set(this.messageFor(err, 'Could not revoke the token.'));
    } finally {
      this.issuing.set(false);
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
