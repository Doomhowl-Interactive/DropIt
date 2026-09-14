import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DOCUMENT, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { UploadResponseSchema } from '../../../shared/types';

@Component({
  selector: 'app-paste-zone',
  templateUrl: './paste-zone.html',
  host: { style: 'display: contents' },
  imports: [ButtonModule, InputGroupModule, InputTextModule, MessageModule],
})
export class PasteZone {
  private readonly document = inject(DOCUMENT);
  private readonly http = inject(HttpClient);

  protected readonly textContent = signal('');
  protected readonly uploading = signal(false);
  protected readonly error = signal('');
  /** Absolute link to the finished upload, shown in place of the editor. */
  protected readonly downloadUrl = signal('');

  protected canUploadText(): boolean {
    return this.textContent().trim().length > 0 && !this.uploading();
  }

  protected onTextInput(event: Event): void {
    this.textContent.set((event.target as HTMLTextAreaElement).value);
  }

  protected async uploadText(): Promise<void> {
    const text = this.textContent();
    if (!text.trim() || this.uploading()) return;

    this.uploading.set(true);
    this.error.set('');

    const filename = `paste-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    const form = new FormData();
    form.append('file', new File([text], filename, { type: 'text/plain' }));

    try {
      const data = UploadResponseSchema.parse(
        await firstValueFrom(this.http.post('/api/files', form)),
      );
      this.downloadUrl.set(`${this.document.location.origin}/api/files/${data.id}`);
    } catch (err) {
      const detail = err instanceof HttpErrorResponse ? err.error?.error : undefined;
      this.error.set(typeof detail === 'string' ? detail : 'Upload failed');
    } finally {
      this.uploading.set(false);
    }
  }

  protected newPaste(): void {
    this.textContent.set('');
    this.error.set('');
    this.downloadUrl.set('');
  }

  protected copy(input: HTMLInputElement): void {
    input.select();
    input.setSelectionRange(0, 99999); // mobile support
    this.document.execCommand('copy');
  }
}
