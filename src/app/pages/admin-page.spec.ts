import { DOCUMENT } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setPageContext } from '../../testing/page-context';
import type { AdminFileRow, AdminPageData } from '../../shared/page-context';
import { AdminPage } from './admin-page';

function row(overrides: Partial<AdminFileRow> = {}): AdminFileRow {
  return {
    id: 'file-1',
    filename: 'report.pdf',
    size: '2.0 KB',
    createdAt: '11/08/26 10:30',
    expiresAt: 'NEVER',
    downloadCount: 3,
    deleteAfterDownload: false,
    deleted: false,
    ...overrides,
  };
}

describe('AdminPage', () => {
  let fixture: ComponentFixture<AdminPage>;

  const create = async (data: AdminPageData | null = { files: [], page: 1, totalPages: 0 }) => {
    setPageContext(data ? { page: 'admin', data } : { page: 'index' });
    fixture = TestBed.createComponent(AdminPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const forms = () => Array.from(element().querySelectorAll('form')) as HTMLFormElement[];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    TestBed.inject(DOCUMENT).cookie = 'csrf_token=token123';
  });

  it('sets the page chrome', async () => {
    await create();

    expect(TestBed.inject(Title).getTitle()).toBe('Admin Console');
    expect(TestBed.inject(DOCUMENT).body.className).toBe('min-h-screen p-4');
  });

  describe('with no files', () => {
    it('says the buffer is empty', async () => {
      await create();
      expect(text()).toContain('Zero files in buffer');
    });

    it('reports zero records', async () => {
      await create();
      expect(text()).toContain('0 records');
    });
  });

  describe('with files', () => {
    const data: AdminPageData = {
      files: [
        row(),
        row({ id: 'file-2', filename: 'secret.zip', deleted: true, deleteAfterDownload: true }),
      ],
      page: 1,
      totalPages: 1,
    };

    beforeEach(() => create(data));

    it('lists each file, linking to the admin download', () => {
      const links = element().querySelectorAll('a[href^="/api/files/admin/download/"]');

      expect(links).toHaveLength(2);
      expect(links[0]!.getAttribute('href')).toBe('/api/files/admin/download/file-1');
      expect(links[0]!.textContent).toContain('report.pdf');
    });

    it('shows the preformatted size, timestamps and hit count', () => {
      expect(text()).toContain('2.0 KB');
      expect(text()).toContain('11/08/26 10:30');
      expect(text()).toContain('NEVER');
    });

    it('tags a live file LIVE and a deleted one REMOVED', () => {
      expect(text()).toContain('LIVE');
      expect(text()).toContain('REMOVED');
    });

    it('tags the burn-after-reading flag', () => {
      expect(text()).toContain('YES');
      expect(text()).toContain('NO');
    });

    it('offers both actions for a live file but only the wipe for a deleted one', () => {
      const actions = forms().map((form) => form.getAttribute('action'));

      expect(actions).toContain('/api/files/admin/delete/file-1');
      expect(actions).toContain('/api/files/admin/delete/fr/file-1');
      expect(actions).toContain('/api/files/admin/delete/fr/file-2');
      expect(actions).not.toContain('/api/files/admin/delete/file-2');
    });

    it('reports the record count', () => {
      expect(text()).toContain('2 records');
    });

    it('fills the hidden csrf field from the cookie once rendered', () => {
      const fields = Array.from(
        element().querySelectorAll('input.csrf-field'),
      ) as HTMLInputElement[];

      expect(fields.length).toBeGreaterThan(0);
      for (const field of fields) expect(field.value).toBe('token123');
    });
  });

  describe('confirmation modal', () => {
    beforeEach(() => create({ files: [row()], page: 1, totalPages: 1 }));

    const terminateForm = () =>
      forms().find((form) => form.getAttribute('action') === '/api/files/admin/delete/file-1')!;

    const wipeForm = () =>
      forms().find((form) => form.getAttribute('action') === '/api/files/admin/delete/fr/file-1')!;

    const submit = (form: HTMLFormElement) => {
      const event = new Event('submit', { cancelable: true, bubbles: true });
      form.dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };

    const confirmButton = () =>
      TestBed.inject(DOCUMENT).querySelector('#modal-confirm-btn') as HTMLButtonElement | null;

    const message = () =>
      TestBed.inject(DOCUMENT).querySelector('#modal-message')?.textContent ?? '';

    it('holds the submit back rather than letting the form post', () => {
      const event = submit(terminateForm());
      expect(event.defaultPrevented).toBe(true);
    });

    it('opens with the terminate wording', () => {
      submit(terminateForm());
      expect(message()).toContain('Kill this file?');
    });

    it('opens with the full-wipe wording', () => {
      submit(wipeForm());
      expect(message()).toContain('permanent database scrub');
    });

    it('stays closed until a form is submitted', () => {
      expect(confirmButton()).toBeNull();
    });

    it('submits the held form when the operator confirms', () => {
      const form = terminateForm();
      const nativeSubmit = vi.spyOn(form, 'submit').mockImplementation(() => undefined);

      submit(form);
      confirmButton()!.click();

      expect(nativeSubmit).toHaveBeenCalledTimes(1);
    });

    it('submits the right form when several are on the page', () => {
      const wipe = wipeForm();
      const terminate = terminateForm();
      const wipeSubmit = vi.spyOn(wipe, 'submit').mockImplementation(() => undefined);
      const terminateSubmit = vi.spyOn(terminate, 'submit').mockImplementation(() => undefined);

      submit(wipe);
      confirmButton()!.click();

      expect(wipeSubmit).toHaveBeenCalledTimes(1);
      expect(terminateSubmit).not.toHaveBeenCalled();
    });

    it('forgets the held form when the operator aborts', () => {
      const form = terminateForm();
      const nativeSubmit = vi.spyOn(form, 'submit').mockImplementation(() => undefined);

      submit(form);
      const abort = Array.from(
        TestBed.inject(DOCUMENT).querySelectorAll('button'),
      ).find((button) => button.textContent?.includes('ABORT')) as HTMLButtonElement;
      abort.click();
      fixture.detectChanges();

      expect(nativeSubmit).not.toHaveBeenCalled();
    });
  });

  describe('pagination', () => {
    const links = () =>
      Array.from(element().querySelectorAll('a[href^="?page="]')).map((link) =>
        link.getAttribute('href'),
      );

    it('offers no page links on a single page', async () => {
      await create({ files: [row()], page: 1, totalPages: 1 });
      expect(links()).toEqual([]);
    });

    it('offers only Next on the first of several pages', async () => {
      await create({ files: [row()], page: 1, totalPages: 3 });
      expect(links()).toEqual(['?page=2']);
    });

    it('offers both directions in the middle', async () => {
      await create({ files: [row()], page: 2, totalPages: 3 });
      expect(links()).toEqual(['?page=1', '?page=3']);
    });

    it('offers only Prev on the last page', async () => {
      await create({ files: [row()], page: 3, totalPages: 3 });
      expect(links()).toEqual(['?page=2']);
    });

    it('shows the position in the footer', async () => {
      await create({ files: [row()], page: 2, totalPages: 3 });
      expect(text()).toContain('Page: 2/3');
    });
  });

  it('falls back to an empty console when the context is for another page', async () => {
    await create(null);

    expect(text()).toContain('Zero files in buffer');
    expect(text()).toContain('Page: 1/0');
  });

  it('links back to the uploader and to logout', async () => {
    await create();

    expect(element().querySelector('a[href="/"]')).toBeTruthy();
    expect(element().querySelector('a[href="/logout"]')).toBeTruthy();
  });
});
