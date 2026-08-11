import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard-page';
import { NotFoundPage } from './pages/not-found-page/not-found.page';
import { FileViewPage } from './pages/file-view-page';
import { IndexPage } from './pages/index-page/index.page';
import { LoginPage } from './pages/login-page/login.page';
import { McpTokensPage } from './pages/mcp-tokens-page';

/**
 * The `api/...` entries exist because those endpoints answer with a page rather
 * than JSON (a deletion confirmation, or "file not found"). Declaring them
 * keeps the browser-side router in agreement with what the server rendered.
 */
export const routes: Routes = [
  { path: '', component: IndexPage },
  { path: 'login', component: LoginPage },
  { path: 'dashboard', component: DashboardPage },
  { path: 'dashboard/mcp', component: McpTokensPage },
  { path: 'f/:id', component: FileViewPage },
  { path: 'api/files/view/:id', component: NotFoundPage },
  { path: 'api/files/download/:id', component: NotFoundPage },
  { path: '**', component: NotFoundPage },
];
