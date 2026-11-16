# AutoScroll Reader — Project Tracker

Status of planned work and known gaps. User-facing behaviour is documented in `README.md`;
implementation details live in `TECHNICAL_NOTES.md`.

## Current state

| Area | Status | Notes |
|---|---|---|
| Core scrolling | Done | Focus line, speed, direction, progress bar |
| Per-site settings | Done | Overrides persist across tabs and reloads |
| Auto-start on load | Done | Verified in a real browser |
| Reading mode | Done | Includes layout-collapse fallback |
| Smart Speed | Done | Rate adapts to on-screen text density |
| Reading statistics | Done | Today's totals plus a seven-day history |
| PDF viewer | Done | Standalone page, local and remote PDFs |
| Unit tests | Partial | Pure helpers only |
| CI | Done | Typecheck, tests, build on push and PR |
| Browser verification | Done | Toolbar popup, injection, auto-start |

## Known gaps

| Gap | Impact | Notes |
|---|---|---|
| No tests for content-script behaviour | Medium | Storage, per-site resolution and reading mode are verified manually only |
| `host_permissions: <all_urls>` | Low | Inherent to running on arbitrary article pages; no network access is used |
| Cloud sync has no UI toggle | Low | The `syncEnabled` flag exists and defaults to on |
| Single-browser target | Low | Chromium-based browsers only; Firefox needs the `browser.*` namespace |

## Roadmap

### Next
- Add behaviour tests for per-site settings resolution and reading-mode fallback.
- Surface stored reading history beyond the popup summary.

### Under consideration
- Firefox and Edge port: requires `browser.*` namespace shims and manifest differences.
- Narrower host permissions once the set of supported sites is known.

### Decided against
- Marketplace badges and install prompts.
- A separate mobile/PWA build.
- Bundled per-site speed presets.

## Verification checklist

```
npm run typecheck
npm test
npm run build
```

Then load `dist/` unpacked, open a long article and confirm the toolbar popup reports the
correct host with a green status dot.
