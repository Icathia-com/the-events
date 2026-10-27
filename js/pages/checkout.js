// Check-out and hours (design/Check-Out.dc.html): the event's check-out code for volunteers to scan, confirming
// check-ins by hand, and hours claims. The code stays the same for the event in Phase 1; it rotates from Phase 3.
// Letter requests are Phase 3, so they aren't shown.
import { requireUser } from '../auth.js';
import { declineClaim, getCodes, getEvent, getMyRole, listAttendance, markAttended } from '../data.js';
import { qrSvg } from '../qr.js';
import { avatarHtml, dragScroll, esc, fmtTime, hoursText, icon, shortDay, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
let event = eventId ? await getEvent(eventId).catch(() => null) : null;
const role = event ? await getMyRole(event.orgId, user.uid).catch(() => null) : null;
const codes = role ? await getCodes(eventId).catch(() => null) : null;

if (!event || !role || !codes) {
  main.innerHTML = `<div class="top-row"><a class="ib" href="index.html" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">Only the organisation’s members can open check-out.</div>`;
  document.body.classList.remove('is-loading');
  await new Promise(() => {}); // nothing more to show
}

const q = `?id=${encodeURIComponent(eventId)}`;
// Scanning this with any camera opens the event page, which confirms the volunteer's hours.
const checkoutUrl = new URL(`event.html?id=${encodeURIComponent(eventId)}&checkout=${encodeURIComponent(codes.checkOut)}`, location.href).href;
let attendance = [];
const busy = new Set();

async function load() {
  [attendance, event] = await Promise.all([listAttendance(eventId), getEvent(eventId)]);
}

const time = (ts) => (ts?.toDate ? fmtTime(ts.toDate()) : '');
const person = (a, line, action) => `<div class="vol-row">${avatarHtml({ uid: a.id, name: a.name }, { size: 40, href: null })}
  <span class="vol-text"><span class="vol-name ellipsis">${esc(a.name || 'Volunteer')}</span><span class="vol-line">${esc(line)}</span></span>${action}</div>`;

function claimLine(a) {
  const hours = hoursText(Number(a.hours) || 0);
  if (!a.checkedInAt) return `Claimed ${hours} · was not checked in`;
  const auto = a.autoConfirmAt?.toDate ? ` · confirms itself ${shortDay(a.autoConfirmAt.toDate()).replace(/^(Today|Tomorrow)$/, (w) => w.toLowerCase())}` : '';
  return `Claimed ${hours} · checked in ${time(a.checkedInAt)}${auto}`;
}

function render() {
  const end = event.endAt.toDate();
  const hours = hoursText(Number(event.hours) || 0);
  const short = `${Number(event.hours) || 0} h`;
  const checkedIn = attendance.filter((a) => a.checkedInAt);
  const left = attendance.filter((a) => a.status === 'checked_in');
  const confirmed = attendance.filter((a) => a.status === 'confirmed');
  const claims = attendance.filter((a) => a.claimedAt);
  const off = (uid) => (busy.has(uid) ? ' disabled' : '');

  main.innerHTML = `
    <header class="mg-head"><a class="ib" href="manage.html${q}" aria-label="Back to Manage event">${icon('back', 20)}</a>
      <span class="mg-head-text grow"><h1>Check-out and hours</h1>
        <span class="mg-head-sub ellipsis">${esc(event.title)} · ${end < new Date() ? 'ended' : 'ends'} ${fmtTime(end)}</span></span></header>
    <div class="glass qr-card">
      <span class="qr-box">${qrSvg(checkoutUrl, 'Check-out code for this event')}</span>
      <span class="card-title">Scan to check out</span>
      <span class="meta">Confirms ${hours} for each volunteer who scans it.</span>
      <button type="button" class="btn-dark" data-action="full">Show full screen</button>
    </div>
    <div class="stat-row">
      <div class="glass stat-card"><b>${checkedIn.length}</b><span>Checked in</span></div>
      <div class="glass stat-card"><b class="is-ok">${confirmed.length}</b><span>Hours confirmed</span></div>
      <div class="glass stat-card"><b class="is-wait">${left.length}</b><span>Not yet</span></div>
    </div>
    <div class="lbl-row"><span class="lbl">Checked in, not checked out</span>
      ${left.length ? `<button type="button" class="sec-link link-btn hit" data-action="all">Confirm all (${left.length})</button>` : ''}</div>
    ${left.length
      ? `<div class="glass list-card">${left.map((a) => person(a, `Checked in ${time(a.checkedInAt)}`,
        `<button type="button" class="confirm-btn" data-confirm="${esc(a.id)}"${off(a.id)}>Confirm ${short}</button>`)).join('')}</div>`
      : `<div class="glass empty-note">${checkedIn.length ? 'Everyone who checked in has their hours confirmed.' : 'No one has checked in yet.'}</div>`}
    <div class="lbl">Hours claims</div>
    ${claims.length
      ? `<div class="glass list-card">${claims.map((a) => person(a, claimLine(a), a.status === 'claimed'
        ? `<span class="decide"><button type="button" class="decline-btn" data-decline="${esc(a.id)}" aria-label="Decline claim from ${esc(a.name)}"${off(a.id)}>${icon('close', 15, 2.4)}</button>
            <button type="button" class="confirm-btn" data-confirm="${esc(a.id)}"${off(a.id)}>Confirm</button></span>`
        : a.status === 'confirmed' ? `<span class="tag-ok">${Number(a.hours) || 0} h confirmed</span>` : '<span class="tag-no">Declined</span>')).join('')}</div>`
      : '<div class="glass empty-note">No hours claims.</div>'}`;
}

function showFullScreen() {
  const opener = document.activeElement;
  const view = document.createElement('div');
  view.className = 'fullscreen-qr';
  view.setAttribute('role', 'dialog');
  view.setAttribute('aria-modal', 'true');
  view.setAttribute('aria-label', 'Check-out code');
  view.innerHTML = `<button type="button" class="icon-btn" aria-label="Close">${icon('close', 18, 2.4)}</button>
    <span class="qr-box">${qrSvg(checkoutUrl, 'Check-out code for this event')}</span>
    <span class="fs-title">Check out here</span><span class="fs-sub">${esc(event.title)} · ${esc(hoursText(Number(event.hours) || 0))}</span>`;
  const close = () => { view.remove(); document.removeEventListener('keydown', onKey); opener?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  view.querySelector('button').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.append(view);
  view.querySelector('button').focus();
}

async function act(uids, task, failure) {
  uids.forEach((uid) => busy.add(uid));
  render();
  try {
    for (const uid of uids) await task(uid);
  } catch (err) {
    console.warn(err);
    toast(failure);
  }
  uids.forEach((uid) => busy.delete(uid));
  await load().catch((err) => console.warn(err));
  render();
}

main.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-action], [data-confirm], [data-decline]');
  if (!t) return;
  if (t.dataset.action === 'full') showFullScreen();
  else if (t.dataset.action === 'all') {
    await act(attendance.filter((a) => a.status === 'checked_in').map((a) => a.id), (uid) => markAttended(eventId, uid, user.uid), 'Couldn’t confirm everyone.');
  } else if (t.dataset.confirm) {
    await act([t.dataset.confirm], (uid) => markAttended(eventId, uid, user.uid), 'Couldn’t confirm the hours.');
  } else if (t.dataset.decline) {
    await act([t.dataset.decline], (uid) => declineClaim(eventId, uid), 'Couldn’t decline the claim.');
  }
});

await load();
render();
dragScroll(document.scrollingElement, 'y');
document.body.classList.remove('is-loading');
