import { defineConfig } from 'vitest/config';

/**
 * Server-side tests only. The Angular `test` target (`@angular/build:unit-test`)
 * runs specs in a browser-like environment, which cannot load the native
 * better-sqlite3 binding these need — hence a second, node-targeted runner
 * rather than one shared config.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/server/**/*.spec.ts'],
    globals: true,
  },
});
