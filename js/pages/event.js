// Event page (design/Event-Detail.dc.html): one page for volunteers and for the hosting organisation's admins.
import { requireUser } from '../auth.js';
import {
  AGE_GROUPS, AREAS, approvalFor, audiencesFor, CAUSES, cancelRegistration, checkOutWithCode, ensureUserDoc, followOrg, getEvent,
  getExactVenue, getMyAttendance, getMyRegistration, getMyRole, getOrganisation, joinEvent, joinStatus, listAnnouncements, listGoing,
  listQuestions, questionLabel, syncHours, ticketFor, typeOpen, unfollowOrg,
} from '../data.js';
import { qrSvg } from '../qr.js';
import {
  checkOutText, coverHtml, dateParts, daysFromToday, dragScroll, esc, fmtTime, hoursText, icon, initials, markSeen, openModal,
  orgDotHtml, reveal, shortDay, toast,
} from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
const ACTIVE = ['going', 'pending', 'waitlist'];

const profile = await ensureUserDoc(user);
let event = eventId ? await getEvent(eventId).catch(() => null) : null;

if (!event) {
  main.innerHTML = `<div class="top-row"><a class="ib" href="index.html" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">This event isn’t available.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

const [org, role] = await Promise.all([
  getOrganisation(event.orgId).catch(() => null),
  getMyRole(event.orgId, user.uid).catch(() => null),
]);
const isAdmin = role === 'admin';
const follows = new Set(profile.follows || []);
let reg = null, going = [], venue = null, menuOpen = false, busy = false;

// Exact venue: shown unless hidden, and then only to approved volunteers and the organisation.
async function loadVenue() {
  if (!event.hideExactLocation) return event.venue;
  if (!role && reg?.status !== 'going') return null;
  return (await getExactVenue(eventId).catch(() => '')) || event.venue;
}

// Announcements (Phase 2): all of them for the organisation, otherwise those for the volunteer's audiences.
let notes = [];
async function loadNotes() {
  if (role) return listAnnouncements(eventId).catch(() => []);
  const att = reg?.status === 'going' && ended() ? await getMyAttendance(eventId, user.uid).catch(() => null) : null;
  const audiences = audiencesFor(reg?.status, att?.status);
  return audiences.length ? listAnnouncements(eventId, audiences).catch(() => []) : [];
}

function notesHtml() {
  if (!notes.length) return '';
  return `<div class="stack-6"><div class="lbl">Announcements</div><div class="glass note-card">${notes.map((n) => {
    const at = n.createdAt?.toDate?.() || new Date();
    return `<div class="note-row"><span class="note-text">${esc(n.text)}</span>
      <span class="meta">${esc(`${n.byName || orgName()} · ${shortDay(at)}, ${fmtTime(at)}`)}${n.sample ? ' · Sample' : ''}</span></div>`;
  }).join('')}</div></div>`;
}

async function refresh() {
  [event, reg, going] = await Promise.all([
    getEvent(eventId),
    getMyRegistration(eventId, user.uid).catch(() => null),
    listGoing(eventId).catch(() => []),
  ]);
  [venue, notes] = await Promise.all([loadVenue(), loadNotes()]);
  render();
}

const orgName = () => org?.name || event.orgName;
const orgHref = () => `organisation.html?id=${encodeURIComponent(event.orgId)}`;
const area = () => AREAS[event.area] || 'Singapore';
const ended = () => event.endAt.toDate() <= new Date();

function whenLine() {
  const start = event.startAt.toDate(), end = event.endAt.toDate();
  const n = daysFromToday(start), p = dateParts(start);
  const day = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${p.weekday}, ${p.day} ${p.month}`;
  return `${day}, ${fmtTime(start)} – ${fmtTime(end)}`;
}

function statusChip() {
  if (event.status === 'cancelled') return ['Cancelled', 'chip-danger'];
  if (ended()) return ['Ended', 'chip-muted'];
  const capacity = event.registration?.capacity;
  if (!capacity) return ['Open registration', 'chip-ok'];
  const left = Math.max(0, capacity - (event.counts?.going || 0));
  if (left === 0) return ['Full', 'chip-muted'];
  return left <= 3 ? [`${left} spots left · almost full`, 'chip-wait'] : [`${left} spots left`, 'chip-ok'];
}

function registrationOpen() {
  const r = event.registration || {}, now = Date.now();
  return r.open && event.visibility !== 'draft'
    && (!r.opensAt || r.opensAt.toMillis() <= now) && (!r.closesAt || r.closesAt.toMillis() > now);
}

// The big button: what the volunteer can do next, or where they stand.
function joinButton() {
  const status = reg?.status;
  if (status === 'going') return { label: 'Registered', cls: 'is-going', check: true, disabled: true };
  if (status === 'pending') return { label: 'Pending approval', cls: 'is-pending', disabled: true };
  if (status === 'waitlist') return { label: 'On the waiting list', cls: 'is-pending', disabled: true };
  if (status === 'declined') return { label: 'Not approved', cls: 'is-closed', disabled: true };
  if (event.status === 'cancelled') return { label: 'Cancelled', cls: 'is-closed', disabled: true };
  if (ended()) return { label: 'Ended', cls: 'is-closed', disabled: true };
  if (!registrationOpen()) return { label: 'Registration closed', cls: 'is-closed', disabled: true };
  const open = choices().filter((c) => c.status !== 'full' && c.status !== 'closed');
  if (!open.length) {
    return choices().some((c) => c.status === 'full') ? { label: 'Full', cls: 'is-closed', disabled: true }
      : { label: 'Registration closed', cls: 'is-closed', disabled: true };
  }
  const all = (s) => open.every((c) => c.status === s);
  return { label: joinLabel(all('waitlist') ? 'waitlist' : all('pending') ? 'pending' : 'going'), cls: '', disabled: false };
}

const joinLabel = (status) => (status === 'waitlist' ? 'Join waiting list' : status === 'pending' ? 'Request to join' : 'Register');

// Ticket types (Phase 2) and what joining each gives now; one choice with no type when the event has none.
const types = () => event.ticketTypes || [];
const choices = () => (types().length ? types() : [null])
  .map((t) => ({ t, status: typeOpen(t) ? joinStatus(event, t) : 'closed' }));
const priceText = (t) => (t?.paid ? `S$${Number(t.amountOnSite || 0).toLocaleString('en-SG')}, paid at the event` : 'Free');

function choiceLine({ t, status }) {
  if (status === 'closed') {
    const opens = t.opensAt && t.opensAt.toMillis() > Date.now() ? t.opensAt.toDate() : null;
    return opens ? `Opens ${shortDay(opens)}` : 'Registration closed';
  }
  return { full: 'Full', waitlist: 'Waiting list', pending: 'Requires approval', going: 'Instant registration' }[status];
}

// More than one ticket type: the volunteer picks one in a sheet, then joins with it.
function pickTicket() {
  const sheet = openModal({ title: 'Choose a ticket', body: `<div class="radio-card">${choices().map((c) => {
    const off = c.status === 'full' || c.status === 'closed';
    return `<button type="button" class="radio-row" data-ticket="${esc(c.t.id)}"${off ? ' disabled' : ''}>
      <span class="radio-text"><span class="radio-title">${esc(c.t.name)}</span>
        ${c.t.description ? `<span class="meta">${esc(c.t.description)}</span>` : ''}
        <span class="meta">${esc(`${priceText(c.t)} · ${choiceLine(c)}`)}</span></span></button>`;
  }).join('')}</div>` });
  sheet.element.addEventListener('click', (e) => {
    const row = e.target.closest('[data-ticket]');
    if (!row) return;
    sheet.close();
    startJoin(row.dataset.ticket);
  });
}

// Registration questions (Phase 2), read once the page is up; asked in a sheet before joining.
const questionsReady = listQuestions(eventId).catch(() => []);

async function startJoin(ticketTypeId) {
  const questions = await questionsReady;
  if (questions.length) askQuestions(ticketTypeId, questions);
  else await join(ticketTypeId);
}

function questionField(q) {
  const name = esc(q.id), req = q.required ? ' required' : '';
  const label = `<span class="ans-label">${esc(questionLabel(q))}${q.required ? '' : '<span class="ans-opt">Optional</span>'}</span>`;
  const input = (type, extra = '') => `<label class="ans">${label}<input class="field-flat" type="${type}" name="${name}" maxlength="300"${extra}${req}></label>`;
  if (q.type === 'age') {
    return `<label class="ans">${label}<select class="field-flat" name="${name}"${req}><option value=""></option>
      ${AGE_GROUPS.map((g) => `<option>${esc(g)}</option>`).join('')}</select></label>`;
  }
  if (q.type === 'options') {
    return `<fieldset class="ans"><legend class="ans-label">${esc(q.text)}${q.required ? '' : '<span class="ans-opt">Optional</span>'}</legend>
      ${(q.options || []).map((o) => `<label class="ans-choice"><input type="radio" name="${name}" value="${esc(o)}"${req}>${esc(o)}</label>`).join('')}</fieldset>`;
  }
  if (q.type === 'checkbox') return `<label class="ans-choice"><input type="checkbox" name="${name}"${req}>${esc(q.text)}</label>`;
  if (q.type === 'terms') {
    const terms = /^https:\/\/\S+$/.test(q.text) ? `<a href="${esc(q.text)}" target="_blank" rel="noopener noreferrer">${esc(q.text)}</a>` : esc(q.text);
    return `<div class="ans"><span class="ans-label">Terms</span><p class="ans-terms">${terms}</p>
      <label class="ans-choice"><input type="checkbox" name="${name}"${req}>I agree</label></div>`;
  }
  if (q.type === 'mobile') return input('tel', ' inputmode="tel" autocomplete="tel"');
  if (q.type === 'link' || q.type === 'linkedin') return input('url', ' inputmode="url"');
  if (q.type === 'emergency') return input('text', ' placeholder="Name and mobile number"');
  return input('text');
}

function askQuestions(ticketTypeId, questions) {
  const sheet = openModal({ title: 'Registration questions', body: `<form class="ans-form" id="answers">
    ${questions.map(questionField).join('')}
    <button type="submit" class="big-btn">${esc(joinLabel(choices().find((c) => (c.t?.id || null) === ticketTypeId)?.status))}</button></form>` });
  sheet.element.querySelector('#answers').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const answers = {};
    for (const q of questions) {
      if (q.type === 'checkbox' || q.type === 'terms') answers[q.id] = form.get(q.id) === 'on';
      else if (String(form.get(q.id) || '').trim()) answers[q.id] = String(form.get(q.id)).trim().slice(0, 300);
    }
    sheet.close();
    join(ticketTypeId, answers);
  });
}

async function join(ticketTypeId, answers = {}) {
  await run(async () => {
    const status = await joinEvent(eventId, user.uid, profile.name || user.email, ticketTypeId, { answers, email: user.email || '' });
    if (status === 'full') toast('This event just filled up.');
  }, 'Couldn’t register.');
}

const menuItem = (action, label, iconName, sep = false) =>
  `<button type="button" role="menuitem" class="menu-item${sep ? ' sep' : ''}" data-action="${action}">${esc(label)}${icon(iconName, 18, 2)}</button>`;

function menu() {
  if (!menuOpen) return '';
  const items = isAdmin
    ? [`<a role="menuitem" class="menu-item" href="create.html?id=${encodeURIComponent(eventId)}">Edit event${icon('edit', 18, 2)}</a>`,
      menuItem('calendar', 'Add to calendar', 'newEvent', true)]
    : [menuItem('calendar', 'Add to calendar', 'newEvent')];
  items.push(menuItem('share', 'Share event link', 'link'), menuItem('qr', 'Event QR code', 'qr'));
  if (!isAdmin && ACTIVE.includes(reg?.status) && !ended()) items.push(menuItem('cancel', 'Cancel my registration', 'cancel', true));
  return `<div class="menu" role="menu" id="event-menu">${items.join('')}</div>`;
}

const moreButton = (cls) =>
  `<button type="button" class="act ${cls}" data-action="menu" aria-haspopup="true" aria-expanded="${menuOpen}">${icon('more', 20, 2.4)}More</button>`;

function actions() {
  if (isAdmin) {
    const soon = (iconName, label) => `<span class="act" aria-disabled="true">${icon(iconName, 20, 2)}<span>${label}</span><span class="soon">Soon</span></span>`;
    return `<div class="act-row">${soon('invite', 'Invite')}
      <a class="act" href="announcements.html?id=${encodeURIComponent(eventId)}">${icon('message', 20, 2)}Message</a>
      <a class="act" href="manage.html?id=${encodeURIComponent(eventId)}">${icon('manage', 20, 2)}Manage</a>${moreButton('')}${menu()}</div>
      ${checkinBar()}`;
  }
  const b = joinButton();
  return `<div class="act-row">
      <button type="button" class="reg-btn ${b.cls}" data-action="join"${b.disabled || busy ? ' disabled' : ''}>${b.check ? icon('check', 18, 2.6) : ''}${esc(b.label)}</button>
      <a class="act act-narrow" href="${orgHref()}#contact">${icon('mail', 20, 2)}Contact</a>${moreButton('act-narrow')}${menu()}
    </div>${role ? checkinBar() : ''}`;
}

const checkinBar = () => `<a class="checkin-bar" href="checkin.html?id=${encodeURIComponent(eventId)}">
  <span>${icon('checkin', 20, 2)}Check in volunteers</span><span class="meta">${event.counts?.going || 0} going</span></a>`;

function locationCard() {
  const hidden = event.hideExactLocation && !venue;
  const title = hidden ? `${area()}, Singapore` : (venue || event.venue || 'Venue to be confirmed');
  const sub = hidden ? 'Exact address is shared with approved volunteers' : `${area()}, Singapore`;
  return `<div class="stack-6"><div class="lbl">Location</div>
    <div class="glass loc-card"><span class="loc-title">${esc(title)}</span><span class="loc-sub">${esc(sub)}</span></div></div>`;
}

function details() {
  // The on-site amount: of the volunteer's own ticket type once registered, otherwise of the event's only type.
  const mine = reg && ACTIVE.includes(reg.status) ? ticketFor(event, reg.ticketTypeId) : null;
  const shown = mine || (types().length === 1 ? types()[0] : null);
  const rows = [
    ['dollar', mine && types().length > 1 ? mine.name : 'Price', shown?.paid ? priceText(shown) : ''],
    ['pin', 'Meeting point', event.meetingPoint],
    ['bag', 'What to bring', event.bring],
    ['clock', 'Volunteer hours', event.hours ? `${hoursText(event.hours)} counted after the organisation confirms you attended` : ''],
  ].filter(([, , value]) => value);
  if (!rows.length) return '';
  return `<div class="glass detail-card">${rows.map(([iconName, label, value]) => `<div class="detail-row">
    <span class="detail-ic">${icon(iconName, 18, 2)}</span>
    <span class="detail-text"><span class="detail-label">${label}</span><span class="detail-value">${esc(value)}</span></span></div>`).join('')}</div>`;
}

function whoIsGoing() {
  const count = event.counts?.going || 0;
  const capacity = event.registration?.capacity;
  let line = 'Be the first to register.';
  if (count) {
    const [a, b] = going;
    if (count === 1 || !a) line = `${a || '1 person'} is going`;
    else if (count === 2 && b) line = `${a}, ${b} are going`;
    else {
      const others = count - (b ? 2 : 1);
      line = `${a}${b ? `, ${b}` : ''} and ${others} ${others === 1 ? 'other' : 'others'} are going`;
    }
    line += capacity ? `. ${Math.max(0, capacity - count)} of ${capacity} spots left.` : '.';
  }
  const faces = going.slice(0, Math.min(5, count)).map((name, i) =>
    `<span class="face" style="background:var(--avatar-${(i % 9) + 1})" aria-hidden="true">${esc(initials(name))}</span>`).join('');
  const countLink = role
    ? `<a class="sec-link" href="volunteers.html?id=${encodeURIComponent(eventId)}">${count} going${icon('chevron')}</a>`
    : `<span class="sec-link">${count} going</span>`;
  return `<div class="stack-6"><div class="lbl-row"><span class="lbl">Who’s going</span>${countLink}</div>
    <div class="glass going-card">${faces ? `<span class="faces">${faces}</span>` : ''}<span class="going-line">${esc(line)}</span></div></div>`;
}

function hostedBy() {
  const on = follows.has(event.orgId);
  return `<div class="stack-6"><div class="lbl">Hosted by</div><div class="glass host-card">
    <a class="host-link" href="${orgHref()}">${orgDotHtml(org || { name: orgName() })}
      <span class="host-text"><span class="host-name">${esc(orgName())}</span>${org?.tagline ? `<span class="meta">${esc(org.tagline)}</span>` : ''}</span></a>
    <button type="button" class="follow-btn hit" data-action="follow" aria-pressed="${on}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(orgName())}">${on ? 'Following' : 'Follow'}</button>
  </div></div>`;
}

function render() {
  const [chipText, chipCls] = statusChip();
  const needsApproval = choices().every((c) => approvalFor(event, c.t)) && !ACTIVE.includes(reg?.status) && !isAdmin;
  document.title = `${event.title} · The Events`;
  main.innerHTML = `
    <div class="top-row">
      <a class="ib" href="index.html" data-action="back" aria-label="Back">${icon('back', 20)}</a>
      <button type="button" class="ib" data-action="menu" aria-label="Share event" aria-haspopup="true">${icon('share', 20, 2)}</button>
    </div>
    <div class="ev-cover-wrap">${coverHtml(event, 350, 24, 34)}
      <span class="cover-chip">${icon('pin', 14, 2)}${esc(CAUSES[event.cause] || 'Cause')} · ${esc(area())}</span></div>
    <div class="ev-head">
      <h1>${esc(event.title)}</h1>
      <a class="org-chip" href="${orgHref()}">${orgDotHtml(org || { name: orgName() })}${esc(orgName())}${icon('chevron', 14)}</a>
      <div class="ev-when">${esc(whenLine())}</div>
      <div class="status-row"><span class="chip ${chipCls}">${esc(chipText)}</span>${needsApproval ? '<span class="meta-note">Approval required</span>' : ''}</div>
    </div>
    ${actions()}
    ${notesHtml()}
    ${locationCard()}
    ${details()}
    ${event.description ? `<div class="stack-6"><div class="lbl">About this event</div><div class="glass about-card">${esc(event.description)}</div></div>` : ''}
    ${whoIsGoing()}
    ${hostedBy()}`;
  if (menuOpen) main.querySelector('#event-menu .menu-item')?.focus();
}

// Add to calendar: an .ics file for the event.
function downloadCalendar() {
  const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const text = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const fold = (line) => {
    const out = [];
    let current = '', size = 0;
    for (const ch of line) {
      const bytes = new TextEncoder().encode(ch).length;
      if (size + bytes > (out.length ? 74 : 75)) { out.push(current); current = ''; size = 0; }
      current += ch;
      size += bytes;
    }
    return [...out, current].join('\r\n ');
  };
  const where = event.hideExactLocation && !venue ? `${area()}, Singapore` : venue || event.venue || '';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${eventId}@the-events`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.startAt.toDate())}`, `DTEND:${stamp(event.endAt.toDate())}`,
    `SUMMARY:${text(event.title)}`, `LOCATION:${text(where)}`,
    `DESCRIPTION:${text(`${event.description || ''}\n\n${location.href}`)}`, `URL:${location.href}`,
    'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  link.download = `${event.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'event'}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function shareLink() {
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title: event.title, url }); } catch (err) { if (err.name !== 'AbortError') toast('Couldn’t share the link.'); }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    toast('Couldn’t copy the link.');
  }
}

function showEventQr() {
  openModal({ kind: 'dialog', title: 'Event QR code', body: `<span class="qr-box">${qrSvg(location.href, 'Event link')}</span>
    <span class="qr-name">${esc(event.title)}</span>` });
}

async function run(task, failure) {
  busy = true;
  render();
  try { await task(); } catch (err) { console.warn(err); toast(failure); }
  busy = false;
  await refresh().catch(() => render());
}

main.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'back') {
    if (document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
    return;
  }
  if (action === 'menu') { menuOpen = !menuOpen; render(); return; }
  if (['calendar', 'share', 'qr', 'cancel'].includes(action)) { menuOpen = false; render(); }
  if (action === 'calendar') downloadCalendar();
  if (action === 'share') shareLink();
  if (action === 'qr') showEventQr();
  if (action === 'cancel') {
    await run(async () => { await cancelRegistration(eventId, user.uid); toast('Registration cancelled'); }, 'Couldn’t cancel the registration.');
  }
  if (action === 'join' && !busy) {
    if (types().length > 1) pickTicket();
    else await startJoin(types()[0]?.id || null);
  }
  if (action === 'follow') {
    const on = follows.has(event.orgId);
    try {
      await (on ? unfollowOrg : followOrg)(user.uid, event.orgId);
      if (on) follows.delete(event.orgId); else follows.add(event.orgId);
    } catch (err) {
      console.warn(err);
      toast('Couldn’t update that.');
    }
    render();
  }
});

document.addEventListener('click', (e) => {
  if (menuOpen && !e.target.closest('.act-row, [data-action="menu"]')) { menuOpen = false; render(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuOpen) { menuOpen = false; render(); main.querySelector('[data-action="menu"]')?.focus(); }
});

reg = await getMyRegistration(eventId, user.uid).catch(() => null);
[going, venue, notes] = await Promise.all([listGoing(eventId).catch(() => []), loadVenue(), loadNotes()]);
render();
if (notes.length && !role) markSeen(eventId);

// Opened from the organiser's check-out code (event.html?id=…&checkout=…): confirm this volunteer's hours, or claim them.
const checkoutCode = new URLSearchParams(location.search).get('checkout');
if (checkoutCode) {
  history.replaceState(null, '', `event.html?id=${encodeURIComponent(eventId)}`);
  if (reg?.status === 'going') {
    try {
      const result = await checkOutWithCode(eventId, user.uid, checkoutCode);
      if (result.status === 'confirmed') await syncHours(user.uid).catch(() => 0);
      toast(checkOutText(result, event.orgName));
    } catch (err) {
      if (err.code === 'not-started') toast('This event hasn’t started yet.');
      else { console.warn(err); toast('That check-out code didn’t work.'); }
    }
  } else {
    toast('Check-out is for volunteers who are going.');
  }
}
dragScroll(document.scrollingElement, 'y');
reveal();
