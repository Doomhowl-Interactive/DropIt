import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard-page';
import { NotFoundPage } from './pages/not-found-page/not-found.page';
import { FileViewPage } from './pages/file-view-page';
import { IndexPage } from './pages/index-page/index.page';
import { LoginPage } from './pages/login-page/login.page';
import { ApiTokensPage } from './pages/api-tokens-page';

/**
 * The `api/...` entries exist because those endpoints answer with a page rather
 * than JSON (a deletion confirmation, or "file not found"). Declaring them
 * keeps the browser-side router in agreement with what the server rendered.
 */
export const routes: Routes = [
  { path: '', component: IndexPage },
  { path: 'login', component: LoginPage },
  { path: 'dashboard', component: DashboardPage },
  { path: 'dashboard/tokens', component: ApiTokensPage },
  { path: 'f/:id', component: FileViewPage },
  { path: '**', component: NotFoundPage },
];
