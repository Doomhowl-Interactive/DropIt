import { Component, DOCUMENT, inject, signal, viewChild, type ElementRef } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { CENTERED_BODY, usePage } from '../page';
import { formatBytes, formatTime } from '../format';
import { readCsrfToken } from '../csrf';

@Component({
  selector: 'app-index-page',
  templateUrl: './index-page.html',
  host: { style: 'display: contents' },
  imports: [CardModule, ButtonModule, ProgressBarModule],
})
export class IndexPage {
  private readonly document = inject(DOCUMENT);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly dragging = signal(false);
  protected readonly uploading = signal(false);
  protected readonly percent = signal(0);
  protected readonly speed = signal('0 KB/S');
  protected readonly eta = signal('--:--');

  private request: XMLHttpRequest | null = null;

  constructor() {
    usePage({ title: 'Drop.it', bodyClass: CENTERED_BODY });
  }

  protected dropZoneText(): string {
    const file = this.selectedFile();
    return file ? `${file.name} (${formatBytes(file.size)})` : 'Click to select or drop file';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);

    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.fileInput().nativeElement.files = files;
      this.selectedFile.set(files[0]!);
    }
  }

  protected onFileSelected(): void {
    this.selectedFile.set(this.fileInput().nativeElement.files?.[0] ?? null);
  }

  protected upload(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);
    this.percent.set(0);

    const form = new FormData();
    form.append('file', file);

    const request = new XMLHttpRequest();
    this.request = request;
    const startedAt = Date.now();

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;

      this.percent.set(Math.round((event.loaded / event.total) * 100));

      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      if (elapsedSeconds > 0) {
        const bytesPerSecond = event.loaded / elapsedSeconds;
        this.speed.set(`${formatBytes(bytesPerSecond)}/S`);
        this.eta.set(formatTime((event.total - event.loaded) / bytesPerSecond));
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          const data = JSON.parse(request.responseText);
          if (data.error) throw new Error(data.error);

          // Hand off to the shareable view page.
          this.document.location.href = `/f/${data.view_key}`;
        } catch {
          console.error('Invalid response:', request.responseText);
          alert('Server error');
        }
      } else {
        alert('Upload failed');
        this.uploading.set(false);
      }
    };

    request.onerror = () => {
      if (request.statusText !== 'abort') {
        alert(`Upload failed: ${request.responseText}`);
        this.reload();
      }
    };

    request.open('POST', '/api/files/upload');
    const csrf = readCsrfToken(this.document);
    if (csrf) request.setRequestHeader('X-CSRF-Token', csrf);
    request.send(form);
  }

  protected cancel(event: Event): void {
    event.stopPropagation();
    if (this.request) {
      this.request.abort();
      alert('Upload cancelled.');
      this.reload();
    }
  }

  protected reload(): void {
    this.document.location.reload();
  }
}
