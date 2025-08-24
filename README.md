# AutoScroll Reader (Chrome Extension)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%E2%98%95%EF%B8%8F-orange)](https://buymeacoffee.com/cenktekin)

AutoScroll Reader adds smooth auto-scrolling with a subtle focus line for comfortable reading on the web and inside the built-in PDF viewer page of this extension.

## Highlights

- Smooth, time-based auto-scroll with sub-pixel accumulation (works at very low speeds)
- Customizable focus line: color, opacity, thickness
- Settings persist via Chrome storage
- Internal PDF Viewer powered by `pdfjs-dist`

## Demos

<div align="left">

<p><strong>Reading Mode on Web Pages</strong></p>

<video src="./auto-scroll-reading.mp4" width="520" autoplay muted loop playsinline controls>
  <a href="./auto-scroll-reading.mp4">Watch the demo video</a>
</video>

<p><strong>PDF Auto-Scroll</strong></p>

<video src="./auto-scroll-pdf.mp4" width="520" autoplay muted loop playsinline controls>
  <a href="./auto-scroll-pdf.mp4">Watch the demo video</a>
  (Your Markdown viewer may not support inline video playback.)
  
</video>

</div>

## Keyboard Shortcuts

- Web pages:
  - Toggle auto-scroll: Ctrl+Shift+S (Cmd+Shift+S on macOS)
  - Speed: + / -
- Internal PDF Viewer (`pdf-viewer.html`):
  - Toggle auto-scroll: Space
  - Speed: + / -

Shortcuts ignore inputs/textareas/contenteditable to avoid interfering while typing.

## Open the PDF Viewer

- From the popup, click "Open PDF Viewer" to open `pdf-viewer.html`.
- You can then:
  - Open a local PDF using the file picker.
  - Or open a remote PDF by passing a `url` query param (http/https, data:, blob: allowed).

> Note: The viewer blocks restricted schemes (e.g., chrome://, chrome-extension://, Web Store) and will show a friendly message instead of failing.

## Install (Load Unpacked)

1. Build the extension:
   ```bash
   npm install
   npm run build
   ```
2. Open Chrome → `chrome://extensions`
3. Enable Developer Mode
4. Click "Load unpacked" and select this project folder

The built files are in `dist/`.

## Development

- Popup (React + Vite): `index.html`, `index.tsx`, `App.tsx`
- Content script: `content.ts`
- Background service worker: `background.ts`
- Internal PDF viewer: `pdf-viewer.html`, `pdf-viewer.ts`
- Types/Helpers: `types.ts`, `hooks/`, `components/`

Build:
```bash
npm run build
```

## Permissions

- `storage` – persist settings
- `activeTab`, `scripting` – content script messaging/injection

## Known Limitations

- Chrome’s own PDF viewer tab (and other restricted pages like `chrome://` or the Web Store) block injections. AutoScroll works on normal sites and the extension’s internal viewer.

## Support

If you find this extension useful, please consider supporting development:

- https://buymeacoffee.com/cenktekin ☕

## License

MIT
