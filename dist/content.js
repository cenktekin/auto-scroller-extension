var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
(() => {
  const DEFAULT_SETTINGS = {
    scrollSpeed: 5,
    lineThickness: 3,
    lineColor: "#00ffff",
    // Neon Blue
    lineOpacity: 80,
    isScrolling: false
  };
  const ERROR_MESSAGES = {
    STORAGE_UNAVAILABLE: "Chrome storage API is not available",
    STORAGE_LOAD_FAILED: "Failed to load settings from storage",
    STORAGE_SAVE_FAILED: "Failed to save settings to storage",
    DOM_MANIPULATION_FAILED: "Failed to manipulate DOM element",
    SCROLL_OPERATION_FAILED: "Failed to perform scroll operation",
    MESSAGE_HANDLING_FAILED: "Failed to handle extension message"
  };
  const handleChromeError = (operation, error) => {
    console.error(`AutoScroll Reader ${operation} failed:`, error || "Unknown error");
  };
  const showUserError = (message) => {
    console.error(`AutoScroll Reader Error: ${message}`);
  };
  class AutoScrollController {
    constructor() {
      __publicField(this, "settings", DEFAULT_SETTINGS);
      __publicField(this, "focusLine", null);
      __publicField(this, "animationFrameId", null);
      __publicField(this, "storageAvailable");
      __publicField(this, "isToggling", false);
      __publicField(this, "BASE_SPEED_PPS", 12);
      // pixels per second per speed unit (speed 10 => ~120px/s)
      __publicField(this, "TOGGLE_TIMEOUT", 100);
      // ms
      __publicField(this, "lastTimestamp", null);
      __publicField(this, "subpixelRemainder", 0);
      __publicField(this, "scrollStep", (timestamp) => {
        if (!this.settings.isScrolling) return;
        const dt = this.lastTimestamp === null ? 1 / 60 : Math.max(0, (timestamp - this.lastTimestamp) / 1e3);
        this.lastTimestamp = timestamp;
        const pps = this.BASE_SPEED_PPS * this.settings.scrollSpeed;
        let delta = pps * dt + this.subpixelRemainder;
        const intDelta = delta > 0 ? Math.floor(delta) : Math.ceil(delta);
        this.subpixelRemainder = delta - intDelta;
        const scroller = document.scrollingElement || document.documentElement;
        const maxScrollTop = Math.max(0, scroller.scrollHeight - window.innerHeight);
        const prevTop = scroller.scrollTop;
        if (intDelta !== 0) {
          const nextTop = Math.max(0, Math.min(prevTop + intDelta, maxScrollTop));
          scroller.scrollTop = nextTop;
        }
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
      });
      this.storageAvailable = !!(typeof chrome !== "undefined" && chrome.storage && chrome.storage.local);
      this.init();
    }
    async init() {
      await this.loadSettings();
      console.log("After loadSettings, isScrolling is:", this.settings.isScrolling);
      this.createFocusLine();
      this.setupMessageListener();
      this.setupStorageListener();
      console.log("AutoScroll Reader content script loaded.");
      if (this.settings.isScrolling) {
        this.startScrolling();
      }
    }
    loadSettings() {
      return new Promise((resolve) => {
        if (!this.storageAvailable) {
          console.warn("AutoScroll Reader:", ERROR_MESSAGES.STORAGE_UNAVAILABLE);
          showUserError(ERROR_MESSAGES.STORAGE_UNAVAILABLE);
          return resolve();
        }
        try {
          chrome.storage.local.get("readerSettings", (result) => {
            try {
              console.log("Loaded settings from storage:", result);
              if (chrome.runtime.lastError) {
                handleChromeError("loading settings", chrome.runtime.lastError);
                showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
              } else if (result.readerSettings) {
                this.settings = { ...this.settings, ...result.readerSettings };
              }
              resolve();
            } catch (error) {
              handleChromeError("processing loaded settings", error);
              showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
              resolve();
            }
          });
        } catch (error) {
          handleChromeError("storage get operation", error);
          showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
          resolve();
        }
      });
    }
    setupMessageListener() {
      try {
        chrome.runtime.onMessage.addListener(
          (message, _sender, sendResponse) => {
            try {
              switch (message.type) {
                case "TOGGLE_SCROLL":
                  this.toggleScrolling();
                  sendResponse({ isScrolling: this.settings.isScrolling });
                  break;
                case "UPDATE_SETTINGS":
                  if (message.payload) {
                    this.updateSettings(message.payload);
                  }
                  sendResponse({ success: true });
                  break;
                case "GET_STATUS":
                  sendResponse({ isScrolling: this.settings.isScrolling });
                  break;
                default:
                  console.warn("AutoScroll Reader: Unknown message type received:", message.type);
                  sendResponse({ error: "Unknown message type" });
              }
            } catch (error) {
              handleChromeError("message processing", error);
              showUserError(ERROR_MESSAGES.MESSAGE_HANDLING_FAILED);
              sendResponse({ error: "Message processing failed" });
            }
            return true;
          }
        );
      } catch (error) {
        handleChromeError("setting up message listener", error);
        showUserError(ERROR_MESSAGES.MESSAGE_HANDLING_FAILED);
      }
    }
    setupStorageListener() {
      try {
        if (this.storageAvailable && chrome.storage.onChanged) {
          chrome.storage.onChanged.addListener((changes, namespace) => {
            try {
              console.log("Storage changed:", changes, namespace);
              if (namespace === "local" && changes.readerSettings) {
                if (this.isToggling) {
                  console.log("Ignoring storage change due to active toggle.");
                  return;
                }
                const newSettings = changes.readerSettings.newValue;
                console.log("Updating settings from storage listener:", newSettings);
                const oldSettings = { ...this.settings };
                const isScrollingChanged = oldSettings.isScrolling !== newSettings.isScrolling;
                const focusLineSettingsChanged = oldSettings.lineColor !== newSettings.lineColor || oldSettings.lineThickness !== newSettings.lineThickness || oldSettings.lineOpacity !== newSettings.lineOpacity || oldSettings.scrollSpeed !== newSettings.scrollSpeed;
                if (isScrollingChanged) {
                  console.log(`isScrolling changed from ${oldSettings.isScrolling} to ${newSettings.isScrolling}`);
                  this.settings.isScrolling = newSettings.isScrolling;
                  if (this.focusLine) {
                    this.focusLine.style.visibility = this.settings.isScrolling ? "visible" : "hidden";
                  }
                  if (this.settings.isScrolling) {
                    console.log("Starting scrolling from storage change");
                    this.startScrolling();
                  } else {
                    console.log("Stopping scrolling from storage change");
                    this.stopScrolling();
                  }
                }
                if (focusLineSettingsChanged) {
                  console.log("Focus line settings changed, updating styles");
                  if (!isScrollingChanged) {
                    this.settings = { ...this.settings, ...newSettings };
                  } else {
                    this.settings = {
                      ...this.settings,
                      lineColor: newSettings.lineColor,
                      lineThickness: newSettings.lineThickness,
                      lineOpacity: newSettings.lineOpacity,
                      scrollSpeed: newSettings.scrollSpeed
                    };
                  }
                  this.createFocusLine();
                  if (this.focusLine) {
                    this.focusLine.style.visibility = this.settings.isScrolling ? "visible" : "hidden";
                  }
                }
              }
            } catch (error) {
              handleChromeError("processing storage changes", error);
              showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
            }
          });
        } else {
          console.warn("AutoScroll Reader: chrome.storage.onChanged not available");
        }
      } catch (error) {
        handleChromeError("setting up storage listener", error);
        showUserError(ERROR_MESSAGES.STORAGE_LOAD_FAILED);
      }
    }
    createFocusLine() {
      try {
        if (this.focusLine) {
          this.focusLine.remove();
        }
        this.focusLine = document.createElement("div");
        this.focusLine.id = "autoscroll-focus-line";
        if (document.body) {
          document.body.appendChild(this.focusLine);
          this.applyFocusLineStyle();
        } else {
          handleChromeError("creating focus line", "document.body not available");
          showUserError(ERROR_MESSAGES.DOM_MANIPULATION_FAILED);
        }
      } catch (error) {
        handleChromeError("creating focus line", error);
        showUserError(ERROR_MESSAGES.DOM_MANIPULATION_FAILED);
      }
    }
    applyFocusLineStyle() {
      if (!this.focusLine) return;
      const color = this.settings.lineColor;
      const thickness = this.settings.lineThickness;
      const opacity = this.settings.lineOpacity / 100;
      Object.assign(this.focusLine.style, {
        position: "fixed",
        top: "50%",
        // Start at the center
        left: "0",
        width: "100%",
        height: `${thickness}px`,
        backgroundColor: color,
        boxShadow: `0 0 5px ${color}, 0 0 10px ${color}, 0 0 15px ${color}`,
        opacity: opacity.toString(),
        zIndex: "2147483647",
        // Max z-index
        pointerEvents: "none",
        transition: "opacity 0.2s",
        visibility: this.settings.isScrolling ? "visible" : "hidden"
      });
    }
    updateSettings(newSettings) {
      const oldSettings = { ...this.settings };
      this.settings = { ...this.settings, ...newSettings };
      console.log("Settings updated:", this.settings);
      console.log(`isScrolling before update: ${oldSettings.isScrolling}, isScrolling after update: ${this.settings.isScrolling}`);
      const focusLineSettingsChanged = oldSettings.lineColor !== this.settings.lineColor || oldSettings.lineThickness !== this.settings.lineThickness || oldSettings.lineOpacity !== this.settings.lineOpacity;
      if (focusLineSettingsChanged) {
        this.createFocusLine();
      } else {
        this.applyFocusLineStyle();
      }
    }
    startScrolling() {
      console.log("Starting scrolling. this.settings.isScrolling is:", this.settings.isScrolling);
      if (this.animationFrameId !== null) {
        console.log("Scroll loop already running.");
        return;
      }
      this.settings.isScrolling = true;
      if (this.focusLine) this.focusLine.style.visibility = "visible";
      console.log("Focus line visibility set to visible.");
      console.log("Requesting new animation frame.");
      this.lastTimestamp = null;
      this.subpixelRemainder = 0;
      this.animationFrameId = requestAnimationFrame(this.scrollStep);
      console.log("Animation frame requested. ID:", this.animationFrameId);
    }
    stopScrolling() {
      console.log("Stopping scrolling...");
      this.settings.isScrolling = false;
      if (this.focusLine) this.focusLine.style.visibility = "hidden";
      console.log("Focus line visibility set to hidden.");
      if (this.animationFrameId !== null) {
        console.log("Cancelling animation frame.");
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      } else {
        console.log("No animation frame to cancel.");
      }
      this.lastTimestamp = null;
      this.subpixelRemainder = 0;
    }
    toggleScrolling() {
      this.isToggling = true;
      console.log("Toggling scrolling. this.settings.isScrolling is:", this.settings.isScrolling);
      const newState = !this.settings.isScrolling;
      console.log("New state will be:", newState);
      console.log("Current animationFrameId:", this.animationFrameId);
      if (newState) {
        this.startScrolling();
      } else {
        this.stopScrolling();
      }
      this.settings.isScrolling = newState;
      console.log("Updated this.settings.isScrolling to:", this.settings.isScrolling);
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
              handleChromeError("resetting toggle flag after storage save", error);
              this.isToggling = false;
            }
          }).catch((error) => {
            handleChromeError("saving settings to storage", error);
            showUserError(ERROR_MESSAGES.STORAGE_SAVE_FAILED);
            this.isToggling = false;
          });
        } catch (error) {
          handleChromeError("storage set operation", error);
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
  console.log("Checking if content script is already injected:", window.autoScrollReaderInjected);
  if (!window.autoScrollReaderInjected) {
    console.log("Injecting content script...");
    window.autoScrollReaderInjected = true;
    new AutoScrollController();
  } else {
    console.log("Content script is already injected. Skipping.");
  }
})();
