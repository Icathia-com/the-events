// Create and edit an event (design/Event-Create.dc.html); create.html?id= edits one.
// Photo covers need Cloud Storage (Phase 2), so covers are a colour gradient for now. "Notify followers" is
// stored; notifications are sent from Phase 3.
import { requireUser } from '../auth.js';
import { AREAS, CAUSES, createEvent, getEvent, getEventRole, getOrganisation, myMemberships, updateEvent } from '../data.js';
import { Timestamp } from '../firebase.js';
import { addDays, coverHtml, coverLabel, dayStart, dragScroll, esc, icon, orgDotHtml, reveal, toast, TZ, zonedDate, zonedParts } from '../ui.js';

const COVERS = [['#7A3E2A', '#D08A5E'], ['#2E5C44', '#5FA37B'], ['#1F4E6E', '#5B9BC2'], ['#8A5A1E', '#D9A24A'], ['#5A3E7A', '#9C7BC4'], ['#3E5A1E', '#8CB83E']];
const SPOTS = ['', '5', '10', '20', '50', '100'];
const DRAFT_KEY = 'theEvents.eventDraft';

const user = await requireUser();
const main = document.querySelector('main');
const editId = new URLSearchParams(location.search).get('id');

// The organisation: the event's when editing, otherwise the first one this person admins.
let org = null, existing = null;
if (editId) {
  existing = await getEvent(editId).catch(() => null);
  if (existing && (await getEventRole(existing, editId, user).catch(() => null)) === 'admin') {
    org = await getOrganisation(existing.orgId).catch(() => null);
  }
} else {
  const admin = (await myMemberships(user.uid).catch(() => [])).find((m) => m.role === 'admin');
  if (admin) org = await getOrganisation(admin.orgId).catch(() => null);
}

const back = (fallback) => `<a class="ib" href="${fallback}" data-action="back" aria-label="Back">${icon('back', 20)}</a>`;
if (!org) {
  main.innerHTML = `<div class="top-row">${back('index.html')}</div>
    <div class="glass empty-note">${editId ? 'Only the organisation’s admins can edit this event.' : 'Only organisation admins can create events.'}</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

const tz = org.timezone || TZ;
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } };
const writeDraft = (value) => { try { if (value) localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); else localStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ } };

function blank() {
  const day = zonedParts(addDays(dayStart(new Date(), tz), 7.5), tz).date;
  return { title: '', cover: 0, date: day, start: '09:00', endDate: day, end: '12:00', area: '', venue: '', meet: '', desc: '', bring: '',
    appr: false, paid: false, price: '', cause: org.causes?.[0] || 'food', vis: 'public', cap: '10', notify: true };
}

function fromEvent(e) {
  const s = zonedParts(e.startAt.toDate(), tz), f = zonedParts(e.endAt.toDate(), tz);
  const paid = (e.ticketTypes || []).find((t) => t.paid);
  return {
    title: e.title, cover: COVERS.findIndex(([a, b]) => a === e.cover?.colors?.[0] && b === e.cover?.colors?.[1]),
    date: s.date, start: s.time, endDate: f.date, end: f.time, area: e.area || '', venue: e.venue || '', meet: e.meetingPoint || '',
    desc: e.description || '', bring: e.bring || '', appr: !!e.registration?.approval, paid: !!paid, price: paid ? String(paid.amountOnSite || '') : '',
    cause: e.cause, vis: e.visibility, cap: e.registration?.capacity ? String(e.registration.capacity) : '', notify: !!e.notifyFollowers,
  };
}

let s = existing ? fromEvent(existing) : blank();
let hasDraft = !existing && Boolean(readDraft()?.title);

const colors = () => (s.cover >= 0 ? COVERS[s.cover] : existing.cover.colors);
// Keep a curated label while the title is unchanged; otherwise make one from the title.
const label = () => (existing && s.title === existing.title ? existing.cover.label : coverLabel(s.title || 'Your event'));

function form() {
  const spots = SPOTS.includes(s.cap) ? SPOTS : [...SPOTS, s.cap].sort((a, b) => Number(a) - Number(b));
  return `
    <header class="create-head">${back(editId ? `event.html?id=${encodeURIComponent(editId)}` : 'index.html')}
      <h1>${editId ? 'Edit event' : 'Create event'}</h1>
      <span class="org-pill">${orgDotHtml(org)}<span class="ellipsis">${esc(org.name)}</span></span></header>
    <div id="restore"></div>
    <div class="cover-edit"><span id="cover-preview"></span>
      <button type="button" class="cover-tool" data-action="cover" aria-label="Change cover colour">${icon('palette', 19, 2)}</button></div>
    <input class="name-input" id="title" aria-label="Event name" placeholder="Event name" maxlength="120" value="${esc(s.title)}">
    <div class="form-card time-card">
      <div class="time-line" aria-hidden="true"><span class="time-dot"></span><span class="time-dash"></span><span class="time-dot is-end"></span></div>
      <div class="time-rows">
        <div class="form-row is-static"><span class="row-label">Start</span>
          <input type="date" class="pill-input is-date" id="date" aria-label="Start date" value="${esc(s.date)}">
          <input type="time" class="pill-input is-time" id="start" aria-label="Start time" value="${esc(s.start)}"></div>
        <div class="form-row is-static"><span class="row-label">End</span>
          <input type="date" class="pill-input is-date" id="endDate" aria-label="End date" value="${esc(s.endDate)}">
          <input type="time" class="pill-input is-time" id="end" aria-label="End time" value="${esc(s.end)}"></div>
      </div>
    </div>
    <div class="form-card">
      <button type="button" class="form-row" data-action="loc" aria-expanded="false" aria-controls="loc-sub">${icon('pin', 20, 2)}<span class="row-label ellipsis" id="loc-label"></span>${icon('chevron', 16)}</button>
      <div class="form-sub" id="loc-sub" hidden>
        <div class="area-chips" id="areas" role="group" aria-label="Area">${Object.entries(AREAS).map(([id, l]) =>
          `<button type="button" class="area-chip" data-area="${id}" aria-pressed="false">${esc(l)}</button>`).join('')}</div>
        <input class="pill-input" id="venue" aria-label="Venue or address" placeholder="Venue or address" maxlength="200" value="${esc(s.venue)}">
        <input class="pill-input" id="meet" aria-label="Meeting point" placeholder="Meeting point" maxlength="200" value="${esc(s.meet)}">
      </div>
    </div>
    <div class="form-card">
      <button type="button" class="form-row" data-action="desc" aria-expanded="false" aria-controls="desc-sub">${icon('doc', 20, 2)}<span class="row-label ellipsis" id="desc-label"></span>${icon('chevron', 16)}</button>
      <div class="form-sub" id="desc-sub" hidden>
        <textarea class="field-area" id="desc" aria-label="Description" placeholder="Description" maxlength="5000">${esc(s.desc)}</textarea>
        <input class="pill-input" id="bring" aria-label="What to bring" placeholder="What to bring" maxlength="300" value="${esc(s.bring)}">
      </div>
    </div>
    <div class="form-heading">Registration</div>
    <div class="form-card">
      <div class="form-row is-static">${icon('lock', 19, 2)}<span class="row-label">Require approval</span>
        <button type="button" class="switch" role="switch" id="appr" aria-label="Require approval"></button></div>
      <button type="button" class="form-row" data-action="price">${icon('dollar', 19, 2)}<span class="row-label">Price</span><span class="row-value" id="price-label"></span>${icon('chevron', 16)}</button>
      <label class="form-row is-static" id="price-row" hidden><span class="row-label row-indent">Amount (S$)</span>
        <input type="number" min="1" step="1" inputmode="numeric" class="pill-input is-amount" id="price" aria-label="Amount collected on site, in Singapore dollars" value="${esc(s.price)}"></label>
    </div>
    <div class="form-heading">Options</div>
    <div class="form-card">
      <label class="form-row is-static">${icon('tag', 19, 2)}<span class="row-label">Cause</span>
        <select class="select-plain" id="cause">${Object.entries(CAUSES).map(([id, l]) => `<option value="${id}"${s.cause === id ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${icon('updown', 16)}</label>
      <label class="form-row is-static">${icon('globe', 19, 2)}<span class="row-label">Visibility</span>
        <select class="select-plain" id="vis">${[['public', 'Public'], ['followers', 'Followers only'], ['draft', 'Draft']].map(([id, l]) => `<option value="${id}"${s.vis === id ? ' selected' : ''}>${l}</option>`).join('')}</select>${icon('updown', 16)}</label>
      <label class="form-row is-static">${icon('spots', 19, 2)}<span class="row-label">Volunteer spots</span>
        <select class="select-plain" id="cap">${spots.map((v) => `<option value="${v}"${s.cap === v ? ' selected' : ''}>${v || 'Unlimited'}</option>`).join('')}</select>${icon('updown', 16)}</label>
      <div class="form-row is-static">${icon('notifications', 19, 2)}<span class="row-label">Notify followers</span>
        <button type="button" class="switch" role="switch" id="notify" aria-label="Notify followers"></button></div>
    </div>
    <button type="button" class="big-btn" id="save">${editId ? 'Save' : 'Create'}</button>`;
}

const $ = (id) => document.getElementById(id);

function sync() {
  $('cover-preview').innerHTML = coverHtml({ cover: { colors: colors(), label: label() } }, 270, 26, 30);
  const loc = s.area ? `${AREAS[s.area]}${s.venue ? ` · ${s.venue}` : ''}` : s.venue;
  $('loc-label').textContent = loc || 'Choose location';
  $('loc-label').classList.toggle('is-empty', !loc);
  const firstLine = s.desc.split('\n')[0];
  $('desc-label').textContent = firstLine || 'Add description';
  $('desc-label').classList.toggle('is-empty', !firstLine);
  $('areas').querySelectorAll('[data-area]').forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.area === s.area)));
  $('price-label').textContent = s.paid ? (Number(s.price) > 0 ? `S$${s.price}` : 'Paid') : 'Free';
  $('price-row').hidden = !s.paid;
  $('appr').setAttribute('aria-checked', String(s.appr));
  $('notify').setAttribute('aria-checked', String(s.notify));
  $('save').disabled = !s.title.trim();
  $('restore').innerHTML = hasDraft && !s.title ? `<div class="restore-pill">
    <button type="button" data-action="restore">${icon('restore', 16, 2)}Restore draft?</button>
    <button type="button" class="restore-x" data-action="dismiss" aria-label="Dismiss draft">${icon('close', 14, 2.4)}</button></div>` : '';
  if (!existing && s.title) writeDraft(s);
}

function showForm() {
  main.innerHTML = form();
  sync();
}

const FIELD_IDS = ['title', 'date', 'start', 'endDate', 'end', 'venue', 'meet', 'desc', 'bring', 'price', 'cause', 'vis', 'cap'];
main.addEventListener('input', (e) => {
  if (!FIELD_IDS.includes(e.target.id)) return;
  s[e.target.id] = e.target.value;
  if (e.target.id === 'date' && s.endDate < s.date) { s.endDate = s.date; $('endDate').value = s.date; }
  sync();
});

main.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-action], [data-area], .switch, #save');
  if (!target) return;
  if (target.dataset.area) { s.area = target.dataset.area; sync(); return; }
  if (target.classList.contains('switch')) { s[target.id] = !s[target.id]; sync(); return; }
  if (target.id === 'save') { await save(); return; }
  const action = target.dataset.action;
  if (action === 'back' && document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
  if (action === 'cover') { s.cover = (s.cover + 1) % COVERS.length; sync(); }
  if (action === 'loc' || action === 'desc') {
    const sub = $(`${action}-sub`), open = sub.hidden;
    sub.hidden = !open;
    target.setAttribute('aria-expanded', String(open));
    if (open) sub.querySelector('input, textarea')?.focus();
  }
  if (action === 'price') { s.paid = !s.paid; sync(); if (s.paid) $('price').focus(); }
  if (action === 'restore') { s = { ...blank(), ...readDraft() }; hasDraft = false; showForm(); }
  if (action === 'dismiss') { writeDraft(null); hasDraft = false; sync(); }
  if (action === 'again') { s = blank(); hasDraft = false; showForm(); $('title').focus(); }
});

async function save() {
  const title = s.title.trim();
  if (!title) return;
  if (!s.date || !s.start || !s.endDate || !s.end) { toast('Add a start and an end.'); return; }
  const startAt = zonedDate(s.date, s.start, tz), endAt = zonedDate(s.endDate, s.end, tz);
  if (!(endAt > startAt)) { toast('The end needs to be after the start.'); return; }
  const hours = Math.round((endAt - startAt) / 900e3) / 4;
  if (hours > 24) { toast('An event can last up to 24 hours.'); return; }
  if (s.paid && !(Number(s.price) >= 1)) { toast('Add the amount collected on site.'); return; }

  const fields = {
    title, description: s.desc.trim(), cause: s.cause, area: s.area || 'islandwide',
    venue: s.venue.trim(), meetingPoint: s.meet.trim(), bring: s.bring.trim(),
    startAt: Timestamp.fromDate(startAt), endAt: Timestamp.fromDate(endAt), hours,
    cover: { colors: colors(), label: label() }, visibility: s.vis,
    registration: { ...(existing?.registration || { open: true, waitlist: true, group: false }), approval: s.appr, capacity: s.cap ? Number(s.cap) : null },
    ticketTypes: ticketTypes(),
    notifyFollowers: s.notify,
  };
  // Ticket types from Access and registration are kept. With one type, the form's price and approval update it;
  // with several, they're set per type there.
  function ticketTypes() {
    const list = existing?.ticketTypes || [];
    if (list.length > 1) return list;
    if (!list.length && !s.paid) return [];
    const { amountOnSite: _old, ...type } = list[0] || { id: 'standard', name: 'Standard', description: '' };
    return [{ ...type, paid: s.paid, ...(s.paid ? { amountOnSite: Number(s.price) } : {}), approval: s.appr }];
  }
  $('save').disabled = true;
  try {
    if (existing) {
      await updateEvent(editId, fields);
      location.replace(`event.html?id=${encodeURIComponent(editId)}`);
      return;
    }
    const id = await createEvent(org, user.uid, fields);
    writeDraft(null);
    const line = s.vis === 'draft' ? 'Saved as a draft. Only your organisation can see it.'
      : s.vis === 'followers' ? 'Volunteers who follow you can see it in Events.' : 'Every volunteer can see it in Events.';
    main.innerHTML = `<header class="create-head">${back('index.html')}<h1>Event created</h1>
        <span class="org-pill">${orgDotHtml(org)}<span class="ellipsis">${esc(org.name)}</span></span></header>
      <div class="glass done-card">
        <span class="done-ic">${icon('check', 30, 2.6)}</span>
        <span class="done-title">${esc(title)}</span>
        <span class="done-line">${line}</span>
        <a class="btn btn-primary" href="event.html?id=${encodeURIComponent(id)}">View event</a>
        <a class="btn btn-secondary" href="index.html">Back to Home</a>
        <button type="button" class="text-btn" data-action="again">Create another</button>
      </div>`;
  } catch (err) {
    console.warn(err);
    toast('Couldn’t save the event.');
    $('save').disabled = false;
  }
}

showForm();
dragScroll(document.scrollingElement, 'y');
reveal();
