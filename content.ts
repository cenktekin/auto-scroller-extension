import type { ChromeMessage } from './types';
import { SettingsStore } from './settings-store';
import { ScrollOverlay } from './overlay';
import { TextDensityAnalyzer } from './density-analyzer';
import { ReadingStatsTracker } from './reading-stats';
import { ReadingModeController } from './reading-mode';
import { ScrollController } from './scroll-controller';
import { ERROR_MESSAGES, handleChromeError, showUserError } from './errors';

(() => {
  const store = new SettingsStore();
  const overlay = new ScrollOverlay();
  const density = new TextDensityAnalyzer();
  const stats = new ReadingStatsTracker(store.storageAvailable);
  const readingMode = new ReadingModeController();
  const scroller = new ScrollController(store, overlay, density, stats);

  const handleMessage = (message: ChromeMessage): unknown => {
    switch (message.type) {
      case 'TOGGLE_SCROLL':
        scroller.toggle();
        return { isScrolling: store.current.isScrolling };
      case 'UPDATE_SETTINGS':
        if (message.payload) {
          scroller.updateSettings(message.payload);
        }
        return { success: true };
      case 'GET_STATUS':
        return { isScrolling: store.current.isScrolling };
      case 'TOGGLE_READING_MODE':
        return { readingMode: readingMode.toggle() };
      case 'TOGGLE_SMART_SPEED': {
        const next = !store.current.smartSpeedEnabled;
        scroller.updateSettings({ smartSpeedEnabled: next });
        if (store.storageAvailable) {
          store.persist({ smartSpeedEnabled: next });
        }
        return { smartSpeedEnabled: next };
      }
      case 'GET_READING_STATS':
        return {
          ...stats.getTodayStats(),
          sessionDuration: stats.getSessionDuration(),
          smartSpeedEnabled: !!store.current.smartSpeedEnabled,
          recentDays: stats.getRecentDays(7),
        };
      default:
        console.warn('AutoScroll Reader: Unknown message type received:', message.type);
        return { error: 'Unknown message type' };
    }
  };

  const setupMessageListener = (): void => {
    try {
      chrome.runtime.onMessage.addListener((message: ChromeMessage, _sender, sendResponse) => {
        try {
          sendResponse(handleMessage(message));
        } catch (error) {
          handleChromeError('message processing', error);
          showUserError(ERROR_MESSAGES.MESSAGE_HANDLING_FAILED);
          sendResponse({ error: 'Message processing failed' });
        }
        return true; // Indicates that the response is sent asynchronously
      });
    } catch (error) {
      handleChromeError('setting up message listener', error);
      showUserError(ERROR_MESSAGES.MESSAGE_HANDLING_FAILED);
    }
  };

  const init = async (): Promise<void> => {
    await store.load();

    if (!overlay.createFocusLine(store.current)) {
      handleChromeError('creating focus line', 'document.body not available');
      showUserError(ERROR_MESSAGES.DOM_MANIPULATION_FAILED);
    }
    overlay.createProgressBar(store.current);

    setupMessageListener();
    store.watch(() => scroller.isToggling, (next) => {
      overlay.applyFocusLineStyle(next);
      overlay.setVisibility(next.isScrolling);
    });
    scroller.setupSpeedHotkeys();
    scroller.setupUserScrollPause();

    await stats.load();

    if (store.current.autoStartOnLoad) {
      scroller.autoStart();
    }
  };

  // Ensure the script is only injected and run once
  if (!(window as any).autoScrollReaderInjected) {
    (window as any).autoScrollReaderInjected = true;
    void init();
  }
})();
