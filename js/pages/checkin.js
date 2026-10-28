// Check-in (design/Check-In.dc.html): the organisation scans volunteers' personal QR codes. Standard shows who it is
// before checking them in; Express checks them in straight away. Check-in records arrival; the hours are confirmed
// at check-out. Admins set the default mode, lock it for staff, and invite staff by email.
import { requireUser } from '../auth.js';
import {
  checkIn, getEvent, getEventRole, getMyRole, getRegistration, inviteStaff, listAttendance, listStaff, listStaffInvites, removeStaff,
  setCheckInMode, withdrawInvite,
} from '../data.js';
import { openScanner } from '../scanner.js';
import { avatarHtml, dateParts, dragScroll, esc, icon, reveal, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
let event = eventId ? await getEvent(eventId).catch(() => null) : null;
const role = event ? await getEventRole(event, eventId, user).catch(() => null) : null;

if (!event || !role) {
  main.innerHTML = `<div class="top-row"><a class="ib" href="index.html" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">Only the organisation’s members can check volunteers in.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

const isAdmin = role === 'admin';
// Check-in staff belong to the organisation, so only its own members see them and only its admins change them.
const orgRole = await getMyRole(event.orgId, user.uid).catch(() => null);
const orgAdmin = orgRole === 'admin';
const q = `?id=${encodeURIComponent(eventId)}`;
let mode = event.checkInMode === 'express' ? 'express' : 'standard';
let staff = [], invites = [], attendance = [], addOpen = false;

async function load() {
  [attendance, staff, invites] = await Promise.all([
    listAttendance(eventId).catch(() => []),
    orgRole ? listStaff(event.orgId).catch(() => []) : [],
    orgAdmin ? listStaffInvites(event.orgId).catch(() => []) : [],
  ]);
}

const radio = (value, title, sub) => {
  const disabled = !isAdmin && event.checkInLocked;
  return `<button type="button" class="radio-row" role="radio" data-mode="${value}" aria-checked="${mode === value}"${disabled ? ' disabled' : ''}>
    <span class="radio-ring">${mode === value ? icon('check', 14, 3) : ''}</span>
    <span class="radio-text"><span class="radio-title">${title}</span><span class="meta">${sub}</span></span></button>`;
};

function staffRows() {
  const rows = [
    ...staff.map((s) => ({ key: s.id, name: s.name || 'Staff', line: 'Can scan and mark attendance', action: 'remove' })),
    ...invites.map((i) => ({ key: i.id, name: i.email, line: 'Invited', action: 'withdraw' })),
  ];
  if (!rows.length) {
    return `<div class="glass empty-state"><span class="empty-ic">${icon('invite', 24, 2)}</span>
      <span class="empty-title">No check-in staff yet</span>
      <span class="meta">Staff can check volunteers in without being able to edit the event. They are not shown on the event page.</span></div>`;
  }
  return `<div class="glass list-card">${rows.map((r) => `<div class="vol-row">
    ${avatarHtml({ uid: r.key, name: r.name }, { size: 40, href: null })}
    <span class="vol-text"><span class="vol-name ellipsis">${esc(r.name)}</span><span class="vol-line">${esc(r.line)}</span></span>
    ${orgAdmin ? `<button type="button" class="remove-btn" data-${r.action}="${esc(r.key)}" aria-label="Remove ${esc(r.name)}">${icon('close', 14, 2.4)}</button>` : ''}
  </div>`).join('')}</div>`;
}

function render() {
  const going = event.counts?.going || 0;
  const marked = attendance.filter((a) => a.checkedInAt || a.status === 'confirmed').length;
  main.innerHTML = `
    <header class="mg-head"><a class="ib" href="manage.html${q}" aria-label="Back to Manage event">${icon('back', 20)}</a>
      <span class="mg-head-text grow"><h1>Check-in</h1><span class="mg-head-sub ellipsis">${esc(event.title)}</span></span></header>
    <button type="button" class="scan-btn" data-action="scan">${icon('qr', 22, 2)}Open QR scanner</button>
    <a class="glass hand-card" href="volunteers.html${q}"><span>${icon('checkin', 20, 2)}Mark attendance by hand</span><span class="meta">${marked} of ${going} marked</span></a>
    <div class="lbl">Default scan mode</div>
    <div class="glass radio-card" role="radiogroup" aria-label="Scan mode">
      ${radio('standard', 'Standard', 'Shows the volunteer’s details after scanning, then you confirm')}
      ${radio('express', 'Express', 'Checks the volunteer in the moment their code is scanned')}
    </div>
    ${isAdmin ? `<div class="glass"><div class="lock-row"><span class="radio-text grow"><span class="radio-title">Lock for check-in staff</span>
      <span class="meta">Staff can scan but cannot change the scan mode</span></span>
      <button type="button" class="switch" role="switch" data-action="lock" aria-checked="${!!event.checkInLocked}" aria-label="Lock for check-in staff"></button></div></div>` : ''}
    ${orgRole ? `<div class="lbl-row"><span class="lbl">Check-in staff</span>
      ${orgAdmin ? `<button type="button" class="sec-link link-btn hit" data-action="add">${addOpen ? 'Close' : '+ Add staff'}</button>` : ''}</div>
    ${addOpen ? `<form class="glass staff-add" id="staff-form">
      <input class="field-flat" type="email" name="email" aria-label="Staff email" placeholder="Email" required autocomplete="off">
      <button type="submit" class="approve-btn">Add</button></form>` : ''}
    ${staffRows()}` : ''}`;
}

// The scanner: reads a volunteer's personal code (TE1:<uid>, or TE1:<uid>:<eventId> for one event).
function scanCard(name, line, action = '') {
  return `<div class="scan-card">${avatarHtml({ uid: name, name }, { size: 44, href: null })}
    <span class="vol-text"><span class="vol-name ellipsis">${esc(name)}</span><span class="vol-line">${esc(line)}</span></span>${action}</div>`;
}

function startScanner() {
  const scanner = openScanner({
    title: 'Scan to check in',
    chip: mode === 'express' ? 'Express' : 'Standard',
    footer: `<nav class="view-pill" aria-label="View"><a href="volunteers.html${q}">List</a><span aria-current="true">${icon('qr', 16, 2)}Scan</span></nav>`,
    onText: async (text) => {
      const m = /^TE1:([\w-]{1,128})(?::([\w-]{1,128}))?$/.exec(text.trim());
      if (!m) { scanner.showResult(scanCard('Unrecognised code', 'Not a volunteer’s check-in code')); return; }
      const [, uid, forEvent] = m;
      if (forEvent && forEvent !== eventId) { scanner.showResult(scanCard('Another event', 'This code is for a different event')); return; }
      const reg = await getRegistration(eventId, uid).catch(() => null);
      if (!reg || reg.status !== 'going') {
        scanner.showResult(scanCard(reg?.name || 'Volunteer', reg?.status === 'pending' ? 'Waiting for approval' : 'Not registered for this event'));
        return;
      }
      if (mode === 'express') {
        const { already } = await checkIn(eventId, uid, user.uid);
        scanner.showResult(scanCard(reg.name, already ? 'Already checked in' : 'Checked in', `<span class="scan-ok">${icon('check', 20, 2.6)}</span>`));
        return;
      }
      const d = dateParts(reg.registeredAt?.toDate?.() || new Date());
      scanner.showResult(scanCard(reg.name, `Registered ${d.day} ${d.month.slice(0, 3)}`,
        `<button type="button" class="confirm-btn" data-checkin="${esc(uid)}">Check in</button>`));
    },
  });
  scanner.element.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-checkin]');
    if (!button) return;
    button.disabled = true;
    try {
      const { already } = await checkIn(eventId, button.dataset.checkin, user.uid);
      const name = button.closest('.scan-card').querySelector('.vol-name').textContent;
      scanner.showResult(scanCard(name, already ? 'Already checked in' : 'Checked in', `<span class="scan-ok">${icon('check', 20, 2.6)}</span>`));
    } catch (err) {
      console.warn(err);
      toast('Couldn’t check them in.');
      button.disabled = false;
    }
  });
}

main.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-action], [data-mode], [data-remove], [data-withdraw]');
  if (!t) return;
  if (t.dataset.action === 'scan') { startScanner(); return; }
  if (t.dataset.action === 'add') { addOpen = !addOpen; render(); if (addOpen) main.querySelector('#staff-form input').focus(); return; }
  try {
    if (t.dataset.mode) {
      mode = t.dataset.mode;
      if (isAdmin) { await setCheckInMode(eventId, { checkInMode: mode }); event = await getEvent(eventId); }
    } else if (t.dataset.action === 'lock') {
      await setCheckInMode(eventId, { checkInLocked: !event.checkInLocked });
      event = await getEvent(eventId);
    } else if (t.dataset.remove) {
      await removeStaff(event.orgId, t.dataset.remove);
      await load();
    } else if (t.dataset.withdraw) {
      await withdrawInvite(event.orgId, t.dataset.withdraw);
      await load();
    }
  } catch (err) {
    console.warn(err);
    toast('Couldn’t save that.');
  }
  render();
});

main.addEventListener('submit', async (e) => {
  if (e.target.id !== 'staff-form') return;
  e.preventDefault();
  const email = String(new FormData(e.target).get('email') || '').trim();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) { toast('That email address doesn’t look right.'); return; }
  try {
    await inviteStaff(event.orgId, email, user.uid);
    addOpen = false;
    await load();
    render();
    toast('Invited');
  } catch (err) {
    console.warn(err);
    toast('Couldn’t add that person.');
  }
});

await load();
render();
dragScroll(document.scrollingElement, 'y');
reveal();
