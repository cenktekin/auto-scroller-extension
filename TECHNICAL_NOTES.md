# AutoScroll Reader — Technical Notes

Implementation notes for contributors. For user-facing documentation see `README.md`.

## Architecture

The extension has three execution contexts plus a standalone viewer page:

| Context | Entry | Bundle |
|---|---|---|
| Popup | `index.tsx` → `App.tsx` | ESM, `popup.js` |
| Content script | `content.ts` | IIFE, `content.js` |
| Service worker | `background.ts` | IIFE, `background.js` |
| PDF viewer | `pdf-viewer.ts` | ESM, `pdfviewer.js` |

The popup and the PDF viewer are loaded as module pages and may share chunks. The content
script and the service worker are **classic scripts**, so each must be a single
self-contained IIFE: `vite.content.config.ts` and `vite.background.config.ts` build them
with `formats: ['iife']`. If either starts emitting `import` statements, Chrome refuses to
run it and the extension silently does nothing. This is the failure mode to check first
when the extension appears dead in a real browser.

## Content script modules

`content.ts` is an entry point only. It builds the objects below and routes messages:

- **`settings-store.ts`** — global settings, per-site overrides, the `siteModeHosts` list,
  effective-settings resolution, persistence, and the `storage.onChanged` subscription.
  `isScrolling` is runtime state and is never persisted as `true`.
- **`scroll-controller.ts`** — the `requestAnimationFrame` loop, subpixel accumulation,
  boundary detection, Smart Speed, speed hotkeys, and wheel-pause behaviour.
- **`reading-mode.ts`** — injects the reading stylesheet, measures `scrollHeight` and
  swaps to a conservative stylesheet when the layout collapses below 60% of baseline.
- **`reading-stats.ts`** — session timing, word estimation, and the seven-day rolling
  window stored under `autoscroll_reading_stats`.
- **`density-analyzer.ts`** — counts visible words in the viewport, cached for 2 s.
- **`overlay.ts`** — the focus line, progress bar and speed toast.
- **`errors.ts`** — shared error messages and logging helpers.

## Storage keys

| Key | Namespace | Shape |
|---|---|---|
| `readerSettings` | `local` (+ `sync` mirror) | `ReaderSettings` |
| `readerSettings_sync` | `sync` | `ReaderSettings` |
| `syncEnabled` | `local` | `boolean` |
| `siteSettings` | `local` | `{ [hostname]: Partial<ReaderSettings> }` |
| `siteModeHosts` | `local` | `string[]` |
| `autoscroll_reading_stats` | `local` | `{ [YYYY-MM-DD]: ReadingStats }` |

Cloud sync is opt-in through `syncEnabled` and mirrors only `readerSettings`. The
`storage.onChanged` handler must ignore the `sync` namespace for every key except
`readerSettings_sync`, otherwise a sync write overwrites unrelated popup state.

## Build and verification

```
npm ci --include=dev     # a global omit=dev setting would drop typescript/vite
npm run typecheck        # tsc --noEmit
npm test                 # node:test, tests/utils.test.ts
npm run build            # typecheck + three vite builds into dist/
```

`npm run build` depends on `tsc --noEmit`, so a type error fails the build rather than
shipping.

### Manual browser check

Load `dist/` as an unpacked extension, open a long article, and use the toolbar icon.
Verify the status dot is green, the host is correct, and auto-start scrolls the page.
Unit tests do not cover this path.

## Testing scope

`tests/utils.test.ts` covers the pure helpers: URL filtering, host parsing, and settings
merging. The content script's DOM behaviour is not unit-tested; it is verified manually in
a real browser.

## Permissions

`host_permissions: ["<all_urls>"]` is required because the content script runs on arbitrary
article pages. The extension makes no network requests and sends no data anywhere.
