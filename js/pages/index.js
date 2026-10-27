// Home (design/Home.dc.html).
import { requireUser } from '../auth.js';
import {
  AREAS, CAUSES, ensureUserDoc, getEvent, hoursBetween, listFollowerEvents, listOrganisations, listPublicEvents,
  myMemberships, myRegistrations,
} from '../data.js';
import { qrSvg } from '../qr.js';
import {
  addDays, avatarHtml, countdown, coverHtml, dateParts, dayHeading, dayKey, dayStart, daysFromToday, dragScroll, esc,
  eventRowHtml, fmtTime, gradient, hourOf, hoursText, icon, initials, openModal, renderBottomBar, renderEventFab, shortDay, toast,
} from '../ui.js';

const CAL_BEFORE = 14;   // days shown before today in the shifts tile
const CAL_DAYS = 70;
const CAL_COL = 100;     // px per day column
const AREA_IDS = ['north', 'northeast', 'east', 'central', 'west'];

const user = await requireUser();
const now = new Date();
const today = dayStart(now);
const $ = (id) => document.getElementById(id);

let failed = false;
const orElse = (fallback) => (err) => { console.warn(err); failed = true; return fallback; };
const byStart = (a, b) => a.startAt.toMillis() - b.startAt.toMillis();
const eventHref = (e) => `event.html?id=${encodeURIComponent(e.id)}`;
const hexOr = (c, fallback) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : fallback);

const profile = await ensureUserDoc(user);
const follows = profile.follows || [];
const { year } = dateParts(now);
const yearStart = dayStart(new Date(Date.UTC(year, 0, 1, 12)));
const nextYearStart = dayStart(new Date(Date.UTC(year + 1, 0, 1, 12)));

const [memberships, regs, hoursThisYear, publicEvents, followerEvents, orgList] = await Promise.all([
  myMemberships(user.uid).catch(orElse([])),
  myRegistrations(user.uid).catch(orElse([])),
  hoursBetween(user.uid, yearStart, nextYearStart).catch(orElse(0)),
  listPublicEvents(today).catch(orElse([])),
  follows.length ? listFollowerEvents(follows, today).catch(orElse([])) : [],
  listOrganisations().catch(orElse([])),
]);

// Events the user is going to or waiting on, with their registration status.
const regEvents = (await Promise.all(regs.map(async (r) => {
  const event = await getEvent(r.eventId).catch(() => null);
  return event && { ...event, regStatus: r.status };
}))).filter(Boolean);

const orgs = Object.fromEntries(orgList.map((o) => [o.id, o]));
const isAdmin = memberships.some((m) => m.role === 'admin');

// Header

// "Mei Lin Tan" greets as "Mei Lin"; two-word names use the first word.
function firstName(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return words.length >= 3 ? words.slice(0, -1).join(' ') : words[0] || '';
}

const day = dateParts(now);
$('today').textContent = `${day.weekday}, ${day.day} ${day.month}`;
const hour = hourOf(now);
const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
const first = firstName(profile.name);
$('greeting').textContent = first ? `${hello}, ${first}` : hello;
if (hoursThisYear > 0) {
  $('impact').textContent = `${hoursText(hoursThisYear)} volunteered this year. Thank you.`;
  $('impact').hidden = false;
}
$('avatar').outerHTML = avatarHtml({ uid: user.uid, name: profile.name, email: user.email, photoUrl: profile.photoUrl }, { size: 46 });

// Quick actions and the QR code

function showQr(event) {
  const payload = event ? `TE1:${user.uid}:${event.id}` : `TE1:${user.uid}`;
  openModal({
    kind: 'dialog',
    title: 'My QR code',
    body: `<span class="qr-box">${qrSvg(payload, 'Your check-in code')}</span>
      <span class="qr-name">${esc(profile.name || user.email)}</span>
      ${event ? `<span class="qr-sub">${esc(event.title)}</span>` : ''}`,
  });
}

$('quick').innerHTML = (isAdmin
  ? `<a class="qa hit" href="create.html">${icon('newEvent')}New event</a>`
  : `<a class="qa hit" href="discover.html">${icon('search')}Discover</a>`)
  + `<button type="button" class="qa hit" id="my-qr">${icon('qr')}My QR code</button>`;
$('my-qr').addEventListener('click', () => showQr());
$('past-link').insertAdjacentHTML('beforeend', icon('chevron'));
$('orgs-link').insertAdjacentHTML('beforeend', icon('chevron'));

// Your events

const upcoming = regEvents.filter((e) => e.endAt.toDate() > now).sort(byStart);
$('up-count').textContent = String(upcoming.length);

function upcomingCard(e) {
  const start = e.startAt.toDate(), end = e.endAt.toDate();
  const pending = e.regStatus === 'pending';
  const isToday = daysFromToday(start, now) === 0;
  const foot = isToday && !pending
    ? `<button type="button" class="ue-foot is-checkin" data-checkin="${esc(e.id)}">${icon('qr')}Check in</button>`
    : `<a class="ue-foot" href="${eventHref(e)}" draggable="false">${icon('pin', 16, 2)}${esc(AREAS[e.area] || 'Singapore')}, Singapore</a>`;
  return `<div class="glass ue-card">
    <a class="ue-main" href="${eventHref(e)}" draggable="false">
      <span class="ue-text">
        <span class="ue-title clamp2">${esc(e.title)}</span>
        <span class="ue-when">${esc(shortDay(start, now))} · ${fmtTime(start)} – ${fmtTime(end)}</span>
        <span class="ue-org">${esc(e.orgName)}</span>
        <span class="chip ${pending || isToday ? 'chip-wait' : 'chip-ok'}">${esc(pending ? 'Waiting for approval' : countdown(start, now))}</span>
      </span>
      ${coverHtml(e, 64, 14, 9)}
    </a>${foot}</div>`;
}

const upEl = $('upcoming');
if (upcoming.length) {
  upEl.className = 'hscroll';
  upEl.innerHTML = upcoming.map(upcomingCard).join('');
  upEl.addEventListener('click', (ev) => {
    const button = ev.target.closest('[data-checkin]');
    if (button) showQr(upcoming.find((e) => e.id === button.dataset.checkin));
  });
  dragScroll(upEl, 'x');
} else {
  upEl.innerHTML = `<a class="glass empty-card" href="#all"><span class="card-title">Nothing registered yet</span>${icon('chevron', 18)}</a>`;
}

// Organisations you follow: the first three, then a tile to find more

const followedOrgs = follows.map((id) => orgs[id]).filter(Boolean);
$('org-count').textContent = String(followedOrgs.length);
const orgTile = (href, logo, name, line) => `<a class="glass org-tile" href="${href}">${logo}
  <span class="org-tile-text"><span class="org-tile-name clamp2">${esc(name)}</span><span class="org-tile-line">${esc(line)}</span></span></a>`;
$('followed').innerHTML = followedOrgs.slice(0, 3).map((o) => orgTile(
  `organisation.html?id=${encodeURIComponent(o.id)}`,
  `<span class="org-logo" style="background:${gradient(o.logoColors)}" aria-hidden="true">${esc(initials(o.name))}</span>`,
  o.name, CAUSES[o.causes?.[0]] || '',
)).join('') + orgTile('discover.html', `<span class="org-logo org-logo-more" aria-hidden="true">${icon('plus', 18, 2.4)}</span>`,
  'Find organisations', 'Browse by cause');

// Your shifts: a strip of days, today in the lens, drag sideways for others

const calStart = addDays(today, -CAL_BEFORE);
const byDay = {};
regEvents.forEach((e) => { (byDay[dayKey(e.startAt.toDate())] ||= []).push(e); });

function shiftBlock(e) {
  const pending = e.regStatus === 'pending';
  const color = hexOr(orgs[e.orgId]?.logoColors?.[0] || e.cover?.colors?.[0], 'var(--forest)');
  return `<span class="cal-block${pending ? ' is-pending' : ''}" style="border-left-color:${color}">
    <span class="cal-time">${fmtTime(e.startAt.toDate())}</span>
    <span class="cal-title clamp2">${esc(e.title)}</span>${pending ? '<span class="cal-pending">Pending</span>' : ''}</span>`;
}

const columns = [];
for (let i = 0; i < CAL_DAYS; i++) {
  const date = addDays(calStart, i + 0.5);
  const p = dateParts(date);
  const items = (byDay[dayKey(date)] || []).sort(byStart);
  columns.push(`<a class="cal-day${i === CAL_BEFORE ? ' is-today' : ''}" href="#all" draggable="false">
    <span class="cal-date"><span class="cal-dow">${p.weekday.slice(0, 3)}</span><span class="cal-num">${p.day}</span></span>
    <span class="cal-items">${items.length ? items.map(shiftBlock).join('') : '<span class="cal-empty"></span>'}</span></a>`);
}
const cal = $('cal-days');
cal.innerHTML = columns.join('');
dragScroll(cal, 'x');
$('cal-today').textContent = String(day.day);

function syncShifts() {
  const firstCol = Math.max(0, Math.min(CAL_DAYS - 1, Math.round(cal.scrollLeft / CAL_COL)));
  const p = dateParts(addDays(calStart, firstCol + 0.5));
  $('cal-month').textContent = `${p.month} ${p.year}`;
  $('cal-today').classList.toggle('is-on', firstCol === CAL_BEFORE);
}
cal.addEventListener('scroll', syncShifts, { passive: true });
$('cal-today').addEventListener('click', () => {
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  cal.scrollTo({ left: CAL_BEFORE * CAL_COL, behavior: smooth ? 'smooth' : 'auto' });
});

// All events, grouped by day, with the area filter

const seen = new Set();
const allEvents = [...publicEvents, ...followerEvents]
  .filter((e) => !seen.has(e.id) && seen.add(e.id) && e.endAt.toDate() > now)
  .sort(byStart);
$('sample-note').hidden = !allEvents.some((e) => e.sample);

const eventRow = (e) => eventRowHtml(e, orgs[e.orgId], fmtTime(e.startAt.toDate()));

let area = 'all';
function renderEvents() {
  const list = allEvents.filter((e) => area === 'all' || e.area === area || e.area === 'islandwide');
  if (!list.length) {
    $('groups').innerHTML = '<div class="glass empty-note">No events in this area yet.</div>';
    return;
  }
  const groups = [];
  for (const e of list) {
    const key = dayKey(e.startAt.toDate());
    if (groups.at(-1)?.key !== key) groups.push({ key, date: e.startAt.toDate(), items: [] });
    groups.at(-1).items.push(e);
  }
  $('groups').innerHTML = groups.map((g) => {
    const [a, b] = dayHeading(g.date, now);
    return `<div class="group"><h3 class="group-head">${esc(a)} <span>/ ${esc(b)}</span></h3>
      <div class="glass list-card">${g.items.map(eventRow).join('')}</div></div>`;
  }).join('');
}

const areaBtn = $('area-btn'), areaMenu = $('area-menu');
function renderAreaControls() {
  areaBtn.innerHTML = `${esc(area === 'all' ? 'All of Singapore' : AREAS[area])} ${icon('chevronDown')}`;
  areaMenu.innerHTML = [['all', 'All of Singapore'], ...AREA_IDS.map((id) => [id, AREAS[id]])]
    .map(([id, label]) => `<button type="button" role="menuitemradio" aria-checked="${id === area}" data-area="${id}">${esc(label)}</button>`)
    .join('');
}
function setMenu(open) {
  areaMenu.hidden = !open;
  areaBtn.setAttribute('aria-expanded', String(open));
  if (open) areaMenu.querySelector('[aria-checked="true"]')?.focus();
}
areaBtn.addEventListener('click', () => setMenu(areaMenu.hidden));
areaMenu.addEventListener('click', (e) => {
  const item = e.target.closest('[data-area]');
  if (!item) return;
  area = item.dataset.area;
  renderAreaControls();
  renderEvents();
  setMenu(false);
  areaBtn.focus();
});
document.addEventListener('click', (e) => { if (!areaMenu.hidden && !e.target.closest('.menu-wrap')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !areaMenu.hidden) { setMenu(false); areaBtn.focus(); } });

renderAreaControls();
renderEvents();

// Page furniture

renderBottomBar('home');
if (isAdmin) renderEventFab();
dragScroll(document.scrollingElement, 'y');
document.body.classList.remove('is-loading');
cal.scrollLeft = CAL_BEFORE * CAL_COL;
syncShifts();
if (failed) toast('Some of Home couldn’t load.');
