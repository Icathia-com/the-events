// Hours record (design/Hours-Record.dc.html): the volunteer's confirmed hours, each line with its own reference
// number, claims still waiting, and a verification code. The record's reference is its latest entry's, so each
// version of the record has its own, and the code opens verify.html?ref= (the page itself is Phase 3).
// Share, PDF and letter requests are Phase 3, so they're hidden.
import { requireUser } from '../auth.js';
import { ensureUserDoc, getEvent, listHours, myAttendance, syncHours } from '../data.js';
import { qrSvg } from '../qr.js';
import { dateParts, dragScroll, esc, hoursText, icon, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const profile = await ensureUserDoc(user);
await syncHours(user.uid).catch((err) => console.warn(err)); // confirmed attendance and due claims become entries

let failed = false;
const orElse = (fallback) => (err) => { console.warn(err); failed = true; return fallback; };
const [entries, attendance] = await Promise.all([listHours(user.uid).catch(orElse([])), myAttendance(user.uid).catch(orElse({}))]);
const claims = await Promise.all(Object.entries(attendance).filter(([, a]) => a.status === 'claimed')
  .map(async ([eventId, a]) => ({ ...a, eventId, event: await getEvent(eventId).catch(() => null) })));

const month = (date) => { const p = dateParts(date); return { m: p.month.slice(0, 3), y: p.year }; };
const fullDate = (date) => { const p = dateParts(date); return `${p.day} ${p.month.slice(0, 3)} ${p.year}`; };
const dayMonth = (date) => { const p = dateParts(date); return `${p.day} ${p.month.slice(0, 3)}`; };

// "Aug to Oct 2026": from the earliest entry's month to the latest's.
function period(first, last) {
  const a = month(first), b = month(last);
  if (a.y !== b.y) return `${a.m} ${a.y} to ${b.m} ${b.y}`;
  return a.m === b.m ? `${a.m} ${a.y}` : `${a.m} to ${b.m} ${a.y}`;
}

function confirmedBy(entry) {
  if (entry.confirmedBy === 'code') return 'confirmed by check-out code';
  if (entry.confirmedBy === 'auto') return 'confirmed automatically after 7 days';
  if (entry.confirmedBy === user.uid && profile.name) return `confirmed by ${profile.name}`;
  return 'confirmed by the organiser';
}

const dated = entries.filter((e) => e.date?.toDate);
const total = entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
const [latest, oldest] = [dated[0], dated.at(-1)]; // listHours is newest first
const fact = (label, value) => `<span class="record-fact"><span>${esc(label)}</span><b>${esc(value)}</b></span>`;

const rows = entries.map((e) => `<div class="record-row">
  <span class="record-row-text"><span class="record-row-title">${esc(e.eventTitle)}</span>
    <span class="record-row-line">${esc([e.orgName, e.date?.toDate ? fullDate(e.date.toDate()) : '', confirmedBy(e)].filter(Boolean).join(' · '))}</span>
    <span class="record-ref">${esc(e.reference || '')}</span></span>
  <span class="record-hours">${esc(`${Number(e.hours) || 0} h`)}</span></div>`).join('');

const verifyUrl = latest?.reference ? new URL(`verify.html?ref=${encodeURIComponent(latest.reference)}`, location.href) : null;

const pending = claims.map((c) => {
  const where = [c.event?.title, c.event?.orgName].filter(Boolean).join(' · ');
  const auto = c.autoConfirmAt?.toDate ? ` · confirms itself on ${dayMonth(c.autoConfirmAt.toDate())}` : '';
  return `<div class="glass pending-card"><span class="claim-icon">${icon('clock', 20, 2)}</span>
    <span class="claim-text"><span class="claim-title">${esc(hoursText(Number(c.hours) || 0))} waiting for confirmation</span>
      <span class="claim-line">${esc(where + auto)}</span></span>
    <a class="sec-link hit" href="claim.html?id=${encodeURIComponent(c.eventId)}">View</a></div>`;
}).join('');

main.innerHTML = `
  <header class="mg-head"><a class="ib" href="profile.html" aria-label="Back to Profile">${icon('back', 20)}</a>
    <span class="mg-head-text grow"><h1>Hours record</h1></span></header>
  <article class="record">
    <div class="record-top"><span class="record-brand"><span class="record-kicker">The Events</span>
      <h2 class="record-title">Record of volunteer hours</h2></span><span class="record-mark" aria-hidden="true"></span></div>
    <div class="record-facts">
      ${fact('Volunteer', profile.name || user.email)}${fact('Confirmed hours', hoursText(total))}
      ${latest ? fact('Period', period(oldest.date.toDate(), latest.date.toDate())) + fact('Reference', latest.reference || '') : ''}
    </div>
    ${rows ? `<div class="record-rows">${rows}</div>` : '<p class="record-empty">No confirmed hours yet.</p>'}
    ${verifyUrl ? `<div class="record-verify"><span class="record-qr">${qrSvg(verifyUrl.href, 'Verification code for this record')}</span>
      <span class="record-note">Scan to verify this record at ${esc(verifyUrl.host + verifyUrl.pathname)}. Each line was confirmed by the organisation named, at the time shown in the app’s log.</span></div>` : ''}
  </article>
  ${pending}`;

dragScroll(document.scrollingElement, 'y');
document.body.classList.remove('is-loading');
if (failed) toast('Some of your record couldn’t load.');
