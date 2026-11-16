import type { ReaderSettings } from './types';

const FOCUS_LINE_ID = 'autoscroll-focus-line';
const PROGRESS_BAR_ID = 'autoscroll-progress';
const SPEED_TOAST_ID = 'autoscroll-speed-toast';

/** Owns the two injected page overlays: the focus line and the progress bar. */
export class ScrollOverlay {
  private focusLine: HTMLElement | null = null;
  private progressBar: HTMLElement | null = null;

  createFocusLine(settings: ReaderSettings): HTMLElement | null {
    if (this.focusLine) {
      this.focusLine.remove();
    }
    this.focusLine = document.createElement('div');
    this.focusLine.id = FOCUS_LINE_ID;
    if (document.body) {
      document.body.appendChild(this.focusLine);
      this.applyFocusLineStyle(settings);
      return this.focusLine;
    }
    return null;
  }

  createProgressBar(settings: ReaderSettings): void {
    if (this.progressBar) this.progressBar.remove();
    this.progressBar = document.createElement('div');
    this.progressBar.id = PROGRESS_BAR_ID;
    Object.assign(this.progressBar.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      height: '3px',
      width: '0%',
      background: `linear-gradient(90deg, ${settings.lineColor}, ${settings.lineColor}aa)`,
      zIndex: '2147483646',
      pointerEvents: 'none',
      transition: 'width 0.1s linear',
      opacity: settings.isScrolling ? '1' : '0',
    });
    document.body?.appendChild(this.progressBar);
  }

  updateProgress(isScrolling: boolean): void {
    if (!this.progressBar) return;
    const scroller = document.scrollingElement || document.documentElement;
    const maxScroll = Math.max(1, scroller.scrollHeight - window.innerHeight);
    const pct = Math.min(100, (scroller.scrollTop / maxScroll) * 100);
    this.progressBar.style.width = `${pct}%`;
    this.progressBar.style.opacity = isScrolling ? '1' : '0';
  }

  applyFocusLineStyle(settings: ReaderSettings): void {
    if (!this.focusLine) return;
    const color = settings.lineColor;
    const opacity = settings.lineOpacity / 100;

    Object.assign(this.focusLine.style, {
      position: 'fixed',
      top: `${settings.focusLinePosition}%`,
      left: '0',
      width: '100%',
      height: `${settings.lineThickness}px`,
      backgroundColor: color,
      boxShadow: `0 0 5px ${color}, 0 0 10px ${color}, 0 0 15px ${color}`,
      opacity: opacity.toString(),
      zIndex: '2147483647',
      pointerEvents: 'none',
      transition: 'opacity 0.2s',
      visibility: settings.isScrolling ? 'visible' : 'hidden',
    });
  }

  setVisibility(visible: boolean): void {
    if (this.focusLine) this.focusLine.style.visibility = visible ? 'visible' : 'hidden';
    if (this.progressBar) this.progressBar.style.opacity = visible ? '1' : '0';
  }

  showSpeedToast(speed: number): void {
    const existing = document.getElementById(SPEED_TOAST_ID);
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = SPEED_TOAST_ID;
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
}
