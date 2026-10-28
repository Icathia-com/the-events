// Invite volunteers (design/Invite.dc.html), for the event's admins: past volunteers with the organisation, or
// everyone who attended one of its past events. In Phase 2 an invitation shows in the app only: on the volunteer's
// Home and under Volunteers, Invited.
import { requireUser } from '../auth.js';
import { getEvent, getEventRole, inviteVolunteers, listInvites, listPastVolunteers, listRegistrations } from '../data.js';
import { avatarHtml, coverHtml, dateParts, dragScroll, esc, icon, reveal, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
const event = eventId ? await getEvent(eventId).catch(() => null) : null;
const role = event ? await getEventRole(event, eventId, user).catch(() => null) : null;
const q = `?id=${encodeURIComponent(eventId)}`;

if (!event || role !== 'admin') {
  main.innerHTML = `<div class="top-row"><a class="ib" href="${event ? `manage.html${q}` : 'index.html'}" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">Only the organisation’s admins can invite volunteers.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

let people = [], events = [], skip = new Set(), tab = 'people', query = '', done = 0, busy = false;
const pickedPeople = new Set(), pickedEvents = new Set();

// People already invited or registered aren't offered again.
async function load() {
  const [past, invites, regs] = await Promise.all([
    listPastVolunteers(event.orgId), listInvites(eventId).catch(() => []), listRegistrations(eventId).catch(() => []),
  ]);
  skip = new Set([...invites.map((i) => i.id), ...regs.filter((r) => ['going', 'pending', 'waitlist'].includes(r.status)).map((r) => r.id)]);
  people = past.people.filter((p) => !skip.has(p.uid));
  events = past.events.filter((e) => e.id !== eventId).map((e) => ({ ...e, invitable: e.attendees.filter((a) => !skip.has(a.uid)) }));
}

// Everyone chosen, once each: the people picked, then everyone who attended the events picked.
function chosen() {
  const out = new Map();
  for (const p of people) if (pickedPeople.has(p.uid)) out.set(p.uid, { uid: p.uid, name: p.name });
  for (const e of events) if (pickedEvents.has(e.id)) for (const a of e.invitable) if (!out.has(a.uid)) out.set(a.uid, { ...a, fromEvent: e.id });
  return [...out.values()];
}

const box = (on) => `<span class="pick-box" aria-hidden="true">${on ? icon('check', 14, 3) : ''}</span>`;
function personRow(p) {
  const last = dateParts(p.last.toDate());
  const on = pickedPeople.has(p.uid);
  return `<button type="button" class="pick-row" data-person="${esc(p.uid)}" aria-pressed="${on}">${avatarHtml({ uid: p.uid, name: p.name }, { size: 40, href: null })}
    <span class="host-text"><span class="host-name">${esc(p.name)}</span><span class="meta">${esc(`${p.count} past ${p.count === 1 ? 'event' : 'events'} · last in ${last.month}`)}</span></span>${box(on)}</button>`;
}
function eventRow(e) {
  const p = dateParts(e.startAt.toDate());
  const on = pickedEvents.has(e.id);
  return `<button type="button" class="pick-row" data-event="${esc(e.id)}" aria-pressed="${on}"${e.invitable.length ? '' : ' disabled'}>${coverHtml(e, 52, 12, 8)}
    <span class="host-text"><span class="host-name clamp2">${esc(e.title)}</span><span class="meta">${esc(`${p.day} ${p.month.slice(0, 3)} · ${e.attendees.length} attended`)}</span></span>${box(on)}</button>`;
}

function render() {
  const head = `<header class="mg-head"><a class="ib" href="manage.html${q}" aria-label="Back to Manage event">${icon('back', 20)}</a>
    <span class="mg-head-text"><h1>Invite volunteers</h1></span></header>`;
  if (done) {
    main.innerHTML = `${head}<div class="glass empty-state is-page"><span class="empty-ic">${icon('check', 26, 2.4)}</span>
      <span class="empty-title" id="done" tabindex="-1">${done} ${done === 1 ? 'invitation' : 'invitations'} sent</span>
      <span class="sheet-btns"><a class="ghost-btn is-link" href="volunteers.html${q}&tab=invited">See invited list</a>
        <button type="button" class="btn-small" data-action="again">Invite more</button></span></div>`;
    main.querySelector('#done').focus();
    return;
  }
  const needle = query.trim().toLowerCase();
  const shownPeople = people.filter((p) => !needle || p.name.toLowerCase().includes(needle));
  const shownEvents = events.filter((e) => !needle || e.title.toLowerCase().includes(needle));
  const n = chosen().length;
  main.innerHTML = `${head}
    <input class="search" id="q" type="search" aria-label="Search people or past events" placeholder="Search people or past events" value="${esc(query)}">
    <div class="seg-tabs" role="tablist" aria-label="Invite from">
      <button type="button" role="tab" data-tab="people" aria-selected="${tab === 'people'}">People</button>
      <button type="button" role="tab" data-tab="events" aria-selected="${tab === 'events'}">Past events</button></div>
    ${tab === 'people'
      ? `<div class="lbl">Past volunteers with your organisation</div>${shownPeople.length
        ? `<div class="glass host-list">${shownPeople.map(personRow).join('')}</div>` : '<div class="glass empty-note">No one matches.</div>'}`
      : `<div class="lbl">Invite everyone who attended</div>${shownEvents.length
        ? `<div class="glass host-list">${shownEvents.map(eventRow).join('')}</div>` : '<div class="glass empty-note">No past events match.</div>'}`}
    <button type="button" class="big-btn send-invites" data-action="send"${n && !busy ? '' : ' disabled'}>${n ? `Send ${n} ${n === 1 ? 'invitation' : 'invitations'}` : 'Choose who to invite'}</button>`;
}

main.addEventListener('input', (e) => {
  if (e.target.id !== 'q') return;
  query = e.target.value;
  render();
  const input = main.querySelector('#q');
  input.focus();
  input.setSelectionRange(query.length, query.length);
});

main.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-tab], [data-person], [data-event], [data-action]');
  if (!t) return;
  if (t.dataset.tab) { tab = t.dataset.tab; render(); main.querySelector(`[data-tab="${tab}"]`)?.focus(); return; }
  const toggle = (set, id) => { if (set.has(id)) set.delete(id); else set.add(id); };
  if (t.dataset.person) { toggle(pickedPeople, t.dataset.person); render(); main.querySelector(`[data-person="${CSS.escape(t.dataset.person)}"]`)?.focus(); return; }
  if (t.dataset.event) { toggle(pickedEvents, t.dataset.event); render(); main.querySelector(`[data-event="${CSS.escape(t.dataset.event)}"]`)?.focus(); return; }
  if (t.dataset.action === 'again') { done = 0; pickedPeople.clear(); pickedEvents.clear(); query = ''; await load(); render(); return; }
  if (t.dataset.action !== 'send' || busy) return;
  const list = chosen();
  if (!list.length) return;
  busy = true;
  render();
  try {
    await inviteVolunteers(eventId, event, list, user.uid);
    done = list.length;
  } catch (err) {
    console.warn(err);
    toast('Couldn’t send the invitations.');
  }
  busy = false;
  render();
});

await load().catch((err) => { console.warn(err); toast('Couldn’t load past volunteers.'); });
render();
dragScroll(document.scrollingElement, 'y');
reveal();
