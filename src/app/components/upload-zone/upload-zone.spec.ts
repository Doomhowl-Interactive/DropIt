import { DOCUMENT } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeLocation, provideFakeLocation } from '../../../testing/document';
import { UploadZone } from './upload-zone';

/** A stand-in for XMLHttpRequest that the test drives by hand. */
class FakeXhr {
  static last: FakeXhr | null = null;

  readonly upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  method = '';
  url = '';
  headers: Record<string, string> = {};
  sent: unknown = null;
  aborted = false;

  status = 200;
  statusText = '';
  responseText = '{}';

  constructor() {
    FakeXhr.last = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.sent = body;
  }

  abort() {
    this.aborted = true;
  }

  /** Fires an upload-progress event with the elapsed clock already advanced. */
  progress(loaded: number, total: number, lengthComputable = true) {
    this.upload.onprogress?.({ loaded, total, lengthComputable } as ProgressEvent);
  }

  succeed(body: unknown) {
    this.status = 200;
    this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
    this.onload?.();
  }

  fail(status: number) {
    this.status = status;
    this.onload?.();
  }
}

describe('UploadZone', () => {
  let fixture: ComponentFixture<UploadZone>;
  let location: ReturnType<typeof fakeLocation>;
  let alertMock: ReturnType<typeof vi.fn>;

  const element = () => fixture.nativeElement as HTMLElement;
  const dropZone = () => element().querySelector('#drop-zone') as HTMLElement;
  const fileInput = () => element().querySelector('#fileInput') as HTMLInputElement;
  const uploadButton = () => element().querySelector('#uploadBtn') as HTMLButtonElement;
  const cancelButton = () => element().querySelector('#cancelBtn') as HTMLButtonElement | null;
  const zoneText = () => element().querySelector('#dz-text')?.textContent?.trim() ?? '';
  const progressText = () => element().querySelector('#progress-text')?.textContent?.trim() ?? '';
  const speedText = () => element().querySelector('#speed-text')?.textContent?.trim() ?? '';
  const etaText = () => element().querySelector('#eta-text')?.textContent?.trim() ?? '';

  /**
   * Replaces the input's `files` with a writable own property. jsdom's real
   * setter only accepts a genuine FileList, which cannot be constructed here,
   * and the drop handler assigns to it.
   */
  const stubFiles = (input: HTMLInputElement, files: File[]) => {
    Object.defineProperty(input, 'files', {
      value: files,
      writable: true,
      configurable: true,
    });
  };

  /** Puts a file on the hidden input the way a file picker would. */
  const select = (name = 'report.pdf', size = 2048) => {
    const file = new File(['x'.repeat(size)], name);
    stubFiles(fileInput(), [file]);
    fileInput().dispatchEvent(new Event('change'));
    fixture.detectChanges();
    return file;
  };

  const startUpload = () => {
    uploadButton().click();
    fixture.detectChanges();
    return FakeXhr.last!;
  };

  beforeEach(() => {
    FakeXhr.last = null;
    location = fakeLocation('/');
    alertMock = vi.fn();

    TestBed.configureTestingModule({ providers: [provideFakeLocation(location)] });
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    vi.stubGlobal('alert', alertMock);

    TestBed.inject(DOCUMENT).cookie = 'csrf_token=token123';

    fixture = TestBed.createComponent(UploadZone);
    fixture.detectChanges();
  });

  afterEach(() => vi.unstubAllGlobals());

  describe('choosing a file', () => {
    it('prompts for a file before one is picked', () => {
      expect(zoneText()).toBe('Click to select or drop file');
    });

    it('disables the upload button until a file is picked', () => {
      expect(uploadButton().disabled).toBe(true);
    });

    it('shows the picked file with its size', () => {
      select('report.pdf', 2048);
      expect(zoneText()).toBe('report.pdf (2 KB)');
    });

    it('enables the upload button once a file is picked', () => {
      select();
      expect(uploadButton().disabled).toBe(false);
    });

    it('goes back to the prompt if the picker is cleared', () => {
      select();
      stubFiles(fileInput(), []);
      fileInput().dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(zoneText()).toBe('Click to select or drop file');
    });
  });

  describe('drag and drop', () => {
    const dragEvent = (type: string, files?: File[]) => {
      const event = new Event(type, { cancelable: true, bubbles: true }) as DragEvent;
      Object.defineProperty(event, 'dataTransfer', {
        value: files ? { files } : undefined,
        configurable: true,
      });
      return event;
    };

    it('highlights the zone while a file hovers over it', () => {
      dropZone().dispatchEvent(dragEvent('dragover'));
      fixture.detectChanges();

      expect(dropZone().classList).toContain('border-primary');
    });

    it('prevents the browser from opening the dragged file', () => {
      const event = dragEvent('dragover');
      dropZone().dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it('drops the highlight again when the file leaves', () => {
      dropZone().dispatchEvent(dragEvent('dragover'));
      fixture.detectChanges();
      dropZone().dispatchEvent(new Event('dragleave'));
      fixture.detectChanges();

      expect(dropZone().classList).not.toContain('border-primary');
    });

    it('accepts a dropped file and clears the highlight', () => {
      const file = new File(['x'.repeat(1024)], 'dropped.bin');
      stubFiles(fileInput(), []);
      dropZone().dispatchEvent(dragEvent('dragover'));
      fixture.detectChanges();

      dropZone().dispatchEvent(dragEvent('drop', [file]));
      fixture.detectChanges();

      expect(zoneText()).toBe('dropped.bin (1 KB)');
      expect(dropZone().classList).not.toContain('border-primary');
    });

    it('ignores a drop that carries no files', () => {
      stubFiles(fileInput(), []);
      dropZone().dispatchEvent(dragEvent('drop', []));
      fixture.detectChanges();

      expect(zoneText()).toBe('Click to select or drop file');
    });

    it('ignores a drop with no dataTransfer at all', () => {
      dropZone().dispatchEvent(dragEvent('drop'));
      fixture.detectChanges();

      expect(zoneText()).toBe('Click to select or drop file');
    });
  });

  describe('uploading', () => {
    beforeEach(() => select());

    it('POSTs the file to the upload endpoint', () => {
      const request = startUpload();

      expect(request.method).toBe('POST');
      expect(request.url).toBe('/api/files/upload');
      expect(request.sent).toBeInstanceOf(FormData);
    });

    it('echoes the csrf cookie in the X-CSRF-Token header', () => {
      expect(startUpload().headers['X-CSRF-Token']).toBe('token123');
    });

    it('sends no csrf header when the cookie is missing', () => {
      TestBed.inject(DOCUMENT).cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';

      expect(startUpload().headers['X-CSRF-Token']).toBeUndefined();
    });

    it('does nothing when no file is selected', () => {
      const fresh = TestBed.createComponent(UploadZone);
      fresh.detectChanges();
      FakeXhr.last = null;

      (fresh.nativeElement.querySelector('#uploadBtn') as HTMLButtonElement).click();

      expect(FakeXhr.last).toBeNull();
    });

    it('shows the progress bar and a cancel button while in flight', () => {
      startUpload();

      expect(element().querySelector('#progress-container')).toBeTruthy();
      expect(cancelButton()).toBeTruthy();
      expect(uploadButton().textContent).toContain('UPLOADING...');
      expect(uploadButton().disabled).toBe(true);
    });

    it('tracks the percentage as bytes go out', () => {
      const request = startUpload();

      request.progress(512, 2048);
      fixture.detectChanges();
      expect(progressText()).toBe('25%');

      request.progress(2048, 2048);
      fixture.detectChanges();
      expect(progressText()).toBe('100%');
    });

    it('reports a speed and an ETA', () => {
      vi.useFakeTimers();
      try {
        const fresh = TestBed.createComponent(UploadZone);
        fresh.detectChanges();
        const input = fresh.nativeElement.querySelector('#fileInput') as HTMLInputElement;
        stubFiles(input, [new File(['x'], 'a.bin')]);
        input.dispatchEvent(new Event('change'));
        fresh.detectChanges();

        (fresh.nativeElement.querySelector('#uploadBtn') as HTMLButtonElement).click();
        fresh.detectChanges();

        vi.advanceTimersByTime(2000);
        FakeXhr.last!.progress(2048, 4096);
        fresh.detectChanges();

        expect(fresh.nativeElement.querySelector('#speed-text').textContent.trim()).toBe('1 KB/S');
        expect(fresh.nativeElement.querySelector('#eta-text').textContent.trim()).toBe('0:02');
      } finally {
        vi.useRealTimers();
      }
    });

    it('ignores a progress event of unknown length', () => {
      const request = startUpload();
      request.progress(512, 0, false);
      fixture.detectChanges();

      expect(progressText()).toBe('0%');
      expect(speedText()).toBe('0 KB/S');
      expect(etaText()).toBe('--:--');
    });

    it('sends the visitor to the share page once the server answers', () => {
      startUpload().succeed({ view_key: 'view-123' });

      expect(location.href).toBe('/f/view-123');
    });

    it('warns and stays put when the server reports an error in the body', () => {
      startUpload().succeed({ error: 'storage full' });

      expect(alertMock).toHaveBeenCalledWith('Server error');
      expect(location.href).toBe('/');
    });

    it('warns when the response is not JSON at all', () => {
      startUpload().succeed('<html>502</html>');

      expect(alertMock).toHaveBeenCalledWith('Server error');
      expect(location.href).toBe('/');
    });

    it('warns and re-enables the button on a non-2xx status', () => {
      const request = startUpload();
      request.fail(403);
      fixture.detectChanges();

      expect(alertMock).toHaveBeenCalledWith('Upload failed');
      expect(uploadButton().disabled).toBe(false);
      expect(cancelButton()).toBeNull();
    });

    it('warns and reloads on a transport error', () => {
      const request = startUpload();
      request.responseText = 'connection reset';
      request.onerror?.();

      expect(alertMock).toHaveBeenCalledWith('Upload failed: connection reset');
      expect(location.reloaded).toBe(true);
    });

    it('stays quiet when the error was the caller aborting', () => {
      const request = startUpload();
      request.statusText = 'abort';
      request.onerror?.();

      expect(alertMock).not.toHaveBeenCalled();
      expect(location.reloaded).toBe(false);
    });
  });

  describe('cancelling', () => {
    beforeEach(() => select());

    it('aborts the request, tells the visitor and reloads', () => {
      const request = startUpload();

      cancelButton()!.click();

      expect(request.aborted).toBe(true);
      expect(alertMock).toHaveBeenCalledWith('Upload cancelled.');
      expect(location.reloaded).toBe(true);
    });

    it('does not re-trigger the drop zone behind it', () => {
      startUpload();
      const clickSpy = vi.fn();
      dropZone().addEventListener('click', clickSpy);

      cancelButton()!.click();

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  it('opens the file picker when the drop zone is clicked', () => {
    const click = vi.spyOn(fileInput(), 'click').mockImplementation(() => undefined);

    dropZone().click();

    expect(click).toHaveBeenCalled();
  });

  it('offers a single never-expiring duration option', () => {
    const options = element().querySelectorAll('#duration option');

    expect(options).toHaveLength(1);
    expect((options[0] as HTMLOptionElement).value).toBe('-1');
  });
});
