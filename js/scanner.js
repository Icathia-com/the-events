// Camera QR scanner (design/Check-In.dc.html): BarcodeDetector where the browser has it, otherwise jsQR
// (Apache-2.0), loaded from jsDelivr only when needed, pinned and integrity-checked.
import { confirmWithCode, syncHours } from './data.js';
import { esc, icon } from './ui.js';

const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const JSQR_SRI = 'sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx';
const REPEAT_MS = 3000; // the same code read again within this time is ignored

function loadJsQR() {
  if (window.jsQR) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = JSQR_URL;
    script.integrity = JSQR_SRI;
    script.crossOrigin = 'anonymous';
    script.onload = resolve;
    script.onerror = () => reject(new Error('The QR reader did not load'));
    document.head.append(script);
  });
}

// Returns a function that reads a QR code from the current video frame, or null.
async function makeReader() {
  if ('BarcodeDetector' in window) {
    try {
      if ((await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async (video) => (await detector.detect(video))[0]?.rawValue || null;
      }
    } catch { /* fall back to jsQR */ }
  }
  await loadJsQR();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    const { videoWidth: w, videoHeight: h } = video;
    if (!w || !h) return null;
    const scale = Math.min(1, 720 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data || null;
  };
}

// Opens the full-screen scanner. onText(text) is called for each new code read. footer is extra HTML under the
// camera (already escaped). Returns { close, showResult(html), clearResult() }.
export function openScanner({ title, chip = '', footer = '', onText }) {
  const opener = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'scanner';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);
  overlay.innerHTML = `
    <div class="scanner-head">
      <button type="button" class="ib scanner-close" data-close aria-label="Close scanner">${icon('back', 20)}</button>
      <span class="scanner-title">${esc(title)}</span>${chip ? `<span class="scanner-chip">${esc(chip)}</span>` : ''}
    </div>
    <div class="scanner-view">
      <div class="scanner-frame">
        <video muted playsinline></video>
        <span class="scanner-corner is-tl" aria-hidden="true"></span><span class="scanner-corner is-tr" aria-hidden="true"></span>
        <span class="scanner-corner is-bl" aria-hidden="true"></span><span class="scanner-corner is-br" aria-hidden="true"></span>
        <span class="scanner-line" aria-hidden="true"></span>
        <span class="scanner-note" hidden></span>
      </div>
    </div>
    <div class="scanner-result" aria-live="polite"></div>
    <div class="scanner-foot">${footer}</div>`;
  document.body.append(overlay);
  document.body.classList.add('has-scanner');

  const video = overlay.querySelector('video');
  const note = overlay.querySelector('.scanner-note');
  let stream = null, timer = null, closed = false, last = '', lastAt = 0;

  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    stream?.getTracks().forEach((track) => track.stop());
    overlay.remove();
    document.body.classList.remove('has-scanner');
    document.removeEventListener('keydown', onKey);
    opener?.focus?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  overlay.querySelector('.scanner-close').focus();

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (closed) { stream.getTracks().forEach((track) => track.stop()); return; }
      video.srcObject = stream;
      await video.play();
      const read = await makeReader();
      const tick = async () => {
        if (closed) return;
        try {
          const text = await read(video);
          if (text && (text !== last || Date.now() - lastAt > REPEAT_MS)) {
            last = text;
            lastAt = Date.now();
            await onText(text);
          }
        } catch (err) {
          console.warn(err);
        }
        if (!closed) timer = setTimeout(tick, 200);
      };
      tick();
    } catch (err) {
      console.warn(err);
      note.textContent = 'Camera not available';
      note.hidden = false;
    }
  })();

  const result = overlay.querySelector('.scanner-result');
  return {
    close,
    showResult: (html) => { result.innerHTML = html; },
    clearResult: () => { result.innerHTML = ''; },
    element: overlay,
  };
}

// The volunteer's check-out: the organiser's code is a link to the event page with the code
// (event.html?id=…&checkout=…). Confirms the volunteer's hours, adds the ledger entry, closes, then onConfirmed(hours).
export function scanCheckOut(eventId, uid, onConfirmed) {
  const say = (text) => scanner.showResult(`<div class="scan-card"><span class="vol-name">${esc(text)}</span></div>`);
  const scanner = openScanner({
    title: 'Scan the check-out code',
    onText: async (text) => {
      let link = null;
      try { link = new URL(text); } catch { /* not a link */ }
      const code = link?.origin === location.origin && link.pathname.endsWith('/event.html') && link.searchParams.get('checkout');
      if (!code) { say('Not a check-out code'); return; }
      if (link.searchParams.get('id') !== eventId) { say('This code is for another event'); return; }
      try {
        const hours = await confirmWithCode(eventId, uid, code);
        await syncHours(uid).catch(() => 0);
        scanner.close();
        onConfirmed(hours);
      } catch (err) {
        console.warn(err);
        say('That check-out code didn’t work');
      }
    },
  });
}
