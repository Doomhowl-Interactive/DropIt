import { TransferState, makeStateKey, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PAGE_CONTEXT_KEY, type PageContext } from '../app/utils/page-context';

const CONTEXT_KEY = makeStateKey<PageContext | null>(PAGE_CONTEXT_KEY);

/**
 * Seeds the transferred page context, the way hydration would in the browser.
 * Call before injecting `PageDataService` or creating a component that uses it,
 * since the service resolves its context once, on construction.
 */
export function setPageContext(context: PageContext | null): void {
  TestBed.inject(TransferState).set(CONTEXT_KEY, context);
}

/** Silences PrimeNG's animation providers, which tests do not need. */
export const NO_ANIMATIONS: Provider[] = [];
