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

// Ticket types (Phase 2): each has its own approval, spots (counted in event.typeCounts) and registration dates.
export const ticketFor = (event, id) => (event.ticketTypes || []).find((t) => t.id === id) || null;
export const approvalFor = (event, type) => (type ? !!type.approval : !!event.registration?.approval);
export const typeFull = (event, type) => type?.capacity != null && (event.typeCounts?.[type.id] || 0) >= type.capacity;
export function typeOpen(type, now = Date.now()) {
  return !type || ((!type.opensAt || type.opensAt.toMillis() <= now) && (!type.closesAt || type.closesAt.toMillis() > now));
}

// What joining gives right now, with the chosen ticket type; the rules apply the same test. While people are on the
// waiting list, newcomers join the end of it, even if a spot is free.
export function joinStatus(event, type = null, approval = approvalFor(event, type)) {
  const { capacity, waitlist } = event.registration || {};
  const full = capacity != null && (event.counts?.going || 0) >= capacity;
  if (full || (waitlist && event.waitingList?.length)) return waitlist && !typeFull(event, type) ? 'waitlist' : 'full';
  if (typeFull(event, type)) return 'full';
  return approval ? 'pending' : 'going';
}

// Vouchers and access codes (Phase 2). Only the event's admins read codes. Each code also has a hint under its
// SHA-256, so a volunteer's app can tell what a code they typed does without listing or reading any code.
export const CODE_KINDS = { reserve: 'Reserved spots', skip: 'Skip approval', unlock: 'Unlock a hidden event', discount: 'Discount' };

// What joining gives with a code: a reserved spot is going, even past the event's spots; skip approval joins without
// approval; a discount or an unlock leaves it as it is.
export function codeStatus(event, type, kind) {
  if (kind === 'reserve') return 'going';
  return kind === 'skip' ? joinStatus(event, type, false) : joinStatus(event, type);
}

async function codeHash(code) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function listCodes(eventId) {
  return allWithIds(await getDocs(collection(db, 'events', eventId, 'codes')))
    .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

export async function createCode(eventId, code, { kind, amount, uses, expiresAt }, by) {
  const extra = kind === 'discount' ? { amount } : {};
  const batch = writeBatch(db);
  batch.set(doc(db, 'events', eventId, 'codes', code), { kind, ...extra, uses, used: 0, expiresAt, createdBy: by, createdAt: serverTimestamp() });
  batch.set(doc(db, 'events', eventId, 'codeHints', await codeHash(code)), { kind, ...extra });
  return batch.commit();
}

export async function deleteCode(eventId, code) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'events', eventId, 'codes', code));
  batch.delete(doc(db, 'events', eventId, 'codeHints', await codeHash(code)));
  return batch.commit();
}

// What a code someone typed does ({ code, kind, amount? }), or null. Whether it still has uses left is only known
// when it's used.
export async function lookUpCode(eventId, code) {
  const snap = await getDoc(doc(db, 'events', eventId, 'codeHints', await codeHash(code)));
  return snap.exists() ? { code, ...snap.data() } : null;
}

// An access code opens a followers-only or draft event to this volunteer, using one of the code's uses.
export function unlockEvent(eventId, uid, code) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'events', eventId, 'unlocks', uid), { code, at: serverTimestamp() });
  batch.update(doc(db, 'events', eventId, 'codes', code), { used: increment(1) });
  return batch.commit();
}

const COUNTED = ['going', 'pending', 'waitlist'];
function stepCounts(counts, before, after) {
  const next = { going: 0, pending: 0, waitlist: 0, attended: 0, ...counts };
  if (COUNTED.includes(before)) next[before] -= 1;
  if (COUNTED.includes(after)) next[after] += 1;
  return next;
}

// The event fields that follow one registration's change from `before` to `after`: the counts, the ticket type's
// going count, and the waiting list (in order, with each person's type and short name).
function followFields(event, uid, before, after, typeId, name) {
  const fields = { counts: stepCounts(event.counts, before, after), countsBy: uid };
  const d = (after === 'going' ? 1 : 0) - (before === 'going' ? 1 : 0);
  if (typeId && d) fields.typeCounts = { ...event.typeCounts, [typeId]: (event.typeCounts?.[typeId] || 0) + d };
  if (after === 'waitlist' && before !== 'waitlist') {
    fields.waitingList = [...(event.waitingList || []), uid];
    fields.waiting = { ...event.waiting, [uid]: { type: typeId || null, name: shortName(name) } };
  } else if (before === 'waitlist' && after !== 'waitlist') {
    fields.waitingList = (event.waitingList || []).filter((u) => u !== uid);
    const { [uid]: _gone, ...rest } = event.waiting || {};
    fields.waiting = rest;
  }
  return fields;
}

export async function getMyRegistration(eventId, uid) {
  return withId(await getDoc(doc(db, 'events', eventId, 'registrations', uid)));
}

// Announcements (Phase 2, in the app only). Each goes to one audience; the event keeps when each audience last got
// one (announcedAt), for the unread dot on Home.
export const AUDIENCES = { going: 'Going', waiting: 'Going and waiting for approval', attended: 'Attended' };

export function postAnnouncement(eventId, fields) {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'events', eventId, 'announcements')), { ...fields, createdAt: serverTimestamp() });
  batch.update(doc(db, 'events', eventId), { [`announcedAt.${fields.audience}`]: serverTimestamp(), updatedAt: serverTimestamp() });
  return batch.commit();
}

// The audiences a volunteer is in, from their registration and attendance.
export function audiencesFor(regStatus, attendanceStatus) {
  return [
    ...(regStatus === 'going' ? ['going'] : []),
    ...(['going', 'pending', 'waitlist'].includes(regStatus) ? ['waiting'] : []),
    ...(attendanceStatus === 'confirmed' ? ['attended'] : []),
  ];
}

// Newest first. The organisation's members read them all (audiences null); a volunteer, those for their audiences.
export async function listAnnouncements(eventId, audiences = null) {
  const all = collection(db, 'events', eventId, 'announcements');
  const snaps = await Promise.all((audiences ? audiences.map((a) => query(all, where('audience', '==', a))) : [all]).map((q) => getDocs(q)));
  return snaps.flatMap(allWithIds).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

// Registration questions (Phase 2): the personal ones under their own ids, custom ones under generated ids.
export const PERSONAL_QUESTIONS = { mobile: 'Mobile number', emergency: 'Emergency contact', age: 'Age group' };
export const AGE_GROUPS = ['Under 18', '18 to 24', '25 to 34', '35 to 44', '45 to 54', '55 to 64', '65 and over'];
export const QUESTION_TYPES = {
  text: 'Text', options: 'Options', checkbox: 'Checkbox', link: 'Link', mobile: 'Mobile number',
  instagram: 'Instagram', telegram: 'Telegram', linkedin: 'LinkedIn', company: 'Company or school', terms: 'Terms to agree',
};
export const questionLabel = (q) => (q.id in PERSONAL_QUESTIONS ? PERSONAL_QUESTIONS[q.id] : q.text);

export async function listQuestions(eventId) {
  return allWithIds(await getDocs(collection(db, 'events', eventId, 'questions'))).sort((a, b) => a.order - b.order);
}
export const setQuestion = (eventId, id, fields) =>
  setDoc(doc(db, 'events', eventId, 'questions', id), { ...fields, updatedAt: serverTimestamp() });
export const removeQuestion = (eventId, id) => deleteDoc(doc(db, 'events', eventId, 'questions', id));

// Joins an event with a ticket type (null when the event has none) and the answers to its questions, or joins again
// after cancelling. The sign-in email goes with the registration, for the organisation. Returns the new status, or 'full'.
export function joinEvent(eventId, uid, name, ticketTypeId = null, { answers = {}, email = '', code = null } = {}) {
  return runTransaction(db, async (tx) => {
    const eventRef = doc(db, 'events', eventId);
    const regRef = doc(db, 'events', eventId, 'registrations', uid);
    const event = (await tx.get(eventRef)).data();
    const regSnap = await tx.get(regRef);
    const before = regSnap.exists() ? regSnap.data().status : 'none';
    if (before !== 'none' && before !== 'cancelled') return before;

    const type = ticketFor(event, ticketTypeId);
    const status = code ? codeStatus(event, type, code.kind) : joinStatus(event, type);
    if (status === 'full') return 'full';
    tx.update(eventRef, followFields(event, uid, before, status, type?.id, name));
    // A code goes on the registration and uses one of its uses (the rules check it's real, current and not used up).
    if (code) tx.update(doc(db, 'events', eventId, 'codes', code.code), { used: increment(1) });
    const fields = {
      status, name, ...(email ? { email } : {}), ticketTypeId: type?.id || null, answers,
      ...(code ? { code: code.code, ...(code.kind === 'discount' ? { discount: code.amount } : {}) } : {}),
      registeredAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    // Joining again after cancelling: a code from the earlier registration doesn't carry over.
    if (regSnap.exists() && !code) Object.assign(fields, { code: deleteField(), discount: deleteField() });
    else if (regSnap.exists() && code.kind !== 'discount') fields.discount = deleteField();
    if (regSnap.exists()) tx.update(regRef, fields);
    else tx.set(regRef, { uid, answers: {}, createdAt: serverTimestamp(), ...fields });
    if (status === 'going') tx.set(doc(db, 'events', eventId, 'going', uid), { name: shortName(name), since: serverTimestamp() });
    return status;
  });
}

// Cancels the volunteer's registration. When they were going, the first person on the waiting list moves up in the
// same write: to going, or to pending when their ticket type needs approval, if their type has a spot.
export function cancelRegistration(eventId, uid) {
  return runTransaction(db, async (tx) => {
    const eventRef = doc(db, 'events', eventId);
    const regRef = doc(db, 'events', eventId, 'registrations', uid);
    const event = (await tx.get(eventRef)).data();
    const regSnap = await tx.get(regRef);
    const reg = regSnap.data();
    const before = reg?.status || 'none';
    if (!COUNTED.includes(before)) return before;

    const fields = followFields(event, uid, before, 'cancelled', reg.ticketTypeId, reg.name);
    const next = before === 'going' ? event.waitingList?.[0] : null;
    const entry = next && next !== uid ? event.waiting?.[next] : null;
    if (entry) {
      const type = ticketFor(event, entry.type);
      const status = approvalFor(event, type) ? 'pending' : 'going';
      const typeCounts = { ...(fields.typeCounts || event.typeCounts) };
      if (type && status === 'going') typeCounts[type.id] = (typeCounts[type.id] || 0) + 1;
      if (!type?.capacity || (typeCounts[type.id] || 0) <= type.capacity) {
        const { [next]: _up, ...waiting } = event.waiting;
        Object.assign(fields, {
          counts: stepCounts(fields.counts, 'waitlist', status), waitingList: event.waitingList.slice(1), waiting,
          movedUp: next, movedUpAt: serverTimestamp(),
        });
        if (type && status === 'going') fields.typeCounts = typeCounts;
        tx.update(doc(db, 'events', eventId, 'registrations', next), { status, movedUpAt: serverTimestamp(), updatedAt: serverTimestamp() });
        if (status === 'going') tx.set(doc(db, 'events', eventId, 'going', next), { name: entry.name, since: serverTimestamp() });
      }
    }
    tx.update(eventRef, fields);
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
    const full = capacity != null && (event.counts?.going || 0) >= capacity;
    if (status === 'going' && reg.status !== 'going' && (full || typeFull(event, ticketFor(event, reg.ticketTypeId)))) return false;

    tx.update(eventRef, followFields(event, uid, reg.status, status, reg.ticketTypeId, reg.name));
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

// The check-out code confirms hours for a volunteer who was checked in, from 30 minutes before the event ends until
// 3 hours after. Any other scan of the code, once the event has started, sends a claim instead.
export const CHECK_OUT_OPENS = 30 * 60e3;
export const CHECK_OUT_CLOSES = 3 * 3600e3;

// A volunteer scans the check-out code on the organiser's screen. Returns { status, hours }: status is 'confirmed',
// or 'claimed' (with autoConfirmAt after a check-in), or 'declined' for a claim the organisation already declined.
// Throws 'not-started' before the event starts.
export async function checkOutWithCode(eventId, uid, code) {
  try {
    return await checkOutTx(eventId, uid, code, true);
  } catch (err) {
    // The server's clock decides the window; at its edges, a refused confirmation becomes a claim.
    if (err.code !== 'permission-denied') throw err;
    return checkOutTx(eventId, uid, code, false);
  }
}

function checkOutTx(eventId, uid, code, mayConfirm) {
  return runTransaction(db, async (tx) => {
    const eventRef = doc(db, 'events', eventId);
    const attRef = doc(db, 'events', eventId, 'attendance', uid);
    const event = (await tx.get(eventRef)).data();
    const reg = (await tx.get(doc(db, 'events', eventId, 'registrations', uid))).data();
    const att = (await tx.get(attRef)).data();
    if (att?.status === 'confirmed' || att?.status === 'declined') return { status: att.status, hours: att.hours };
    const now = Date.now(), endsAt = event.endAt.toMillis();
    if (now < event.startAt.toMillis()) throw Object.assign(new Error('The event hasn’t started'), { code: 'not-started' });
    if (mayConfirm && att?.checkedInAt && now >= endsAt - CHECK_OUT_OPENS && now <= endsAt + CHECK_OUT_CLOSES) {
      tx.update(eventRef, { counts: { ...event.counts, attended: (event.counts?.attended || 0) + 1 }, countsBy: uid });
      tx.update(attRef, {
        name: reg.name, status: 'confirmed', hours: event.hours, code, checkedOutAt: serverTimestamp(), checkedOutBy: uid,
        confirmedAt: serverTimestamp(), confirmedBy: 'code', updatedAt: serverTimestamp(),
      });
      return { status: 'confirmed', hours: event.hours };
    }
    if (att?.status === 'claimed') return { status: 'claimed', hours: att.hours, autoConfirmAt: att.autoConfirmAt };
    const fields = { name: reg.name, status: 'claimed', hours: event.hours, code, claimedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    if (att?.checkedInAt) fields.autoConfirmAt = Timestamp.fromMillis(now + WEEK);
    if (att) tx.update(attRef, fields);
    else tx.set(attRef, { uid, ...fields });
    return { status: 'claimed', hours: event.hours, autoConfirmAt: fields.autoConfirmAt };
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
// and the attended count moves with each. Returns how many were confirmed.
async function autoConfirmClaims(uid) {
  const claims = await getDocs(query(collectionGroup(db, 'attendance'), where('uid', '==', uid), where('status', '==', 'claimed')));
  let confirmed = 0;
  for (const claim of claims.docs) {
    const { autoConfirmAt, claimedAt } = claim.data();
    if (!autoConfirmAt || !claimedAt || Math.max(autoConfirmAt.toMillis(), claimedAt.toMillis() + WEEK) > Date.now()) continue;
    const eventRef = claim.ref.parent.parent;
    await runTransaction(db, async (tx) => {
      const event = (await tx.get(eventRef)).data();
      if ((await tx.get(claim.ref)).data()?.status !== 'claimed') return;
      tx.update(eventRef, { counts: { ...event.counts, attended: (event.counts?.attended || 0) + 1 }, countsBy: uid });
      tx.update(claim.ref, { status: 'confirmed', confirmedAt: serverTimestamp(), confirmedBy: 'auto', updatedAt: serverTimestamp() });
    }).then(() => { confirmed += 1; }, (err) => console.warn(`Couldn’t confirm the claim for ${eventRef.id}`, err));
  }
  return confirmed;
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
// hours. Entries whose confirmation was undone are removed. Returns how many entries were added or removed.
export async function syncHours(uid) {
  const confirmedAttendance = () =>
    getDocs(query(collectionGroup(db, 'attendance'), where('uid', '==', uid), where('status', '==', 'confirmed')));
  const [autoConfirmed, confirmedBefore, entries] = await Promise.all([
    autoConfirmClaims(uid).catch((err) => { console.warn(err); return 0; }),
    confirmedAttendance(),
    getDocs(collection(db, 'users', uid, 'hours')),
  ]);
  const confirmed = autoConfirmed ? await confirmedAttendance() : confirmedBefore;
  const have = new Set(entries.docs.map((d) => d.id));
  const confirmedIds = new Set(confirmed.docs.map((d) => d.ref.parent.parent.id));
  let changed = 0;

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
          changed += 1;
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
    changed += 1;
  }
  return changed;
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

export async function getMember(orgId, uid) {
  return (await getDoc(doc(db, 'organisations', orgId, 'members', uid))).data() || null;
}

// The user's role for one event: their organisation role, or else their host role on the event (Phase 2). A co-host
// acts as an admin for that event only, and event staff as staff.
export async function getEventRole(event, eventId, user) {
  const email = user.email?.toLowerCase();
  const [orgRole, host] = await Promise.all([
    getMyRole(event.orgId, user.uid).catch(() => null),
    email ? getDoc(doc(db, 'events', eventId, 'hosts', email)).then((s) => s.data()?.role || null).catch(() => null) : null,
  ]);
  return orgRole || (host === 'cohost' ? 'admin' : host);
}

// Organisation applications (Phase 2): the applicant creates the organisation, pending, and becomes its admin in the
// same write. The network admin approves or declines it.
const LOGO_COLOURS = [['#1F4E6E', '#5B9BC2'], ['#2E5C44', '#5FA37B'], ['#B04A6A', '#E58AA8'], ['#8A4A12', '#E8945A'], ['#5A3E7A', '#9C7BC4']];

export async function applyOrganisation(uid, applicantName, fields) {
  const slug = fields.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'org';
  const orgId = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const colours = LOGO_COLOURS[[...fields.name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % LOGO_COLOURS.length];
  const batch = writeBatch(db);
  batch.set(doc(db, 'organisations', orgId), {
    ...fields, timezone: 'Asia/Singapore', logoColors: colours, status: 'pending', stats: { events: 0, volunteers: 0, hours: 0 },
    createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'organisations', orgId, 'members', uid), { uid, role: 'admin', name: applicantName.slice(0, 100), addedAt: serverTimestamp() });
  await batch.commit();
  return orgId;
}

export async function listApplications() {
  const snaps = await getDocs(query(collection(db, 'organisations'), where('status', '==', 'pending')));
  return allWithIds(snaps).sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
}

export const decideApplication = (orgId, status, uid) => updateDoc(doc(db, 'organisations', orgId), {
  status, decidedBy: uid, updatedAt: serverTimestamp(), ...(status === 'approved' ? { approvedAt: serverTimestamp() } : {}),
});

// Event hosts (Phase 2): co-hosts and staff, one per email. Guest speakers and partner organisations are kept on the
// event itself (speakers, partners), because they're shown on the event page.
export async function listHosts(eventId) {
  return allWithIds(await getDocs(collection(db, 'events', eventId, 'hosts')));
}
export const addHost = (eventId, email, role, by) =>
  setDoc(doc(db, 'events', eventId, 'hosts', email), { email, role, addedBy: by, addedAt: serverTimestamp() });
export const removeHost = (eventId, email) => deleteDoc(doc(db, 'events', eventId, 'hosts', email));

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

// The organisation's events that have ended, newest first (its members only). Drafts and cancelled events are left out.
export async function listOrgPastEvents(orgId, n = 20) {
  const now = Date.now();
  const snaps = await getDocs(query(collection(db, 'events'), where('orgId', '==', orgId),
    where('startAt', '<', Timestamp.fromMillis(now)), orderBy('startAt', 'desc'), limit(n)));
  return allWithIds(snaps).filter((e) => e.endAt.toMillis() < now && e.status !== 'cancelled' && e.visibility !== 'draft');
}

// How many hours claims are waiting on an event (the organisation's members only).
export async function countClaims(eventId) {
  return (await getDocs(query(collection(db, 'events', eventId, 'attendance'), where('status', '==', 'claimed')))).size;
}
