// Hosts (design/Hosts.dc.html), for the organisation's admins: co-hosts and staff added by email, guest speakers by
// name, and partner organisations. Speakers and partners are shown on the event page; co-hosts and staff are not.
import { requireUser } from '../auth.js';
import { addHost, getEvent, getMyRole, listHosts, listOrganisations, removeHost, updateEvent } from '../data.js';
import { avatarHtml, dragScroll, esc, icon, orgDotHtml, reveal, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
let event = eventId ? await getEvent(eventId).catch(() => null) : null;
const role = event ? await getMyRole(event.orgId, user.uid).catch(() => null) : null;
const q = `?id=${encodeURIComponent(eventId)}`;

if (!event || role !== 'admin') {
  main.innerHTML = `<div class="top-row"><a class="ib" href="${event ? `manage.html${q}` : 'index.html'}" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">Only the organisation’s admins can change the hosts.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

const ROLES = { cohost: 'Co-host', staff: 'Staff', speaker: 'Guest speaker' };
const HELP = {
  cohost: 'Can edit the event, approve volunteers and send announcements.',
  staff: 'Can check volunteers in and see the list. Cannot edit the event.',
  speaker: 'Shown on the event page only. No access to manage it.',
};
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

let hosts = [], orgs = [], draft = '', pick = 'cohost', busy = false;
async function load() {
  [hosts, orgs, event] = await Promise.all([
    listHosts(eventId).catch(() => []), listOrganisations().catch(() => []), getEvent(eventId),
  ]);
}

function hostRow({ key, name, line, tag, action }) {
  return `<div class="host-row">${avatarHtml({ uid: key, name }, { size: 40, href: null })}
    <span class="host-text"><span class="host-name ellipsis">${esc(name)}</span><span class="meta">${esc(line)}</span></span>
    ${action ? `<button type="button" class="role-btn hit" data-cycle="${esc(key)}" aria-label="${esc(`Change role for ${name}, currently ${tag}`)}">${esc(tag)}${icon('updown', 14, 2)}</button>
      <button type="button" class="remove-btn" data-remove="${esc(key)}" aria-label="${esc(`Remove ${name}`)}">${icon('close', 14, 2.4)}</button>`
      : tag ? `<span class="chip chip-muted">${esc(tag)}</span>` : ''}</div>`;
}

function render() {
  const speakers = event.speakers || [];
  const partners = new Set((event.partners || []).map((p) => p.id));
  const rows = [
    `<div class="host-row">${orgDotHtml({ name: event.orgName, logoColors: event.cover?.colors })}
      <span class="host-text"><span class="host-name">${esc(event.orgName)}</span><span class="meta">Your organisation · hosts this event</span></span>
      <span class="chip chip-muted">Organiser</span></div>`,
    ...hosts.map((h) => hostRow({ key: h.id, name: h.email, line: HELP[h.role], tag: ROLES[h.role], action: true })),
    ...speakers.map((s, i) => `<div class="host-row">${avatarHtml({ uid: s, name: s }, { size: 40, href: null })}
      <span class="host-text"><span class="host-name ellipsis">${esc(s)}</span><span class="meta">${HELP.speaker}</span></span>
      <span class="chip chip-muted">Guest speaker</span>
      <button type="button" class="remove-btn" data-speaker="${i}" aria-label="${esc(`Remove ${s}`)}">${icon('close', 14, 2.4)}</button></div>`),
  ];
  const isEmail = EMAIL.test(draft.trim());
  const can = !busy && (pick === 'speaker' ? draft.trim().length > 1 && !draft.includes('@') : isEmail);
  main.innerHTML = `
    <header class="mg-head"><a class="ib" href="manage.html${q}" aria-label="Back to Manage event">${icon('back', 20)}</a>
      <span class="mg-head-text"><h1>Hosts</h1></span></header>
    <div class="stack-6"><div class="lbl">Hosting this event</div><div class="glass host-list">${rows.join('')}</div></div>
    <div class="stack-6"><div class="lbl">Add a host</div>
      <div class="glass compose-card">
        <input class="field-flat" id="draft" aria-label="Email, or a guest speaker's name" placeholder="Email, or a guest speaker’s name" maxlength="120" autocomplete="off" value="${esc(draft)}">
        <div class="area-chips" role="group" aria-label="Role">${Object.entries(ROLES).map(([id, label]) =>
          `<button type="button" class="area-chip" data-pick="${id}" aria-pressed="${pick === id}">${label}</button>`).join('')}</div>
        <span class="meta">${HELP[pick]}</span>
        <button type="button" class="big-btn" data-action="add"${can ? '' : ' disabled'}>Add host</button>
      </div></div>
    <div class="stack-6"><div class="lbl">Partner organisation</div><div class="glass host-list">${orgs.filter((o) => o.id !== event.orgId).map((o) => {
      const on = partners.has(o.id);
      return `<div class="host-row">${orgDotHtml(o)}
        <span class="host-text"><span class="host-name">${esc(o.name)}</span><span class="meta">${esc(on ? 'Co-hosting · shown on the event page' : o.tagline || '')}</span></span>
        <button type="button" class="partner-btn hit" data-partner="${esc(o.id)}" aria-pressed="${on}">${on ? 'Co-hosting' : 'Invite'}</button></div>`;
    }).join('')}</div></div>`;
}

async function act(task, failure) {
  busy = true;
  try { await task(); await load(); } catch (err) { console.warn(err); toast(failure); }
  busy = false;
  render();
}

main.addEventListener('input', (e) => {
  if (e.target.id !== 'draft') return;
  draft = e.target.value;
  const isEmail = EMAIL.test(draft.trim());
  main.querySelector('[data-action="add"]').disabled = busy || !(pick === 'speaker' ? draft.trim().length > 1 && !draft.includes('@') : isEmail);
});

main.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-pick], [data-action], [data-cycle], [data-remove], [data-speaker], [data-partner]');
  if (!t || busy) return;
  if (t.dataset.pick) { pick = t.dataset.pick; render(); main.querySelector(`[data-pick="${pick}"]`)?.focus(); return; }
  if (t.dataset.action === 'add') {
    const value = draft.trim();
    if (pick === 'speaker') {
      await act(() => updateEvent(eventId, { speakers: [...(event.speakers || []), value].slice(0, 20) }), 'Couldn’t add the speaker.');
    } else {
      await act(() => addHost(eventId, value.toLowerCase(), pick, user.uid), 'Couldn’t add the host.');
    }
    draft = '';
    render();
    return;
  }
  if (t.dataset.cycle) {
    const h = hosts.find((x) => x.id === t.dataset.cycle);
    if (h) await act(() => addHost(eventId, h.id, h.role === 'cohost' ? 'staff' : 'cohost', user.uid), 'Couldn’t change the role.');
    main.querySelector(`[data-cycle="${CSS.escape(t.dataset.cycle)}"]`)?.focus();
    return;
  }
  if (t.dataset.remove) { await act(() => removeHost(eventId, t.dataset.remove), 'Couldn’t remove the host.'); return; }
  if (t.dataset.speaker) {
    const i = Number(t.dataset.speaker);
    await act(() => updateEvent(eventId, { speakers: (event.speakers || []).filter((_, j) => j !== i) }), 'Couldn’t remove the speaker.');
    return;
  }
  if (t.dataset.partner) {
    const id = t.dataset.partner, list = event.partners || [];
    const o = orgs.find((x) => x.id === id);
    const next = list.some((p) => p.id === id) ? list.filter((p) => p.id !== id) : [...list, { id, name: o.name, logoColors: o.logoColors || [] }];
    await act(() => updateEvent(eventId, { partners: next.slice(0, 10) }), 'Couldn’t update the partner.');
  }
});

await load();
render();
dragScroll(document.scrollingElement, 'y');
reveal();
