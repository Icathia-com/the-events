// Profile (design/Profile.dc.html). Notification settings arrive with notifications in Phase 3, so they aren't shown.
import { requireUser, signOut } from '../auth.js';
import { ensureUserDoc, listHours, listOrganisations, listOrgEvents, myMemberships, updateProfile } from '../data.js';
import { avatarHtml, coverHtml, coverLabel, dateParts, dragScroll, esc, icon, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');

let profile = await ensureUserDoc(user);
let failed = false;
const orElse = (fallback) => (err) => { console.warn(err); failed = true; return fallback; };
const [memberships, ledger, orgList] = await Promise.all([
  myMemberships(user.uid).catch(orElse([])),
  listHours(user.uid).catch(orElse([])),
  listOrganisations().catch(orElse([])),
]);
const orgs = Object.fromEntries(orgList.map((o) => [o.id, o]));

// Events hosted: events this person created for an organisation they admin.
const adminOrgs = memberships.filter((m) => m.role === 'admin');
const hosted = (await Promise.all(adminOrgs.map((m) => listOrgEvents(m.orgId).catch(orElse([])))))
  .flat().filter((e) => e.createdBy === user.uid).length;
const totalHours = ledger.reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
let editing = false;

function roleLine() {
  const admin = memberships.find((m) => m.role === 'admin'), staff = memberships.find((m) => m.role === 'staff');
  if (admin) return `Volunteer · Admin at ${orgs[admin.orgId]?.name || 'your organisation'}`;
  if (staff) return `Volunteer · Staff at ${orgs[staff.orgId]?.name || 'your organisation'}`;
  return 'Volunteer';
}

function pastRow(h) {
  const org = orgs[h.orgId];
  const p = dateParts(h.date.toDate());
  const cover = { cover: h.cover || { colors: org?.logoColors, label: coverLabel(h.eventTitle) } };
  return `<div class="ev-row">${coverHtml(cover, 56, 12, 8)}
    <span class="ev-text"><span class="ev-org">${esc(h.orgName || org?.name || '')}</span>
      <span class="ev-title clamp2">${esc(h.eventTitle)}</span>
      <span class="ev-meta"><span>${esc(`${p.weekday.slice(0, 3)} ${p.day} ${p.month.slice(0, 3)}`)}</span><span class="chip chip-ok">${Number(h.hours)} ${Number(h.hours) === 1 ? 'hour' : 'hours'}</span></span>
    </span></div>`;
}

function render() {
  const joined = profile.joinedAt?.toDate ? dateParts(profile.joinedAt.toDate()) : null;
  const member = memberships[0] && orgs[memberships[0].orgId];
  const view = `<div class="stack-6"><h1 class="profile-name">${esc(profile.name || user.email)}</h1><span class="role-line">${esc(roleLine())}</span></div>
    ${profile.bio ? `<span class="bio">${esc(profile.bio)}</span>` : ''}
    ${joined ? `<span class="joined">${icon('calendar', 15, 2)}Joined ${esc(joined.month)} ${joined.year}</span>` : ''}`;
  const edit = `<form class="stack-6" id="profile-form">
      <input class="field-flat edit-name" name="name" aria-label="Name" value="${esc(profile.name || '')}" maxlength="100" required>
      <textarea class="field-area edit-bio" name="bio" aria-label="About you" placeholder="About you" maxlength="500">${esc(profile.bio || '')}</textarea>
    </form>`;
  main.innerHTML = `
    <div class="top-row"><a class="ib" href="index.html" data-action="back" aria-label="Back">${icon('back', 20)}</a></div>
    <section class="glass profile-card">
      <div class="profile-band"></div>
      <div class="profile-body">
        <div class="profile-top">${avatarHtml({ uid: user.uid, name: profile.name, email: user.email, photoUrl: profile.photoUrl }, { size: 84, href: null })}
          <button type="button" class="btn-small" data-action="edit">${editing ? 'Done' : 'Edit profile'}</button></div>
        ${editing ? edit : view}
        <div class="stats">
          <a class="stat" href="index.html"><b>${hosted}</b><span>Events hosted</span></a>
          <span class="stat"><b>${ledger.length}</b><span>Events attended</span></span>
          <a class="stat" href="organisations.html"><b>${(profile.follows || []).length}</b><span>Organisations followed</span></a>
        </div>
      </div>
    </section>
    <a class="glass hours-card" href="hours.html">
      <span class="hours-ic">${icon('clock', 22, 2)}</span>
      <span class="card-title">${Number(totalHours.toFixed(1))} volunteer ${totalHours === 1 ? 'hour' : 'hours'}</span>${icon('chevron', 16)}
    </a>
    <div class="sec"><h2>Past events</h2>${ledger.some((h) => h.sample) ? '<span class="sec-sub">Sample</span>' : ''}</div>
    ${ledger.length ? `<div class="glass list-card">${ledger.map(pastRow).join('')}</div>` : '<div class="glass empty-note">No past events yet.</div>'}
    <div class="glass link-rows">
      ${member ? `<a class="link-row" href="organisation.html?id=${encodeURIComponent(member.id)}">${icon('organisations', 19, 2)}<span>Your organisation: ${esc(member.name)}</span>${icon('chevron', 16)}</a>` : ''}
      <button type="button" class="link-row is-danger" data-action="sign-out">${icon('signOut', 19, 2)}<span>Sign out</span></button>
    </div>`;
}

async function saveEdits() {
  const form = new FormData(main.querySelector('#profile-form'));
  const name = String(form.get('name') || '').trim();
  const bio = String(form.get('bio') || '').trim();
  if (!name) { toast('A name is needed.'); return false; }
  if (name === profile.name && bio === profile.bio) return true;
  try {
    await updateProfile(user.uid, { name, bio });
    profile = { ...profile, name, bio };
    toast('Saved');
    return true;
  } catch (err) {
    console.warn(err);
    toast('Couldn’t save that.');
    return false;
  }
}

main.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'back' && document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
  if (action === 'edit') {
    if (editing && !(await saveEdits())) return;
    editing = !editing;
    render();
    if (editing) main.querySelector('[name="name"]')?.focus();
  }
  if (action === 'sign-out') {
    await signOut();
    location.replace('signin.html');
  }
});
main.addEventListener('submit', (e) => { e.preventDefault(); main.querySelector('[data-action="edit"]')?.click(); });

render();
dragScroll(document.scrollingElement, 'y');
document.body.classList.remove('is-loading');
if (failed) toast('Some of your profile couldn’t load.');
