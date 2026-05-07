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
