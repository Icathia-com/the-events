// Organisation applications (Phase 2), for the network admin: each pending organisation with Approve and Decline.
import { requireUser } from '../auth.js';
import { AREAS, CAUSES, decideApplication, ensureUserDoc, listApplications, getMember } from '../data.js';
import { dateParts, dragScroll, esc, icon, orgLogoHtml, reveal, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const profile = await ensureUserDoc(user);
const head = `<header class="mg-head"><a class="ib" href="profile.html" aria-label="Back to your profile">${icon('back', 20)}</a>
  <span class="mg-head-text"><h1>Applications</h1></span></header>`;

if (!profile.networkAdmin) {
  main.innerHTML = `${head}<div class="glass empty-note">Only the network admin can see this.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

let apps = [];
const busy = new Set();
async function load() {
  const list = await listApplications();
  const people = await Promise.all(list.map((o) => getMember(o.id, o.createdBy).catch(() => null)));
  apps = list.map((o, i) => ({ ...o, applicant: people[i]?.name || '' }));
}

function card(o) {
  const tags = [...(o.causes || []).map((c) => CAUSES[c]), AREAS[o.area]].filter(Boolean);
  const when = o.createdAt?.toDate ? dateParts(o.createdAt.toDate()) : null;
  const off = busy.has(o.id) ? ' disabled' : '';
  return `<article class="glass app-card">
    <div class="app-top">${orgLogoHtml(o, 52)}<span class="ticket-text"><span class="card-title">${esc(o.name)}</span>
      ${o.tagline ? `<span class="meta">${esc(o.tagline)}</span>` : ''}</span></div>
    <span class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>
    ${o.about ? `<p class="app-about">${esc(o.about)}</p>` : ''}
    <span class="meta">${esc([o.email, o.address, o.website].filter(Boolean).join(' · '))}</span>
    <span class="meta">${esc(`Applied${o.applicant ? ` by ${o.applicant}` : ''}${when ? ` on ${when.weekday.slice(0, 3)} ${when.day} ${when.month.slice(0, 3)}` : ''}`)}${o.sample ? ' · Sample' : ''}</span>
    <div class="sheet-btns"><button type="button" class="ghost-btn is-danger" data-decline="${esc(o.id)}"${off}>Decline</button>
      <button type="button" class="big-btn grow" data-approve="${esc(o.id)}"${off}>Approve</button></div>
  </article>`;
}

function render() {
  main.innerHTML = `${head}
    ${apps.length ? apps.map(card).join('') : `<div class="glass empty-state is-page"><span class="empty-ic">${icon('organisations', 26, 2)}</span>
      <span class="empty-title">No applications waiting</span></div>`}`;
}

main.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-approve], [data-decline]');
  if (!t) return;
  const id = t.dataset.approve || t.dataset.decline, status = t.dataset.approve ? 'approved' : 'declined';
  const name = apps.find((o) => o.id === id)?.name || 'The organisation';
  busy.add(id);
  render();
  try {
    await decideApplication(id, status, user.uid);
    toast(status === 'approved' ? `${name} approved` : `${name} declined`);
  } catch (err) {
    console.warn(err);
    toast('Couldn’t save that.');
  }
  busy.delete(id);
  await load().catch((err) => console.warn(err));
  render();
});

await load().catch((err) => { console.warn(err); toast('Couldn’t load the applications.'); });
render();
dragScroll(document.scrollingElement, 'y');
reveal();
