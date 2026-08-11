import {
  DOCUMENT,
  PLATFORM_ID,
  REQUEST_CONTEXT,
  TransferState,
  makeStateKey,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { PAGE_CONTEXT_KEY, type PageContext } from '../../shared/page-context';
import { CENTERED_BODY, PageDataService, usePage } from './page';

const CONTEXT_KEY = makeStateKey<PageContext | null>(PAGE_CONTEXT_KEY);

describe('PageDataService', () => {
  describe('in the browser', () => {
    beforeEach(() => TestBed.configureTestingModule({}));

    it('replays the context the server transferred', () => {
      TestBed.inject(TransferState).set(CONTEXT_KEY, { page: 'deleted' });

      expect(TestBed.inject(PageDataService).context).toEqual({ page: 'deleted' });
    });

    it('yields null when no context was transferred', () => {
      expect(TestBed.inject(PageDataService).context).toBeNull();
    });

    it('carries nested page data through', () => {
      const context: PageContext = {
        page: 'complete',
        data: {
          filename: 'report.pdf',
          downloadId: 'file-1',
          deleteId: 'del-1',
          origin: 'https://drop.example',
        },
      };
      TestBed.inject(TransferState).set(CONTEXT_KEY, context);

      expect(TestBed.inject(PageDataService).context).toEqual(context);
    });
  });

  describe('on the server', () => {
    const configure = (requestContext: unknown) =>
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'server' },
          { provide: REQUEST_CONTEXT, useValue: requestContext },
        ],
      });

    it('reads the context Express attached to the request', () => {
      configure({ page: 'index' });

      expect(TestBed.inject(PageDataService).context).toEqual({ page: 'index' });
    });

    it('stashes it in TransferState for the browser to pick up', () => {
      configure({ page: 'index' });
      TestBed.inject(PageDataService);

      expect(TestBed.inject(TransferState).get(CONTEXT_KEY, null)).toEqual({ page: 'index' });
    });

    it('falls back to null, and transfers null, when there is no request context', () => {
      configure(undefined);

      expect(TestBed.inject(PageDataService).context).toBeNull();
      expect(TestBed.inject(TransferState).get(CONTEXT_KEY, { page: 'index' })).toBeNull();
    });
  });
});

describe('usePage', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('sets the document title and replaces the body classes', () => {
    TestBed.runInInjectionContext(() => usePage({ title: 'Admin Console', bodyClass: 'p-4' }));

    expect(TestBed.inject(Title).getTitle()).toBe('Admin Console');
    expect(TestBed.inject(DOCUMENT).body.className).toBe('p-4');
  });

  it('overwrites whatever classes the body already had', () => {
    TestBed.inject(DOCUMENT).body.className = 'stale leftover';

    TestBed.runInInjectionContext(() => usePage({ title: 'Drop.it', bodyClass: CENTERED_BODY }));

    expect(TestBed.inject(DOCUMENT).body.className).toBe(CENTERED_BODY);
  });
});

describe('CENTERED_BODY', () => {
  it('is a full-height centred layout', () => {
    expect(CENTERED_BODY).toContain('min-h-screen');
    expect(CENTERED_BODY).toContain('items-center');
    expect(CENTERED_BODY).toContain('justify-center');
  });
});
