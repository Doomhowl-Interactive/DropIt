import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard-page';
import { NotFoundPage } from './pages/not-found-page/not-found.page';
import { IndexPage } from './pages/index-page/index.page';
import { LoginPage } from './pages/login-page/login.page';
import { ApiTokensPage } from './pages/api-tokens-page';

/**
 * Only the pages Express renders directly. Anything else — `/api/files/:id`
 * answering with "file not found", say — falls through to the wildcard, which
 * renders the same not-found page the server did.
 */
export const routes: Routes = [
  { path: '', component: IndexPage },
  { path: 'login', component: LoginPage },
  { path: 'dashboard', component: DashboardPage },
  { path: 'dashboard/tokens', component: ApiTokensPage },
  {
    path: 'dashboard/password',
    loadComponent: () => import('./pages/change-password-page').then((m) => m.ChangePasswordPage),
  },
  { path: '**', component: NotFoundPage },
];
