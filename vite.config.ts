import { defineConfig } from 'vite';

// The A.8 side build. Project root stays the repo root so the dev server serves
// the SHARED `Routes/**` JSON (and the existing LCARS CSS) to the new app exactly
// as the live `js/` app sees them — data and styling are never forked (see A.8).
//
// Entry is `index.next.htm` so the live `index.htm` is untouched until cutover.
export default defineConfig({
  root: '.',
  // Relative base: the built index.next.html references ./assets/… so the bundle
  // works dropped at the site root next to Routes/ (side-by-side with index.htm),
  // regardless of mount path. App data fetches (Routes/…) are already relative.
  base: './',
  server: { open: '/index.next.html' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Two entry HTMLs: the console (remapped to /index.htm on deploy) and the
    // standalone MQTT diagnostic tree (kept as /twist-mqtt-tree.html).
    rollupOptions: { input: { main: 'index.next.html', tree: 'twist-mqtt-tree.html' } },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
