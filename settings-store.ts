import type { ReaderSettings, SiteSettingsMap } from './types';
import { DEFAULT_SETTINGS, SITE_MODE_KEY, SITE_SETTINGS_KEY } from './types';
import { resolveSettings } from './utils';
import { ERROR_MESSAGES, handleChromeError, showUserError } from './errors';

/**
 * Owns the persisted settings (global + per-site overrides + host mode list) and
 * the effective settings for the current page. `isScrolling` is runtime state and
 * is never persisted as true.
 */
export class SettingsStore {
  private globalSettings: ReaderSettings = { ...DEFAULT_SETTINGS };
  private siteSettingsMap: SiteSettingsMap = {};
  private siteModeHosts: string[] = [];
  private settings: ReaderSettings = { ...DEFAULT_SETTINGS };
  private readonly host = window.location.hostname;
  readonly storageAvailable: boolean;

  constructor() {
    this.storageAvailable = !!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
  }

  get current(): ReaderSettings {
    return this.settings;
  }

  get global(): ReaderSettings {
    return this.globalSettings;
  }

  setGlobalScrolling(value: boolean): void {
    this.globalSettings.isScrolling = value;
  }

  isPerSiteModeOn(): boolean {
    return this.siteModeHosts.includes(this.host);
  }

  /** Recomputes the effective settings; optionally carries the current runtime scrolling flag. */
  refresh(scrollingState?: boolean): ReaderSettings {
    const next = this.computeEffective();
    if (scrollingState !== undefined) next.isScrolling = scrollingState;
    this.settings = next;
    return next;
  }

  /** Local-only merge, used for optimistic UI updates before persistence. */
  patchLocal(patch: Partial<ReaderSettings>): ReaderSettings {
    this.settings = { ...this.settings, ...patch };
    return this.settings;
  }

  private computeEffective(): ReaderSettings {
    const override = this.isPerSiteModeOn() ? this.siteSettingsMap[this.host] : undefined;
    return resolveSettings(this.globalSettings, override);
  }

  load(): Promise<void> {
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
            resolve();
          }
        });
      } catch (error) {
        handleChromeError('storage get operation', error);
        showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
        resolve();
      }
    });
  }

  /** Writes a settings patch to the per-site override or the global settings. */
  persist(patch: Partial<ReaderSettings>): void {
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

  /** Persists the global settings with the runtime scrolling flag forced off. */
  persistGlobalSettings(): Promise<void> {
    return chrome.storage.local.set({ readerSettings: { ...this.globalSettings, isScrolling: false } });
  }

  /**
   * Listens for settings changes written by other tabs or the popup.
   * `shouldIgnore` suppresses the echo of our own writes; `onApplied` receives the
   * recomputed effective settings after every applied change.
   */
  watch(shouldIgnore: () => boolean, onApplied: (next: ReaderSettings) => void): void {
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
          if (shouldIgnore()) return;

          const wasScrolling = this.settings.isScrolling;
          this.settings = this.computeEffective();
          this.settings.isScrolling = wasScrolling;
          onApplied(this.settings);
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
}
