// Manage menu (design/Manage-Event.dc.html). Every row from the canvas is shown; the ones that arrive in later
// phases are marked Soon.
import { requireUser } from '../auth.js';
import { cancelEvent, getEvent, getEventRole, getMyRole } from '../data.js';
import { coverHtml, dateParts, dragScroll, esc, fmtTime, icon, openModal, reveal, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
let event = eventId ? await getEvent(eventId).catch(() => null) : null;
const role = event ? await getEventRole(event, eventId, user).catch(() => null) : null;

if (!event || !role) {
  main.innerHTML = `<div class="top-row"><a class="ib" href="index.html" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">Only the organisation’s members can manage this event.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

const isAdmin = role === 'admin';
// Hosts are managed by the organisation's own admins, not by the event's co-hosts.
const orgAdmin = isAdmin && (await getMyRole(event.orgId, user.uid).catch(() => null)) === 'admin';
const q = `?id=${encodeURIComponent(eventId)}`;

// A row: a link when it works, a dimmed row with "Soon" when it comes later.
function row({ href, iconName, tile, title, sub, soon, small, action, danger, disabled }) {
  const lead = small ? icon(iconName, 20, 2) : `<span class="mg-ic" style="background:var(--tile-${tile})">${icon(iconName, 18, 2)}</span>`;
  const text = `<span class="mg-text"><span class="mg-title">${esc(title)}${soon ? '<span class="soon">Soon</span>' : ''}</span>${sub ? `<span class="mg-sub">${esc(sub)}</span>` : ''}</span>`;
  const cls = `mg-row${small ? ' is-small' : ''}${soon ? ' is-soon' : ''}${danger ? ' is-danger' : ''}`;
  if (soon) return `<div class="${cls}" aria-disabled="true">${lead}${text}</div>`;
  if (action) return `<button type="button" class="${cls}" data-action="${action}"${disabled ? ' disabled' : ''}>${lead}${text}</button>`;
  return `<a class="${cls}" href="${href}">${lead}${text}${small ? '' : icon('chevron', 16)}</a>`;
}

function render() {
  const start = event.startAt.toDate(), end = event.endAt.toDate(), p = dateParts(start);
  const cancelled = event.status === 'cancelled';
  const { going = 0, pending = 0 } = event.counts || {};
  const capacity = event.registration?.capacity;
  const status = cancelled ? ['Cancelled', 'chip-danger'] : [capacity ? `${going} of ${capacity} spots filled` : `${going} registered`, 'chip-ok'];
  const visibility = { public: 'Public', followers: 'Followers only', draft: 'Draft' }[event.visibility] || 'Public';
  main.innerHTML = `
    <header class="mg-head"><a class="ib" href="event.html${q}" aria-label="Back to the event">${icon('back', 20)}</a>
      <span class="mg-head-text"><h1>Manage event</h1><span class="mg-head-sub ellipsis">${esc(event.title)}</span></span></header>
    <a class="glass mg-event" href="event.html${q}">${coverHtml(event, 64, 14, 10)}
      <span class="ev-text"><span class="ev-title">${esc(event.title)}</span>
        <span class="meta">${esc(`${p.weekday.slice(0, 3)} ${p.day} ${p.month.slice(0, 3)}, ${fmtTime(start)} – ${fmtTime(end)}`)}</span>
        <span class="mg-chips"><span class="chip ${status[1]}">${esc(status[0])}</span><span class="chip chip-muted">${visibility}</span></span></span></a>
    <div class="glass mg-card">
      ${isAdmin ? row({ href: `create.html${q}`, iconName: 'edit', tile: 'details', title: 'Event details', sub: 'Name, description, time and location' }) : ''}
      ${row({ href: `volunteers.html${q}`, iconName: 'organisations', tile: 'volunteers', title: 'Volunteers', sub: `${going} going${pending ? ` · ${pending} waiting for approval` : ''}` })}
      ${orgAdmin ? row({ href: `hosts.html${q}`, iconName: 'hosts', tile: 'hosts', title: 'Hosts', sub: 'Add co-hosts and event staff' }) : ''}
      ${row({ href: `checkin.html${q}`, iconName: 'qr', tile: 'checkin', title: 'Check-in options', sub: 'QR scanning, manual attendance and staff' })}
      ${row({ href: `checkout.html${q}`, iconName: 'clock', tile: 'checkout', title: 'Check-out and hours', sub: 'Check-out code, confirm hours, claims from volunteers' })}
    </div>
    <div class="glass mg-card">
      ${isAdmin ? row({ href: `access.html${q}`, iconName: 'ticket', tile: 'access', title: 'Access and registration', sub: 'Visibility, spots, approval, free or paid on site' }) : ''}
      ${isAdmin ? row({ href: `vouchers.html${q}`, iconName: 'voucher', tile: 'vouchers', title: 'Vouchers and access codes', sub: 'Codes for groups, partners or reserved spots' }) : ''}
      ${isAdmin ? row({ href: `questions.html${q}`, iconName: 'doc', tile: 'questions', title: 'Registration questions', sub: 'What to ask volunteers when they sign up' }) : ''}
      ${isAdmin ? row({ href: `announcements.html${q}`, iconName: 'message', tile: 'announce', title: 'Announcements', sub: 'Message everyone who registered' }) : ''}
      ${row({ iconName: 'insights', tile: 'insights', title: 'Insights', sub: 'Page views, registrations and attendance', soon: true })}
    </div>
    <div class="glass mg-card">
      ${row({ iconName: 'invite', title: 'Invite volunteers', small: true, soon: true })}
      ${row({ href: `checkin.html${q}`, iconName: 'checkin', title: 'Check in volunteers', small: true })}
      ${row({ iconName: 'chat', title: 'Start event chat', small: true, soon: true })}
    </div>
    <div class="glass mg-card">
      ${row({ iconName: 'clone', title: 'Clone event', small: true, soon: true })}
      ${row({ iconName: 'transfer', title: 'Transfer to another organisation', small: true, soon: true })}
    </div>
    ${isAdmin ? `<div class="glass mg-card">${row({ action: 'cancel', iconName: 'cancel', title: cancelled ? 'Event cancelled' : 'Cancel event', small: true, danger: true, disabled: cancelled })}</div>` : ''}`;
}

main.addEventListener('click', (e) => {
  if (!e.target.closest('[data-action="cancel"]')) return;
  const sheet = openModal({
    kind: 'sheet',
    title: 'Cancel this event?',
    body: `<span class="sheet-ic">${icon('alert', 22, 2)}</span>
      <span class="sheet-text">Registered volunteers will see it as cancelled. This cannot be undone.</span>
      <button type="button" class="btn btn-danger" data-confirm>Cancel event</button>`,
  });
  const confirm = sheet.element.querySelector('[data-confirm]');
  confirm.addEventListener('click', async () => {
    confirm.disabled = true;
    try {
      await cancelEvent(eventId);
      event = await getEvent(eventId);
      sheet.close();
      render();
      toast('Event cancelled');
    } catch (err) {
      console.warn(err);
      toast('Couldn’t cancel the event.');
      confirm.disabled = false;
    }
  });
});

render();
dragScroll(document.scrollingElement, 'y');
reveal();
