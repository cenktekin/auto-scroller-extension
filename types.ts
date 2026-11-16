
export interface ReaderSettings {
  scrollSpeed: number;
  lineThickness: number;
  lineColor: string;
  lineOpacity: number;
  isScrolling: boolean;
  scrollDirection: 'down' | 'up';
  focusLinePosition: number;
  smartSpeedEnabled?: boolean;
  autoStartOnLoad?: boolean;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  scrollSpeed: 5,
  lineThickness: 3,
  lineColor: '#00ffff',
  lineOpacity: 80,
  isScrolling: false,
  scrollDirection: 'down',
  focusLinePosition: 50,
  smartSpeedEnabled: false,
  autoStartOnLoad: false,
};

/** Settings that can be overridden per website. Runtime state (isScrolling) is excluded. */
export type PerSiteSettings = Partial<Omit<ReaderSettings, 'isScrolling'>>;

/** Map of hostname -> per-site setting overrides. */
export type SiteSettingsMap = Record<string, PerSiteSettings>;

export const SITE_SETTINGS_KEY = 'siteSettings';

/** Hostnames where per-site mode is switched on in the popup. */
export const SITE_MODE_KEY = 'siteModeHosts';

export interface ReadingStats {
  totalSeconds: number;
  totalWords: number;
  sessions: number;
}

/** One day of stored reading stats; `date` is a local YYYY-MM-DD key. */
export interface DailyStatsEntry {
  date: string;
  stats: ReadingStats;
}

/** Response payload of GET_READING_STATS. */
export interface ReadingStatsResponse extends ReadingStats {
  sessionDuration: number;
  smartSpeedEnabled: boolean;
  recentDays?: DailyStatsEntry[];
}

export interface ChromeMessage {
  type: 'TOGGLE_SCROLL' | 'UPDATE_SETTINGS' | 'GET_STATUS' | 'TOGGLE_READING_MODE' | 'TOGGLE_SMART_SPEED' | 'GET_READING_STATS';
  payload?: Partial<ReaderSettings>;
}