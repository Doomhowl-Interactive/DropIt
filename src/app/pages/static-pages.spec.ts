import { DOCUMENT } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { CENTERED_BODY } from '../utils/page';
import { DeletedPage } from './deleted-page';
import { NotFoundPage } from './not-found-page/not-found.page';
import { IndexPage } from './index-page/index.page';

/** The pages with no inputs: they render fixed copy and set the page chrome. */
describe.each([
  { name: 'DeletedPage', component: DeletedPage, title: 'File Deleted sucessfull' },
  { name: 'FileNotFoundPage', component: NotFoundPage, title: '404 — File Not Found' },
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
  { name: 'FileNotFoundPage', component: NotFoundPage },
])('$name', ({ component }) => {
  it('offers a way back to the uploader', () => {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[href="/"]')).toBeTruthy();
  });
});

describe('FileNotFoundPage content', () => {
  it('shows a 404 and explains why the file may be gone', () => {
    const fixture = TestBed.createComponent(NotFoundPage);
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

  it('links to the admin console', () => {
    expect(fixture.nativeElement.querySelector('a[href="/admin"]')).toBeTruthy();
  });
});
