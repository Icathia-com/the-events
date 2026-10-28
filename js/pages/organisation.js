// Organisation page (design/Organisation.dc.html). Read-only for volunteers; the organisation's admins can edit
// About and the giving link. Letter requests are Phase 3, so they aren't shown.
import { requireUser } from '../auth.js';
import {
  AREAS, CAUSES, countClaims, ensureUserDoc, followOrg, getMyRole, getOrganisation, listFollowerEvents, listOrgPastEvents,
  listOrgPublicEvents, unfollowOrg, updateOrganisation,
} from '../data.js';
import {
  coverHtml, dateParts, dayStart, dragScroll, esc, fmtTime, gradient, icon, orgLogoHtml, reveal, shortDay, spotsChip, toast,
} from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const orgId = new URLSearchParams(location.search).get('id');
const now = new Date();

const profile = await ensureUserDoc(user);
let org = orgId ? await getOrganisation(orgId).catch(() => null) : null;

if (!org) {
  main.innerHTML = `<div class="top-row"><a class="ib" href="organisations.html" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">This organisation isn’t available.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

const role = await getMyRole(orgId, user.uid).catch(() => null);
const mine = role === 'admin';
const follows = new Set(profile.follows || []);
let editing = false, events = [];

async function loadEvents() {
  const today = dayStart(now);
  const [pub, fol] = await Promise.all([
    listOrgPublicEvents(orgId, today).catch(() => []),
    follows.has(orgId) || role ? listFollowerEvents([orgId], today).catch(() => []) : [],
  ]);
  const seen = new Set();
  events = [...pub, ...fol].filter((e) => !seen.has(e.id) && seen.add(e.id) && e.endAt.toDate() > now)
    .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis());
}

function eventRow(e) {
  const start = e.startAt.toDate();
  return `<a class="ev-row" href="event.html?id=${encodeURIComponent(e.id)}" draggable="false">${coverHtml(e, 64, 14, 9)}
    <span class="ev-text"><span class="ev-title clamp2">${esc(e.title)}</span>
      <span class="ev-meta"><span>${esc(`${shortDay(start, now)}, ${fmtTime(start)}`)}</span>${spotsChip(e)}</span></span>
    ${icon('chevron', 16)}</a>`;
}

// The admin's past events, each with its waiting claims, linking to its check-out and hours page.
let past = null;
async function loadPast() {
  const list = await listOrgPastEvents(orgId);
  const counts = await Promise.all(list.map((e) => countClaims(e.id).catch(() => 0)));
  past = list.map((e, i) => ({ ...e, claims: counts[i] }));
}

function pastRow(e) {
  const start = e.startAt.toDate();
  const n = e.claims;
  return `<a class="ev-row" href="checkout.html?id=${encodeURIComponent(e.id)}" draggable="false">${coverHtml(e, 64, 14, 9)}
    <span class="ev-text"><span class="ev-title clamp2">${esc(e.title)}</span>
      <span class="ev-meta"><span>${esc(`${shortDay(start, now)}, ${fmtTime(start)}`)}</span>${n
        ? `<span class="chip chip-wait">${n} ${n === 1 ? 'claim' : 'claims'} waiting</span>` : '<span>No claims</span>'}</span></span>
    ${icon('chevron', 16)}</a>`;
}

const pastHtml = () => !past ? '' : `<div class="lbl">Past events</div>
  ${past.length ? `<div class="glass list-card">${past.map(pastRow).join('')}</div>` : '<div class="glass empty-note">No past events.</div>'}`;

function about() {
  if (editing) {
    return `<form class="glass edit-card" id="about-form">
      <textarea class="field-area" name="about" aria-label="About your organisation" maxlength="2000">${esc(org.about || '')}</textarea>
      <input class="field-flat" name="givingUrl" type="url" inputmode="url" aria-label="Giving page link" placeholder="Link to your giving page" value="${esc(org.givingUrl || '')}" maxlength="500">
      <button class="btn btn-primary" type="submit">Done</button></form>`;
  }
  return `<div class="glass about-card">${esc(org.about || '')}</div>`;
}

function render() {
  const on = follows.has(orgId);
  const p = org.approvedAt ? dateParts(org.approvedAt.toDate()) : null;
  const stats = org.stats || {};
  const tags = [...(org.causes || []).map((c) => CAUSES[c]), AREAS[org.area]].filter(Boolean);
  const give = /^https:\/\//.test(org.givingUrl || '')
    ? `<a class="act act-narrow" href="${esc(org.givingUrl)}" target="_blank" rel="noopener noreferrer">${icon('heart', 20, 2)}Give</a>` : '';
  document.title = `${org.name} · The Events`;
  main.innerHTML = `
    <div class="top-row">
      <a class="ib" href="organisations.html" data-action="back" aria-label="Back">${icon('back', 20)}</a>
      <button type="button" class="ib" data-action="share" aria-label="Share organisation">${icon('share', 20, 2)}</button>
    </div>
    <section class="glass org-hero">
      <div class="org-band" style="background:${gradient(org.logoColors)}"></div>
      <div class="org-hero-body">
        <div class="org-hero-top">${orgLogoHtml(org, 76)}${mine ? '<span class="tag-forest">Your organisation</span>' : ''}</div>
        <div class="stack-6">
          <h1 class="org-name">${esc(org.name)}</h1>
          ${org.tagline ? `<span class="org-tagline">${esc(org.tagline)}</span>` : ''}
          <span class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>
        </div>
        <div class="stats">
          <span class="stat"><b>${Number(stats.events || 0).toLocaleString('en-SG')}</b><span>Events this year</span></span>
          <span class="stat"><b>${Number(stats.volunteers || 0).toLocaleString('en-SG')}</b><span>Volunteers</span></span>
          <span class="stat"><b>${Number(stats.hours || 0).toLocaleString('en-SG')}</b><span>Hours given</span></span>
        </div>
      </div>
    </section>
    <div class="act-row">
      <button type="button" class="follow-big" data-action="follow" aria-pressed="${on}">${on ? 'Following' : 'Follow'}</button>
      <a class="act act-narrow" href="#contact">${icon('mail', 20, 2)}Contact</a>${give}
    </div>
    ${mine ? `<div class="act-row">
      <a class="act act-short" href="create.html">${icon('plus', 18, 2.4)}New event</a>
      <button type="button" class="act act-short act-square" data-action="edit" aria-label="Edit About and the giving link" aria-pressed="${editing}">${icon('edit', 18, 2)}</button>
    </div>` : ''}
    <div class="stack-6"><div class="lbl">About</div>${about()}</div>
    <div class="stack-6">
      <div class="lbl-row"><span class="lbl">Upcoming events</span>${events.some((e) => e.sample) ? '<span class="sec-sub">Sample events</span>' : ''}</div>
      ${events.length ? `<div class="glass list-card">${events.map(eventRow).join('')}</div>` : '<div class="glass empty-note">No upcoming events.</div>'}
    </div>
    ${mine ? `<div class="stack-6" id="past">${pastHtml()}</div>` : ''}
    ${(org.impact || []).length ? `<div class="stack-6"><div class="lbl">Past impact</div><div class="glass impact-card">
      ${org.impact.map((i) => `<div class="impact-row"><span class="impact-ic" style="background:${gradient(org.logoColors)}">${icon('check', 18, 2)}</span>
        <span class="detail-text"><span class="detail-value">${esc(i.title)}</span><span class="meta">${esc(i.line)}</span></span></div>`).join('')}</div></div>` : ''}
    <div class="stack-6" id="contact"><div class="lbl">Contact</div><div class="glass contact-card">
      ${org.email ? `<div class="contact-row">${icon('mail', 18, 2)}<span>${esc(org.email)}</span></div>` : ''}
      ${org.address ? `<div class="contact-row">${icon('pin', 18, 2)}<span>${esc(org.address)}</span></div>` : ''}
      ${org.website ? `<div class="contact-row">${icon('globe', 18, 2)}<span>${esc(org.website)}</span></div>` : ''}
    </div></div>
    ${p ? `<p class="footnote">Approved member of the network since ${esc(p.month)} ${p.year}. Giving goes to the organisation’s own page; the app does not handle donations.</p>` : ''}`;
}

main.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'back' && document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
  if (action === 'share') {
    const url = location.href;
    if (navigator.share) navigator.share({ title: org.name, url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => toast('Link copied'), () => toast('Couldn’t copy the link.'));
  }
  if (action === 'edit') { editing = !editing; render(); if (editing) main.querySelector('textarea')?.focus(); }
  if (action === 'follow') {
    const on = follows.has(orgId);
    target.disabled = true;
    try {
      await (on ? unfollowOrg : followOrg)(user.uid, orgId);
      if (on) follows.delete(orgId); else follows.add(orgId);
      await loadEvents();
    } catch (err) {
      console.warn(err);
      toast('Couldn’t update that.');
    }
    render();
  }
});

main.addEventListener('submit', async (e) => {
  if (e.target.id !== 'about-form') return;
  e.preventDefault();
  const form = new FormData(e.target);
  const aboutText = String(form.get('about') || '').trim();
  const givingUrl = String(form.get('givingUrl') || '').trim();
  if (givingUrl && !/^https:\/\/\S+$/.test(givingUrl)) { toast('The giving link needs to start with https://'); return; }
  try {
    await updateOrganisation(orgId, { about: aboutText, givingUrl });
    org = await getOrganisation(orgId);
    editing = false;
    render();
    toast('Saved');
  } catch (err) {
    console.warn(err);
    toast('Couldn’t save that.');
  }
});

await Promise.all([loadEvents(), mine && loadPast().catch((err) => console.warn(err))]);
render();
dragScroll(document.scrollingElement, 'y');
reveal();
if (location.hash === '#contact') document.getElementById('contact')?.scrollIntoView();
