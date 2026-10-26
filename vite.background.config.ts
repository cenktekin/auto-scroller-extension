import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// MV3 service workers are registered as classic scripts (the manifest does not
// declare "type": "module"), so the background code must be a single IIFE.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: resolve(__dirname, 'background.ts'),
      formats: ['iife'],
      name: 'AutoScrollBackground',
      fileName: () => 'background.js',
    },
  },
});
