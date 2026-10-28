// Shared components: bottom bar, avatar, "+ Event" button, dialogs and sheets, toast, drag-to-scroll,
// covers and organisation marks, event and organisation rows, follow buttons, and dates shown in the
// organisation's timezone.
import { AREAS, followOrg, unfollowOrg } from './data.js';

// The app shell service worker (brief section 3). Every page loads this module, so every page registers it.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((err) => console.warn(err));

// Waits for Manrope, up to a second, so text doesn't reflow and jump when the web font arrives after it's shown.
const fontReady = () => Promise.race([
  document.fonts ? document.fonts.load('600 16px Manrope').catch(() => null) : null,
  new Promise((resolve) => setTimeout(resolve, 1000)),
]);

// Shows the page once its content is in place.
export async function reveal() {
  await fontReady();
  document.body.classList.remove('is-loading');
}

// Shows one part of the page (a child of main) before the rest has loaded.
export async function revealEarly(el) {
  await fontReady();
  el.classList.add('shown');
}

export const TZ = 'Asia/Singapore';

// Escapes text for use inside HTML.
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  discover: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  organisations: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2a5 5 0 0 1 6 4.8"/>',
  notifications: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  newEvent: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v2M17 20h4M14 20h1"/>',
  pin: '<path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 8l9 6 9-6"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  invite: '<circle cx="10" cy="8" r="3.5"/><path d="M3 20a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
  message: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  manage: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  checkin: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M12.5 7.5l4 4"/>',
  cancel: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  bag: '<path d="M6 7h12l1 14H5z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-1 1.2-1.9-.5-1 .2-2.1 1.3-2.1H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  doc: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  dollar: '<path d="M12 3v18M16.5 7.5c0-1.9-2-3-4.5-3S7.5 5.6 7.5 7.5s2 2.6 4.5 3.2 4.5 1.4 4.5 3.3-2 3.5-4.5 3.5-4.5-1.2-4.5-3.2"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.4"/>',
  spots: '<path d="M5 4h14M12 20V8M8 12l4-4 4 4"/>',
  updown: '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  hosts: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M19 3l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L16 5.3l2-.3z"/>',
  ticket: '<path d="M4 6h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V7a1 1 0 0 1 1-1z"/><path d="M14.5 6.5v2M14.5 11v2M14.5 15.5v2"/>',
  voucher: '<path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6z"/><path d="M9 8v8M15 8v8"/>',
  insights: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  clone: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  transfer: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
  sort: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  heart: '<path d="M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.4-7 10-7 10z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  signOut: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  food: '<path d="M4 13h16l-1.5 7h-13z"/><path d="M12 13V8M8 10c0-3 2-5 4-5s4 2 4 5"/>',
  elderly: '<path d="M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.4-7 10-7 10z"/>',
  children: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  environment: '<path d="M5 20c0-8 4-14 14-15-1 10-7 14-14 15z"/><path d="M5 20c3-5 6-8 10-10"/>',
  animals: '<circle cx="6" cy="9" r="2"/><circle cx="18" cy="9" r="2"/><circle cx="9.5" cy="5" r="2"/><circle cx="14.5" cy="5" r="2"/><path d="M12 11c3 0 6 3 6 6a3 3 0 0 1-3 3c-1.5 0-2-1-3-1s-1.5 1-3 1a3 3 0 0 1-3-3c0-3 3-6 6-6z"/>',
  education: '<path d="M3 6a2 2 0 0 1 2-2h5a3 3 0 0 1 2 1 3 3 0 0 1 2-1h5a2 2 0 0 1 2 2v13h-7a2 2 0 0 0-2 1 2 2 0 0 0-2-1H3z"/><path d="M12 5v15"/>',
};

export const icon = (name, size = 16, stroke = 2.2) =>
  `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

// Bottom bar

const TABS = [
  ['home', 'index.html', 'Home'],
  ['discover', 'discover.html', 'Discover'],
  ['organisations', 'organisations.html', 'Organisations'],
  ['notifications', 'notifications.html', 'Notifications'],
];

export function renderBottomBar(active) {
  const nav = document.createElement('nav');
  nav.className = 'tabbar';
  nav.setAttribute('aria-label', 'Main');
  nav.innerHTML = TABS.map(([key, href, label]) =>
    `<a href="${href}" class="tab" title="${label}" aria-label="${label}"${key === active ? ' aria-current="page"' : ''}><span class="lens"></span>${icon(key, 24, 1.9)}</a>`).join('');
  document.body.append(nav);
}

export function renderEventFab() {
  const link = document.createElement('a');
  link.href = 'create.html';
  link.className = 'fab';
  link.innerHTML = `${icon('plus', 18, 2.4)}Event`;
  document.body.append(link);
}

// People and organisations

export function initials(name, fallback = '') {
  const words = String(name || '').replace(/[^\p{L} ]/gu, ' ').split(/\s+/).filter((w) => w && !/^(the|of|and|sg)$/i.test(w));
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('') || fallback;
}

// A colour pair as a CSS gradient; anything that isn't a hex colour falls back to forest.
export function gradient(colors) {
  const [a, b] = (colors || []).map((c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : null));
  return `linear-gradient(135deg, ${a || '#24412F'}, ${b || a || '#2E7D5B'})`;
}

export function avatarHtml(person, { size = 44, href = 'profile.html', label = 'Your profile' } = {}) {
  const n = ([...String(person.uid || '')].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 9) + 1;
  const photo = /^https:\/\//.test(person.photoUrl || '') ? person.photoUrl : '';
  const inner = photo ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer">` : esc(initials(person.name || person.email, '?'));
  const style = `--size:${size}px;background:var(--avatar-${n})`;
  if (!href) return `<span class="avatar" style="${style}" aria-hidden="true">${inner}</span>`;
  return `<a href="${href}" class="avatar" style="${style}" aria-label="${esc(label)}">${inner}</a>`;
}

export const orgDotHtml = (org) =>
  `<span class="org-dot" style="background:${gradient(org?.logoColors)}" aria-hidden="true">${esc(initials(org?.name))}</span>`;

export const coverHtml = (event, size, radius, font) =>
  `<span class="cover" style="--w:${size}px;--r:${radius}px;--fs:${font}px;background:${gradient(event.cover?.colors)}" aria-hidden="true">${esc(event.cover?.label || '')}</span>`;

// A cover's short label from a title: up to two upper-case lines of up to ten letters, so it fits small covers.
// A line doesn't end on a small word ("RUN FOR" becomes "RUN").
export function coverLabel(title, perLine = 10) {
  let a = '', b = '';
  for (const word of String(title || '').toUpperCase().split(/\s+/).filter(Boolean)) {
    if (!b && `${a} ${word}`.trim().length <= perLine) a = `${a} ${word}`.trim();
    else if (a && `${b} ${word}`.trim().length <= perLine) b = `${b} ${word}`.trim();
    else if (a) break;
  }
  const trim = (line) => line.replace(/(\s+(FOR|THE|OF|AND|A|AN|TO|AT|ON|IN|WITH|&))+$/, '');
  [a, b] = [trim(a), trim(b)];
  return b ? `${a}\n${b}` : a || String(title || '').toUpperCase().slice(0, perLine);
}

// An organisation's mark at any size: rounded square by default, a circle with round: true.
export const orgLogoHtml = (org, size = 42, round = false) =>
  `<span class="org-logo" style="width:${size}px;height:${size}px;border-radius:${round ? '50%' : `${Math.round(size / 3)}px`};font-size:${Math.round(size * 0.31)}px;background:${gradient(org?.logoColors)}" aria-hidden="true">${esc(initials(org?.name))}</span>`;

export function spotsChip(event) {
  const capacity = event.registration?.capacity;
  if (!capacity) return '';
  const left = Math.max(0, capacity - (event.counts?.going || 0));
  if (left === 0) return '<span class="chip chip-muted">Full</span>';
  if (left <= 3) return `<span class="chip chip-wait">Almost full · ${left} left</span>`;
  return `<span class="chip chip-ok">${left} spots left</span>`;
}

// A row in an event list: cover, host, title, then the given time text, the area and (optionally) the spots chip.
export function eventRowHtml(event, org, timeText, { spots = true } = {}) {
  const host = org || { name: event.orgName };
  return `<a class="ev-row" href="event.html?id=${encodeURIComponent(event.id)}" draggable="false">${coverHtml(event, 72, 16, 11)}
    <span class="ev-text">
      <span class="ev-org">${orgDotHtml(host)}<span class="ev-org-name">${esc(event.orgName || host.name)}</span></span>
      <span class="ev-title clamp2">${esc(event.title)}</span>
      <span class="ev-meta"><span>${icon('clock', 14, 2)}${esc(timeText)}</span><span>${icon('pin', 14, 2)}${esc(AREAS[event.area] || 'Singapore')}</span>${spots ? spotsChip(event) : ''}</span>
    </span></a>`;
}

export const followButtonHtml = (org, on) =>
  `<button type="button" class="follow-btn hit" data-follow="${esc(org.id)}" aria-pressed="${on}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(org.name)}">${on ? 'Following' : 'Follow'}</button>`;

// Follow buttons inside root save straight away; follows (a Set of org ids) is kept in step, then onChange runs.
export function wireFollow(root, uid, follows, onChange) {
  root.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-follow]');
    if (!button) return;
    const id = button.dataset.follow, on = follows.has(id);
    button.disabled = true;
    try {
      await (on ? unfollowOrg : followOrg)(uid, id);
      if (on) follows.delete(id); else follows.add(id);
      onChange?.();
    } catch (err) {
      console.warn(err);
      toast('Couldn’t update that.');
    }
    button.disabled = false;
  });
}

// Dialogs (centred) and sheets (slide up). body is HTML the caller has already escaped.

export function openModal({ title, body = '', kind = 'sheet' }) {
  const opener = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = `overlay overlay-${kind}`;
  overlay.innerHTML = `<div class="${kind}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
    <div class="modal-head"><span class="modal-title">${esc(title)}</span>
    <button type="button" class="icon-btn hit" data-close aria-label="Close">${icon('close', 16, 2.4)}</button></div>
    <div class="modal-body">${body}</div></div>`;
  const box = overlay.firstElementChild;

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    opener?.focus?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key !== 'Tab') return;
    const focusable = [...box.querySelectorAll('a[href], button:not([disabled]), input, select, textarea')];
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  box.focus();
  return { close, element: box };
}

export function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(el.hideTimer);
  el.hideTimer = setTimeout(() => el.classList.remove('is-on'), 3500);
}

// Lets the mouse drag-scroll an element sideways ('x') or the whole page ('y', with document.scrollingElement).
// A drag that moves more than a few pixels doesn't also count as a click.
export function dragScroll(el, axis = 'x') {
  const page = el === document.scrollingElement;
  const host = page ? document : el;
  let start = null, origin = 0, moved = false;
  if (!page) el.dataset.dragX = '';

  host.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('input, textarea, select, label, [contenteditable]')) return;
    if (page && e.target.closest('[data-drag-x]')) return;
    start = axis === 'x' ? e.clientX : e.clientY;
    origin = axis === 'x' ? el.scrollLeft : el.scrollTop;
    moved = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (start === null) return;
    const delta = (axis === 'x' ? e.clientX : e.clientY) - start;
    if (!moved && Math.abs(delta) < 6) return;
    if (!moved) {
      moved = true;
      document.body.classList.add('is-dragging');
      if (!page) el.classList.add('is-dragging');
    }
    if (axis === 'x') el.scrollLeft = origin - delta;
    else el.scrollTop = origin - delta;
  });
  window.addEventListener('mouseup', () => {
    if (start === null) return;
    start = null;
    document.body.classList.remove('is-dragging');
    el.classList.remove('is-dragging');
    setTimeout(() => { moved = false; }, 0);
  });
  host.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  host.addEventListener('dragstart', (e) => e.preventDefault());
}

// Dates, in the organisation's timezone (Singapore for now)

const DAY = 86400e3;

function parts(date, options, tz = TZ) {
  const list = new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...options }).formatToParts(date);
  return Object.fromEntries(list.map((p) => [p.type, p.value]));
}

// "2026-10-28": the calendar date in that timezone.
export function dayKey(date, tz = TZ) {
  const p = parts(date, { year: 'numeric', month: '2-digit', day: '2-digit' }, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

// The moment a wall-clock date ("2026-11-07") and time ("09:00") happen in that timezone.
export function zonedDate(dateText, timeText, tz = TZ) {
  const [y, m, d] = dateText.split('-').map(Number);
  const [hh, mm] = timeText.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const p = parts(guess, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }, tz);
  const offset = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - guess.getTime();
  return new Date(guess.getTime() - offset);
}

// A moment as the wall-clock date and time in that timezone: { date: '2026-11-07', time: '09:00' }.
export function zonedParts(date, tz = TZ) {
  const p = parts(date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, tz);
  return { date: dayKey(date, tz), time: `${p.hour}:${p.minute}` };
}

// Midnight at the start of the date's day, in that timezone.
export const dayStart = (date = new Date(), tz = TZ) => zonedDate(dayKey(date, tz), '00:00', tz);

export const addDays = (date, n) => new Date(date.getTime() + n * DAY);
export const daysFromToday = (date, now = new Date(), tz = TZ) => Math.round((dayStart(date, tz) - dayStart(now, tz)) / DAY);
export const hourOf = (date, tz = TZ) => Number(parts(date, { hour: 'numeric', hourCycle: 'h23' }, tz).hour);

export const fmtTime = (date, tz = TZ) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(date);

export function dateParts(date, tz = TZ) {
  const p = parts(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, tz);
  return { weekday: p.weekday, day: Number(p.day), month: p.month, year: Number(p.year) };
}

// "Today", "Tomorrow" or "Sat 31 Oct".
export function shortDay(date, now = new Date(), tz = TZ) {
  const n = daysFromToday(date, now, tz);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  const p = dateParts(date, tz);
  return `${p.weekday.slice(0, 3)} ${p.day} ${p.month.slice(0, 3)}`;
}

// ["Today", "Wednesday"] or ["31 October", "Saturday"]: the heading for a day's group of events.
export function dayHeading(date, now = new Date(), tz = TZ) {
  const n = daysFromToday(date, now, tz), p = dateParts(date, tz);
  return [n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${p.day} ${p.month}`, p.weekday];
}

export function countdown(start, now = new Date(), tz = TZ) {
  const n = daysFromToday(start, now, tz);
  if (n === 0) {
    const mins = Math.round((start - now) / 60e3);
    if (mins <= 0) return 'Happening now';
    if (mins < 60) return `In ${mins} min`;
    const hours = Math.round(mins / 60);
    return `In ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return n === 1 ? 'Tomorrow' : `In ${n} days`;
}

export const hoursText = (h) => `${Number(h.toFixed(1))} ${h === 1 ? 'hour' : 'hours'}`;

// What a scan of the check-out code did, for a toast.
export const checkOutText = ({ status, hours }, orgName) => status === 'confirmed' ? `${hoursText(hours)} confirmed`
  : status === 'claimed' ? `Claim sent to ${orgName}` : 'Claim declined';
