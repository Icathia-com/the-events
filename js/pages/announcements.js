// Announcements (design/Blasts.dc.html), for the organisation's admins. In Phase 2 they reach volunteers in the app
// only, on the event page; push, email and SMS are shown as Soon.
import { requireUser } from '../auth.js';
import { AUDIENCES, ensureUserDoc, getEvent, getMyRole, listAnnouncements, postAnnouncement } from '../data.js';
import { dragScroll, esc, fmtTime, icon, reveal, shortDay, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
let event = eventId ? await getEvent(eventId).catch(() => null) : null;
const role = event ? await getMyRole(event.orgId, user.uid).catch(() => null) : null;
const q = `?id=${encodeURIComponent(eventId)}`;

if (!event || role !== 'admin') {
  main.innerHTML = `<div class="top-row"><a class="ib" href="${event ? `manage.html${q}` : 'index.html'}" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">Only the organisation’s admins can send announcements.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

const CHANNELS = [
  ['Push notification', 'Instant, in the app'],
  ['Email', 'Full message with the event details'],
  ['SMS', 'For volunteers without the app; costs the organisation per message'],
];
const [profile, firstList] = await Promise.all([ensureUserDoc(user), listAnnouncements(eventId).catch(() => [])]);
let sent = firstList, to = 'going', text = '', justSent = null, busy = false;

function audienceCount(a) {
  const c = event.counts || {};
  if (a === 'going') return c.going || 0;
  if (a === 'waiting') return (c.going || 0) + (c.pending || 0) + (c.waitlist || 0);
  return c.attended || 0;
}
const people = (n) => `${n} ${n === 1 ? 'volunteer' : 'volunteers'}`;
const canSend = () => !busy && text.trim().length > 0 && audienceCount(to) > 0;

function composeHtml() {
  const n = audienceCount(to);
  return `<div class="glass compose-card">
      <textarea class="compose-text" id="text" aria-label="Message to volunteers" placeholder="Write to your volunteers" maxlength="2000">${esc(text)}</textarea>
      <div class="lbl">Send to</div>
      <div class="area-chips" role="group" aria-label="Send to">${Object.entries(AUDIENCES).map(([id, label]) =>
        `<button type="button" class="area-chip" data-to="${id}" aria-pressed="${to === id}">${esc(`${label} (${audienceCount(id)})`)}</button>`).join('')}</div>
      <div class="lbl">Deliver by</div>
      <div class="form-card is-flat">${CHANNELS.map(([label, help]) => `<div class="form-row is-static is-tall is-soon" aria-disabled="true">
        <span class="ticket-text"><span class="row-label">${label}<span class="soon">Soon</span></span><span class="meta">${esc(help)}</span></span>
        <span class="switch" aria-hidden="true"></span></div>`).join('')}</div>
      <span class="meta">${n ? `Goes to ${people(n)} in the app.` : 'No one in this group yet.'}</span>
    </div>`;
}

function sentHtml() {
  if (!sent.length) return '';
  return `<div class="stack-6"><div class="lbl">Sent</div><div class="glass note-card">${sent.map((s) => {
    const at = s.createdAt?.toDate?.() || new Date();
    const count = Number.isInteger(s.count) ? ` · ${people(s.count)}` : '';
    return `<div class="note-row"><span class="note-head"><span class="note-to">${esc(`To ${AUDIENCES[s.audience]?.toLowerCase() || s.audience}${count}`)}</span>
        <span class="meta">${esc(`${shortDay(at)}, ${fmtTime(at)}`)}</span></span>
      <span class="note-text">${esc(s.text)}</span><span class="meta">${esc(`Sent by ${s.byName || 'the organisation'} · In the app${s.sample ? ' · Sample' : ''}`)}</span></div>`;
  }).join('')}</div></div>`;
}

function render() {
  main.innerHTML = `
    <header class="mg-head"><a class="ib" href="manage.html${q}" aria-label="Back to Manage event">${icon('back', 20)}</a>
      <span class="mg-head-text grow"><h1>Announcements</h1></span>
      ${justSent ? '' : `<button type="button" class="send-btn" data-action="send"${canSend() ? '' : ' disabled'}>Send</button>`}</header>
    ${justSent ? `<div class="glass sent-card"><span class="sent-ic">${icon('check', 20, 2.6)}</span>
        <span class="card-title grow">Sent to ${esc(people(justSent))}</span>
        <button type="button" class="ghost-btn is-small" data-action="new">New</button></div>` : composeHtml()}
    ${sentHtml()}`;
}

main.addEventListener('input', (e) => {
  if (e.target.id !== 'text') return;
  text = e.target.value;
  main.querySelector('[data-action="send"]').disabled = !canSend();
});

main.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-to], [data-action]');
  if (!t) return;
  if (t.dataset.to) { to = t.dataset.to; render(); main.querySelector(`[data-to="${to}"]`)?.focus(); return; }
  if (t.dataset.action === 'new') { justSent = null; render(); main.querySelector('#text')?.focus(); return; }
  if (t.dataset.action !== 'send' || !canSend()) return;
  busy = true;
  render();
  try {
    const count = audienceCount(to);
    await postAnnouncement(eventId, { text: text.trim(), audience: to, by: user.uid, byName: profile.name || user.email, count });
    [event, sent] = await Promise.all([getEvent(eventId), listAnnouncements(eventId)]);
    text = '';
    justSent = count;
  } catch (err) {
    console.warn(err);
    toast('Couldn’t send the announcement.');
  }
  busy = false;
  render();
});

render();
dragScroll(document.scrollingElement, 'y');
reveal();
