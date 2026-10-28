// Apply to join (Phase 2, from "Run a non-profit?" on the Organisations tab): the organisation's profile. It's created
// pending, with the applicant as its admin, and stays hidden from everyone else until the network admin approves it.
import { requireUser } from '../auth.js';
import { applyOrganisation, AREAS, CAUSES, ensureUserDoc } from '../data.js';
import { dragScroll, esc, icon, reveal, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const profile = await ensureUserDoc(user);
const causes = new Set();
let area = 'islandwide', busy = false;

const chips = (list, attr, on) => Object.entries(list).map(([id, label]) =>
  `<button type="button" class="area-chip" data-${attr}="${id}" aria-pressed="${on(id)}">${esc(label)}</button>`).join('');

function render() {
  main.innerHTML = `
    <header class="mg-head"><a class="ib" href="organisations.html" aria-label="Back to Organisations">${icon('back', 20)}</a>
      <span class="mg-head-text"><h1>Apply to join</h1></span></header>
    <form class="glass compose-card" id="apply" novalidate>
      <input class="field-flat is-strong" name="name" aria-label="Organisation name" placeholder="Organisation name" maxlength="100" required>
      <input class="field-flat" name="tagline" aria-label="Tagline" placeholder="Tagline" maxlength="120">
      <div class="lbl">Causes</div>
      <div class="area-chips" role="group" aria-label="Causes" id="causes">${chips(CAUSES, 'cause', (id) => causes.has(id))}</div>
      <div class="lbl">Area</div>
      <div class="area-chips" role="group" aria-label="Area" id="areas">${chips(AREAS, 'area', (id) => id === area)}</div>
      <div class="lbl">Contact details</div>
      <input class="field-flat" name="email" type="email" inputmode="email" aria-label="Contact email" placeholder="Email" maxlength="200" required>
      <input class="field-flat" name="address" aria-label="Address" placeholder="Address" maxlength="200">
      <input class="field-flat" name="website" aria-label="Website" placeholder="Website" maxlength="200">
      <div class="lbl">About</div>
      <textarea class="field-area" name="about" aria-label="About your organisation" placeholder="About your organisation" maxlength="2000"></textarea>
      <input class="field-flat" name="givingUrl" type="url" inputmode="url" aria-label="Giving page link" placeholder="Link to your giving page" maxlength="500">
      <button type="submit" class="big-btn">Send application</button>
    </form>`;
}

main.addEventListener('click', (e) => {
  const cause = e.target.closest('[data-cause]'), pick = e.target.closest('[data-area]');
  if (cause) {
    const id = cause.dataset.cause;
    if (causes.has(id)) causes.delete(id); else causes.add(id);
    cause.setAttribute('aria-pressed', String(causes.has(id)));
  }
  if (pick) {
    area = pick.dataset.area;
    main.querySelectorAll('[data-area]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.area === area)));
  }
});

main.addEventListener('submit', async (e) => {
  if (e.target.id !== 'apply' || busy) return;
  e.preventDefault();
  const f = new FormData(e.target);
  const get = (k) => String(f.get(k) || '').trim();
  const fields = {
    name: get('name'), tagline: get('tagline'), causes: [...causes], area, email: get('email'),
    address: get('address'), website: get('website'), about: get('about'), givingUrl: get('givingUrl'),
  };
  if (!fields.name) { toast('Add the organisation’s name.'); return; }
  if (!fields.causes.length) { toast('Choose at least one cause.'); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) { toast('Add a contact email.'); return; }
  if (fields.givingUrl && !/^https:\/\/\S+$/.test(fields.givingUrl)) { toast('The giving link needs to start with https://'); return; }
  busy = true;
  e.target.querySelector('[type="submit"]').disabled = true;
  try {
    await applyOrganisation(user.uid, profile.name || user.email, fields);
    main.innerHTML = `
      <header class="mg-head"><a class="ib" href="organisations.html" aria-label="Back to Organisations">${icon('back', 20)}</a>
        <span class="mg-head-text"><h1>Apply to join</h1></span></header>
      <div class="glass empty-state is-page"><span class="empty-ic">${icon('check', 26, 2.4)}</span>
        <span class="empty-title" tabindex="-1" id="sent">Application sent</span>
        <span class="meta">${esc(fields.name)} is waiting for review.</span>
        <a class="btn-small" href="profile.html">Your profile</a></div>`;
    main.querySelector('#sent').focus();
  } catch (err) {
    console.warn(err);
    toast('Couldn’t send the application.');
    busy = false;
    e.target.querySelector('[type="submit"]').disabled = false;
  }
});

render();
dragScroll(document.scrollingElement, 'y');
reveal();
