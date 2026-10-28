// Vouchers and access codes (design/Vouchers.dc.html), for the event's admins: reserved spots, skip approval, unlock
// a hidden event, and a discount on the on-site fee, each with a use limit and an expiry date.
import { requireUser } from '../auth.js';
import { Timestamp } from '../firebase.js';
import { CODE_KINDS, createCode, deleteCode, getEvent, getEventRole, listCodes } from '../data.js';
import { dragScroll, esc, icon, reveal, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
const event = eventId ? await getEvent(eventId).catch(() => null) : null;
const role = event ? await getEventRole(event, eventId, user).catch(() => null) : null;
const q = `?id=${encodeURIComponent(eventId)}`;

if (!event || role !== 'admin') {
  main.innerHTML = `<div class="top-row"><a class="ib" href="${event ? `manage.html${q}` : 'index.html'}" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">Only the organisation’s admins can see the codes.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

const HELP = {
  reserve: 'Holds spots that only people with the code can take, for example a company team or a school group.',
  skip: 'Volunteers with the code are approved instantly, for example your regulars.',
  unlock: 'Lets someone register for a followers-only or draft event.',
  discount: 'Takes an amount off a fee collected on site.',
};
// Dates are whole days in Singapore: a code works until the end of its expiry day.
const eventDay = new Date(event.startAt.toMillis() + 8 * 3600e3).toISOString().slice(0, 10);
const endOfDay = (day) => Timestamp.fromMillis(new Date(`${day}T00:00:00+08:00`).getTime() + 86400e3);
const dayOf = (ts) => new Date(ts.toMillis() - 86400e3 + 8 * 3600e3).toISOString().slice(0, 10);

let codes = [], editing = false, draft = { code: '', kind: 'reserve', amount: '', uses: '', expires: eventDay }, busy = false;
const load = async () => { codes = await listCodes(eventId); };
const canSave = () => !busy && draft.code.length >= 3 && (draft.kind !== 'discount' || Number(draft.amount) > 0)
  && (draft.kind !== 'reserve' || Number(draft.uses) >= 1);

function codeRow(c) {
  const until = c.expiresAt ? ` · until ${dayOf(c.expiresAt).slice(8)}/${dayOf(c.expiresAt).slice(5, 7)}` : '';
  const line = `${CODE_KINDS[c.kind]}${c.kind === 'discount' ? ` · S$${c.amount} off` : ''}${until}`;
  return `<div class="host-row"><span class="code-ic" style="background:var(--code-${c.kind})">${icon(c.kind === 'discount' ? 'dollar' : c.kind === 'unlock' ? 'lock' : 'voucher', 18, 2)}</span>
    <span class="host-text"><span class="code-name">${esc(c.id)}</span><span class="meta">${esc(line)}</span></span>
    <span class="code-used">${c.used || 0} of ${c.uses ?? '∞'} used</span>
    <button type="button" class="remove-btn" data-delete="${esc(c.id)}" aria-label="${esc(`Delete code ${c.id}`)}">${icon('close', 14, 2.4)}</button></div>`;
}

function formHtml() {
  return `<form class="glass compose-card" id="new-code" novalidate>
    <span class="card-title">New code</span>
    <input class="field-flat code-input" id="code" aria-label="Code" placeholder="Code" maxlength="20" autocomplete="off" value="${esc(draft.code)}">
    <div class="lbl">What the code does</div>
    <div class="kind-list" role="radiogroup" aria-label="What the code does">${Object.entries(CODE_KINDS).map(([id, label]) =>
      `<button type="button" class="kind-card" role="radio" data-kind="${id}" aria-checked="${draft.kind === id}">
        <span class="radio-ring">${draft.kind === id ? icon('check', 12, 3) : ''}</span>
        <span class="radio-text"><span class="radio-title">${label}</span><span class="meta">${esc(HELP[id])}</span></span></button>`).join('')}</div>
    ${draft.kind === 'discount' ? `<label class="inline-field"><span>Discount on the on-site fee (S$)</span>
      <input class="field-flat" id="amount" type="number" min="1" step="1" inputmode="numeric" aria-label="Discount amount" value="${esc(draft.amount)}"></label>` : ''}
    <label class="inline-field"><span>Can be used</span>
      <input class="field-flat" id="uses" type="number" min="1" step="1" inputmode="numeric" placeholder="${draft.kind === 'reserve' ? 'Spots' : 'Unlimited'}" aria-label="Maximum uses" value="${esc(draft.uses)}"><span>times</span></label>
    <label class="inline-field"><span>Expires</span>
      <input class="field-flat" id="expires" type="date" aria-label="Expiry date" value="${esc(draft.expires)}"></label>
    <div class="sheet-btns"><button type="button" class="ghost-btn" data-action="cancel">Cancel</button>
      <button type="submit" class="big-btn grow"${canSave() ? '' : ' disabled'}>Create code</button></div>
  </form>`;
}

function render() {
  main.innerHTML = `
    <header class="mg-head"><a class="ib" href="manage.html${q}" aria-label="Back to Manage event">${icon('back', 20)}</a>
      <span class="mg-head-text grow"><h1>Vouchers and access codes</h1></span>
      <button type="button" class="ib" data-action="new" aria-label="New code" aria-expanded="${editing}">${icon('plus', 20, 2.4)}</button></header>
    ${editing ? formHtml() : ''}
    ${codes.length ? `<div class="stack-6"><div class="lbl">Active codes</div><div class="glass host-list">${codes.map(codeRow).join('')}</div></div>`
      : editing ? '' : `<div class="glass empty-state"><span class="empty-ic">${icon('voucher', 24, 2)}</span><span class="empty-title">No codes yet</span>
        <span class="meta">A code can hold spots for a partner or a company team, let regular volunteers skip approval, or take money off an on-site fee.</span>
        <button type="button" class="btn-small" data-action="new">New code</button></div>`}`;
}

main.addEventListener('input', (e) => {
  if (e.target.id === 'code') {
    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean !== e.target.value) e.target.value = clean;
    draft.code = clean;
  }
  if (e.target.id === 'amount') draft.amount = e.target.value;
  if (e.target.id === 'uses') draft.uses = e.target.value;
  if (e.target.id === 'expires') draft.expires = e.target.value;
  const save = main.querySelector('#new-code [type="submit"]');
  if (save) save.disabled = !canSave();
});

main.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-action], [data-kind], [data-delete]');
  if (!t) return;
  if (t.dataset.kind) { draft.kind = t.dataset.kind; render(); main.querySelector(`[data-kind="${draft.kind}"]`)?.focus(); return; }
  if (t.dataset.action === 'new' || t.dataset.action === 'cancel') {
    editing = t.dataset.action === 'new' ? !editing : false;
    draft = { code: '', kind: 'reserve', amount: '', uses: '', expires: eventDay };
    render();
    if (editing) main.querySelector('#code')?.focus();
    return;
  }
  if (t.dataset.delete) {
    try { await deleteCode(eventId, t.dataset.delete); await load(); render(); toast('Code deleted'); } catch (err) { console.warn(err); toast('Couldn’t delete the code.'); }
  }
});

main.addEventListener('submit', async (e) => {
  if (e.target.id !== 'new-code') return;
  e.preventDefault();
  if (!canSave()) return;
  if (codes.some((c) => c.id === draft.code)) { toast('That code is already in use.'); return; }
  busy = true;
  try {
    await createCode(eventId, draft.code, {
      kind: draft.kind, amount: Number(draft.amount), uses: draft.uses ? Number(draft.uses) : null,
      expiresAt: draft.expires ? endOfDay(draft.expires) : null,
    }, user.uid);
    await load();
    editing = false;
    toast('Code created');
  } catch (err) {
    console.warn(err);
    toast('Couldn’t create the code.');
  }
  busy = false;
  render();
});

await load().catch((err) => console.warn(err));
render();
dragScroll(document.scrollingElement, 'y');
reveal();
