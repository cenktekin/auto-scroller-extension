import type { ReaderSettings } from './types';
import type { SettingsStore } from './settings-store';
import type { ScrollOverlay } from './overlay';
import { TextDensityAnalyzer } from './density-analyzer';
import { ReadingStatsTracker } from './reading-stats';
import { handleChromeError, showUserError, ERROR_MESSAGES } from './errors';

/** Drives the requestAnimationFrame scroll loop and feeds reading stats. */
export class ScrollController {
  private animationFrameId: number | null = null;
  private isPausedByUser = false;
  private pauseTimeoutId: number | null = null;
  private lastTimestamp: number | null = null;
  private subpixelRemainder = 0;
  private toggling = false;
  private readonly BASE_SPEED_PPS = 12;
  private readonly TOGGLE_TIMEOUT = 100;
  private readonly USER_PAUSE_RESUME_DELAY = 1500;

  constructor(
    private readonly store: SettingsStore,
    private readonly overlay: ScrollOverlay,
    private readonly density: TextDensityAnalyzer,
    private readonly stats: ReadingStatsTracker,
  ) {}

  get isScrolling(): boolean {
    return this.store.current.isScrolling;
  }

  get isToggling(): boolean {
    return this.toggling;
  }

  private calculateSmartSpeed(): number {
    const settings = this.store.current;
    if (!settings.smartSpeedEnabled) {
      return settings.scrollSpeed;
    }

    const wordsPerViewport = this.density.analyze();

    if (wordsPerViewport < 50) return Math.max(1, settings.scrollSpeed - 2);
    if (wordsPerViewport < 100) return Math.max(2, settings.scrollSpeed - 1);
    if (wordsPerViewport > 500) return Math.min(10, settings.scrollSpeed + 2);
    if (wordsPerViewport > 300) return Math.min(10, settings.scrollSpeed + 1);

    return settings.scrollSpeed;
  }

  private scrollStep = (timestamp: number): void => {
    if (!this.isScrolling || this.isPausedByUser) return;

    const settings = this.store.current;
    const dt = this.lastTimestamp === null ? (1 / 60) : Math.max(0, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    const pps = this.BASE_SPEED_PPS * this.calculateSmartSpeed();
    if (pps === 0) {
      this.animationFrameId = requestAnimationFrame(this.scrollStep);
      return;
    }

    const direction = settings.scrollDirection === 'up' ? -1 : 1;
    const delta = direction * pps * dt + this.subpixelRemainder;

    const intDelta = delta > 0 ? Math.floor(delta) : Math.ceil(delta);
    this.subpixelRemainder = delta - intDelta;

    const scroller = document.scrollingElement || document.documentElement;
    const maxScrollTop = Math.max(0, scroller.scrollHeight - window.innerHeight);

    if (intDelta !== 0) {
      scroller.scrollTop = Math.max(0, Math.min(scroller.scrollTop + intDelta, maxScrollTop));
      this.overlay.updateProgress(this.isScrolling);
      this.stats.trackProgress(this.density.analyze());
    }

    const atBoundary = settings.scrollDirection === 'down'
      ? scroller.scrollTop >= maxScrollTop
      : scroller.scrollTop <= 0;

    if (atBoundary) {
      this.stop();
      this.store.setGlobalScrolling(false);
      if (this.store.storageAvailable) {
        this.store.persistGlobalSettings().catch((error) => {
          handleChromeError('saving settings at scroll boundary', error);
        });
      }
    } else {
      this.animationFrameId = requestAnimationFrame(this.scrollStep);
    }
  };

  private start(): void {
    if (this.animationFrameId !== null) {
      return;
    }
    this.store.current.isScrolling = true;
    this.overlay.setVisibility(true);
    this.overlay.updateProgress(true);
    this.stats.startSession();

    this.lastTimestamp = null;
    this.subpixelRemainder = 0;
    this.animationFrameId = requestAnimationFrame(this.scrollStep);
  }

  private stop(): void {
    this.store.current.isScrolling = false;
    this.overlay.setVisibility(false);

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    void this.stats.saveSession();

    this.lastTimestamp = null;
    this.subpixelRemainder = 0;
  }

  private releaseTogglingLater(): void {
    setTimeout(() => {
      this.toggling = false;
    }, this.TOGGLE_TIMEOUT);
  }

  /** Starts scrolling for "Auto-start on load" without persisting anything. */
  autoStart(): void {
    this.start();
  }

  toggle(): void {
    this.toggling = true;

    const newState = !this.isScrolling;
    if (newState) {
      this.start();
    } else {
      this.stop();
    }

    this.store.current.isScrolling = newState;
    this.store.setGlobalScrolling(false);

    if (!this.store.storageAvailable) {
      this.releaseTogglingLater();
      return;
    }

    try {
      this.store.persistGlobalSettings().then(() => {
        this.releaseTogglingLater();
      }).catch((error) => {
        handleChromeError('saving settings to storage', error);
        showUserError(ERROR_MESSAGES.STORAGE_SAVE_FAILED);
        this.toggling = false;
      });
    } catch (error) {
      handleChromeError('storage set operation', error);
      showUserError(ERROR_MESSAGES.STORAGE_SAVE_FAILED);
      this.toggling = false;
    }
  }

  /** Stops a user-initiated scroll without persisting, then resumes after a short delay. */
  private pauseForUserScroll(): void {
    this.isPausedByUser = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.pauseTimeoutId !== null) {
      clearTimeout(this.pauseTimeoutId);
    }
    this.pauseTimeoutId = window.setTimeout(() => {
      this.isPausedByUser = false;
      this.pauseTimeoutId = null;
      if (this.isScrolling) {
        this.lastTimestamp = null;
        this.subpixelRemainder = 0;
        this.animationFrameId = requestAnimationFrame(this.scrollStep);
      }
    }, this.USER_PAUSE_RESUME_DELAY);
  }

  /** Auto-scroll pauses briefly whenever the user wheels, so the page stays readable. */
  setupUserScrollPause(): void {
    window.addEventListener('wheel', () => {
      if (!this.isScrolling || this.isPausedByUser) return;
      this.pauseForUserScroll();
    }, { capture: true, passive: true });
  }

  /** `+` / `-` adjust the speed; the change is applied and persisted. */
  setupSpeedHotkeys(): void {
    try {
      window.addEventListener('keydown', (e) => {
        try {
          const target = e.target as HTMLElement | null;
          const isEditable = !!target && (
            target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable
          );
          if (isEditable) return;
          const inc = (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd');
          const dec = (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract');
          if (!inc && !dec) return;
          e.preventDefault();
          const clamp = (v: number) => Math.max(0, Math.min(10, v));
          const next = clamp(this.store.current.scrollSpeed + (inc ? 1 : -1));
          if (next === this.store.current.scrollSpeed) return;
          this.store.patchLocal({ scrollSpeed: next });
          this.overlay.showSpeedToast(next);
          if (this.store.storageAvailable) {
            this.store.persist({ scrollSpeed: next });
          }
        } catch (error) {
          handleChromeError('handling speed hotkeys', error);
        }
      }, { capture: true });
    } catch (error) {
      handleChromeError('setting up speed hotkeys', error);
    }
  }

  /** Applies a settings patch locally and refreshes the overlays that depend on it. */
  updateSettings(patch: Partial<ReaderSettings>): void {
    this.store.patchLocal(patch);
    this.overlay.applyFocusLineStyle(this.store.current);
  }
}
