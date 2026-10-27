// Organisations (design/Organisations.dc.html). Applying to join the network is Phase 2, so it isn't shown.
import { requireUser } from '../auth.js';
import { AREAS, CAUSES, ensureUserDoc, listOrganisations, listOrgEvents, listPublicEvents, myMemberships } from '../data.js';
import {
  avatarHtml, dayStart, daysFromToday, dragScroll, esc, followButtonHtml, orgLogoHtml, renderBottomBar, toast, wireFollow,
} from '../ui.js';

const user = await requireUser();
const $ = (id) => document.getElementById(id);
const now = new Date();

const profile = await ensureUserDoc(user);
const follows = new Set(profile.follows || []);
let failed = false;
const orElse = (fallback) => (err) => { console.warn(err); failed = true; return fallback; };
const [orgList, events, memberships] = await Promise.all([
  listOrganisations().catch(orElse([])),
  listPublicEvents(dayStart(now)).catch(orElse([])),
  myMemberships(user.uid).catch(orElse([])),
]);

const upcomingCount = {};
events.filter((e) => e.endAt.toDate() > now).forEach((e) => { upcomingCount[e.orgId] = (upcomingCount[e.orgId] || 0) + 1; });

// The admin's own organisation: requests waiting across its upcoming events, and how many happen tomorrow.
const adminOf = memberships.find((m) => m.role === 'admin');
const mine = adminOf && orgList.find((o) => o.id === adminOf.orgId);
let mineLine = 'Your organisation';
if (mine) {
  const own = (await listOrgEvents(mine.id).catch(orElse([]))).filter((e) => e.status === 'scheduled' && e.endAt.toDate() > now);
  const waiting = own.reduce((sum, e) => sum + (e.counts?.pending || 0), 0);
  const tomorrow = own.filter((e) => daysFromToday(e.startAt.toDate(), now) === 1).length;
  if (waiting) mineLine += ` · ${waiting} ${waiting === 1 ? 'request' : 'requests'} waiting`;
  if (tomorrow) mineLine += ` · ${tomorrow} ${tomorrow === 1 ? 'event' : 'events'} tomorrow`;
}

let search = '', cause = '';

function row(o) {
  const n = upcomingCount[o.id] || 0;
  const line = [CAUSES[o.causes?.[0]], AREAS[o.area], n ? `${n} upcoming` : 'no upcoming events'].filter(Boolean).join(' · ');
  return `<div class="org-row">
    <a class="org-row-link" href="organisation.html?id=${encodeURIComponent(o.id)}">${orgLogoHtml(o, 42)}
      <span class="org-row-text"><span class="org-row-name">${esc(o.name)}</span><span class="org-row-line">${esc(line)}</span></span></a>
    ${followButtonHtml(o, follows.has(o.id))}</div>`;
}

function render() {
  const q = search.trim().toLowerCase();
  const filtering = Boolean(q || cause);
  const matches = (o) => (!cause || (o.causes || []).includes(cause))
    && (!q || `${o.name} ${o.tagline} ${(o.causes || []).map((c) => CAUSES[c]).join(' ')} ${AREAS[o.area] || ''}`.toLowerCase().includes(q));

  $('chips').innerHTML = [['', 'All causes'], ...Object.entries(CAUSES)].map(([id, label]) =>
    `<button type="button" class="filter-chip" data-cause="${id}" aria-pressed="${cause === id}">${esc(label)}</button>`).join('');

  $('mine').innerHTML = mine && !filtering ? `<a class="glass mine-card" href="organisation.html?id=${encodeURIComponent(mine.id)}">
    ${orgLogoHtml(mine, 44)}<span class="org-row-text grow"><span class="org-row-name">${esc(mine.name)}</span><span class="org-row-line">${esc(mineLine)}</span></span>
    <span class="tag-forest">Manage</span></a>` : '';

  const followed = filtering ? [] : orgList.filter((o) => follows.has(o.id));
  $('followed').innerHTML = followed.length ? `<div class="stack-6"><div class="sec"><h2>You follow<span class="count">${followed.length}</span></h2></div>
    <div class="glass list-card">${followed.map(row).join('')}</div></div>` : '';

  const all = orgList.filter((o) => matches(o) && (filtering || !follows.has(o.id)));
  $('all-title').textContent = filtering ? 'Results' : 'More organisations';
  $('all-count').textContent = String(all.length);
  $('sample-note').hidden = !all.some((o) => o.sample);
  $('all').innerHTML = all.length ? `<div class="glass list-card">${all.map(row).join('')}</div>` : '<div class="glass empty-note">No organisations match.</div>';
}

$('search').addEventListener('input', (e) => { search = e.target.value; render(); });
$('chips').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-cause]');
  if (!chip) return;
  cause = chip.dataset.cause;
  render();
});
wireFollow(document.querySelector('main'), user.uid, follows, render);

$('avatar').outerHTML = avatarHtml({ uid: user.uid, name: profile.name, email: user.email, photoUrl: profile.photoUrl });
render();
renderBottomBar('organisations');
dragScroll($('chips'), 'x');
dragScroll(document.scrollingElement, 'y');
document.body.classList.remove('is-loading');
if (failed) toast('Some organisations couldn’t load.');
