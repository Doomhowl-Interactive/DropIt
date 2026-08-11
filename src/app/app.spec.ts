import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterOutlet, provideRouter, Router } from '@angular/router';
import { RenderMode } from '@angular/ssr';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { serverRoutes } from './app.routes.server';
import { AdminPage } from './pages/admin-page';
import { DeleteResultPage } from './pages/delete-result-page';
import { ErrorPage } from './pages/error-page';
import { NotFoundPage } from './pages/not-found-page/not-found.page';
import { FileViewPage } from './pages/file-view-page';
import { IndexPage } from './pages/index-page';
import { LoginPage } from './pages/login-page/login.page';

@Component({ template: '', standalone: true })
class Blank {}

describe('App', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('creates', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders nothing but a router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.debugElement.query((node) => node.componentInstance instanceof RouterOutlet));
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});

describe('routes', () => {
  it.each([
    ['', IndexPage],
    ['login', LoginPage],
    ['admin', AdminPage],
    ['f/:id', FileViewPage],
    ['api/files/delete/:id', DeleteResultPage],
    ['api/files/view/:id', NotFoundPage],
    ['api/files/download/:id', NotFoundPage],
    ['**', ErrorPage],
  ])('maps %o to its page', (path, component) => {
    expect(routes.find((route) => route.path === path)?.component).toBe(component);
  });

  it('ends with the catch-all, so nothing shadows it', () => {
    expect(routes.at(-1)?.path).toBe('**');
    expect(routes.filter((route) => route.path === '**')).toHaveLength(1);
  });

  it('declares no duplicate paths', () => {
    const paths = routes.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  describe('navigation', () => {
    let router: Router;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideRouter(routes.map((route) => ({ ...route, component: Blank })))],
      });
      router = TestBed.inject(Router);
    });

    it.each([
      ['/', ''],
      ['/login', 'login'],
      ['/admin', 'admin'],
      ['/f/abc123', 'f/:id'],
      ['/api/files/delete/abc123', 'api/files/delete/:id'],
      ['/api/files/view/abc123', 'api/files/view/:id'],
      ['/api/files/download/abc123', 'api/files/download/:id'],
    ])('routes %o to the %o entry', async (url, path) => {
      await router.navigateByUrl(url);

      expect(router.routerState.snapshot.root.firstChild?.routeConfig?.path).toBe(path);
    });

    it('falls through to the catch-all for an unknown url', async () => {
      await router.navigateByUrl('/nothing/here');

      expect(router.routerState.snapshot.root.firstChild?.routeConfig?.path).toBe('**');
    });
  });
});

describe('serverRoutes', () => {
  it('renders every path on the server, prerendering nothing', () => {
    expect(serverRoutes).toEqual([{ path: '**', renderMode: RenderMode.Server }]);
  });
});
