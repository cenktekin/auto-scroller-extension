import type { ReadingStats, DailyStatsEntry } from './types';
import { handleChromeError } from './errors';

export const EMPTY_STATS: ReadingStats = { totalSeconds: 0, totalWords: 0, sessions: 0 };

export class ReadingStatsTracker {
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

  /** Stored per-day stats, newest first. Empty days are not filled in. */
  getRecentDays(limit: number = 7): DailyStatsEntry[] {
    return Object.keys(this.stats)
      .sort()
      .reverse()
      .slice(0, limit)
      .map(date => ({ date, stats: { ...this.stats[date] } }));
  }

  getSessionDuration(): number {
    if (this.sessionStartTime === 0) return 0;
    return Math.round((Date.now() - this.sessionStartTime) / 1000);
  }
}
