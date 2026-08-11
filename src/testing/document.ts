import { DOCUMENT, type Provider } from '@angular/core';

export interface FakeLocation {
  href: string;
  reload: () => void;
}

/**
 * A DOCUMENT provider whose `location` is inert.
 *
 * Components navigate by assigning `document.location.href`, and jsdom both
 * refuses to redefine `location` and complains loudly about navigation. This
 * proxies the real document so rendering still works, swapping only that one
 * property for a plain object the test can inspect.
 */
export function provideFakeLocation(location: FakeLocation): Provider {
  const real = document;

  const proxy = new Proxy(real, {
    get(target, property, receiver) {
      if (property === 'location') return location;

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, property, value) {
      if (property === 'location') return true;
      return Reflect.set(target, property, value, target);
    },
  });

  return { provide: DOCUMENT, useValue: proxy };
}

/** A fresh inert location, defaulting to the page the test starts on. */
export function fakeLocation(href = '/'): FakeLocation & { reloaded: boolean } {
  const location = {
    href,
    reloaded: false,
    reload() {
      location.reloaded = true;
    },
  };
  return location;
}
