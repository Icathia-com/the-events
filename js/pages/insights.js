// Insights (design/Insights.dc.html), for the event's admins: registered, waiting, cancelled, spots filled,
// attendance and where registrations came from. Page views aren't counted (see Decisions to confirm).
import { requireUser } from '../auth.js';
import { getEvent, getEventRole, listAttendance, listRegistrations, SOURCES } from '../data.js';
import { dragScroll, esc, hoursText, icon, reveal } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
const event = eventId ? await getEvent(eventId).catch(() => null) : null;
const role = event ? await getEventRole(event, eventId, user).catch(() => null) : null;
const q = `?id=${encodeURIComponent(eventId)}`;

if (!event || role !== 'admin') {
  main.innerHTML = `<div class="top-row"><a class="ib" href="${event ? `manage.html${q}` : 'index.html'}" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">Only the organisation’s admins can see insights.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

const [regs, attendance] = await Promise.all([listRegistrations(eventId).catch(() => []), listAttendance(eventId).catch(() => [])]);
const c = event.counts || {};
const going = c.going || 0, waiting = (c.pending || 0) + (c.waitlist || 0);
const cancelled = regs.filter((r) => r.status === 'cancelled').length;
const capacity = event.registration?.capacity;
const filled = capacity ? Math.min(100, Math.round((going / capacity) * 100)) : null;
const confirmed = attendance.filter((a) => a.status === 'confirmed');
const hours = confirmed.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
const pct = (n, of) => (of ? Math.round((n / of) * 100) : 0);

// Every registration that came in (whatever its status now) by where it came from; older ones have no source.
const counted = regs.filter((r) => r.registeredAt);
const sources = Object.entries(SOURCES).map(([id, label]) => [label, counted.filter((r) => r.source === id).length]);
const unknown = counted.filter((r) => !(r.source in SOURCES)).length;
if (unknown) sources.push(['Not recorded', unknown]);

const bar = (value, cls = '') => `<span class="bar${cls}"><span style="width:${value}%"></span></span>`;
main.innerHTML = `
  <header class="mg-head"><a class="ib" href="manage.html${q}" aria-label="Back to Manage event">${icon('back', 20)}</a>
    <span class="mg-head-text grow"><h1>Insights</h1></span>${event.sample ? '<span class="tag">Sample data</span>' : ''}</header>
  <div class="stat-row">
    <div class="glass stat-tile"><b>${going}</b><span>Registered</span></div>
    <div class="glass stat-tile"><b>${waiting}</b><span>Waiting for approval</span></div>
    <div class="glass stat-tile"><b>${cancelled}</b><span>Cancelled</span></div>
  </div>
  <div class="glass insight-card"><span class="insight-head"><span class="card-title">Spots filled</span><b>${filled == null ? 'No limit' : `${filled}%`}</b></span>
    ${filled == null ? `<span class="meta">${going} registered</span>` : `${bar(filled)}<span class="meta">${esc(`${going} of ${capacity} spots · ${Math.max(0, capacity - going)} left`)}</span>`}</div>
  <div class="glass insight-card"><span class="insight-head"><span class="card-title">Attendance</span><b>${esc(`${confirmed.length} of ${going} marked`)}</b></span>
    ${bar(pct(confirmed.length, going), ' is-clay')}<span class="meta">Hours added so far: ${esc(hoursText(hours))}.</span></div>
  <div class="lbl">Where registrations came from</div>
  <div class="glass insight-card">${counted.length ? sources.map(([label, n]) => `<div class="source-row">
      <span class="insight-head"><span>${esc(label)}</span><b>${pct(n, counted.length)}%</b></span>${bar(pct(n, counted.length), ' is-thin')}</div>`).join('')
    : '<span class="meta">No registrations yet.</span>'}</div>`;
dragScroll(document.scrollingElement, 'y');
reveal();
