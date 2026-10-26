import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Content scripts are loaded as classic scripts, so they must be a single
// self-contained IIFE bundle. A shared ESM chunk would fail with
// "Cannot use import statement outside a module".
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: resolve(__dirname, 'content.ts'),
      formats: ['iife'],
      name: 'AutoScrollContent',
      fileName: () => 'content.js',
    },
  },
});
