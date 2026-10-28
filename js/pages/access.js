// Access and registration (design/Access.dc.html), for the organisation's admins: visibility, accepting
// registrations, volunteer spots and the waiting list, group registration, and ticket types.
import { requireUser } from '../auth.js';
import { Timestamp } from '../firebase.js';
import { getEvent, getMyRole, updateEvent } from '../data.js';
import { dragScroll, esc, icon, openModal, reveal, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
let event = eventId ? await getEvent(eventId).catch(() => null) : null;
const role = event ? await getMyRole(event.orgId, user.uid).catch(() => null) : null;
const q = `?id=${encodeURIComponent(eventId)}`;

if (!event || role !== 'admin') {
  main.innerHTML = `<div class="top-row"><a class="ib" href="${event ? `manage.html${q}` : 'index.html'}" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">Only the organisation’s admins can change this.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

const VIS = [
  ['public', 'Public', 'Listed in Events and on your organisation page.'],
  ['followers', 'Followers only', 'Only volunteers who follow your organisation can see it. Not listed in Events.'],
  ['draft', 'Draft', 'Only your organisation can see it.'],
];

const reg = () => event.registration || {};
// An event made without ticket types is shown with one Standard type, from its approval setting.
const types = () => (event.ticketTypes?.length ? event.ticketTypes
  : [{ id: 'standard', name: 'Standard', description: '', paid: false, approval: !!reg().approval }]);

async function save(fields, done = 'Saved') {
  try {
    await updateEvent(eventId, fields);
    event = await getEvent(eventId);
    render();
    if (done) toast(done);
    return true;
  } catch (err) {
    console.warn(err);
    toast('Couldn’t save that.');
    return false;
  }
}
const saveRegistration = (patch) => save({ registration: { ...reg(), ...patch } });

const switchHtml = (id, on, label) => `<button type="button" class="switch" role="switch" data-switch="${id}" aria-checked="${on}" aria-label="${esc(label)}"></button>`;

function capText() {
  const { capacity, waitlist } = reg();
  if (!capacity) return ['Unlimited', 'Anyone can register until you close registrations.'];
  return [`${capacity} spots`, waitlist ? `A waiting list opens when the ${capacity} spots are filled.` : `Registration closes when the ${capacity} spots are filled.`];
}

function ticketRow(t, i) {
  const line = `${t.approval ? 'Requires approval' : 'Instant registration'}${t.capacity ? ` · ${t.capacity} spots` : ''}`;
  return `<button type="button" class="form-row is-ticket" data-ticket="${i}">
    <span class="ticket-text"><span class="row-label">${esc(t.name)}</span>
      <span class="ticket-line"><span class="ticket-dot${t.approval ? ' is-wait' : ''}"></span>${esc(line)}</span></span>
    <span class="row-value">${esc(t.paid ? `S$${Number(t.amountOnSite || 0).toLocaleString('en-SG')} on site` : 'Free')}</span>${icon('chevron', 16)}</button>`;
}

function render() {
  const vis = VIS.find(([id]) => id === event.visibility) || VIS[0];
  const [capLabel, capHelp] = capText();
  const soon = (iconName, label) => `<div class="form-row is-static is-soon" aria-disabled="true">${icon(iconName, 19, 2)}<span class="row-label">${label}<span class="soon">Soon</span></span></div>`;
  main.innerHTML = `
    <header class="mg-head"><a class="ib" href="manage.html${q}" aria-label="Back to Manage event">${icon('back', 20)}</a>
      <span class="mg-head-text"><h1>Access and registration</h1></span></header>
    <div class="stack-6"><div class="form-card">
      <button type="button" class="form-row" data-action="vis">${icon('globe', 19, 2)}<span class="row-label">Visibility</span><span class="row-value">${vis[1]}</span>${icon('chevron', 16)}</button>
    </div><p class="help">${esc(vis[2])}</p></div>
    <div class="stack-6"><div class="form-card">
      <div class="form-row is-static">${icon('checkin', 19, 2)}<span class="row-label">Accept registrations</span>${switchHtml('open', !!reg().open, 'Accept registrations')}</div>
      <button type="button" class="form-row" data-action="spots">${icon('organisations', 19, 2)}<span class="row-label">Volunteer spots</span><span class="row-value">${esc(capLabel)}</span>${icon('chevron', 16)}</button>
    </div><p class="help">${esc(capHelp)}</p></div>
    <div class="form-card">
      <div class="form-row is-static is-tall">${icon('organisations', 19, 2)}<span class="ticket-text"><span class="row-label">Group registration</span>
        <span class="meta">One person can register a group, for example a company team</span></span>${switchHtml('group', !!reg().group, 'Group registration')}</div>
    </div>
    <div class="stack-6">
      <div class="lbl-row"><span class="lbl">Ticket types</span>
        <button type="button" class="add-btn hit" data-action="add-ticket" aria-label="Add a ticket type">${icon('plus', 16, 2.4)}</button></div>
      <div class="form-card">${types().map(ticketRow).join('')}</div>
    </div>
    <div class="form-card">${soon('voucher', 'Vouchers and access codes')}${soon('doc', 'Registration questions')}</div>`;
}

function visibilitySheet() {
  const sheet = openModal({ title: 'Event visibility', body: `<div class="radio-card" role="radiogroup" aria-label="Visibility">${VIS.map(([id, label, help]) =>
    `<button type="button" class="radio-row" role="radio" data-vis="${id}" aria-checked="${event.visibility === id}">
      <span class="radio-ring">${event.visibility === id ? icon('check', 14, 3) : ''}</span>
      <span class="radio-text"><span class="radio-title">${label}</span><span class="meta">${esc(help)}</span></span></button>`).join('')}</div>` });
  sheet.element.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-vis]');
    if (!row || row.dataset.vis === event.visibility) return;
    sheet.close();
    await save({ visibility: row.dataset.vis });
  });
}

function spotsSheet() {
  const r = reg();
  const sheet = openModal({ title: 'Volunteer spots', body: `<div class="form-card is-flat">
      <div class="form-row is-static"><span class="row-label">Limit spots</span>${switchHtml('limit', r.capacity != null, 'Limit spots')}</div>
      <label class="form-row is-static" id="cap-row"${r.capacity != null ? '' : ' hidden'}><span class="row-label">Spots</span>
        <input type="number" min="1" max="10000" step="1" inputmode="numeric" class="pill-input is-amount" id="cap" aria-label="Spots" value="${r.capacity ?? 10}"></label>
      <div class="form-row is-static is-tall"><span class="ticket-text"><span class="row-label">Waiting list when full</span>
        <span class="meta">Volunteers can join a waiting list and are moved up if someone drops out</span></span>${switchHtml('waitlist', !!r.waitlist, 'Waiting list when full')}</div>
    </div>
    <button type="button" class="big-btn" data-action="save-spots">Save</button>` });
  const box = sheet.element;
  box.addEventListener('click', async (e) => {
    const sw = e.target.closest('[data-switch]');
    if (sw) {
      sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true'));
      if (sw.dataset.switch === 'limit') box.querySelector('#cap-row').hidden = sw.getAttribute('aria-checked') !== 'true';
      return;
    }
    if (!e.target.closest('[data-action="save-spots"]')) return;
    const limited = box.querySelector('[data-switch="limit"]').getAttribute('aria-checked') === 'true';
    const cap = Number(box.querySelector('#cap').value);
    if (limited && !(Number.isInteger(cap) && cap >= 1 && cap <= 10000)) { toast('Spots need to be a whole number from 1 to 10,000.'); return; }
    const waitlist = box.querySelector('[data-switch="waitlist"]').getAttribute('aria-checked') === 'true';
    if (await saveRegistration({ capacity: limited ? cap : null, waitlist })) sheet.close();
  });
}

// Registration dates are whole days in Singapore: open from the start of the first, closed after the last.
const SG = '+08:00';
const toDay = (ts, back = 0) => ts ? new Date(ts.toMillis() - back + 8 * 3600e3).toISOString().slice(0, 10) : '';
const fromDay = (day, ahead = 0) => Timestamp.fromMillis(new Date(`${day}T00:00:00${SG}`).getTime() + ahead);

function ticketSheet(index) {
  const list = types();
  const t = index >= 0 ? list[index] : { name: '', description: '', paid: false, approval: false };
  const seg = (paid, label) => `<button type="button" class="seg-btn" data-paid="${paid}" aria-pressed="${!!t.paid === paid}">${label}</button>`;
  const sheet = openModal({ title: index >= 0 ? 'Edit ticket type' : 'New ticket type', body: `
    <input class="field-flat" id="tk-name" aria-label="Ticket type name" placeholder="Name" maxlength="40" value="${esc(t.name)}">
    <input class="field-flat" id="tk-desc" aria-label="Description" placeholder="Description" maxlength="200" value="${esc(t.description || '')}">
    <div class="lbl">Price</div>
    <div class="seg-row">${seg(false, 'Free')}${seg(true, 'Paid on site')}</div>
    <label class="amount-row" id="tk-amount-row"${t.paid ? '' : ' hidden'}><span class="meta">Amount collected at the event (S$)</span>
      <input type="number" min="1" step="1" inputmode="numeric" class="pill-input is-amount" id="tk-amount" aria-label="Amount collected at the event, in Singapore dollars" value="${t.amountOnSite ?? ''}"></label>
    <div class="form-card is-flat">
      <div class="form-row is-static"><span class="row-label">Require approval</span>${switchHtml('appr', !!t.approval, 'Require approval')}</div>
      <label class="form-row is-static"><span class="row-label">Spots for this type</span>
        <input type="number" min="1" max="10000" step="1" inputmode="numeric" class="pill-input is-amount" id="tk-cap" aria-label="Spots for this type" value="${t.capacity ?? ''}"></label>
      <label class="form-row is-static"><span class="row-label">Registration opens</span>
        <input type="date" class="pill-input is-date" id="tk-from" aria-label="Registration opens" value="${toDay(t.opensAt)}"></label>
      <label class="form-row is-static"><span class="row-label">Registration closes</span>
        <input type="date" class="pill-input is-date" id="tk-to" aria-label="Registration closes" value="${toDay(t.closesAt, 86400e3)}"></label>
    </div>
    <div class="sheet-btns">${index >= 0 && list.length > 1 ? '<button type="button" class="ghost-btn is-danger" data-action="delete-ticket">Delete</button>' : ''}
      <button type="button" class="big-btn grow" data-action="save-ticket">Save</button></div>` });
  const box = sheet.element;
  const $ = (id) => box.querySelector(`#${id}`);
  const sync = () => { box.querySelector('[data-action="save-ticket"]').disabled = !$('tk-name').value.trim(); };
  $('tk-name').addEventListener('input', sync);
  sync();
  box.addEventListener('click', async (e) => {
    const paid = e.target.closest('[data-paid]');
    if (paid) {
      box.querySelectorAll('[data-paid]').forEach((b) => b.setAttribute('aria-pressed', String(b === paid)));
      $('tk-amount-row').hidden = paid.dataset.paid !== 'true';
      return;
    }
    const sw = e.target.closest('[data-switch]');
    if (sw) { sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true')); return; }
    if (e.target.closest('[data-action="delete-ticket"]')) {
      if (await save({ ticketTypes: list.filter((_, i) => i !== index) }, 'Ticket type deleted')) sheet.close();
      return;
    }
    if (!e.target.closest('[data-action="save-ticket"]')) return;
    const isPaid = box.querySelector('[data-paid="true"]').getAttribute('aria-pressed') === 'true';
    const amount = Number($('tk-amount').value), cap = $('tk-cap').value ? Number($('tk-cap').value) : null;
    const from = $('tk-from').value, to = $('tk-to').value;
    if (isPaid && !(Number.isInteger(amount) && amount >= 1)) { toast('Add the amount collected at the event.'); return; }
    if (cap != null && !(Number.isInteger(cap) && cap >= 1 && cap <= 10000)) { toast('Spots need to be a whole number from 1 to 10,000.'); return; }
    if (from && to && to < from) { toast('Registration needs to close after it opens.'); return; }
    const next = {
      id: t.id || `t${Date.now().toString(36)}`, name: $('tk-name').value.trim(), description: $('tk-desc').value.trim(),
      paid: isPaid, ...(isPaid ? { amountOnSite: amount } : {}),
      approval: box.querySelector('[data-switch="appr"]').getAttribute('aria-checked') === 'true',
      ...(cap != null ? { capacity: cap } : {}), ...(from ? { opensAt: fromDay(from) } : {}), ...(to ? { closesAt: fromDay(to, 86400e3) } : {}),
    };
    const ticketTypes = index >= 0 ? list.map((x, i) => (i === index ? next : x)) : [...list, next];
    if (ticketTypes.length > 10) { toast('An event can have up to 10 ticket types.'); return; }
    const approval = ticketTypes.every((x) => x.approval);
    if (await save({ ticketTypes, registration: { ...reg(), approval } })) sheet.close();
  });
}

main.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-action], [data-switch], [data-ticket]');
  if (!target) return;
  if (target.dataset.switch) {
    const on = target.getAttribute('aria-checked') !== 'true';
    target.setAttribute('aria-checked', String(on));
    await saveRegistration({ [target.dataset.switch]: on });
    return;
  }
  if (target.dataset.ticket) { ticketSheet(Number(target.dataset.ticket)); return; }
  const action = target.dataset.action;
  if (action === 'vis') visibilitySheet();
  if (action === 'spots') spotsSheet();
  if (action === 'add-ticket') ticketSheet(-1);
});

render();
dragScroll(document.scrollingElement, 'y');
reveal();
