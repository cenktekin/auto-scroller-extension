# AutoScroll Reader (Chrome Extension)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%E2%98%95%EF%B8%8F-orange)](https://buymeacoffee.com/cenktekin)

AutoScroll Reader automatically scrolls pages with a visible focus line for comfortable reading.

Works on normal web pages and embedded PDF viewers. Chrome's built‑in PDF viewer is not scriptable; see Known Limitations for a workaround plan.

## Features

- Adjustable scroll speed (time‑based, smooth, sub‑pixel accurate)
- Toggle start/stop via popup or keyboard shortcut
- Customizable focus line (color, opacity, thickness)
- State persisted per browser (Chrome storage)

## Keyboard Shortcut

- Default: Ctrl+Shift+S (Cmd+Shift+S on macOS)

## Install (Load Unpacked)

1. Build the extension:
   ```bash
   npm install
   npm run build
   ```
2. Open Chrome → chrome://extensions
3. Enable Developer Mode
4. Click "Load unpacked" and select this project folder

The built files are in `dist/`. This repo includes `dist/` for convenience.

## Development

- Source popup (React + Vite): `index.html`, `index.tsx`, `App.tsx`
- Content script: `content.ts`
- Background service worker: `background.ts`
- Types/Helpers: `types.ts`, `hooks/`, `components/`

Build:
```bash
npm run build
```

Package contents used by Chrome:
- `manifest.json`
- `dist/content.js`, `dist/background.js`, `dist/popup.js`, `dist/assets/popup.css`
- `index.html` (popup), icons

## Permissions

- `storage` – persist settings
- `activeTab`, `scripting` – messaging/injection safety for keyboard shortcut fallback

## Known Limitations

- Chrome's native PDF viewer runs in a restricted `chrome-extension://` origin and blocks third‑party content scripts. AutoScroll works on pages that embed PDFs in their own viewer (e.g., pdf.js), but not on the native viewer tab.
- Planned workaround: an internal PDF viewer page using `pdfjs-dist`, opened with the original PDF URL ("Open with AutoScroll").

## License

MIT


## Support

If you find this extension useful, you can support development here:

- https://buymeacoffee.com/cenktekin

