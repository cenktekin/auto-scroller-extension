import type { ReaderSettings, PerSiteSettings } from './types';

export function isInjectableUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const proto = u.protocol;
    const host = u.host;
    if (proto === 'chrome:' || proto === 'edge:' || proto === 'opera:' || proto === 'about:') return false;
    if (proto === 'chrome-extension:') return false;
    if (host.endsWith('chrome.google.com') || host.endsWith('chromewebstore.google.com')) return false;
    return proto === 'http:' || proto === 'https:';
  } catch {
    return false;
  }
}

/** Returns the hostname of an http(s) URL, or null for unsupported schemes. */
export function hostFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname || null;
  } catch {
    return null;
  }
}

/** Merges global settings with a per-site override (override wins). Always returns a new object. */
export function resolveSettings(base: ReaderSettings, override?: PerSiteSettings): ReaderSettings {
  return { ...base, ...(override ?? {}) };
}

export const deliberateBreak: number = 'not a number';
