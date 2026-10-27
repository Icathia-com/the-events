// Discover (design/Discover.dc.html). Browse by location filters the list here; the map is Phase 3.
import { requireUser } from '../auth.js';
import { AREAS, CAUSES, ensureUserDoc, listFollowerEvents, listOrganisations, listPublicEvents } from '../data.js';
import {
  addDays, avatarHtml, dayStart, dragScroll, esc, eventRowHtml, fmtTime, followButtonHtml, icon, orgLogoHtml,
  renderBottomBar, shortDay, toast, wireFollow,
} from '../ui.js';

const AREA_IDS = ['north', 'northeast', 'east', 'central', 'west'];
const POPULAR = 4;

const user = await requireUser();
const $ = (id) => document.getElementById(id);
const now = new Date();
const today = dayStart(now);

const profile = await ensureUserDoc(user);
const follows = new Set(profile.follows || []);
let failed = false;
const orElse = (fallback) => (err) => { console.warn(err); failed = true; return fallback; };
const [publicEvents, followerEvents, orgList] = await Promise.all([
  listPublicEvents(today).catch(orElse([])),
  follows.size ? listFollowerEvents([...follows], today).catch(orElse([])) : [],
  listOrganisations().catch(orElse([])),
]);
const orgs = Object.fromEntries(orgList.map((o) => [o.id, o]));
const seen = new Set();
const upcoming = [...publicEvents, ...followerEvents]
  .filter((e) => !seen.has(e.id) && seen.add(e.id) && e.endAt.toDate() > now)
  .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis());

let cause = '', area = '', search = '';

// Popular this week: the next seven days' events with the most registrations.
function popular() {
  const weekEnd = addDays(today, 7);
  return upcoming.filter((e) => e.startAt.toDate() < weekEnd)
    .map((e) => ({ e, n: (e.counts?.going || 0) + (e.counts?.pending || 0) }))
    .filter(({ n }) => n > 0)
    .sort((a, b) => b.n - a.n || a.e.startAt.toMillis() - b.e.startAt.toMillis())
    .slice(0, POPULAR).map(({ e }) => e);
}

function renderList() {
  const q = search.trim().toLowerCase();
  let list, title;
  if (q) {
    list = upcoming.filter((e) => `${e.title} ${e.orgName}`.toLowerCase().includes(q));
    title = 'Search results';
  } else if (cause) {
    list = upcoming.filter((e) => e.cause === cause);
    title = `${CAUSES[cause]} events`;
  } else if (area) {
    list = upcoming.filter((e) => e.area === area || e.area === 'islandwide');
    title = `${AREAS[area]} events`;
  } else {
    list = popular();
    title = 'Popular this week';
  }
  $('list-title').textContent = title;
  $('list-where').textContent = list.some((e) => e.sample) ? 'Singapore · Sample events' : 'Singapore';
  $('list-action').innerHTML = q || cause || area
    ? `<button type="button" class="sec-link link-btn hit" data-clear>Clear ${icon('close', 14, 2.4)}</button>`
    : `<a class="sec-link" href="index.html#all">View all${icon('chevron')}</a>`;
  $('list').innerHTML = list.length
    ? `<div class="glass list-card">${list.map((e) => eventRowHtml(e, orgs[e.orgId], `${shortDay(e.startAt.toDate(), now)}, ${fmtTime(e.startAt.toDate())}`, { spots: false })).join('')}</div>`
    : '<div class="glass empty-note">No upcoming events match.</div>';

  $('causes').innerHTML = Object.entries(CAUSES).map(([id, label]) => `
    <button type="button" class="cause-chip" data-cause="${id}" aria-pressed="${cause === id}">
      <span class="cause-ic">${icon(id, 16, 2)}</span>${esc(label)}<span class="cause-count">${upcoming.filter((e) => e.cause === id).length}</span>
    </button>`).join('');
  $('areas').innerHTML = AREA_IDS.map((id) => {
    const n = upcoming.filter((e) => e.area === id).length;
    return `<button type="button" class="area-card" data-area="${id}" aria-pressed="${area === id}" style="background:var(--area-${id})">
      <span class="area-name">${esc(AREAS[id])}</span><span class="area-count">${n} ${n === 1 ? 'event' : 'events'}</span></button>`;
  }).join('');
}

function renderOrgs() {
  $('orgs').innerHTML = orgList.map((o) => `<div class="org-row">
    <a class="org-row-link" href="organisation.html?id=${encodeURIComponent(o.id)}">${orgLogoHtml(o, 42, true)}
      <span class="org-row-text"><span class="org-row-name">${esc(o.name)}</span><span class="org-row-line">${esc(o.tagline || '')}</span></span></a>
    ${followButtonHtml(o, follows.has(o.id))}</div>`).join('');
}

$('search-toggle').innerHTML = icon('search', 20, 2);
$('search-toggle').addEventListener('click', () => {
  const open = $('search').hidden;
  $('search').hidden = !open;
  $('search-toggle').setAttribute('aria-expanded', String(open));
  search = '';
  $('search').value = '';
  if (open) { cause = ''; area = ''; $('search').focus(); }
  renderList();
});
$('search').addEventListener('input', (e) => { search = e.target.value; cause = ''; area = ''; renderList(); });
document.querySelector('main').addEventListener('click', (e) => {
  const causeBtn = e.target.closest('[data-cause]'), areaBtn = e.target.closest('[data-area]');
  if (causeBtn) { cause = cause === causeBtn.dataset.cause ? '' : causeBtn.dataset.cause; area = ''; search = ''; $('search').value = ''; }
  else if (areaBtn) { area = area === areaBtn.dataset.area ? '' : areaBtn.dataset.area; cause = ''; search = ''; $('search').value = ''; }
  else if (e.target.closest('[data-clear]')) { cause = ''; area = ''; search = ''; $('search').value = ''; }
  else return;
  renderList();
});
wireFollow($('orgs'), user.uid, follows, renderOrgs);

$('avatar').outerHTML = avatarHtml({ uid: user.uid, name: profile.name, email: user.email, photoUrl: profile.photoUrl });
$('see-all').insertAdjacentHTML('beforeend', icon('chevron'));
renderList();
renderOrgs();
renderBottomBar('discover');
dragScroll($('causes'), 'x');
dragScroll($('areas'), 'x');
dragScroll(document.scrollingElement, 'y');
document.body.classList.remove('is-loading');
if (failed) toast('Some of Discover couldn’t load.');
