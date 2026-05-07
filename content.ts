import type { ReaderSettings, ChromeMessage } from './types';
import { DEFAULT_SETTINGS } from './types';

(() => {

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
    private settings: ReaderSettings = DEFAULT_SETTINGS;
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
    private isPausedByUser = false;
    private pauseTimeoutId: number | null = null;

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
              chrome.storage.local.set({ readerSettings: { ...this.settings, scrollSpeed: next } });
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

      if (this.settings.isScrolling) {
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
          chrome.storage.local.get('readerSettings', (result) => {
            try {
              if (chrome.runtime.lastError) {
                handleChromeError('loading settings', chrome.runtime.lastError);
                showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
              } else if (result.readerSettings) {
                this.settings = { ...this.settings, ...result.readerSettings };
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
        };

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
        if (this.storageAvailable && chrome.storage.onChanged) {
          chrome.storage.onChanged.addListener((changes, namespace) => {
            try {
              if (namespace === 'local' && changes.readerSettings) {
                if (this.isToggling) {
                  return;
                }
                const newSettings = changes.readerSettings.newValue as ReaderSettings;

                // Check what type of settings changed
                const oldSettings = { ...this.settings };
                const isScrollingChanged = oldSettings.isScrolling !== newSettings.isScrolling;
                const focusLineSettingsChanged =
                  oldSettings.lineColor !== newSettings.lineColor ||
                  oldSettings.lineThickness !== newSettings.lineThickness ||
                  oldSettings.lineOpacity !== newSettings.lineOpacity ||
                  oldSettings.scrollSpeed !== newSettings.scrollSpeed;

                // Handle scrolling state changes
                if (isScrollingChanged) {
                  this.settings.isScrolling = newSettings.isScrolling;

                  if (this.focusLine) {
                    this.focusLine.style.visibility = this.settings.isScrolling ? 'visible' : 'hidden';
                  }

                  if (this.settings.isScrolling) {
                    this.startScrolling();
                  }
                  else {
                    this.stopScrolling();
                  }
                }

                // Handle focus line style changes
                if (focusLineSettingsChanged) {
                  if (!isScrollingChanged) {
                    this.settings = { ...this.settings, ...newSettings };
                  } else {
                    // Only update non-scrolling settings
                    this.settings = {
                      ...this.settings,
                      lineColor: newSettings.lineColor,
                      lineThickness: newSettings.lineThickness,
                      lineOpacity: newSettings.lineOpacity,
                      scrollSpeed: newSettings.scrollSpeed
                    };
                  }
                  // Recreate focus line to apply new styles
                  this.createFocusLine();
                  // Restore visibility based on scrolling state
                  if (this.focusLine) {
                    this.focusLine.style.visibility = this.settings.isScrolling ? 'visible' : 'hidden';
                  }
                }
              }
            } catch (error) {
              handleChromeError('processing storage changes', error);
              showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
            }
          });
        } else {
          console.warn('AutoScroll Reader: chrome.storage.onChanged not available');
        }
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

    private scrollStep = (timestamp: number): void => {
      if (!this.settings.isScrolling || this.isPausedByUser) return;

      const dt = this.lastTimestamp === null ? (1 / 60) : Math.max(0, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;

      const pps = this.BASE_SPEED_PPS * this.settings.scrollSpeed;
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
      }

      const atBoundary = this.settings.scrollDirection === 'down'
        ? scroller.scrollTop >= maxScrollTop
        : scroller.scrollTop <= 0;

      if (atBoundary) {
        this.stopScrolling();
        if (this.storageAvailable) {
          chrome.storage.local.set({
            readerSettings: { ...this.settings, isScrolling: false }
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
      
      if (this.storageAvailable) {
        try {
          chrome.storage.local.set({
            readerSettings: { ...this.settings }
          }).then(() => {
            try {
              setTimeout(() => {
                this.isToggling = false;
              }, this.TOGGLE_TIMEOUT);
            } catch (error) {
              handleChromeError('resetting toggle flag after storage save', error);
              this.isToggling = false;
            }
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
      } else {
        setTimeout(() => {
          this.isToggling = false;
        }, this.TOGGLE_TIMEOUT);
      }
    }
  }

  // Ensure the script is only injected and run once
  if (!(window as any).autoScrollReaderInjected) {
    (window as any).autoScrollReaderInjected = true;
    new AutoScrollController();
  }
})();