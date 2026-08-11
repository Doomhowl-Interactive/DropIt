import { DOCUMENT } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setPageContext } from '../../testing/page-context';
import type { CompletePageData } from '../utils/page-context';
import { CompletePage } from './complete-page';

const DATA: CompletePageData = {
  filename: 'report.pdf',
  downloadId: 'file-1',
  deleteId: 'del-1',
  origin: 'https://drop.example',
};

describe('CompletePage', () => {
  let fixture: ComponentFixture<CompletePage>;

  const create = (data: CompletePageData | null = DATA) => {
    setPageContext(data ? { page: 'complete', data } : { page: 'index' });
    fixture = TestBed.createComponent(CompletePage);
    fixture.detectChanges();
    return fixture;
  };

  const input = (id: string) =>
    fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement | null;

  beforeEach(() => TestBed.configureTestingModule({}));

  it('sets the page chrome', () => {
    create();

    expect(TestBed.inject(Title).getTitle()).toBe('Send.it - File Ready');
  });

  it('builds the download link from the origin and download id', () => {
    create();
    expect(input('res-url')?.value).toBe('https://drop.example/api/files/view/file-1');
  });

  it('builds the deletion link from the origin and deletion id', () => {
    create();
    expect(input('res-del')?.value).toBe('https://drop.example/api/files/delete/del-1');
  });

  it('follows whatever origin the request came in on', () => {
    create({ ...DATA, origin: 'http://localhost:8080' });
    expect(input('res-url')?.value).toBe('http://localhost:8080/api/files/view/file-1');
  });

  it('leaves both links empty when the context is for another page', () => {
    create(null);

    expect(input('res-url')?.value).toBe('');
    expect(input('res-del')?.value).toBe('');
  });

  it('announces that the upload completed', () => {
    create();
    expect(fixture.nativeElement.textContent).toContain('UPLOAD COMPLETE');
  });

  it('offers a link back to start a new upload', () => {
    create();
    expect(fixture.nativeElement.querySelector('a[href="/"]')).toBeTruthy();
  });

  describe('copy button', () => {
    it('selects the whole field and asks the document to copy it', () => {
      create();
      const execCommand = vi.fn();
      Object.defineProperty(TestBed.inject(DOCUMENT), 'execCommand', {
        value: execCommand,
        configurable: true,
      });

      const field = input('res-url')!;
      const setSelectionRange = vi.spyOn(field, 'setSelectionRange');
      const select = vi.spyOn(field, 'select');

      const button = fixture.nativeElement.querySelectorAll('button')[0] as HTMLButtonElement;
      button.click();

      expect(select).toHaveBeenCalled();
      expect(setSelectionRange).toHaveBeenCalledWith(0, 99999);
      expect(execCommand).toHaveBeenCalledWith('copy');
    });

    it('copies the deletion link from the second button', () => {
      create();
      const execCommand = vi.fn();
      Object.defineProperty(TestBed.inject(DOCUMENT), 'execCommand', {
        value: execCommand,
        configurable: true,
      });

      const select = vi.spyOn(input('res-del')!, 'select');
      (fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement).click();

      expect(select).toHaveBeenCalled();
      expect(execCommand).toHaveBeenCalledWith('copy');
    });
  });

  it('marks both link fields read-only', () => {
    create();

    expect(input('res-url')?.readOnly).toBe(true);
    expect(input('res-del')?.readOnly).toBe(true);
  });
});
