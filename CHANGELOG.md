# AutoScroll Reader — Changelog

All notable changes to this extension are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning is [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Reading history in the popup.** The popup now shows a "Last 7 Days" section with
  per-day reading time and word counts. The section stays hidden until data exists.
  Reading stats are still capped at the most recent seven days in storage.
- **Continuous integration.** A GitHub Actions workflow runs typecheck, unit tests and
  the production build on every push and pull request to `main`.

### Changed
- The content script was split into focused modules (`settings-store`, `scroll-controller`,
  `reading-mode`, `reading-stats`, `density-analyzer`, `overlay`). `content.ts` is now a thin
  entry point that wires the modules together instead of a single 841-line file.

### Fixed
- Swallowed errors in reading-mode stability checks are now logged with context instead of
  being discarded silently.

## [1.0.0] - 2026-10-26

### Added
- Auto-scroll with a configurable focus line (color, thickness, opacity, position).
- Scroll direction (up/down) and speed control (0–10, plus `+`/`-` hotkeys).
- Auto-pause while the reader scrolls manually; resumes shortly after.
- Progress bar showing how far through the page the reader is.
- Reading mode that strips clutter and re-centres long-form content, with a layout
  fallback when the page collapses.
- Per-site setting overrides, persisted across tabs and reloads.
- Auto-start on page load.
- Smart Speed, adjusting rate to on-screen text density.
- Reading statistics (time, words, sessions) for the current day.
- Internal PDF viewer.
- Keyboard shortcuts: `Ctrl+Shift+S` (toggle scrolling), `Ctrl+Shift+R` (reading mode).

### Fixed
- Content script and background worker are bundled as single IIFE files. An earlier
  ESM bundle failed to load as a classic content script, so nothing ran in the browser.
- Popup state could be overwritten by cloud sync; the sync listener now only reacts to
  the settings key.
