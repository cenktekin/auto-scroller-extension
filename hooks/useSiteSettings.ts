import { useCallback } from 'react';
import type { PerSiteSettings, SiteSettingsMap } from '../types';
import { SITE_MODE_KEY, SITE_SETTINGS_KEY } from '../types';
import { useChromeStorage } from './useChromeStorage';

/**
 * Per-site settings overrides stored under `chrome.storage.local[siteSettings]`.
 * The map is keyed by hostname; values are partial overrides of the global settings.
 *
 * `siteModeHosts` records the hosts where the override is actually in effect, so the
 * popup and the content script agree on the same state across tabs and reloads.
 */
export function useSiteSettings() {
  const [siteSettings, setSiteSettings] = useChromeStorage<SiteSettingsMap>(SITE_SETTINGS_KEY, {});
  const [siteModeHosts, setSiteModeHosts] = useChromeStorage<string[]>(SITE_MODE_KEY, []);

  const setOverride = useCallback((host: string, patch: PerSiteSettings) => {
    if (!host) return;
    setSiteSettings(prev => ({ ...prev, [host]: { ...(prev[host] ?? {}), ...patch } }));
  }, [setSiteSettings]);

  const clearOverride = useCallback((host: string) => {
    setSiteSettings(prev => {
      if (!prev[host]) return prev;
      const next = { ...prev };
      delete next[host];
      return next;
    });
  }, [setSiteSettings]);

  const isPerSite = useCallback(
    (host: string | null): boolean => !!host && siteModeHosts.includes(host),
    [siteModeHosts],
  );

  const setPerSite = useCallback((host: string | null, enabled: boolean) => {
    if (!host) return;
    setSiteModeHosts(prev => {
      const has = prev.includes(host);
      if (enabled === has) return prev;
      return enabled ? [...prev, host] : prev.filter(h => h !== host);
    });
  }, [setSiteModeHosts]);

  return { siteSettings, setOverride, clearOverride, isPerSite, setPerSite };
}
