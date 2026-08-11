import { DOCUMENT } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeLocation, provideFakeLocation } from '../../../testing/document';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let location: ReturnType<typeof fakeLocation>;
  let fetchMock: ReturnType<typeof vi.fn>;

  const field = (id: string) => fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;

  const form = () => fixture.nativeElement.querySelector('form') as HTMLFormElement;

  const submit = async () => {
    form().dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const ok = (status = 200) => ({ ok: status < 400, status }) as Response;

  beforeEach(() => {
    location = fakeLocation('/login');
    TestBed.configureTestingModule({ providers: [provideFakeLocation(location)] });

    fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal('fetch', fetchMock);

    TestBed.inject(DOCUMENT).cookie = 'csrf_token=token123';

    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sets the page chrome', () => {
    expect(TestBed.inject(Title).getTitle()).toBe('Login');
    expect(TestBed.inject(DOCUMENT).body.className).toContain('min-h-screen');
  });

  it('renders username and password fields, the latter masked', () => {
    expect(field('username')).toBeTruthy();
    expect(field('password').type).toBe('password');
  });

  it('hides the error message until a login fails', () => {
    expect(fixture.nativeElement.textContent).not.toContain('ACCESS DENIED');
  });

  it('posts the typed credentials as JSON', async () => {
    field('username').value = 'admin';
    field('password').value = 'Hunter2!x';

    await submit();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'Hunter2!x' }),
      }),
    );
  });

  it('echoes the csrf cookie back in the X-CSRF-Token header', async () => {
    await submit();

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'token123',
    });
  });

  it('redirects to the dashboard on success', async () => {
    await submit();
    expect(location.href).toBe('/dashboard');
  });

  it('shows ACCESS DENIED and stays put when the credentials are rejected', async () => {
    fetchMock.mockResolvedValue(ok(401));

    await submit();

    expect(fixture.nativeElement.textContent).toContain('ACCESS DENIED');
    expect(location.href).toBe('/login');
  });

  it('shows ACCESS DENIED when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await submit();

    expect(fixture.nativeElement.textContent).toContain('ACCESS DENIED');
    expect(location.href).toBe('/login');
  });

  it('prevents the browser from submitting the form itself', async () => {
    const event = new Event('submit', { cancelable: true });
    form().dispatchEvent(event);
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(true);
  });

  it('sends an empty csrf header when the cookie is missing', async () => {
    const document = TestBed.inject(DOCUMENT);
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';

    await submit();

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('');
  });

  it('links back to the uploader', () => {
    expect(fixture.nativeElement.querySelector('a[href="/"]')).toBeTruthy();
  });
});
