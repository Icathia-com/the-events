// Claim your hours (design/Claim-Hours.dc.html): after an event that ended without the hours confirmed, the volunteer
// scans the organiser's check-out code or claims the hours without it. A claim after a check-in confirms itself 7 days
// later if the organiser doesn't decide first; in Phase 1 the volunteer's app does that on their next visit.
import { requireUser } from '../auth.js';
import { claimHours, getEvent, getMyAttendance, getMyRegistration, syncHours } from '../data.js';
import { scanCheckOut } from '../scanner.js';
import { coverHtml, dateParts, dragScroll, esc, fmtTime, hoursText, icon, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
const event = eventId ? await getEvent(eventId).catch(() => null) : null;
let reg = null, att = null;

const head = `<header class="mg-head"><a class="ib" href="index.html" aria-label="Back to Home">${icon('back', 20)}</a>
  <span class="mg-head-text grow"><h1>Claim your hours</h1></span></header>`;

if (!event) {
  main.innerHTML = `${head}<div class="glass empty-note">This event isn’t available.</div>`;
  document.body.classList.remove('is-loading');
  await new Promise(() => {}); // nothing more to show
}

// "Sat 17 Oct"
const day = (date) => { const p = dateParts(date); return `${p.weekday.slice(0, 3)} ${p.day} ${p.month.slice(0, 3)}`; };

async function load() {
  await syncHours(user.uid).catch(() => 0); // also confirms claims that are due
  [reg, att] = await Promise.all([getMyRegistration(eventId, user.uid), getMyAttendance(eventId, user.uid)]);
}

function eventCard() {
  const start = event.startAt.toDate(), end = event.endAt.toDate();
  return `<div class="glass claim-event">${coverHtml(event, 64, 14, 9)}
    <span class="claim-event-text"><span class="claim-org">${esc(event.orgName)}</span>
      <span class="claim-event-title">${esc(event.title)}</span>
      <span class="claim-when">${esc(day(start))} · ${fmtTime(start)} – ${fmtTime(end)} · ${esc(hoursText(Number(event.hours) || 0))}</span></span></div>`;
}

const result = (tone, glyph, title, line) => `<div class="glass claim-result">
  <span class="claim-badge ${tone}">${icon(glyph, 28, tone === 'is-ok' ? 2.6 : 2.2)}</span>
  <span class="claim-head" tabindex="-1">${esc(title)}</span><span class="claim-body">${esc(line)}</span>
  <a class="claim-link" href="hours.html">See my hours record</a></div>`;

function stateCard() {
  const status = att?.status;
  if (status === 'confirmed') {
    return result('is-ok', 'check', `${hoursText(Number(att.hours) || 0)} confirmed`, 'Added to your record. Thank you for coming.');
  }
  if (status === 'claimed') {
    return result('is-wait', 'clock', `Claim sent to ${event.orgName}`, att.autoConfirmAt
      ? `The organiser can confirm it any time. If they do not respond, it confirms itself on ${day(att.autoConfirmAt.toDate())}.`
      : 'The organiser needs to confirm you were there.');
  }
  if (status === 'declined') return result('is-no', 'close', 'Claim declined', `${event.orgName} declined this claim.`);
  if (reg?.status !== 'going') return '<div class="glass empty-note">Claims are for volunteers who were going to this event.</div>';
  if (event.endAt.toDate() > new Date()) return '<div class="glass empty-note">Hours can be claimed once the event has ended.</div>';

  const checkedIn = att?.checkedInAt?.toDate();
  return `<div class="glass claim-box">
    <span class="claim-status"><span class="claim-icon">${icon('clock', 18, 2)}</span>
      <span class="claim-text"><span class="claim-title">${checkedIn ? `You checked in at ${fmtTime(checkedIn)}` : 'No check-in recorded'}</span>
        <span class="claim-line">${checkedIn ? 'But there is no check-out, so the hours are not confirmed yet.' : 'The organiser will need to confirm you were there.'}</span></span></span>
    <button type="button" class="btn btn-primary claim-btn" data-action="scan">${icon('qr', 18)}Scan the organiser’s check-out code</button>
    <button type="button" class="btn btn-secondary claim-btn" data-action="claim">Claim ${esc(hoursText(Number(event.hours) || 0))} without a code</button>
    <span class="claim-help">${checkedIn
      ? 'A claim is sent to the organiser. Because you checked in, it confirms itself after 7 days if they do not respond.'
      : 'A claim is sent to the organiser. Without a check-in it stays pending until they confirm it.'}</span>
  </div>`;
}

function render() {
  main.innerHTML = head + eventCard() + stateCard();
}

// After a claim or a check-out, the new state's heading takes focus.
async function refresh() {
  await load();
  render();
  main.querySelector('.claim-head')?.focus();
}

main.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'scan') {
    scanCheckOut(eventId, user.uid, () => refresh().catch((err) => console.warn(err)));
  } else if (button.dataset.action === 'claim') {
    button.disabled = true;
    try {
      await claimHours(eventId, user.uid);
      await refresh();
    } catch (err) {
      console.warn(err);
      toast('Couldn’t send the claim.');
      button.disabled = false;
    }
  }
});

await load();
render();
dragScroll(document.scrollingElement, 'y');
document.body.classList.remove('is-loading');
