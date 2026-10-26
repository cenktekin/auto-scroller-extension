import test from 'node:test';
import assert from 'node:assert/strict';
import { isInjectableUrl, hostFromUrl, resolveSettings } from '../utils.ts';
import { DEFAULT_SETTINGS, type ReaderSettings } from '../types.ts';

test('isInjectableUrl accepts http(s) pages', () => {
  assert.equal(isInjectableUrl('https://tr.wikipedia.org/wiki/Okuma'), true);
  assert.equal(isInjectableUrl('http://example.com/article'), true);
});

test('isInjectableUrl rejects restricted schemes and the web store', () => {
  assert.equal(isInjectableUrl('chrome://extensions'), false);
  assert.equal(isInjectableUrl('edge://settings'), false);
  assert.equal(isInjectableUrl('about:blank'), false);
  assert.equal(isInjectableUrl('chrome-extension://abc/index.html'), false);
  assert.equal(isInjectableUrl('https://chromewebstore.google.com/detail/x'), false);
  assert.equal(isInjectableUrl('file:///C:/tmp/a.html'), false);
});

test('isInjectableUrl is safe on empty and malformed input', () => {
  assert.equal(isInjectableUrl(undefined), false);
  assert.equal(isInjectableUrl(''), false);
  assert.equal(isInjectableUrl('not a url'), false);
});

test('hostFromUrl returns the hostname for http(s) only', () => {
  assert.equal(hostFromUrl('https://tr.wikipedia.org/wiki/X'), 'tr.wikipedia.org');
  assert.equal(hostFromUrl('https://github.com:8443/a/b'), 'github.com');
  assert.equal(hostFromUrl('chrome://extensions'), null);
  assert.equal(hostFromUrl('chrome-extension://abc/index.html'), null);
  assert.equal(hostFromUrl(undefined), null);
  assert.equal(hostFromUrl('nope'), null);
});

test('resolveSettings lets the per-site override win', () => {
  const base: ReaderSettings = { ...DEFAULT_SETTINGS, scrollSpeed: 3 };
  const merged = resolveSettings(base, { scrollSpeed: 8, autoStartOnLoad: true });

  assert.equal(merged.scrollSpeed, 8);
  assert.equal(merged.autoStartOnLoad, true);
  assert.equal(merged.lineColor, base.lineColor);
  assert.equal(base.scrollSpeed, 3);
});

test('resolveSettings always returns a new object', () => {
  const base: ReaderSettings = { ...DEFAULT_SETTINGS };
  const copy = resolveSettings(base);
  assert.notEqual(copy, base);
  assert.deepEqual(copy, base);
});
