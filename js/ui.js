// Shared components: bottom bar, avatar, "+ Event" button, dialogs and sheets, toast, drag-to-scroll,
// covers and organisation marks, and dates shown in the organisation's timezone.

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
  return `<a href="${href}" class="avatar" style="--size:${size}px;background:var(--avatar-${n})" aria-label="${esc(label)}">${inner}</a>`;
}

export const orgDotHtml = (org) =>
  `<span class="org-dot" style="background:${gradient(org?.logoColors)}" aria-hidden="true">${esc(initials(org?.name))}</span>`;

export const coverHtml = (event, size, radius, font) =>
  `<span class="cover" style="--w:${size}px;--r:${radius}px;--fs:${font}px;background:${gradient(event.cover?.colors)}" aria-hidden="true">${esc(event.cover?.label || '')}</span>`;

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

  host.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('input, textarea, select, label, [contenteditable]')) return;
    if (page && e.target.closest('.hscroll, .cal-days')) return;
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

// Midnight at the start of the date's day, in that timezone.
export function dayStart(date = new Date(), tz = TZ) {
  const [y, m, d] = dayKey(date, tz).split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  const p = parts(guess, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }, tz);
  const offset = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - guess.getTime();
  return new Date(guess.getTime() - offset);
}

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
