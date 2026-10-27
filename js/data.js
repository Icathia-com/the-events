// All Firestore reads and writes.
import {
  arrayRemove, arrayUnion, collection, collectionGroup, db, deleteDoc, deleteField, doc, getDoc, getDocs, increment, limit,
  orderBy, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch,
} from './firebase.js';

// Fixed lists (brief section 6). Keys are stored in Firestore; values are what people see.
export const AREAS = {
  north: 'North', northeast: 'North-East', east: 'East', central: 'Central', west: 'West', islandwide: 'Islandwide',
};
export const CAUSES = {
  food: 'Food', elderly: 'Elderly', children: 'Children', environment: 'Environment', animals: 'Animals', education: 'Education',
};

const withId = (snap) => (snap.exists() ? { id: snap.id, ...snap.data() } : null);
const allWithIds = (snaps) => snaps.docs.map(withId);

// Users

// Returns users/{uid}, creating it on first sign-in (brief section 6).
// networkAdmin is set by hand in the console; hoursTotal is added by the confirm path in a later slice.
export async function ensureUserDoc(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const profile = {
    name: (user.displayName || '').slice(0, 100),
    email: user.email,
    photoUrl: user.photoURL || '',
    bio: '',
    follows: [],
    joinedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return profile;
}

export const getProfile = async (uid) => withId(await getDoc(doc(db, 'users', uid)));

// Only name, bio and photoUrl; the rules refuse anything else.
export function updateProfile(uid, { name, bio, photoUrl }) {
  const fields = Object.fromEntries(Object.entries({ name, bio, photoUrl }).filter(([, v]) => v !== undefined));
  return updateDoc(doc(db, 'users', uid), { ...fields, updatedAt: serverTimestamp() });
}

export const followOrg = (uid, orgId) => updateDoc(doc(db, 'users', uid), { follows: arrayUnion(orgId), updatedAt: serverTimestamp() });
export const unfollowOrg = (uid, orgId) => updateDoc(doc(db, 'users', uid), { follows: arrayRemove(orgId), updatedAt: serverTimestamp() });

// The whole hours ledger, newest first.
export async function listHours(uid) {
  const snaps = await getDocs(query(collection(db, 'users', uid, 'hours'), orderBy('date', 'desc')));
  return allWithIds(snaps);
}

// Confirmed hours with a date in [from, to).
export async function hoursBetween(uid, from, to) {
  const snaps = await getDocs(query(collection(db, 'users', uid, 'hours'),
    where('date', '>=', Timestamp.fromDate(from)), where('date', '<', Timestamp.fromDate(to))));
  return snaps.docs.reduce((sum, d) => sum + (Number(d.data().hours) || 0), 0);
}

// Registrations

// "Aisha Rahman" shows as "Aisha R." in who's going; "Mei Lin Tan" as "Mei Lin T.".
export function shortName(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words[0] || '';
  const first = words.length >= 3 ? words.slice(0, -1).join(' ') : words[0];
  return `${first} ${words.at(-1)[0].toUpperCase()}.`.slice(0, 40);
}

// What joining gives right now; the rules apply the same test.
export function joinStatus(event) {
  const { capacity, waitlist, approval } = event.registration || {};
  if (capacity != null && (event.counts?.going || 0) >= capacity) return waitlist ? 'waitlist' : 'full';
  return approval ? 'pending' : 'going';
}

const COUNTED = ['going', 'pending', 'waitlist'];
function stepCounts(counts, before, after) {
  const next = { going: 0, pending: 0, waitlist: 0, attended: 0, ...counts };
  if (COUNTED.includes(before)) next[before] -= 1;
  if (COUNTED.includes(after)) next[after] += 1;
  return next;
}

export async function getMyRegistration(eventId, uid) {
  return withId(await getDoc(doc(db, 'events', eventId, 'registrations', uid)));
}

// Joins an event, or joins again after cancelling. Returns the new status.
export function joinEvent(eventId, uid, name) {
  return runTransaction(db, async (tx) => {
    const eventRef = doc(db, 'events', eventId);
    const regRef = doc(db, 'events', eventId, 'registrations', uid);
    const event = (await tx.get(eventRef)).data();
    const regSnap = await tx.get(regRef);
    const before = regSnap.exists() ? regSnap.data().status : 'none';
    if (before !== 'none' && before !== 'cancelled') return before;

    const status = joinStatus(event);
    if (status === 'full') return 'full';
    tx.update(eventRef, { counts: stepCounts(event.counts, before, status), countsBy: uid });
    const fields = { status, name, registeredAt: serverTimestamp(), updatedAt: serverTimestamp() };
    if (regSnap.exists()) tx.update(regRef, fields);
    else tx.set(regRef, { uid, ticketTypeId: null, answers: {}, createdAt: serverTimestamp(), ...fields });
    if (status === 'going') tx.set(doc(db, 'events', eventId, 'going', uid), { name: shortName(name), since: serverTimestamp() });
    return status;
  });
}

export function cancelRegistration(eventId, uid) {
  return runTransaction(db, async (tx) => {
    const eventRef = doc(db, 'events', eventId);
    const regRef = doc(db, 'events', eventId, 'registrations', uid);
    const event = (await tx.get(eventRef)).data();
    const regSnap = await tx.get(regRef);
    const before = regSnap.exists() ? regSnap.data().status : 'none';
    if (!COUNTED.includes(before)) return before;

    tx.update(eventRef, { counts: stepCounts(event.counts, before, 'cancelled'), countsBy: uid });
    tx.update(regRef, { status: 'cancelled', updatedAt: serverTimestamp() });
    if (before === 'going') tx.delete(doc(db, 'events', eventId, 'going', uid));
    return 'cancelled';
  });
}

// The organisation's view of an event: every registration and every attendance record.
export async function listRegistrations(eventId) {
  return allWithIds(await getDocs(collection(db, 'events', eventId, 'registrations')));
}

export async function listAttendance(eventId) {
  return allWithIds(await getDocs(collection(db, 'events', eventId, 'attendance')));
}

// An admin's decision on a registration: 'going', 'declined' or 'waitlist'. Returns false if the event is full.
export function decideRegistration(eventId, uid, status, adminUid) {
  return runTransaction(db, async (tx) => {
    const eventRef = doc(db, 'events', eventId);
    const regRef = doc(db, 'events', eventId, 'registrations', uid);
    const event = (await tx.get(eventRef)).data();
    const reg = (await tx.get(regRef)).data();
    const capacity = event.registration?.capacity;
    if (status === 'going' && reg.status !== 'going' && capacity != null && (event.counts?.going || 0) >= capacity) return false;

    tx.update(eventRef, { counts: stepCounts(event.counts, reg.status, status), countsBy: uid });
    tx.update(regRef, { status, decidedAt: serverTimestamp(), decidedBy: adminUid, updatedAt: serverTimestamp() });
    const goingRef = doc(db, 'events', eventId, 'going', uid);
    if (status === 'going') tx.set(goingRef, { name: shortName(reg.name), since: serverTimestamp() });
    else if (reg.status === 'going') tx.delete(goingRef);
    return true;
  });
}

// Marks a going volunteer attended: their hours for the event are confirmed. Any check-in time is kept.
export function markAttended(eventId, uid, byUid) {
  return runTransaction(db, async (tx) => {
    const eventRef = doc(db, 'events', eventId);
    const attRef = doc(db, 'events', eventId, 'attendance', uid);
    const event = (await tx.get(eventRef)).data();
    const attSnap = await tx.get(attRef);
    const reg = (await tx.get(doc(db, 'events', eventId, 'registrations', uid))).data();
    if (attSnap.data()?.status === 'confirmed') return;

    const counts = { ...event.counts, attended: (event.counts?.attended || 0) + 1 };
    tx.update(eventRef, { counts, countsBy: uid });
    tx.set(attRef, {
      ...(attSnap.exists() ? attSnap.data() : {}), uid, name: reg.name, status: 'confirmed', hours: event.hours,
      checkedOutAt: serverTimestamp(), checkedOutBy: byUid, confirmedAt: serverTimestamp(), confirmedBy: byUid, updatedAt: serverTimestamp(),
    });
  });
}

// Undoes "Mark attended": back to checked in if they had checked in, otherwise no attendance at all.
export function unmarkAttended(eventId, uid) {
  return runTransaction(db, async (tx) => {
    const eventRef = doc(db, 'events', eventId);
    const attRef = doc(db, 'events', eventId, 'attendance', uid);
    const event = (await tx.get(eventRef)).data();
    const att = (await tx.get(attRef)).data();
    if (att?.status !== 'confirmed') return;

    tx.update(eventRef, { counts: { ...event.counts, attended: Math.max(0, (event.counts?.attended || 0) - 1) }, countsBy: uid });
    if (att.checkedInAt) {
      tx.update(attRef, {
        status: 'checked_in', checkedOutAt: deleteField(), checkedOutBy: deleteField(),
        confirmedAt: deleteField(), confirmedBy: deleteField(), updatedAt: serverTimestamp(),
      });
    } else {
      tx.delete(attRef);
    }
  });
}

export const cancelEvent = (eventId) => updateEvent(eventId, { status: 'cancelled' });

// Check-in and check-out

// The event's check-in and check-out codes (the organisation's members only).
export async function getCodes(eventId) {
  return (await getDoc(doc(db, 'events', eventId, 'private', 'codes'))).data() || null;
}

// The organisation checks a going volunteer in (scanned, or by hand). Returns { status, already }.
export function checkIn(eventId, uid, byUid) {
  return runTransaction(db, async (tx) => {
    const attRef = doc(db, 'events', eventId, 'attendance', uid);
    const event = (await tx.get(doc(db, 'events', eventId))).data();
    const reg = (await tx.get(doc(db, 'events', eventId, 'registrations', uid))).data();
    const att = (await tx.get(attRef)).data();
    if (att?.checkedInAt || att?.status === 'confirmed') return { status: att.status, already: true };
    tx.set(attRef, {
      ...(att || {}), uid, name: reg.name, status: att?.status || 'checked_in', hours: att?.hours ?? event.hours,
      checkedInAt: serverTimestamp(), checkedInBy: byUid, updatedAt: serverTimestamp(),
    });
    return { status: att?.status || 'checked_in', already: false };
  });
}

export const getRegistration = getMyRegistration;

// A volunteer confirms their own hours with the check-out code from the organiser's screen. Returns the hours.
export function confirmWithCode(eventId, uid, code) {
  return runTransaction(db, async (tx) => {
    const eventRef = doc(db, 'events', eventId);
    const attRef = doc(db, 'events', eventId, 'attendance', uid);
    const event = (await tx.get(eventRef)).data();
    const reg = (await tx.get(doc(db, 'events', eventId, 'registrations', uid))).data();
    const att = (await tx.get(attRef)).data();
    if (att?.status === 'confirmed') return att.hours;
    tx.update(eventRef, { counts: { ...event.counts, attended: (event.counts?.attended || 0) + 1 }, countsBy: uid });
    const fields = {
      name: reg.name, status: 'confirmed', hours: event.hours, code, checkedOutAt: serverTimestamp(), checkedOutBy: uid,
      confirmedAt: serverTimestamp(), confirmedBy: 'code', updatedAt: serverTimestamp(),
    };
    if (att) tx.update(attRef, fields);
    else tx.set(attRef, { uid, ...fields });
    return event.hours;
  });
}

export const declineClaim = (eventId, uid) =>
  updateDoc(doc(db, 'events', eventId, 'attendance', uid), { status: 'declined', updatedAt: serverTimestamp() });

export const setCheckInMode = (eventId, fields) => updateEvent(eventId, fields);

// The volunteer's own attendance on their events, by event id (checked in, confirmed, claimed or declined).
export async function myAttendance(uid) {
  const snaps = await getDocs(query(collectionGroup(db, 'attendance'),
    where('uid', '==', uid), where('status', 'in', ['checked_in', 'confirmed', 'claimed', 'declined'])));
  return Object.fromEntries(snaps.docs.map((d) => [d.ref.parent.parent.id, d.data()]));
}

export async function getMyAttendance(eventId, uid) {
  return (await getDoc(doc(db, 'events', eventId, 'attendance', uid))).data() || null;
}

// Claims

const WEEK = 7 * 86400e3;

// After the event, a volunteer who was going claims its hours without the code. A claim after a check-in confirms
// itself 7 days later (autoConfirmAt) unless the organisation decides first.
export function claimHours(eventId, uid) {
  return runTransaction(db, async (tx) => {
    const attRef = doc(db, 'events', eventId, 'attendance', uid);
    const event = (await tx.get(doc(db, 'events', eventId))).data();
    const reg = (await tx.get(doc(db, 'events', eventId, 'registrations', uid))).data();
    const att = (await tx.get(attRef)).data();
    if (att && att.status !== 'checked_in') return;
    const fields = { name: reg.name, status: 'claimed', hours: event.hours, claimedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    if (att?.checkedInAt) fields.autoConfirmAt = Timestamp.fromMillis(Date.now() + WEEK);
    if (att) tx.update(attRef, fields);
    else tx.set(attRef, { uid, ...fields });
  });
}

// Phase 1 auto-confirm, run by the volunteer's own app (section 8): claims past autoConfirmAt confirm themselves,
// and the attended count moves with each.
async function autoConfirmClaims(uid) {
  const claims = await getDocs(query(collectionGroup(db, 'attendance'), where('uid', '==', uid), where('status', '==', 'claimed')));
  for (const claim of claims.docs) {
    const { autoConfirmAt, claimedAt } = claim.data();
    if (!autoConfirmAt || !claimedAt || Math.max(autoConfirmAt.toMillis(), claimedAt.toMillis() + WEEK) > Date.now()) continue;
    const eventRef = claim.ref.parent.parent;
    await runTransaction(db, async (tx) => {
      const event = (await tx.get(eventRef)).data();
      if ((await tx.get(claim.ref)).data()?.status !== 'claimed') return;
      tx.update(eventRef, { counts: { ...event.counts, attended: (event.counts?.attended || 0) + 1 }, countsBy: uid });
      tx.update(claim.ref, { status: 'confirmed', confirmedAt: serverTimestamp(), confirmedBy: 'auto', updatedAt: serverTimestamp() });
    }).catch((err) => console.warn(`Couldn’t confirm the claim for ${eventRef.id}`, err));
  }
}

// Staff

export async function listStaff(orgId) {
  return allWithIds(await getDocs(query(collection(db, 'organisations', orgId, 'members'), where('role', '==', 'staff'))));
}

export async function listStaffInvites(orgId) {
  return allWithIds(await getDocs(collection(db, 'organisations', orgId, 'staffInvites')));
}

// Staff are invited by email; the person becomes staff the next time they sign in (claimInvites).
export function inviteStaff(orgId, email, byUid) {
  const id = email.trim().toLowerCase();
  return setDoc(doc(db, 'organisations', orgId, 'staffInvites', id), { email: id, role: 'staff', invitedBy: byUid, invitedAt: serverTimestamp() });
}

export const withdrawInvite = (orgId, email) => deleteDoc(doc(db, 'organisations', orgId, 'staffInvites', email));
export const removeStaff = (orgId, uid) => deleteDoc(doc(db, 'organisations', orgId, 'members', uid));

// Accepts any staff invitations for the signed-in person's email. Returns how many.
export async function claimInvites(user, name) {
  if (!user.email || !user.emailVerified) return 0;
  const email = user.email.toLowerCase();
  const snaps = await getDocs(query(collectionGroup(db, 'staffInvites'), where('email', '==', email)));
  for (const invite of snaps.docs) {
    const orgId = invite.ref.parent.parent.id;
    const batch = writeBatch(db);
    batch.set(doc(db, 'organisations', orgId, 'members', user.uid), { uid: user.uid, role: 'staff', name: (name || email).slice(0, 100), addedAt: serverTimestamp() });
    batch.delete(invite.ref);
    await batch.commit();
  }
  return snaps.size;
}

// For an organisation's admins: how many confirmed events each volunteer has had with the organisation.
export async function pastEventCounts(orgId) {
  const snaps = await getDocs(query(collectionGroup(db, 'hours'), where('orgId', '==', orgId)));
  const counts = {};
  snaps.docs.forEach((d) => { const uid = d.ref.parent.parent.id; counts[uid] = (counts[uid] || 0) + 1; });
  return counts;
}

// Phase 1 confirm path, run by the volunteer's own app: claims due to confirm themselves are confirmed, then a ledger
// entry is added for each confirmed attendance, each with a new reference number, and hoursTotal moved by the same
// hours. Entries whose confirmation was undone are removed. Returns how many entries were added.
export async function syncHours(uid) {
  await autoConfirmClaims(uid).catch((err) => console.warn(err));
  const [confirmed, entries] = await Promise.all([
    getDocs(query(collectionGroup(db, 'attendance'), where('uid', '==', uid), where('status', '==', 'confirmed'))),
    getDocs(collection(db, 'users', uid, 'hours')),
  ]);
  const have = new Set(entries.docs.map((d) => d.id));
  const confirmedIds = new Set(confirmed.docs.map((d) => d.ref.parent.parent.id));
  let added = 0;

  for (const att of confirmed.docs) {
    const eventId = att.ref.parent.parent.id;
    if (have.has(eventId)) continue;
    try {
      const event = (await getDoc(doc(db, 'events', eventId))).data();
      const year = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', year: 'numeric' }).format(event.startAt.toDate());
      for (let attempt = 1; ; attempt++) {
        const reference = `VN-${year}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
        const batch = writeBatch(db);
        batch.set(doc(db, 'users', uid, 'hours', eventId), {
          eventId, eventTitle: event.title, orgId: event.orgId, orgName: event.orgName, cover: event.cover, date: event.startAt,
          hours: att.data().hours, confirmedBy: att.data().confirmedBy, confirmedAt: att.data().confirmedAt, reference,
        });
        batch.set(doc(db, 'references', reference), { uid, entryId: eventId });
        batch.update(doc(db, 'users', uid), { hoursTotal: increment(att.data().hours), hoursBy: eventId });
        try {
          await batch.commit();
          added += 1;
          break;
        } catch (err) {
          if (attempt >= 5) throw err; // most likely the reference number was taken: try another
        }
      }
    } catch (err) {
      console.warn(`Couldn’t add the hours for ${eventId}`, err);
    }
  }

  for (const entry of entries.docs) {
    if (entry.data().sample || confirmedIds.has(entry.id)) continue;
    const batch = writeBatch(db);
    batch.delete(entry.ref);
    batch.update(doc(db, 'users', uid), { hoursTotal: increment(-entry.data().hours), hoursBy: entry.id });
    await batch.commit();
  }
  return added;
}

// The first few people going (short names), oldest first.
export async function listGoing(eventId, max = 5) {
  const snaps = await getDocs(query(collection(db, 'events', eventId, 'going'), orderBy('since'), limit(max)));
  return snaps.docs.map((d) => d.data().name);
}

// The exact venue of a hidden-location event: for approved volunteers and the organisation.
export async function getExactVenue(eventId) {
  return (await getDoc(doc(db, 'events', eventId, 'private', 'location'))).data()?.venue || '';
}

// The user's own going and pending registrations, across all events: [{ eventId, status, ... }].
export async function myRegistrations(uid) {
  const snaps = await getDocs(query(collectionGroup(db, 'registrations'),
    where('uid', '==', uid), where('status', 'in', ['going', 'pending'])));
  return snaps.docs.map((d) => ({ eventId: d.ref.parent.parent.id, ...d.data() }));
}

// Organisations

export const getOrganisation = async (orgId) => withId(await getDoc(doc(db, 'organisations', orgId)));

export async function listOrganisations() {
  const snaps = await getDocs(query(collection(db, 'organisations'), where('status', '==', 'approved')));
  return allWithIds(snaps).sort((a, b) => a.name.localeCompare(b.name));
}

// Admins edit their organisation's About and giving link (the rules allow only profile fields).
export function updateOrganisation(orgId, { about, givingUrl }) {
  const fields = Object.fromEntries(Object.entries({ about, givingUrl }).filter(([, v]) => v !== undefined));
  return updateDoc(doc(db, 'organisations', orgId), { ...fields, updatedAt: serverTimestamp() });
}

// The user's role in an organisation ('admin' or 'staff'), or null.
export async function getMyRole(orgId, uid) {
  return (await getDoc(doc(db, 'organisations', orgId, 'members', uid))).data()?.role || null;
}

// The organisations the user belongs to: [{ orgId, role, name }].
export async function myMemberships(uid) {
  const snaps = await getDocs(query(collectionGroup(db, 'members'), where('uid', '==', uid)));
  return snaps.docs.map((d) => ({ orgId: d.ref.parent.parent.id, role: d.data().role, name: d.data().name }));
}

// Events

export const getEvent = async (eventId) => withId(await getDoc(doc(db, 'events', eventId)));

// Scheduled public events from a date onwards, soonest first.
export async function listPublicEvents(from = new Date()) {
  const snaps = await getDocs(query(collection(db, 'events'),
    where('status', '==', 'scheduled'), where('visibility', '==', 'public'),
    where('startAt', '>=', Timestamp.fromDate(from)), orderBy('startAt')));
  return allWithIds(snaps);
}

// Scheduled followers-only events of the given organisations (the ones the user follows), soonest first.
export async function listFollowerEvents(orgIds, from = new Date()) {
  const chunks = [];
  for (let i = 0; i < orgIds.length; i += 30) chunks.push(orgIds.slice(i, i + 30));
  const results = await Promise.all(chunks.map((ids) => getDocs(query(collection(db, 'events'),
    where('status', '==', 'scheduled'), where('visibility', '==', 'followers'), where('orgId', 'in', ids),
    where('startAt', '>=', Timestamp.fromDate(from)), orderBy('startAt')))));
  return results.flatMap(allWithIds).sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis());
}

const randomCode = () => [...crypto.getRandomValues(new Uint8Array(9))].map((b) => b.toString(16).padStart(2, '0')).join('');

// Creates an event for an organisation, with its check-in and check-out codes in the same write. Returns its id.
// fields: title, description, cause, area, venue, meetingPoint, bring, startAt, endAt, hours, cover, visibility,
// registration, ticketTypes, notifyFollowers.
export async function createEvent(org, uid, fields) {
  const ref = doc(collection(db, 'events'));
  const batch = writeBatch(db);
  batch.set(ref, {
    ...fields, orgId: org.id, orgName: org.name, status: 'scheduled',
    counts: { going: 0, pending: 0, waitlist: 0, attended: 0 },
    hideExactLocation: false, checkInMode: 'standard', checkInLocked: false,
    createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'events', ref.id, 'private', 'codes'), { checkIn: randomCode(), checkOut: randomCode(), rotatedAt: serverTimestamp() });
  await batch.commit();
  return ref.id;
}

export const updateEvent = (eventId, fields) => updateDoc(doc(db, 'events', eventId), { ...fields, updatedAt: serverTimestamp() });

// One organisation's scheduled public events from a date onwards, for anyone signed in.
export async function listOrgPublicEvents(orgId, from = new Date()) {
  const snaps = await getDocs(query(collection(db, 'events'),
    where('orgId', '==', orgId), where('status', '==', 'scheduled'), where('visibility', '==', 'public'),
    where('startAt', '>=', Timestamp.fromDate(from)), orderBy('startAt')));
  return allWithIds(snaps);
}

// Every event of an organisation the user is a member of, drafts included.
export async function listOrgEvents(orgId) {
  const snaps = await getDocs(query(collection(db, 'events'), where('orgId', '==', orgId), orderBy('startAt')));
  return allWithIds(snaps);
}
