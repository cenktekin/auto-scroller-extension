// Minimal internal PDF viewer using pdf.js
// Import pdf.js as ES module and set worker via URL
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker?url';

// Match the ReaderSettings used by content.ts
interface ReaderSettings {
  scrollSpeed: number;
  lineThickness: number;
  lineColor: string;
  lineOpacity: number; // 0-100
  isScrolling: boolean;
}

const DEFAULT_SETTINGS: ReaderSettings = {
  scrollSpeed: 5,
  lineThickness: 3,
  lineColor: '#00ffff',
  lineOpacity: 80,
  isScrolling: false,
};

function getParam(name: string): string | null {
  const url = new URL(window.location.href);
  const v = url.searchParams.get(name);
  return v;
}

async function renderPdfFromUrl(url: string) {
  // Configure worker
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  const viewer = document.getElementById('viewer')!;
  viewer.innerHTML = '';
  const loadingTask = pdfjsLib.getDocument(url);
  const pdf = await loadingTask.promise;
  const padding = 32; // #viewer has 16px left+right
  const containerWidth = Math.max(320, (viewer.clientWidth || window.innerWidth) - padding);
  const containerHeight = viewer.clientHeight || window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const vw1 = page.getViewport({ scale: 1 });
    // Fit width, but ensure page height > viewer height to make scrolling visible
    let scale = Math.max(0.8, containerWidth / vw1.width);
    const minHeightScale = (containerHeight * 1.1) / vw1.height; // ensure taller than viewport
    if (vw1.height * scale < containerHeight * 0.95) {
      scale = Math.max(scale, minHeightScale);
    }
    scale = Math.min(3, scale);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    // Logical CSS size
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    // Backing store size for HiDPI
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    viewer.appendChild(canvas);
    await page.render({ canvasContext: ctx, viewport, transform: [dpr, 0, 0, dpr, 0, 0] }).promise;
  }
}

async function renderPdfFromData(data: ArrayBuffer) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  const viewer = document.getElementById('viewer')!;
  viewer.innerHTML = '';
  const uint8 = new Uint8Array(data);
  const loadingTask = pdfjsLib.getDocument({ data: uint8 });
  const pdf = await loadingTask.promise;
  const padding = 32;
  const containerWidth = Math.max(320, (viewer.clientWidth || window.innerWidth) - padding);
  const containerHeight = viewer.clientHeight || window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const vw1 = page.getViewport({ scale: 1 });
    let scale = Math.max(0.8, containerWidth / vw1.width);
    const minHeightScale = (containerHeight * 1.1) / vw1.height;
    if (vw1.height * scale < containerHeight * 0.95) {
      scale = Math.max(scale, minHeightScale);
    }
    scale = Math.min(3, scale);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    viewer.appendChild(canvas);
    await page.render({ canvasContext: ctx, viewport, transform: [dpr, 0, 0, dpr, 0, 0] }).promise;
  }
}

let settings: ReaderSettings = { ...DEFAULT_SETTINGS };
let isScrolling = false;
let rafId: number | null = null;
let lastTs: number | null = null;
let subpixelRemainder = 0;
const BASE_SPEED_PPS = 12; // consistent with content.ts

function updateUi() {
  const btn = document.getElementById('toggle-scroll') as HTMLButtonElement | null;
  const status = document.getElementById('status');
  const focus = document.getElementById('focus-line') as HTMLElement | null;
  if (btn) btn.textContent = isScrolling ? 'Stop' : 'Start';
  if (status) {
    const storageOk = (typeof chrome !== 'undefined' && !!chrome.storage?.local);
    status.textContent = `Auto-scroll is ${isScrolling ? 'ON' : 'OFF'} • (Space: toggle, +/-: speed) • storage: ${storageOk ? 'ok' : 'off'}`;
  }
  if (focus) focus.style.visibility = isScrolling ? 'visible' : 'hidden';
  applyFocusLineStyle();
}

function step(now: number) {
  const container = document.getElementById('viewer');
  if (!container) { rafId = null; return; }
  if (!isScrolling) { rafId = null; return; }
  const dt = lastTs === null ? (1 / 60) : Math.max(0, (now - lastTs) / 1000);
  lastTs = now;
  const pps = Math.max(0, BASE_SPEED_PPS * (settings?.scrollSpeed ?? DEFAULT_SETTINGS.scrollSpeed));
  let delta = pps * dt + subpixelRemainder;
  const intDelta = delta > 0 ? Math.floor(delta) : Math.ceil(delta);
  subpixelRemainder = delta - intDelta;
  const canScrollContainer = container.scrollHeight - container.clientHeight > 1;
  if (intDelta !== 0) {
    if (canScrollContainer) {
      container.scrollTop = Math.max(0, Math.min(container.scrollTop + intDelta, container.scrollHeight - container.clientHeight));
    } else {
      const doc = document.scrollingElement || document.documentElement || document.body;
      const maxTop = Math.max(0, doc.scrollHeight - window.innerHeight);
      doc.scrollTop = Math.max(0, Math.min(doc.scrollTop + intDelta, maxTop));
    }
  }
  rafId = requestAnimationFrame(step);
}

function startScroll() {
  if (isScrolling) return;
  isScrolling = true;
  lastTs = null; // reset timing like content.ts
  subpixelRemainder = 0;
  updateUi();
  // small nudge to make movement visible
  const container = document.getElementById('viewer');
  if (container) container.scrollTop = container.scrollTop + 1;
  // persist state so popup reflects it
  try { chrome.storage?.local?.set?.({ readerSettings: { ...settings, isScrolling: true } }); } catch {}
  rafId = requestAnimationFrame(step);
}

function stopScroll() {
  isScrolling = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  updateUi();
  // persist state so popup reflects it
  try { chrome.storage?.local?.set?.({ readerSettings: { ...settings, isScrolling: false } }); } catch {}
}

function toggleScroll() { isScrolling ? stopScroll() : startScroll(); }

function applyFocusLineStyle() {
  const focus = document.getElementById('focus-line') as HTMLElement | null;
  if (!focus) return;
  const opacity = (settings?.lineOpacity ?? DEFAULT_SETTINGS.lineOpacity) / 100;
  const thickness = settings?.lineThickness ?? DEFAULT_SETTINGS.lineThickness;
  const color = settings?.lineColor ?? DEFAULT_SETTINGS.lineColor;
  Object.assign(focus.style, {
    height: `${thickness}px`,
    backgroundColor: color,
    boxShadow: `0 0 5px ${color}, 0 0 10px ${color}, 0 0 15px ${color}`,
    opacity: `${opacity}`,
  } as Partial<CSSStyleDeclaration>);
}

function clampSpeed(v: number) { return Math.max(0, Math.min(10, v)); }

function setSpeed(newSpeed: number) {
  const clamped = clampSpeed(newSpeed);
  if (settings.scrollSpeed === clamped) return;
  settings.scrollSpeed = clamped;
  try { chrome.storage?.local?.set?.({ readerSettings: { ...settings } }); } catch {}
}

async function loadSettings(): Promise<void> {
  try {
    await new Promise<void>((resolve) => {
      if (!('chrome' in window) || !chrome.storage?.local) return resolve();
      chrome.storage.local.get('readerSettings', (result) => {
        try {
          if (result && result.readerSettings) {
            settings = { ...settings, ...(result.readerSettings as ReaderSettings) };
            isScrolling = !!settings.isScrolling; // sync initial
          }
        } catch {}
        resolve();
      });
    });
  } catch {}
}

function setupStorageListener() {
  if (!('chrome' in window) || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local' || !changes.readerSettings) return;
    const newSettings = changes.readerSettings.newValue as ReaderSettings;
    const old = { ...settings };
    settings = { ...settings, ...newSettings };
    // React to isScrolling change
    if (old.isScrolling !== settings.isScrolling) {
      isScrolling = !!settings.isScrolling;
      if (isScrolling) startScroll(); else stopScroll();
    } else {
      // Apply style changes live
      applyFocusLineStyle();
    }
  });
}

(function main() {
  // Load settings and listen for changes
  loadSettings().then(() => {
    applyFocusLineStyle();
    if (settings.isScrolling) startScroll(); else stopScroll();
  });
  setupStorageListener();
  // Wire local file picker
  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      try {
        const buf = await file.arrayBuffer();
        await renderPdfFromData(buf);
        // do not auto-start; keep state
        stopScroll();
      } catch (e) {
        const v = document.getElementById('viewer');
        if (v) v.innerHTML = '<p class="text-center text-red-400">Failed to load selected PDF.</p>';
        console.error('Failed to load local PDF:', e);
      }
    });
  }

  // Wire toggle button
  const btn = document.getElementById('toggle-scroll');
  if (btn) btn.addEventListener('click', () => toggleScroll());

  // Keyboard shortcut: Space
  window.addEventListener('keydown', (e) => {
    // Ignore when typing in text inputs/textareas/contenteditable
    const target = e.target as HTMLElement | null;
    const isEditable = !!target && (
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable
    );
    if (isEditable) return;
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      toggleScroll();
      return;
    }
    // Speed up/down with + and - (also support numpad)
    if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
      e.preventDefault();
      setSpeed((settings.scrollSpeed ?? 5) + 1);
      return;
    }
    if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      setSpeed((settings.scrollSpeed ?? 5) - 1);
      return;
    }
  }, { capture: true });

  // Try URL param rendering
  const url = getParam('url');
  if (url) {
    // Guard against restricted or unsupported URL schemes (e.g., chrome://, about:, file:)
    try {
      const parsed = new URL(url);
      const allowed = new Set(['http:', 'https:', 'blob:', 'data:']);
      if (!allowed.has(parsed.protocol)) {
        const v = document.getElementById('viewer');
        if (v) v.innerHTML = '<p class="text-center text-yellow-300">This URL scheme is not supported. Please open a PDF from the web (http/https) or use "Open local PDF" above.</p>';
        stopScroll();
        return;
      }
    } catch {
      const v = document.getElementById('viewer');
      if (v) v.innerHTML = '<p class="text-center text-yellow-300">Invalid URL. Use "Open local PDF" above.</p>';
      stopScroll();
      return;
    }
    renderPdfFromUrl(url).then(() => {
      // honor current settings; do not force start
      if (settings.isScrolling) startScroll(); else stopScroll();
    }).catch(err => {
      const v = document.getElementById('viewer');
      if (v) v.innerHTML = '<p class="text-center text-red-400">Failed to load PDF from URL. Use "Open local PDF" above.</p>';
      console.error('Failed to load URL PDF:', err);
    });
  } else {
    const v = document.getElementById('viewer');
    if (v) v.innerHTML = '<p class="text-center text-yellow-300">No PDF URL provided. Use "Open local PDF" above.</p>';
  }
  // Initial UI state
  updateUi();
})();
