import { DOCUMENT } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { CENTERED_BODY } from '../page';
import { DeletedPage } from './deleted-page';
import { ErrorPage } from './error-page';
import { FileNotFoundPage } from './file-not-found-page';
import { IndexPage } from './index-page';

/** The pages with no inputs: they render fixed copy and set the page chrome. */
describe.each([
  { name: 'DeletedPage', component: DeletedPage, title: 'File Deleted sucessfull' },
  { name: 'ErrorPage', component: ErrorPage, title: 'Nothing to see here' },
  { name: 'FileNotFoundPage', component: FileNotFoundPage, title: '404 — File Not Found' },
  { name: 'IndexPage', component: IndexPage, title: 'Drop.it' },
])('$name', ({ component, title }) => {
  let fixture: ComponentFixture<object>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [component] });
    fixture = TestBed.createComponent(component);
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sets its document title', () => {
    expect(TestBed.inject(Title).getTitle()).toBe(title);
  });

  it('uses the centred body layout', () => {
    expect(TestBed.inject(DOCUMENT).body.className).toBe(CENTERED_BODY);
  });
});

/** The three dead-end pages all need a way back; the index *is* the uploader. */
describe.each([
  { name: 'DeletedPage', component: DeletedPage },
  { name: 'ErrorPage', component: ErrorPage },
  { name: 'FileNotFoundPage', component: FileNotFoundPage },
])('$name', ({ component }) => {
  it('offers a way back to the uploader', () => {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[href="/"]')).toBeTruthy();
  });
});

describe('ErrorPage content', () => {
  it('says there is nothing to see', () => {
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('NOTHING TO SEE HERE');
  });
});

describe('FileNotFoundPage content', () => {
  it('shows a 404 and explains why the file may be gone', () => {
    const fixture = TestBed.createComponent(FileNotFoundPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('404');
    expect(text).toContain('FILE NOT FOUND');
    expect(text).toContain('expired');
  });
});

describe('DeletedPage content', () => {
  it('confirms the deletion', () => {
    const fixture = TestBed.createComponent(DeletedPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('FILE DELETED');
  });
});

describe('IndexPage content', () => {
  let fixture: ComponentFixture<IndexPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(IndexPage);
    fixture.detectChanges();
  });

  it('hosts the upload zone', () => {
    expect(fixture.nativeElement.querySelector('app-upload-zone')).toBeTruthy();
  });

  it('links to the admin console', () => {
    expect(fixture.nativeElement.querySelector('a[href="/admin"]')).toBeTruthy();
  });
});
