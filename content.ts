(() => {
  // Define types directly
  interface ReaderSettings {
    scrollSpeed: number;
    lineThickness: number;
    lineColor: string;
    lineOpacity: number;
    isScrolling: boolean;
  }

  interface ChromeMessage {
    type: 'TOGGLE_SCROLL' | 'UPDATE_SETTINGS' | 'GET_STATUS';
    payload?: Partial<ReaderSettings>;
  }

  // Use consistent DEFAULT_SETTINGS (matching types.ts)
  const DEFAULT_SETTINGS: ReaderSettings = {
    scrollSpeed: 5,
    lineThickness: 3,
    lineColor: '#00ffff', // Neon Blue
    lineOpacity: 80,
    isScrolling: false,
  };

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
    private animationFrameId: number | null = null;
    private readonly storageAvailable: boolean;
    private isToggling: boolean = false;
    private readonly BASE_SPEED_PPS = 12; // pixels per second per speed unit (speed 10 => ~120px/s)
    private readonly TOGGLE_TIMEOUT = 100; // ms
    private lastTimestamp: number | null = null;
    private subpixelRemainder = 0;

    constructor() {
      this.storageAvailable = !!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
      this.init();
    }

    private async init(): Promise<void> {
      await this.loadSettings();
      console.log('After loadSettings, isScrolling is:', this.settings.isScrolling);
      this.createFocusLine();
      this.setupMessageListener();
      this.setupStorageListener();
      console.log('AutoScroll Reader content script loaded.');

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
              console.log('Loaded settings from storage:', result);
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
              console.log('Storage changed:', changes, namespace);
              if (namespace === 'local' && changes.readerSettings) {
                // If we are currently toggling, ignore storage changes
                if (this.isToggling) {
                  console.log('Ignoring storage change due to active toggle.');
                  return;
                }
                const newSettings = changes.readerSettings.newValue as ReaderSettings;
                console.log('Updating settings from storage listener:', newSettings);

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
                  console.log(`isScrolling changed from ${oldSettings.isScrolling} to ${newSettings.isScrolling}`);
                  // Update the settings
                  this.settings.isScrolling = newSettings.isScrolling;

                  // Update focus line visibility directly
                  if (this.focusLine) {
                    this.focusLine.style.visibility = this.settings.isScrolling ? 'visible' : 'hidden';
                  }

                  // If scrolling is enabled, start it
                  if (this.settings.isScrolling) {
                    console.log('Starting scrolling from storage change');
                    this.startScrolling();
                  }
                  // If scrolling is disabled, stop it
                  else {
                    console.log('Stopping scrolling from storage change');
                    this.stopScrolling();
                  }
                }

                // Handle focus line style changes
                if (focusLineSettingsChanged) {
                  console.log('Focus line settings changed, updating styles');
                  // Update the settings (but preserve isScrolling state if it wasn't changed)
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

    private applyFocusLineStyle(): void {
      if (!this.focusLine) return;
      const color = this.settings.lineColor;
      const thickness = this.settings.lineThickness;
      const opacity = this.settings.lineOpacity / 100;
      
      Object.assign(this.focusLine.style, {
        position: 'fixed',
        top: '50%', // Start at the center
        left: '0',
        width: '100%',
        height: `${thickness}px`,
        backgroundColor: color,
        boxShadow: `0 0 5px ${color}, 0 0 10px ${color}, 0 0 15px ${color}`,
        opacity: opacity.toString(),
        zIndex: '2147483647', // Max z-index
        pointerEvents: 'none',
        transition: 'opacity 0.2s',
        visibility: this.settings.isScrolling ? 'visible' : 'hidden',
      });
    }
    
    public updateSettings(newSettings: Partial<ReaderSettings>): void {
      const oldSettings = { ...this.settings };
      this.settings = { ...this.settings, ...newSettings };
      console.log('Settings updated:', this.settings);
      console.log(`isScrolling before update: ${oldSettings.isScrolling}, isScrolling after update: ${this.settings.isScrolling}`);
      
      // Check if focus line related settings have changed
      const focusLineSettingsChanged = 
        oldSettings.lineColor !== this.settings.lineColor ||
        oldSettings.lineThickness !== this.settings.lineThickness ||
        oldSettings.lineOpacity !== this.settings.lineOpacity;
      
      if (focusLineSettingsChanged) {
        // Re-create the focus line to ensure it exists and has the correct styles
        this.createFocusLine();
      } else {
        // Just apply the new styles
        this.applyFocusLineStyle();
      }
    }

    private scrollStep = (timestamp: number): void => {
      if (!this.settings.isScrolling) return;

      // Compute dt in seconds
      const dt = this.lastTimestamp === null ? (1 / 60) : Math.max(0, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;

      // Pixels per second based on current speed
      const pps = this.BASE_SPEED_PPS * this.settings.scrollSpeed; // 0..120 px/s by default
      let delta = pps * dt + this.subpixelRemainder; // pixels to move this frame (can be fractional)

      // Convert to integer pixels, carry remainder for next frame
      const intDelta = delta > 0 ? Math.floor(delta) : Math.ceil(delta);
      this.subpixelRemainder = delta - intDelta;

      const scroller = document.scrollingElement || document.documentElement;
      const maxScrollTop = Math.max(0, scroller.scrollHeight - window.innerHeight);
      const prevTop = scroller.scrollTop;

      if (intDelta !== 0) {
        const nextTop = Math.max(0, Math.min(prevTop + intDelta, maxScrollTop));
        scroller.scrollTop = nextTop;
      }

      // Bottom detection
      const atBottom = scroller.scrollTop >= maxScrollTop;
      if (atBottom) {
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
      console.log('Starting scrolling. this.settings.isScrolling is:', this.settings.isScrolling);
      // If an animation loop is already running, do nothing (idempotent)
      if (this.animationFrameId !== null) {
        console.log('Scroll loop already running.');
        return;
      }
      // Ensure state reflects running
      this.settings.isScrolling = true;
      if (this.focusLine) this.focusLine.style.visibility = 'visible';
      console.log('Focus line visibility set to visible.');
      
      console.log('Requesting new animation frame.');
      // reset timing state
      this.lastTimestamp = null;
      this.subpixelRemainder = 0;
      this.animationFrameId = requestAnimationFrame(this.scrollStep);
      console.log('Animation frame requested. ID:', this.animationFrameId);
    }

    private stopScrolling(): void {
      console.log('Stopping scrolling...');
      // Always ensure we stop the loop even if isScrolling flag is out-of-sync
      this.settings.isScrolling = false;
      if (this.focusLine) this.focusLine.style.visibility = 'hidden';
      console.log('Focus line visibility set to hidden.');

      if (this.animationFrameId !== null) {
        console.log('Cancelling animation frame.');
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      } else {
        console.log('No animation frame to cancel.');
      }
      // clear timing state
      this.lastTimestamp = null;
      this.subpixelRemainder = 0;
    }

    public toggleScrolling(): void {
      // Prevent storage listener from interfering
      this.isToggling = true;
      
      console.log('Toggling scrolling. this.settings.isScrolling is:', this.settings.isScrolling);
      const newState = !this.settings.isScrolling;
      console.log('New state will be:', newState);
      console.log('Current animationFrameId:', this.animationFrameId);
      
      if (newState) {
        this.startScrolling();
      } else {
        this.stopScrolling();
      }
      
      // Update the settings object
      this.settings.isScrolling = newState;
      console.log('Updated this.settings.isScrolling to:', this.settings.isScrolling);
      
      // Persist the state change
      if (this.storageAvailable) {
        try {
          chrome.storage.local.set({
            readerSettings: { ...this.settings }
          }).then(() => {
            try {
              // Allow storage listener to interfere again after a small delay
              setTimeout(() => {
                this.isToggling = false;
              }, this.TOGGLE_TIMEOUT);
            } catch (error) {
              handleChromeError('resetting toggle flag after storage save', error);
              this.isToggling = false; // Ensure we reset the flag even on error
            }
          }).catch((error) => {
            handleChromeError('saving settings to storage', error);
            showUserError(ERROR_MESSAGES.STORAGE_SAVE_FAILED);
            this.isToggling = false; // Reset flag even on error
          });
        } catch (error) {
          handleChromeError('storage set operation', error);
          showUserError(ERROR_MESSAGES.STORAGE_SAVE_FAILED);
          this.isToggling = false; // Reset flag even on error
        }
      } else {
        // Allow storage listener to interfere again after a small delay
        setTimeout(() => {
          this.isToggling = false;
        }, this.TOGGLE_TIMEOUT);
      }
    }
  }

  // Ensure the script is only injected and run once
  console.log('Checking if content script is already injected:', (window as any).autoScrollReaderInjected);
  if (!(window as any).autoScrollReaderInjected) {
    console.log('Injecting content script...');
    (window as any).autoScrollReaderInjected = true;
    new AutoScrollController();
  } else {
    console.log('Content script is already injected. Skipping.');
  }
})();