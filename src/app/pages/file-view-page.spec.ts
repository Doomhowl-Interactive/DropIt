import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { setPageContext } from '../../testing/page-context';
import type { PageContext } from '../utils/page-context';
import { FileViewPage } from './file-view-page';

const COMPLETE: PageContext = {
  page: 'complete',
  data: {
    filename: 'report.pdf',
    downloadId: 'file-1',
    deleteId: 'del-1',
    origin: 'https://drop.example',
  },
};

/** Both pages are thin switches between a success page and the 404 page. */
describe('FileViewPage', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  const render = (context: PageContext | null) => {
    setPageContext(context);
    const fixture = TestBed.createComponent(FileViewPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows the share page when the view key resolved', () => {
    const element = render(COMPLETE);

    expect(element.querySelector('app-complete-page')).toBeTruthy();
    expect(element.querySelector('app-file-not-found-page')).toBeNull();
  });

  it('shows the 404 page when the server reported the file missing', () => {
    const element = render({ page: 'file-not-found' });

    expect(element.querySelector('app-file-not-found-page')).toBeTruthy();
    expect(element.querySelector('app-complete-page')).toBeNull();
  });

  it('shows the 404 page when there is no context at all', () => {
    expect(render(null).querySelector('app-file-not-found-page')).toBeTruthy();
  });
});
