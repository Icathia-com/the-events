// Volunteers list (design/Volunteers.dc.html). The Invited tab arrives with invitations in Phase 2.
// Admins approve and decline; admins and staff mark attendance. People on the waiting list are listed with
// the requests, so an admin can move them up.
import { requireUser } from '../auth.js';
import {
  decideRegistration, getEvent, getMyRole, listAttendance, listRegistrations, markAttended, pastEventCounts, unmarkAttended,
} from '../data.js';
import { avatarHtml, dateParts, dragScroll, esc, fmtTime, hoursText, icon, reveal, shortDay, toast } from '../ui.js';

const TABS = [['going', 'Going'], ['attended', 'Attended'], ['unmarked', 'Not yet marked'], ['pending', 'Waiting for approval']];
const EMPTY = {
  going: 'No one has registered yet', attended: 'No one marked attended yet', unmarked: 'Everyone is marked', pending: 'No requests waiting',
};

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
let event = eventId ? await getEvent(eventId).catch(() => null) : null;
const role = event ? await getMyRole(event.orgId, user.uid).catch(() => null) : null;

if (!event || !role) {
  main.innerHTML = `<div class="top-row"><a class="ib" href="index.html" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">Only the organisation’s members can see this list.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

const isAdmin = role === 'admin';
const q = `?id=${encodeURIComponent(eventId)}`;
let people = [], past = {};
let tab = 'going', search = '', searchOpen = false, byName = false;
const busy = new Set();

async function load() {
  const [regs, attendance, pastCounts, fresh] = await Promise.all([
    listRegistrations(eventId),
    listAttendance(eventId),
    isAdmin ? pastEventCounts(event.orgId).catch(() => ({})) : {},
    getEvent(eventId),
  ]);
  const att = Object.fromEntries(attendance.map((a) => [a.id, a]));
  event = fresh;
  past = pastCounts;
  people = regs.filter((r) => ['going', 'pending', 'waitlist'].includes(r.status))
    .map((r) => ({ uid: r.id, name: r.name || 'Volunteer', status: r.status, registeredAt: r.registeredAt?.toDate?.() || new Date(), att: att[r.id] }))
    .sort((a, b) => a.registeredAt - b.registeredAt);
}

const attended = (p) => p.att?.status === 'confirmed';
const inTab = {
  going: (p) => p.status === 'going',
  attended: (p) => p.status === 'going' && attended(p),
  unmarked: (p) => p.status === 'going' && !attended(p),
  pending: (p) => p.status === 'pending' || p.status === 'waitlist',
};

function line(p) {
  const d = dateParts(p.registeredAt);
  if (p.status === 'pending' || p.status === 'waitlist') {
    const when = `${shortDay(p.registeredAt).replace(/^(Today|Tomorrow)$/, (w) => w.toLowerCase())}, ${fmtTime(p.registeredAt)}`;
    return p.status === 'pending' ? `Requested ${when}` : `On the waiting list since ${when}`;
  }
  if (attended(p)) return `Attended · ${hoursText(Number(p.att.hours) || 0)} added`;
  const n = past[p.uid] || 0;
  return `Registered ${d.day} ${d.month.slice(0, 3)}${isAdmin ? (n ? ` · ${n} past ${n === 1 ? 'event' : 'events'}` : ' · first event') : ''}`;
}

function actions(p) {
  const off = busy.has(p.uid) ? ' disabled' : '';
  if (p.status === 'going') {
    const on = attended(p);
    return `<button type="button" class="mark-btn" data-mark="${esc(p.uid)}" aria-pressed="${on}"
      aria-label="${on ? 'Unmark attendance for' : 'Mark attended:'} ${esc(p.name)}"${off}>${on ? `${icon('check', 18, 2.6)}Attended` : 'Mark attended'}</button>`;
  }
  if (!isAdmin) return '';
  return `<span class="decide">
    <button type="button" class="decline-btn" data-decline="${esc(p.uid)}" aria-label="Decline ${esc(p.name)}"${off}>${icon('close', 16, 2.4)}</button>
    <button type="button" class="approve-btn" data-approve="${esc(p.uid)}"${off}>Approve</button></span>`;
}

// The page shell is drawn once; render() refreshes the tabs, the list and the summary.
main.innerHTML = `
  <header class="mg-head"><a class="ib" href="manage.html${q}" aria-label="Back to Manage event">${icon('back', 20)}</a>
    <span class="mg-head-text grow"><h1>Volunteers</h1></span>
    <button type="button" class="ib" data-action="sort" aria-pressed="false" aria-label="Sort by name">${icon('sort', 20, 2)}</button>
    <button type="button" class="ib" data-action="search" aria-expanded="false" aria-label="Search volunteers">${icon('search', 20, 2)}</button>
  </header>
  <input class="search" id="search" type="search" aria-label="Search by name" placeholder="Search by name" hidden>
  <div class="chip-row" id="tabs" role="tablist" aria-label="Volunteer status"></div>
  <div id="list"></div>
  <div id="summary"></div>
  <nav class="view-pill" aria-label="View"><span aria-current="true">List</span><a href="checkin.html${q}">${icon('qr', 16, 2)}Scan</a></nav>`;
const $ = (id) => document.getElementById(id);

function render() {
  const query = search.trim().toLowerCase();
  let rows = people.filter(inTab[tab]).filter((p) => !query || p.name.toLowerCase().includes(query));
  if (byName) rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const attendedPeople = people.filter(inTab.attended);
  const hours = attendedPeople.reduce((sum, p) => sum + (Number(p.att.hours) || 0), 0);

  $('tabs').innerHTML = TABS.map(([id, label]) =>
    `<button type="button" class="vol-tab" role="tab" data-tab="${id}" aria-selected="${tab === id}">${label} <span class="vol-badge">${people.filter(inTab[id]).length}</span></button>`).join('');
  $('list').innerHTML = rows.length
    ? `<div class="glass list-card">${rows.map((p) => `<div class="vol-row">
        ${avatarHtml({ uid: p.uid, name: p.name }, { size: 40, href: null })}
        <span class="vol-text"><span class="vol-name ellipsis">${esc(p.name)}</span><span class="vol-line">${esc(line(p))}</span></span>
        ${actions(p)}</div>`).join('')}</div>`
    : `<div class="glass empty-state"><span class="empty-ic">${icon('organisations', 26, 2)}</span>
        <span class="empty-title">${query ? 'No names match.' : EMPTY[tab]}</span></div>`;
  $('summary').innerHTML = tab === 'going' || tab === 'attended'
    ? `<div class="glass summary-card"><span class="hours-ic">${icon('clock', 20, 2)}</span>
      <span class="card-title">${attendedPeople.length} attended · ${hoursText(hours).replace(/hours?$/, (w) => `volunteer ${w}`)}</span></div>` : '';
  main.querySelector('[data-action="sort"]').setAttribute('aria-pressed', String(byName));
}

async function act(uid, task, failure) {
  busy.add(uid);
  render();
  try { await task(); } catch (err) { console.warn(err); toast(failure); }
  busy.delete(uid);
  await load().catch((err) => console.warn(err));
  render();
}

main.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-tab], [data-action], [data-mark], [data-approve], [data-decline]');
  if (!t) return;
  if (t.dataset.tab) { tab = t.dataset.tab; render(); return; }
  if (t.dataset.action === 'sort') { byName = !byName; render(); return; }
  if (t.dataset.action === 'search') {
    searchOpen = !searchOpen;
    search = '';
    $('search').value = '';
    $('search').hidden = !searchOpen;
    t.setAttribute('aria-expanded', String(searchOpen));
    if (searchOpen) $('search').focus();
    render();
    return;
  }
  const person = people.find((p) => p.uid === (t.dataset.mark || t.dataset.approve || t.dataset.decline));
  if (!person || busy.has(person.uid)) return;
  if (t.dataset.mark) {
    await act(person.uid, () => (attended(person) ? unmarkAttended(eventId, person.uid) : markAttended(eventId, person.uid, user.uid)),
      'Couldn’t save the attendance.');
  } else if (t.dataset.approve) {
    await act(person.uid, async () => {
      if (!(await decideRegistration(eventId, person.uid, 'going', user.uid))) toast('All spots are taken.');
    }, 'Couldn’t approve that request.');
  } else if (t.dataset.decline) {
    await act(person.uid, () => decideRegistration(eventId, person.uid, 'declined', user.uid), 'Couldn’t decline that request.');
  }
});
main.addEventListener('input', (e) => {
  if (e.target.id !== 'search') return;
  search = e.target.value;
  render();
});

await load();
render();
dragScroll($('tabs'), 'x');
dragScroll(document.scrollingElement, 'y');
reveal();
