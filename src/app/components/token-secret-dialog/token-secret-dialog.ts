import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';

/**
 * Shows a freshly minted token once. Purely presentational — it owns no state
 * beyond "did the copy button work", so the page can drive it entirely through
 * its inputs.
 */
@Component({
  selector: 'app-token-secret-dialog',
  templateUrl: './token-secret-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [ButtonModule, DialogModule, MessageModule],
})
export class TokenSecretDialog {
  /** The plaintext secret, or null when there is nothing to show. */
  readonly secret = input.required<string | null>();
  readonly endpoint = input.required<string>();

  readonly closed = output<void>();

  protected readonly copied = signal(false);

  protected readonly visible = computed(() => this.secret() !== null);

  /** Ready to paste into a terminal, which is how most clients are set up. */
  protected readonly command = computed(
    () =>
      `claude mcp add --transport http dropit ${this.endpoint()} \\\n` +
      `  --header "Authorization: Bearer ${this.secret()}"`,
  );

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
    } catch {
      // Clipboard access can be refused; the value is on screen to select anyway.
      this.copied.set(false);
    }
  }

  protected close(): void {
    this.copied.set(false);
    this.closed.emit();
  }
}
