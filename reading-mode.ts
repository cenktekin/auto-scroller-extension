import { handleChromeError } from './errors';

const READING_MODE_ATTR = 'data-autoscroll-reading-mode';

const AGGRESSIVE_CSS = `
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

const SAFE_CSS = `
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

/**
 * Applies the aggressive reading stylesheet and falls back to a conservative one
 * when it collapses the page layout (scrollHeight dropping below 60% of baseline).
 */
export class ReadingModeController {
  private isActive = false;
  private styleEl: HTMLStyleElement | null = null;
  private cleanup: (() => void) | null = null;

  get active(): boolean {
    return this.isActive;
  }

  toggle(): boolean {
    if (this.isActive) this.disable();
    else this.enable();
    return this.isActive;
  }

  enable(): void {
    try {
      if (this.isActive) return;
      document.documentElement.setAttribute(READING_MODE_ATTR, 'on');

      this.styleEl = document.createElement('style');
      this.styleEl.id = 'autoscroll-reading-style';
      this.styleEl.textContent = AGGRESSIVE_CSS;
      document.head.appendChild(this.styleEl);

      const baseline = document.documentElement.scrollHeight;
      let switched = false;
      let warned = false;
      let cleanup = () => {};

      const maybeSwitch = () => {
        if (switched) return;
        try {
          const nowH = document.documentElement.scrollHeight;
          if (nowH > 0 && baseline > 0 && nowH / baseline < 0.6) {
            if (this.styleEl) this.styleEl.textContent = SAFE_CSS;
            switched = true;
            cleanup();
          }
        } catch (error) {
          // Runs on every scroll/mutation: warn once, then stop retrying so the
          // console does not flood on a page that keeps throwing.
          switched = true;
          if (!warned) {
            warned = true;
            handleChromeError('measuring layout for reading mode fallback', error);
          }
          cleanup();
        }
      };

      const scrollHandler = () => maybeSwitch();
      const observer = new MutationObserver(() => maybeSwitch());
      cleanup = () => {
        window.removeEventListener('scroll', scrollHandler, true);
        try {
          observer.disconnect();
        } catch (error) {
          handleChromeError('disconnecting reading mode observer', error);
        }
        this.cleanup = null;
      };
      this.cleanup = cleanup;

      window.addEventListener('scroll', scrollHandler, true);
      try {
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: false });
      } catch (error) {
        handleChromeError('starting reading mode observer', error);
      }

      setTimeout(maybeSwitch, 0);
      this.isActive = true;
    } catch (error) {
      handleChromeError('enabling reading mode', error);
    }
  }

  disable(): void {
    try {
      this.cleanup?.();
      document.documentElement.removeAttribute(READING_MODE_ATTR);
      if (this.styleEl) {
        this.styleEl.remove();
        this.styleEl = null;
      }
      this.isActive = false;
    } catch (error) {
      handleChromeError('disabling reading mode', error);
    }
  }
}
