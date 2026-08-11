import {
  DOCUMENT,
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  REQUEST_CONTEXT,
  TransferState,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { PAGE_CONTEXT_KEY, type PageContext } from '../shared/page-context';

const CONTEXT_KEY = makeStateKey<PageContext | null>(PAGE_CONTEXT_KEY);

/**
 * Exposes the page context the Express layer computed for this request.
 *
 * On the server it arrives through `REQUEST_CONTEXT` and is stashed in
 * `TransferState`; the browser reads that same payload back during hydration,
 * so both renders agree on the markup.
 */
@Injectable({ providedIn: 'root' })
export class PageDataService {
  private readonly state = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));
  private readonly requestContext = inject(REQUEST_CONTEXT, { optional: true });

  readonly context = this.resolve();

  private resolve(): PageContext | null {
    if (this.isServer) {
      const context = (this.requestContext as PageContext | undefined) ?? null;
      this.state.set(CONTEXT_KEY, context);
      return context;
    }
    return this.state.get(CONTEXT_KEY, null);
  }
}

/**
 * Applies the per-page document chrome — the <title> and the <body> classes
 * each of the original templates carried.
 */
export function usePage(options: { title: string; bodyClass: string }): void {
  inject(Title).setTitle(options.title);
  inject(DOCUMENT).body.className = options.bodyClass;
}

/** Centred single-column layout shared by most of the pages. */
export const CENTERED_BODY = 'min-h-screen flex items-center justify-center p-4 no-transitions';
