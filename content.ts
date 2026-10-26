import type { ReaderSettings, ReadingStats, ChromeMessage, SiteSettingsMap } from './types';
import { DEFAULT_SETTINGS, SITE_MODE_KEY, SITE_SETTINGS_KEY } from './types';
import { resolveSettings } from './utils';

(() => {

  class TextDensityAnalyzer {
    private cachedDensity: number = 0;
    private lastAnalysisTime: number = 0;
    private readonly ANALYSIS_INTERVAL = 2000;

    analyze(): number {
      const now = Date.now();
      if (now - this.lastAnalysisTime < this.ANALYSIS_INTERVAL) {
        return this.cachedDensity;
      }
      
      const viewportHeight = window.innerHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const viewportTop = scrollTop;
      const viewportBottom = scrollTop + viewportHeight;
      
      const textNodes = this.getVisibleTextNodes(viewportTop, viewportBottom);
      let totalWords = 0;
      
      for (const node of textNodes) {
        const text = node.textContent || '';
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        totalWords += words.length;
      }
      
      this.cachedDensity = totalWords;
      this.lastAnalysisTime = now;
      return totalWords;
    }

    private getVisibleTextNodes(viewportTop: number, viewportBottom: number): Node[] {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
            const rect = parent.getBoundingClientRect();
            const elementTop = rect.top + window.scrollY;
            const elementBottom = elementTop + rect.height;
            if (elementBottom < viewportTop || elementTop > viewportBottom) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );
      
      const nodes: Node[] = [];
      while (walker.nextNode()) {
        nodes.push(walker.currentNode);
      }
      return nodes;
    }
  }

  const EMPTY_STATS: ReadingStats = { totalSeconds: 0, totalWords: 0, sessions: 0 };

  class ReadingStatsTracker {
    private static readonly STORAGE_KEY = 'autoscroll_reading_stats';
    private sessionStartTime: number = 0;
    private sessionWordsRead: number = 0;
    private lastScrollPosition: number = 0;
    private stats: Record<string, ReadingStats> = {};
    private readonly storageAvailable: boolean;

    constructor(storageAvailable: boolean) {
      this.storageAvailable = storageAvailable;
    }

    async load(): Promise<void> {
      if (!this.storageAvailable) return;
      try {
        const result = await chrome.storage.local.get(ReadingStatsTracker.STORAGE_KEY);
        this.stats = result[ReadingStatsTracker.STORAGE_KEY] ?? {};
      } catch (error) {
        handleChromeError('loading reading stats', error);
        this.stats = {};
      }
    }

    startSession(): void {
      this.sessionStartTime = Date.now();
      this.sessionWordsRead = 0;
      this.lastScrollPosition = window.scrollY || document.documentElement.scrollTop;
    }

    trackProgress(currentDensity: number): void {
      const currentScroll = window.scrollY || document.documentElement.scrollTop;
      const scrollDelta = Math.abs(currentScroll - this.lastScrollPosition);
      if (scrollDelta > 50) {
        this.sessionWordsRead += Math.round(currentDensity * (scrollDelta / window.innerHeight));
        this.lastScrollPosition = currentScroll;
      }
    }

    async saveSession(): Promise<void> {
      if (this.sessionStartTime === 0) return;

      try {
        const duration = Math.round((Date.now() - this.sessionStartTime) / 1000);
        const today = new Date().toISOString().split('T')[0];

        if (!this.stats[today]) {
          this.stats[today] = { ...EMPTY_STATS };
        }

        this.stats[today].totalSeconds += duration;
        this.stats[today].totalWords += this.sessionWordsRead;
        this.stats[today].sessions += 1;

        const last7Days = Object.keys(this.stats).sort().slice(-7);
        const trimmedStats: Record<string, ReadingStats> = {};
        for (const key of last7Days) {
          trimmedStats[key] = this.stats[key];
        }
        this.stats = trimmedStats;

        if (this.storageAvailable) {
          await chrome.storage.local.set({ [ReadingStatsTracker.STORAGE_KEY]: trimmedStats });
        }
      } catch (error) {
        handleChromeError('saving reading stats', error);
      }
    }

    getTodayStats(): ReadingStats {
      const today = new Date().toISOString().split('T')[0];
      return this.stats[today] || { ...EMPTY_STATS };
    }

    getSessionDuration(): number {
      if (this.sessionStartTime === 0) return 0;
      return Math.round((Date.now() - this.sessionStartTime) / 1000);
    }
  }

  // Error handling constants
  const ERROR_MESSAGES = {
    STORAGE_UNAVAILABLE: 'Chrome storage API is not available',
    STORAGE_LOAD_FAILED: 'Failed to load settings from storage',
    STORAGE_SAVE_FAILED: 'Failed to save settings to storage',
    DOM_MANIPULATION_FAILED: 'Failed to manipulate DOM element',
    SCROLL_OPERATION_FAILED: 'Failed to perform scroll operation',
    MESSAGE_HANDLING_FAILED: 'Failed to handle extension message',
  } as const;

  // Error handling utilities
  const handleChromeError = (operation: string, error?: any): void => {
    console.error(`AutoScroll Reader ${operation} failed:`, error || 'Unknown error');
  };

  const showUserError = (message: string): void => {
    console.error(`AutoScroll Reader Error: ${message}`);
    // In a production extension, you might want to show a user-visible notification
    // chrome.notifications.create({ ... });
  };

  class AutoScrollController {
    private settings: ReaderSettings = { ...DEFAULT_SETTINGS };
    private globalSettings: ReaderSettings = { ...DEFAULT_SETTINGS };
    private siteSettingsMap: SiteSettingsMap = {};
    private siteModeHosts: string[] = [];
    private readonly host = window.location.hostname;
    private focusLine: HTMLElement | null = null;
    private progressBar: HTMLElement | null = null;
    private animationFrameId: number | null = null;
    private readonly storageAvailable: boolean;
    private isToggling: boolean = false;
    private readonly BASE_SPEED_PPS = 12;
    private readonly TOGGLE_TIMEOUT = 100;
    private readonly USER_PAUSE_RESUME_DELAY = 1500;
    private lastTimestamp: number | null = null;
    private subpixelRemainder = 0;
    private isReadingMode = false;
    private readingModeStyleEl: HTMLStyleElement | null = null;
    private readingModeCleanup: (() => void) | null = null;
    private isPausedByUser = false;
    private pauseTimeoutId: number | null = null;
    private textDensityAnalyzer: TextDensityAnalyzer | null = null;
    private readingStatsTracker: ReadingStatsTracker | null = null;

    constructor() {
      this.storageAvailable = !!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
      this.init();
    }

    private setupSpeedHotkeys(): void {
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
            const next = clamp(this.settings.scrollSpeed + (inc ? 1 : -1));
            if (next === this.settings.scrollSpeed) return;
            this.updateSettings({ scrollSpeed: next });
            this.showSpeedToast(next);
            if (this.storageAvailable) {
              this.persistSettings({ scrollSpeed: next });
            }
          } catch (error) {
            handleChromeError('handling speed hotkeys', error);
          }
        }, { capture: true });
      } catch (error) {
        handleChromeError('setting up speed hotkeys', error);
      }
    }

    private showSpeedToast(speed: number): void {
      const existing = document.getElementById('autoscroll-speed-toast');
      if (existing) existing.remove();
      const toast = document.createElement('div');
      toast.id = 'autoscroll-speed-toast';
      toast.textContent = `Speed: ${speed}`;
      Object.assign(toast.style, {
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(17, 24, 39, 0.9)',
        color: '#e5e7eb',
        padding: '6px 16px',
        borderRadius: '8px',
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        zIndex: '2147483647',
        pointerEvents: 'none',
        transition: 'opacity 0.3s',
        opacity: '1',
      });
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 800);
    }

    private setupUserScrollPause(): void {
      window.addEventListener('wheel', () => {
        if (!this.settings.isScrolling || this.isPausedByUser) return;
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
          if (this.settings.isScrolling) {
            this.lastTimestamp = null;
            this.subpixelRemainder = 0;
            this.animationFrameId = requestAnimationFrame(this.scrollStep);
          }
        }, this.USER_PAUSE_RESUME_DELAY);
      }, { capture: true, passive: true });
    }

    private async init(): Promise<void> {
      await this.loadSettings();
      this.createFocusLine();
      this.createProgressBar();
      this.setupMessageListener();
      this.setupStorageListener();
      this.setupSpeedHotkeys();
      this.setupUserScrollPause();
      
      this.textDensityAnalyzer = new TextDensityAnalyzer();
      this.readingStatsTracker = new ReadingStatsTracker(this.storageAvailable);
      await this.readingStatsTracker.load();

      if (this.settings.autoStartOnLoad) {
        this.startScrolling();
      }
    }
    
    private loadSettings(): Promise<void> {
      return new Promise((resolve) => {
        if (!this.storageAvailable) {
          console.warn('AutoScroll Reader:', ERROR_MESSAGES.STORAGE_UNAVAILABLE);
          showUserError(ERROR_MESSAGES.STORAGE_UNAVAILABLE);
          return resolve();
        }

        try {
          chrome.storage.local.get(['readerSettings', SITE_SETTINGS_KEY, SITE_MODE_KEY], (result) => {
            try {
              if (chrome.runtime.lastError) {
                handleChromeError('loading settings', chrome.runtime.lastError);
                showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
              } else {
                if (result.readerSettings) {
                  // isScrolling is runtime state: a persisted value must not auto-start a page.
                  this.globalSettings = { ...this.globalSettings, ...result.readerSettings, isScrolling: false };
                }
                this.siteSettingsMap = result[SITE_SETTINGS_KEY] ?? {};
                this.siteModeHosts = result[SITE_MODE_KEY] ?? [];
                this.settings = this.computeEffective();
              }
              resolve();
            } catch (error) {
              handleChromeError('processing loaded settings', error);
              showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
              resolve(); // Still resolve to not break initialization
            }
          });
        } catch (error) {
          handleChromeError('storage get operation', error);
          showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
          resolve(); // Still resolve to not break initialization
        }
      });
    }

    private isPerSiteModeOn(): boolean {
      return this.siteModeHosts.includes(this.host);
    }

    private computeEffective(): ReaderSettings {
      const override = this.isPerSiteModeOn() ? this.siteSettingsMap[this.host] : undefined;
      return resolveSettings(this.globalSettings, override);
    }

    /** Writes a settings patch to the per-site override or the global settings. */
    private persistSettings(patch: Partial<ReaderSettings>): void {
      try {
        if (this.isPerSiteModeOn()) {
          const nextMap: SiteSettingsMap = {
            ...this.siteSettingsMap,
            [this.host]: { ...(this.siteSettingsMap[this.host] ?? {}), ...patch },
          };
          this.siteSettingsMap = nextMap;
          chrome.storage.local.set({ [SITE_SETTINGS_KEY]: nextMap });
        } else {
          this.globalSettings = { ...this.globalSettings, ...patch, isScrolling: false };
          chrome.storage.local.set({ readerSettings: { ...this.globalSettings } });
        }
      } catch (error) {
        handleChromeError('persisting settings', error);
      }
    }
    
    private enableReadingMode(): void {
      try {
        if (this.isReadingMode) return;
        document.documentElement.setAttribute('data-autoscroll-reading-mode', 'on');
        const aggressiveCSS = `
          html[data-autoscroll-reading-mode='on'] body {
            background: #111827 !important;
            color: #e5e7eb !important;
            line-height: 1.7 !important;
            font-size: 18px !important;
            visibility: visible !important;
            display: block !important;
            overflow-y: auto !important;
          }
          html[data-autoscroll-reading-mode='on'] html {
            visibility: visible !important;
            display: block !important;
          }
          html[data-autoscroll-reading-mode='on'] img, 
          html[data-autoscroll-reading-mode='on'] figure, 
          html[data-autoscroll-reading-mode='on'] video { 
            max-width: 100%; height: auto; display: block; margin: 1rem auto; 
          }
          /* Center main content and limit width */
          html[data-autoscroll-reading-mode='on'] main, 
          html[data-autoscroll-reading-mode='on'] article, 
          html[data-autoscroll-reading-mode='on'] .content, 
          html[data-autoscroll-reading-mode='on'] .post, 
          html[data-autoscroll-reading-mode='on'] [role='main'] {
            max-width: 800px; margin: 0 auto; padding: 0 16px; 
          }
          /* Hide common clutter but avoid removing structural layout */
          html[data-autoscroll-reading-mode='on'] [class*='sidebar' i],
          html[data-autoscroll-reading-mode='on'] [class*='ad' i],
          html[data-autoscroll-reading-mode='on'] .ads,
          html[data-autoscroll-reading-mode='on'] .advertisement,
          html[data-autoscroll-reading-mode='on'] [id*='cookie' i],
          html[data-autoscroll-reading-mode='on'] [aria-label*='cookie' i],
          /* Hide common overlays/popups instead of all fixed-position elements */
          html[data-autoscroll-reading-mode='on'] [aria-modal='true'],
          html[data-autoscroll-reading-mode='on'] [role='dialog'],
          html[data-autoscroll-reading-mode='on'] [class*='modal' i],
          html[data-autoscroll-reading-mode='on'] [class*='overlay' i],
          html[data-autoscroll-reading-mode='on'] [class*='popup' i],
          html[data-autoscroll-reading-mode='on'] [class*='banner' i][style*='position:fixed' i] {
            display: none !important;
          }
          /* Keep focus line above everything; JS controls visibility */
          html[data-autoscroll-reading-mode='on'] #autoscroll-focus-line {
            display: block !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
          }
        `;

        const safeCSS = `
          html[data-autoscroll-reading-mode='on'] body {
            background: #111827 !important;
            color: #e5e7eb !important;
            line-height: 1.7 !important;
            font-size: 18px !important;
            visibility: visible !important;
            display: block !important;
            overflow-y: auto !important;
          }
          html[data-autoscroll-reading-mode='on'] html { visibility: visible !important; display: block !important; }
          /* Center main content and limit width */
          html[data-autoscroll-reading-mode='on'] main, 
          html[data-autoscroll-reading-mode='on'] article, 
          html[data-autoscroll-reading-mode='on'] .content, 
          html[data-autoscroll-reading-mode='on'] .post, 
          html[data-autoscroll-reading-mode='on'] [role='main'] {
            max-width: 800px; margin: 0 auto; padding: 0 16px; 
          }
          /* Keep everything else, just ensure focus line on top; JS controls visibility */
          html[data-autoscroll-reading-mode='on'] #autoscroll-focus-line {
            display: block !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
          }
        `;

        this.readingModeStyleEl = document.createElement('style');
        this.readingModeStyleEl.id = 'autoscroll-reading-style';
        this.readingModeStyleEl.textContent = aggressiveCSS;
        document.head.appendChild(this.readingModeStyleEl);
        
        // Dynamic fallback: if layout collapses now or shortly after, switch to safeCSS once
        const baseline = document.documentElement.scrollHeight;
        let switched = false;
        const maybeSwitch = () => {
          if (switched) return;
          try {
            const nowH = document.documentElement.scrollHeight;
            if (nowH > 0 && baseline > 0 && nowH / baseline < 0.6) {
              this.readingModeStyleEl!.textContent = safeCSS;
              switched = true;
              cleanup();
            }
          } catch { /* noop */ }
        };

        const scrollHandler = () => maybeSwitch();
        const mo = new MutationObserver(() => maybeSwitch());
        const cleanup = () => {
          window.removeEventListener('scroll', scrollHandler, true);
          try { mo.disconnect(); } catch { /* noop */ }
          this.readingModeCleanup = null;
        };
        this.readingModeCleanup = cleanup;

        window.addEventListener('scroll', scrollHandler, true);
        try { mo.observe(document.documentElement, { childList: true, subtree: true, attributes: false }); } catch { /* noop */ }

        // Initial microtask check
        setTimeout(maybeSwitch, 0);
        this.isReadingMode = true;
      } catch (error) {
        handleChromeError('enabling reading mode', error);
      }
    }

    private disableReadingMode(): void {
      try {
        this.readingModeCleanup?.();
        document.documentElement.removeAttribute('data-autoscroll-reading-mode');
        if (this.readingModeStyleEl) {
          this.readingModeStyleEl.remove();
          this.readingModeStyleEl = null;
        }
        this.isReadingMode = false;
      } catch (error) {
        handleChromeError('disabling reading mode', error);
      }
    }

    private toggleReadingMode(): void {
      if (this.isReadingMode) this.disableReadingMode();
      else this.enableReadingMode();
    }
    
    private setupMessageListener(): void {
      try {
        chrome.runtime.onMessage.addListener(
          (message: ChromeMessage, _sender, sendResponse) => {
            try {
              switch (message.type) {
                case 'TOGGLE_SCROLL':
                  this.toggleScrolling();
                  sendResponse({ isScrolling: this.settings.isScrolling });
                  break;
                case 'UPDATE_SETTINGS':
                  if (message.payload) {
                    this.updateSettings(message.payload);
                  }
                  sendResponse({ success: true });
                  break;
                case 'GET_STATUS':
                   sendResponse({ isScrolling: this.settings.isScrolling });
                   break;
                case 'TOGGLE_READING_MODE':
                   this.toggleReadingMode();
                   sendResponse({ readingMode: this.isReadingMode });
                   break;
                case 'TOGGLE_SMART_SPEED':
                   this.updateSettings({ smartSpeedEnabled: !this.settings.smartSpeedEnabled });
                   if (this.storageAvailable) {
                     this.persistSettings({ smartSpeedEnabled: !!this.settings.smartSpeedEnabled });
                   }
                   sendResponse({ smartSpeedEnabled: !!this.settings.smartSpeedEnabled });
                   break;
                case 'GET_READING_STATS':
                   const stats = this.readingStatsTracker?.getTodayStats() || { totalSeconds: 0, totalWords: 0, sessions: 0 };
                   const sessionDuration = this.readingStatsTracker?.getSessionDuration() || 0;
                   sendResponse({ ...stats, sessionDuration, smartSpeedEnabled: !!this.settings.smartSpeedEnabled });
                   break;
                default:
                  console.warn('AutoScroll Reader: Unknown message type received:', message.type);
                  sendResponse({ error: 'Unknown message type' });
              }
            } catch (error) {
              handleChromeError('message processing', error);
              showUserError(ERROR_MESSAGES.MESSAGE_HANDLING_FAILED);
              sendResponse({ error: 'Message processing failed' });
            }
            return true; // Indicates that the response is sent asynchronously
          }
        );
      } catch (error) {
        handleChromeError('setting up message listener', error);
        showUserError(ERROR_MESSAGES.MESSAGE_HANDLING_FAILED);
      }
    }

    private setupStorageListener(): void {
      try {
        if (!this.storageAvailable || !chrome.storage.onChanged) {
          console.warn('AutoScroll Reader: chrome.storage.onChanged not available');
          return;
        }

        chrome.storage.onChanged.addListener((changes, namespace) => {
          try {
            if (namespace !== 'local') return;
            const settingsChanged = !!changes.readerSettings;
            const siteChanged = !!changes[SITE_SETTINGS_KEY];
            const modeChanged = !!changes[SITE_MODE_KEY];
            if (!settingsChanged && !siteChanged && !modeChanged) return;

            if (settingsChanged) {
              const newGlobal = changes.readerSettings.newValue as ReaderSettings | undefined;
              if (newGlobal) {
                this.globalSettings = { ...this.globalSettings, ...newGlobal, isScrolling: false };
              }
            }
            if (siteChanged) {
              this.siteSettingsMap = (changes[SITE_SETTINGS_KEY].newValue as SiteSettingsMap) ?? {};
            }
            if (modeChanged) {
              this.siteModeHosts = (changes[SITE_MODE_KEY].newValue as string[]) ?? [];
            }

            // Ignore the echo of our own persistence writes
            if (this.isToggling) return;

            const wasScrolling = this.settings.isScrolling;
            this.settings = this.computeEffective();
            this.settings.isScrolling = wasScrolling;
            this.applyFocusLineStyle();
            if (this.focusLine) {
              this.focusLine.style.visibility = wasScrolling ? 'visible' : 'hidden';
            }
          } catch (error) {
            handleChromeError('processing storage changes', error);
            showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
          }
        });
      } catch (error) {
        handleChromeError('setting up storage listener', error);
        showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
      }
    }

    private createFocusLine(): void {
      try {
        if (this.focusLine) {
          this.focusLine.remove();
        }
        this.focusLine = document.createElement('div');
        this.focusLine.id = 'autoscroll-focus-line';
        if (document.body) {
          document.body.appendChild(this.focusLine);
          this.applyFocusLineStyle();
        } else {
          handleChromeError('creating focus line', 'document.body not available');
          showUserError(ERROR_MESSAGES.DOM_MANIPULATION_FAILED);
        }
      } catch (error) {
        handleChromeError('creating focus line', error);
        showUserError(ERROR_MESSAGES.DOM_MANIPULATION_FAILED);
      }
    }

    private createProgressBar(): void {
      if (this.progressBar) this.progressBar.remove();
      this.progressBar = document.createElement('div');
      this.progressBar.id = 'autoscroll-progress';
      Object.assign(this.progressBar.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        height: '3px',
        width: '0%',
        background: `linear-gradient(90deg, ${this.settings.lineColor}, ${this.settings.lineColor}aa)`,
        zIndex: '2147483646',
        pointerEvents: 'none',
        transition: 'width 0.1s linear',
        opacity: this.settings.isScrolling ? '1' : '0',
      });
      document.body?.appendChild(this.progressBar);
    }

    private updateProgress(): void {
      if (!this.progressBar) return;
      const scroller = document.scrollingElement || document.documentElement;
      const maxScroll = Math.max(1, scroller.scrollHeight - window.innerHeight);
      const pct = Math.min(100, (scroller.scrollTop / maxScroll) * 100);
      this.progressBar.style.width = `${pct}%`;
      this.progressBar.style.opacity = this.settings.isScrolling ? '1' : '0';
    }

    private applyFocusLineStyle(): void {
      if (!this.focusLine) return;
      const color = this.settings.lineColor;
      const thickness = this.settings.lineThickness;
      const opacity = this.settings.lineOpacity / 100;
      const position = this.settings.focusLinePosition;
      
      Object.assign(this.focusLine.style, {
        position: 'fixed',
        top: `${position}%`,
        left: '0',
        width: '100%',
        height: `${thickness}px`,
        backgroundColor: color,
        boxShadow: `0 0 5px ${color}, 0 0 10px ${color}, 0 0 15px ${color}`,
        opacity: opacity.toString(),
        zIndex: '2147483647',
        pointerEvents: 'none',
        transition: 'opacity 0.2s',
        visibility: this.settings.isScrolling ? 'visible' : 'hidden',
      });
    }
    
    public updateSettings(newSettings: Partial<ReaderSettings>): void {
      const oldSettings = { ...this.settings };
      this.settings = { ...this.settings, ...newSettings };
      
      const focusLineSettingsChanged = 
        oldSettings.lineColor !== this.settings.lineColor ||
        oldSettings.lineThickness !== this.settings.lineThickness ||
        oldSettings.lineOpacity !== this.settings.lineOpacity ||
        oldSettings.focusLinePosition !== this.settings.focusLinePosition;
      
      if (focusLineSettingsChanged) {
        this.applyFocusLineStyle();
      }
    }

    private calculateSmartSpeed(): number {
      if (!this.settings.smartSpeedEnabled || !this.textDensityAnalyzer) {
        return this.settings.scrollSpeed;
      }
      
      const density = this.textDensityAnalyzer.analyze();
      const wordsPerViewport = density;
      
      if (wordsPerViewport < 50) return Math.max(1, this.settings.scrollSpeed - 2);
      if (wordsPerViewport < 100) return Math.max(2, this.settings.scrollSpeed - 1);
      if (wordsPerViewport > 300) return Math.min(10, this.settings.scrollSpeed + 1);
      if (wordsPerViewport > 500) return Math.min(10, this.settings.scrollSpeed + 2);
      
      return this.settings.scrollSpeed;
    }

    private scrollStep = (timestamp: number): void => {
      if (!this.settings.isScrolling || this.isPausedByUser) return;

      const dt = this.lastTimestamp === null ? (1 / 60) : Math.max(0, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;

      const effectiveSpeed = this.calculateSmartSpeed();
      const pps = this.BASE_SPEED_PPS * effectiveSpeed;
      if (pps === 0) {
        this.animationFrameId = requestAnimationFrame(this.scrollStep);
        return;
      }

      const direction = this.settings.scrollDirection === 'up' ? -1 : 1;
      let delta = direction * pps * dt + this.subpixelRemainder;

      const intDelta = delta > 0 ? Math.floor(delta) : Math.ceil(delta);
      this.subpixelRemainder = delta - intDelta;

      const scroller = document.scrollingElement || document.documentElement;
      const maxScrollTop = Math.max(0, scroller.scrollHeight - window.innerHeight);

      if (intDelta !== 0) {
        const nextTop = Math.max(0, Math.min(scroller.scrollTop + intDelta, maxScrollTop));
        scroller.scrollTop = nextTop;
        this.updateProgress();
        
        if (this.readingStatsTracker && this.textDensityAnalyzer) {
          const density = this.textDensityAnalyzer.analyze();
          this.readingStatsTracker.trackProgress(density);
        }
      }

      const atBoundary = this.settings.scrollDirection === 'down'
        ? scroller.scrollTop >= maxScrollTop
        : scroller.scrollTop <= 0;

      if (atBoundary) {
        this.stopScrolling();
        this.globalSettings.isScrolling = false;
        if (this.storageAvailable) {
          chrome.storage.local.set({
            readerSettings: { ...this.globalSettings, isScrolling: false }
          });
        }
      } else {
        this.animationFrameId = requestAnimationFrame(this.scrollStep);
      }
    };

    private startScrolling(): void {
      if (this.animationFrameId !== null) {
        return;
      }
      this.settings.isScrolling = true;
      if (this.focusLine) this.focusLine.style.visibility = 'visible';
      if (this.progressBar) {
        this.progressBar.style.opacity = '1';
        this.updateProgress();
      }
      
      if (this.readingStatsTracker) {
        this.readingStatsTracker.startSession();
      }
      
      this.lastTimestamp = null;
      this.subpixelRemainder = 0;
      this.animationFrameId = requestAnimationFrame(this.scrollStep);
    }

    private stopScrolling(): void {
      this.settings.isScrolling = false;
      if (this.focusLine) this.focusLine.style.visibility = 'hidden';
      if (this.progressBar) this.progressBar.style.opacity = '0';

      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      
      if (this.readingStatsTracker) {
        void this.readingStatsTracker.saveSession();
      }
      
      this.lastTimestamp = null;
      this.subpixelRemainder = 0;
    }

    public toggleScrolling(): void {
      this.isToggling = true;

      const newState = !this.settings.isScrolling;

      if (newState) {
        this.startScrolling();
      } else {
        this.stopScrolling();
      }

      this.settings.isScrolling = newState;
      this.globalSettings.isScrolling = false;

      if (!this.storageAvailable) {
        setTimeout(() => {
          this.isToggling = false;
        }, this.TOGGLE_TIMEOUT);
        return;
      }

      try {
        chrome.storage.local.set({
          readerSettings: { ...this.globalSettings, isScrolling: false }
        }).then(() => {
          setTimeout(() => {
            this.isToggling = false;
          }, this.TOGGLE_TIMEOUT);
        }).catch((error) => {
          handleChromeError('saving settings to storage', error);
          showUserError(ERROR_MESSAGES.STORAGE_SAVE_FAILED);
          this.isToggling = false;
        });
      } catch (error) {
        handleChromeError('storage set operation', error);
        showUserError(ERROR_MESSAGES.STORAGE_SAVE_FAILED);
        this.isToggling = false;
      }
    }
  }

  // Ensure the script is only injected and run once
  if (!(window as any).autoScrollReaderInjected) {
    (window as any).autoScrollReaderInjected = true;
    new AutoScrollController();
  }
})();