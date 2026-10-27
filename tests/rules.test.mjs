// Rules tests for users/{uid}. `npm test` starts the Firestore emulator and runs this file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, setLogLevel,
  updateDoc, where, writeBatch,
} from 'firebase/firestore';

let testEnv;

before(async () => {
  setLogLevel('error');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-the-events',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

beforeEach(() => testEnv.clearFirestore());

after(() => testEnv?.cleanup());

const dbAs = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
const userRef = (db, uid) => doc(db, 'users', uid);

const firstSignIn = (uid) => ({
  name: 'Aisha Rahman',
  email: `${uid}@example.com`,
  photoUrl: '',
  bio: '',
  follows: [],
  joinedAt: serverTimestamp(),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

// Writes a profile with rules off, as the console would.
const seed = (uid, extra = {}) => testEnv.withSecurityRulesDisabled((ctx) => setDoc(userRef(ctx.firestore(), uid), {
  name: 'Ben Tan', email: `${uid}@example.com`, photoUrl: '', bio: '', follows: [],
  joinedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
  ...extra,
}));

// Writes any documents with rules off: { 'path/to/doc': data }.
const seedDocs = (docs) => testEnv.withSecurityRulesDisabled(async (ctx) => {
  for (const [path, data] of Object.entries(docs)) await setDoc(doc(ctx.firestore(), path), data);
});

const anon = () => testEnv.unauthenticatedContext().firestore();

describe('users/{uid}: own profile', () => {
  it('creates their profile on first sign-in', async () => {
    await assertSucceeds(setDoc(userRef(dbAs('alice'), 'alice'), firstSignIn('alice')));
  });

  it('reads their own profile', async () => {
    await seed('alice');
    await assertSucceeds(getDoc(userRef(dbAs('alice'), 'alice')));
  });

  it('updates name, bio, photoUrl and follows', async () => {
    await seed('alice');
    await assertSucceeds(updateDoc(userRef(dbAs('alice'), 'alice'), {
      name: 'Aisha R', bio: 'Weekend volunteer', photoUrl: 'https://example.com/a.jpg', follows: ['harvest-table'],
      updatedAt: serverTimestamp(),
    }));
  });
});

describe('users/{uid}: protected fields', () => {
  it('cannot set networkAdmin on first sign-in', async () => {
    await assertFails(setDoc(userRef(dbAs('alice'), 'alice'), { ...firstSignIn('alice'), networkAdmin: true }));
  });

  it('cannot set hoursTotal on first sign-in', async () => {
    await assertFails(setDoc(userRef(dbAs('alice'), 'alice'), { ...firstSignIn('alice'), hoursTotal: 40 }));
  });

  it('cannot turn on networkAdmin later', async () => {
    await seed('alice', { networkAdmin: false });
    await assertFails(updateDoc(userRef(dbAs('alice'), 'alice'), { networkAdmin: true, updatedAt: serverTimestamp() }));
  });

  it('cannot change hoursTotal', async () => {
    await seed('alice', { hoursTotal: 2 });
    await assertFails(updateDoc(userRef(dbAs('alice'), 'alice'), { hoursTotal: 40, updatedAt: serverTimestamp() }));
  });

  it('cannot change their email', async () => {
    await seed('alice');
    await assertFails(updateDoc(userRef(dbAs('alice'), 'alice'), { email: 'other@example.com', updatedAt: serverTimestamp() }));
  });

  it('cannot create a profile with someone else\'s email', async () => {
    await assertFails(setDoc(userRef(dbAs('alice'), 'alice'), { ...firstSignIn('alice'), email: 'bob@example.com' }));
  });

  it('cannot follow more than 200 organisations', async () => {
    await seed('alice');
    const follows = Array.from({ length: 201 }, (_, i) => `org-${i}`);
    await assertFails(updateDoc(userRef(dbAs('alice'), 'alice'), { follows, updatedAt: serverTimestamp() }));
  });

  it('cannot delete their profile', async () => {
    await seed('alice');
    await assertFails(deleteDoc(userRef(dbAs('alice'), 'alice')));
  });
});

describe('users/{uid}: other people', () => {
  it('cannot read another user\'s profile', async () => {
    await seed('bob');
    await assertFails(getDoc(userRef(dbAs('alice'), 'bob')));
  });

  it('cannot create or edit another user\'s profile', async () => {
    await seed('bob');
    await assertFails(setDoc(userRef(dbAs('alice'), 'carol'), firstSignIn('alice')));
    await assertFails(updateDoc(userRef(dbAs('alice'), 'bob'), { name: 'Changed', updatedAt: serverTimestamp() }));
  });

  it('signed-out visitors cannot read any profile', async () => {
    await seed('bob');
    await assertFails(getDoc(userRef(anon(), 'bob')));
  });
});

// Shared fixtures for organisations and events. mei is an admin of "open"; carol is a member of "waiting".
const orgFixtures = () => seedDocs({
  'organisations/open': { name: 'Open Org', status: 'approved' },
  'organisations/waiting': { name: 'Waiting Org', status: 'pending' },
  'organisations/open/members/mei': { uid: 'mei', role: 'admin' },
  'organisations/waiting/members/carol': { uid: 'carol', role: 'admin' },
  'users/alice': { name: 'Alice', follows: ['open'] },
  'users/bob': { name: 'Bob', follows: [] },
  'users/root': { name: 'Root', follows: [], networkAdmin: true },
  'events/pub': { orgId: 'open', visibility: 'public', status: 'scheduled' },
  'events/fol': { orgId: 'open', visibility: 'followers', status: 'scheduled' },
  'events/drf': { orgId: 'open', visibility: 'draft', status: 'scheduled' },
});

describe('organisations', () => {
  beforeEach(orgFixtures);

  it('anyone signed in can read an approved organisation', async () => {
    await assertSucceeds(getDoc(doc(dbAs('bob'), 'organisations/open')));
  });

  it('signed-out visitors cannot read organisations', async () => {
    await assertFails(getDoc(doc(anon(), 'organisations/open')));
  });

  it('a non-member cannot read a pending organisation', async () => {
    await assertFails(getDoc(doc(dbAs('alice'), 'organisations/waiting')));
  });

  it('a member can read their own pending organisation', async () => {
    await assertSucceeds(getDoc(doc(dbAs('carol'), 'organisations/waiting')));
  });

  it('the network admin can read a pending organisation', async () => {
    await assertSucceeds(getDoc(doc(dbAs('root'), 'organisations/waiting')));
  });

  it('listing approved organisations works, listing all of them does not', async () => {
    await assertSucceeds(getDocs(query(collection(dbAs('bob'), 'organisations'), where('status', '==', 'approved'))));
    await assertFails(getDocs(collection(dbAs('bob'), 'organisations')));
  });

  it('nobody can create an organisation or replace one wholesale', async () => {
    await assertFails(setDoc(doc(dbAs('mei'), 'organisations/open'), { name: 'Changed', status: 'approved' }));
    await assertFails(setDoc(doc(dbAs('root'), 'organisations/new'), { name: 'New', status: 'approved' }));
  });

  it('members can see their membership and find it with a query on their own uid', async () => {
    await assertSucceeds(getDoc(doc(dbAs('mei'), 'organisations/open/members/mei')));
    await assertSucceeds(getDocs(query(collectionGroup(dbAs('mei'), 'members'), where('uid', '==', 'mei'))));
  });

  it('a volunteer cannot read other people\'s memberships', async () => {
    await assertFails(getDoc(doc(dbAs('alice'), 'organisations/open/members/mei')));
    await assertFails(getDocs(query(collectionGroup(dbAs('alice'), 'members'), where('uid', '==', 'mei'))));
  });
});

describe('organisations: editing the profile', () => {
  beforeEach(async () => {
    await orgFixtures();
    await seedDocs({
      'organisations/open': {
        name: 'Open Org', tagline: 'Tag', about: 'About', causes: ['food'], area: 'central', logoColors: ['#111111', '#222222'],
        givingUrl: '', email: 'hi@open.example', address: 'Somewhere', website: 'open.example', status: 'approved',
        stats: { events: 1, volunteers: 2, hours: 3 },
      },
      'organisations/open/members/sam': { uid: 'sam', role: 'staff' },
    });
  });
  const edit = (uid, fields) => updateDoc(doc(dbAs(uid), 'organisations/open'), { ...fields, updatedAt: serverTimestamp() });

  it('an organisation admin can edit About and the giving link', async () => {
    await assertSucceeds(edit('mei', { about: 'We sort food.', givingUrl: 'https://open.example/give' }));
  });

  it('an admin cannot change the status, the stats or the approval', async () => {
    await assertFails(edit('mei', { status: 'suspended' }));
    await assertFails(edit('mei', { stats: { events: 99, volunteers: 2, hours: 3 } }));
    await assertFails(edit('mei', { approvedAt: new Date() }));
  });

  it('the giving link must be an https address', async () => {
    await assertFails(edit('mei', { givingUrl: 'http://open.example/give' }));
    await assertFails(edit('mei', { givingUrl: 'javascript:alert(1)' }));
  });

  it('staff, volunteers and other organisations\' admins cannot edit', async () => {
    await assertFails(edit('sam', { about: 'Changed' }));
    await assertFails(edit('alice', { about: 'Changed' }));
    await assertFails(edit('carol', { about: 'Changed' }));
  });
});

describe('events: who can read', () => {
  beforeEach(orgFixtures);

  it('anyone signed in can read a public event', async () => {
    await assertSucceeds(getDoc(doc(dbAs('bob'), 'events/pub')));
  });

  it('signed-out visitors cannot read events', async () => {
    await assertFails(getDoc(doc(anon(), 'events/pub')));
  });

  it('followers can read a followers-only event, others cannot', async () => {
    await assertSucceeds(getDoc(doc(dbAs('alice'), 'events/fol')));
    await assertFails(getDoc(doc(dbAs('bob'), 'events/fol')));
  });

  it('a volunteer cannot read a draft event, even one from an organisation they follow', async () => {
    await assertFails(getDoc(doc(dbAs('alice'), 'events/drf')));
    await assertFails(getDoc(doc(dbAs('bob'), 'events/drf')));
  });

  it('organisation members and the network admin can read a draft event', async () => {
    await assertSucceeds(getDoc(doc(dbAs('mei'), 'events/drf')));
    await assertSucceeds(getDoc(doc(dbAs('root'), 'events/drf')));
  });

  it('listing public events works, listing every event does not', async () => {
    await assertSucceeds(getDocs(query(collection(dbAs('bob'), 'events'), where('visibility', '==', 'public'))));
    await assertFails(getDocs(collection(dbAs('bob'), 'events')));
  });

  it('a follower can list followers-only events of the organisations they follow', async () => {
    const q = query(collection(dbAs('alice'), 'events'), where('visibility', '==', 'followers'), where('orgId', 'in', ['open']));
    await assertSucceeds(getDocs(q));
    const other = query(collection(dbAs('bob'), 'events'), where('visibility', '==', 'followers'), where('orgId', 'in', ['open']));
    await assertFails(getDocs(other));
  });

  it('a member can list all of their organisation\'s events, drafts included', async () => {
    await assertSucceeds(getDocs(query(collection(dbAs('mei'), 'events'), where('orgId', '==', 'open'))));
    await assertFails(getDocs(query(collection(dbAs('alice'), 'events'), where('orgId', '==', 'open'))));
  });

  it('an incomplete event is refused, even from an admin', async () => {
    await assertFails(setDoc(doc(dbAs('mei'), 'events/new'), { orgId: 'open', visibility: 'public', status: 'scheduled' }));
  });
});

describe('the organisation\'s decisions, attendance and the hours ledger', () => {
  const startAt = new Date(Date.now() - 3 * 3600e3), endAt = new Date(Date.now() - 3600e3);
  const confirmedAt = new Date(Date.now() - 1800e3);
  const cover = { colors: ['#7A3E2A', '#D08A5E'], label: 'YISHUN\nVISIT' };
  const counts = (over = {}) => ({ going: 1, pending: 1, waitlist: 0, attended: 0, ...over });
  const reg = (uid, status) => ({ uid, name: `${uid} A.`, status, ticketTypeId: null, answers: {}, registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date() });

  beforeEach(async () => {
    await orgFixtures();
    await seedDocs({
      'organisations/open/members/sam': { uid: 'sam', role: 'staff' },
      'events/e7': {
        orgId: 'open', orgName: 'Open Org', title: 'Yishun visit', visibility: 'public', status: 'scheduled', startAt, endAt,
        hours: 2, cover, registration: { open: true, approval: true, capacity: 10, waitlist: true, group: false }, counts: counts(),
      },
      'events/e7/registrations/alice': reg('alice', 'pending'),
      'events/e7/registrations/bob': reg('bob', 'going'),
      'events/e7/going/bob': { name: 'Bob B.' },
    });
  });

  // An admin's decision the way the app writes it: the registration, the counts (naming whose) and who's going.
  function decide(by, who, status, next, { goingEntry, countsBy = who } = {}) {
    const db = dbAs(by);
    const batch = writeBatch(db);
    batch.update(doc(db, 'events/e7'), { counts: next, countsBy });
    batch.update(doc(db, `events/e7/registrations/${who}`), { status, decidedAt: serverTimestamp(), decidedBy: by, updatedAt: serverTimestamp() });
    if (goingEntry === 'add') batch.set(doc(db, `events/e7/going/${who}`), { name: `${who} A.`, since: serverTimestamp() });
    if (goingEntry === 'remove') batch.delete(doc(db, `events/e7/going/${who}`));
    return batch.commit();
  }

  function markAttended(by, who, next, { moveCounts = true } = {}) {
    const db = dbAs(by);
    const batch = writeBatch(db);
    if (moveCounts) batch.update(doc(db, 'events/e7'), { counts: next, countsBy: who });
    batch.set(doc(db, `events/e7/attendance/${who}`), {
      uid: who, name: `${who} A.`, status: 'confirmed', hours: 2, checkedOutAt: serverTimestamp(), checkedOutBy: by,
      confirmedAt: serverTimestamp(), confirmedBy: by, updatedAt: serverTimestamp(),
    });
    return batch.commit();
  }

  // The volunteer's app adding its ledger entry: the entry, its reference number and the new total, together.
  function addEntry(uid, ref, { hours = 2 } = {}) {
    const db = dbAs(uid);
    const batch = writeBatch(db);
    batch.set(doc(db, `users/${uid}/hours/e7`), {
      eventId: 'e7', eventTitle: 'Yishun visit', orgId: 'open', orgName: 'Open Org', cover, date: startAt, hours,
      confirmedBy: 'mei', confirmedAt, reference: ref,
    });
    batch.set(doc(db, `references/${ref}`), { uid, entryId: 'e7' });
    batch.update(doc(db, `users/${uid}`), { hoursTotal: increment(hours), hoursBy: 'e7' });
    return batch.commit();
  }

  const confirmBob = () => seedDocs({
    'events/e7': {
      orgId: 'open', orgName: 'Open Org', title: 'Yishun visit', visibility: 'public', status: 'scheduled', startAt, endAt,
      hours: 2, cover, registration: { open: true, approval: true, capacity: 10, waitlist: true, group: false }, counts: counts({ attended: 1 }),
    },
    'events/e7/attendance/bob': { uid: 'bob', status: 'confirmed', hours: 2, confirmedAt, confirmedBy: 'mei', updatedAt: confirmedAt },
  });

  it('an admin approves a request: going, a who\'s-going entry, and the counts move', async () => {
    await assertSucceeds(decide('mei', 'alice', 'going', counts({ going: 2, pending: 0 }), { goingEntry: 'add' }));
  });

  it('staff and volunteers cannot approve requests', async () => {
    await assertFails(decide('sam', 'alice', 'going', counts({ going: 2, pending: 0 }), { goingEntry: 'add' }));
    await assertFails(decide('bob', 'alice', 'going', counts({ going: 2, pending: 0 }), { goingEntry: 'add' }));
  });

  it('an admin declines a request', async () => {
    await assertSucceeds(decide('mei', 'alice', 'declined', counts({ pending: 0 })));
  });

  it('the counts must follow the person whose registration changed', async () => {
    await assertFails(decide('mei', 'alice', 'going', counts({ going: 2, pending: 0 }), { goingEntry: 'add', countsBy: 'bob' }));
  });

  it('staff mark a going volunteer attended, and the attended count moves with it', async () => {
    await assertSucceeds(markAttended('sam', 'bob', counts({ attended: 1 })));
  });

  it('attendance needs a going registration, and the attended count must move', async () => {
    await assertFails(markAttended('mei', 'alice', counts({ attended: 1 })));
    await assertFails(markAttended('mei', 'bob', counts(), { moveCounts: false }));
  });

  it('a volunteer cannot record their own attendance', async () => {
    await assertFails(markAttended('bob', 'bob', counts({ attended: 1 })));
  });

  it('once confirmed, the volunteer\'s app adds the entry, with a new reference number and the hours total', async () => {
    await confirmBob();
    await assertSucceeds(addEntry('bob', 'VN-2026-12345'));
  });

  it('no entry without confirmed attendance, or for different hours', async () => {
    await assertFails(addEntry('alice', 'VN-2026-22222'));
    await confirmBob();
    await assertFails(addEntry('bob', 'VN-2026-33333', { hours: 3 }));
  });

  it('a reference number is used only once', async () => {
    await confirmBob();
    await seedDocs({ 'references/VN-2026-44444': { uid: 'carol', entryId: 'x' } });
    await assertFails(addEntry('bob', 'VN-2026-44444'));
  });

  it('hoursTotal cannot be changed on its own', async () => {
    await assertFails(updateDoc(doc(dbAs('bob'), 'users/bob'), { hoursTotal: 10, hoursBy: 'e7' }));
  });

  it('a volunteer cannot write anyone else\'s ledger or hours total', async () => {
    await confirmBob();
    const db = dbAs('alice');
    const batch = writeBatch(db);
    batch.set(doc(db, 'users/bob/hours/e7'), {
      eventId: 'e7', eventTitle: 'Yishun visit', orgId: 'open', orgName: 'Open Org', cover, date: startAt, hours: 2,
      confirmedBy: 'mei', confirmedAt, reference: 'VN-2026-55555',
    });
    batch.set(doc(db, 'references/VN-2026-55555'), { uid: 'bob', entryId: 'e7' });
    batch.update(doc(db, 'users/bob'), { hoursTotal: increment(2), hoursBy: 'e7' });
    await assertFails(batch.commit());
    await assertFails(updateDoc(doc(dbAs('alice'), 'users/bob'), { hoursTotal: 10, hoursBy: 'e7' }));
  });

  it('organisation admins can list the ledger entries that name their organisation', async () => {
    await seedDocs({ 'users/bob/hours/past': { orgId: 'open', hours: 3 } });
    await assertSucceeds(getDocs(query(collectionGroup(dbAs('mei'), 'hours'), where('orgId', '==', 'open'))));
    await assertFails(getDocs(query(collectionGroup(dbAs('carol'), 'hours'), where('orgId', '==', 'open'))));
  });
});

describe('check-in, check-out and staff', () => {
  const counts = (over = {}) => ({ going: 1, pending: 0, waitlist: 0, attended: 0, ...over });
  const st = serverTimestamp;

  beforeEach(async () => {
    await orgFixtures();
    await seedDocs({
      'organisations/open/members/sam': { uid: 'sam', role: 'staff' },
      'organisations/open/members/sue': { uid: 'sue', role: 'staff' },
      'events/e8': {
        orgId: 'open', orgName: 'Open Org', title: 'Pantry restock', visibility: 'public', status: 'scheduled',
        startAt: new Date(), endAt: new Date(Date.now() + 2 * 3600e3), hours: 2, counts: counts(),
        registration: { open: true, approval: false, capacity: 10, waitlist: true, group: false },
      },
      'events/e8/registrations/alice': { uid: 'alice', name: 'Alice A.', status: 'going' },
      'events/e8/private/codes': { checkIn: 'in-12345678', checkOut: 'out-12345678' },
    });
  });

  // The volunteer's check-out: attendance confirmed with the code, and the attended count, in one write.
  function checkOut(uid, { who = uid, code = 'out-12345678', hours = 2, update = false } = {}) {
    const db = dbAs(uid);
    const batch = writeBatch(db);
    batch.update(doc(db, 'events/e8'), { counts: counts({ attended: 1 }), countsBy: who });
    const fields = { status: 'confirmed', hours, code, checkedOutAt: st(), checkedOutBy: who, confirmedAt: st(), confirmedBy: 'code', updatedAt: st() };
    if (update) batch.update(doc(db, `events/e8/attendance/${who}`), fields);
    else batch.set(doc(db, `events/e8/attendance/${who}`), { uid: who, name: 'Alice A.', ...fields });
    return batch.commit();
  }

  it('staff check a going volunteer in', async () => {
    await assertSucceeds(setDoc(doc(dbAs('sam'), 'events/e8/attendance/alice'), {
      uid: 'alice', name: 'Alice A.', status: 'checked_in', hours: 2, checkedInAt: st(), checkedInBy: 'sam', updatedAt: st(),
    }));
  });

  it('a volunteer confirms their own hours with the check-out code', async () => {
    await assertSucceeds(checkOut('alice'));
  });

  it('the wrong code, different hours, or someone else\'s attendance is refused', async () => {
    await assertFails(checkOut('alice', { code: 'guess-1234' }));
    await assertFails(checkOut('alice', { hours: 5 }));
    await assertFails(checkOut('bob', { who: 'alice' }));
  });

  it('after a check-in, the check-out keeps the organisation\'s check-in record', async () => {
    await seedDocs({ 'events/e8/attendance/alice': { uid: 'alice', name: 'Alice A.', status: 'checked_in', hours: 2, checkedInAt: new Date(), checkedInBy: 'sam', updatedAt: new Date() } });
    await assertSucceeds(checkOut('alice', { update: true }));
  });

  it('admins invite staff by email; staff and volunteers cannot', async () => {
    const invite = (uid) => setDoc(doc(dbAs(uid), 'organisations/open/staffInvites/dan@example.com'), {
      email: 'dan@example.com', role: 'staff', invitedBy: uid, invitedAt: st(),
    });
    await assertSucceeds(invite('mei'));
    await assertFails(invite('sam'));
    await assertFails(invite('alice'));
  });

  it('an invited person becomes staff when they sign in', async () => {
    await seedDocs({ 'organisations/open/staffInvites/dan@example.com': { email: 'dan@example.com', role: 'staff', invitedBy: 'mei' } });
    const db = dbAs('dan');
    const batch = writeBatch(db);
    batch.set(doc(db, 'organisations/open/members/dan'), { uid: 'dan', role: 'staff', name: 'Dan', addedAt: st() });
    batch.delete(doc(db, 'organisations/open/staffInvites/dan@example.com'));
    await assertSucceeds(batch.commit());
  });

  it('nobody becomes staff without an invite, or admin with one', async () => {
    await assertFails(setDoc(doc(dbAs('eve'), 'organisations/open/members/eve'), { uid: 'eve', role: 'staff', name: 'Eve', addedAt: st() }));
    await seedDocs({ 'organisations/open/staffInvites/dan@example.com': { email: 'dan@example.com', role: 'staff', invitedBy: 'mei' } });
    const db = dbAs('dan');
    const batch = writeBatch(db);
    batch.set(doc(db, 'organisations/open/members/dan'), { uid: 'dan', role: 'admin', name: 'Dan', addedAt: st() });
    batch.delete(doc(db, 'organisations/open/staffInvites/dan@example.com'));
    await assertFails(batch.commit());
  });

  it('admins remove staff; staff cannot remove each other', async () => {
    await assertFails(deleteDoc(doc(dbAs('sam'), 'organisations/open/members/sue')));
    await assertSucceeds(deleteDoc(doc(dbAs('mei'), 'organisations/open/members/sue')));
  });
});

describe('claims and auto-confirm', () => {
  const WEEK = 7 * 86400e3;
  const ago = (days) => new Date(Date.now() - days * 86400e3);
  const ended = { startAt: new Date(Date.now() - 5 * 3600e3), endAt: new Date(Date.now() - 2 * 3600e3) };
  const counts = (over = {}) => ({ going: 1, pending: 1, waitlist: 0, attended: 0, ...over });
  const st = serverTimestamp;
  const event = (times = ended) => ({
    orgId: 'open', orgName: 'Open Org', title: 'Beach clean-up', visibility: 'public', status: 'scheduled', ...times, hours: 3,
    counts: counts(), registration: { open: true, approval: false, capacity: 40, waitlist: true, group: false },
  });
  const attendance = (over = {}) => ({
    uid: 'alice', name: 'Alice A.', status: 'checked_in', hours: 3, checkedInAt: ago(0.2), checkedInBy: 'mei', updatedAt: new Date(), ...over,
  });

  beforeEach(async () => {
    await orgFixtures();
    await seedDocs({
      'events/e9': event(),
      'events/e9/registrations/alice': { uid: 'alice', name: 'Alice A.', status: 'going' },
      'events/e9/registrations/bob': { uid: 'bob', name: 'Bob B.', status: 'pending' },
    });
  });

  // A claim without a check-in, the way the app writes it.
  const claim = (uid, over = {}) => setDoc(doc(dbAs(uid), `events/e9/attendance/${uid}`), {
    uid, name: 'Alice A.', status: 'claimed', hours: 3, claimedAt: st(), updatedAt: st(), ...over,
  });
  const claimAfterCheckIn = (autoConfirmAt) => updateDoc(doc(dbAs('alice'), 'events/e9/attendance/alice'), {
    status: 'claimed', claimedAt: st(), autoConfirmAt, updatedAt: st(),
  });

  // Confirming a claim: the attendance and the attended count, in one write.
  function confirm(by, fields) {
    const db = dbAs(by);
    const batch = writeBatch(db);
    batch.update(doc(db, 'events/e9'), { counts: counts({ attended: 1 }), countsBy: 'alice' });
    batch.update(doc(db, 'events/e9/attendance/alice'), { status: 'confirmed', confirmedAt: st(), updatedAt: st(), ...fields });
    return batch.commit();
  }
  const autoConfirm = () => confirm('alice', { confirmedBy: 'auto' });

  it('after the event, a volunteer who was going claims its hours', async () => {
    await assertSucceeds(claim('alice'));
  });

  it('no claim before the event ends, without a going registration, for other hours or for someone else', async () => {
    await seedDocs({ 'events/e9': event({ startAt: new Date(), endAt: new Date(Date.now() + 3600e3) }) });
    await assertFails(claim('alice'));
    await seedDocs({ 'events/e9': event() });
    await assertFails(claim('bob', { name: 'Bob B.' }));
    await assertFails(claim('alice', { hours: 5 }));
    await assertFails(setDoc(doc(dbAs('bob'), 'events/e9/attendance/alice'), {
      uid: 'alice', name: 'Alice A.', status: 'claimed', hours: 3, claimedAt: st(), updatedAt: st(),
    }));
  });

  it('a claim cannot confirm itself, use another name, or set an auto-confirm date without a check-in', async () => {
    await assertFails(claim('alice', { status: 'confirmed', confirmedAt: st(), confirmedBy: 'auto' }));
    await assertFails(claim('alice', { name: 'Someone Else' }));
    await assertFails(claim('alice', { autoConfirmAt: new Date(Date.now() + WEEK) }));
  });

  it('a claim after a check-in sets its auto-confirm date 7 days ahead, not sooner', async () => {
    await seedDocs({ 'events/e9/attendance/alice': attendance() });
    await assertFails(claimAfterCheckIn(new Date(Date.now() + 86400e3)));
    await assertSucceeds(claimAfterCheckIn(new Date(Date.now() + WEEK)));
  });

  it('the organiser confirms or declines a claim', async () => {
    const claimed = attendance({ status: 'claimed', claimedAt: ago(1), autoConfirmAt: new Date(Date.now() + 6 * 86400e3) });
    await seedDocs({ 'events/e9/attendance/alice': claimed });
    await assertSucceeds(confirm('mei', { checkedOutAt: st(), checkedOutBy: 'mei', confirmedBy: 'mei' }));
    await seedDocs({ 'events/e9': event(), 'events/e9/attendance/alice': claimed });
    await assertSucceeds(updateDoc(doc(dbAs('mei'), 'events/e9/attendance/alice'), { status: 'declined', updatedAt: st() }));
  });

  it('once its date has passed, the volunteer\'s app confirms the claim, and the attended count moves', async () => {
    await seedDocs({ 'events/e9/attendance/alice': attendance({ status: 'claimed', claimedAt: ago(8), autoConfirmAt: ago(1) }) });
    await assertSucceeds(autoConfirm());
  });

  it('auto-confirm waits for its date and 7 days after the claim, and needs a check-in', async () => {
    await seedDocs({ 'events/e9/attendance/alice': attendance({ status: 'claimed', claimedAt: ago(8), autoConfirmAt: ago(-1) }) });
    await assertFails(autoConfirm());
    await seedDocs({ 'events/e9/attendance/alice': attendance({ status: 'claimed', claimedAt: ago(3), autoConfirmAt: ago(1) }) });
    await assertFails(autoConfirm());
    await seedDocs({ 'events/e9/attendance/alice': { uid: 'alice', name: 'Alice A.', status: 'claimed', hours: 3, claimedAt: ago(8), updatedAt: ago(8) } });
    await assertFails(autoConfirm());
  });

  it('a declined claim stays declined', async () => {
    await seedDocs({ 'events/e9/attendance/alice': attendance({ status: 'declined', claimedAt: ago(8), autoConfirmAt: ago(1) }) });
    await assertFails(claimAfterCheckIn(new Date(Date.now() + WEEK)));
    await assertFails(autoConfirm());
  });
});

describe('events: creating and editing', () => {
  const start = new Date(Date.now() + 3 * 86400e3), end = new Date(start.getTime() + 2 * 3600e3);
  const newEvent = (over = {}) => ({
    orgId: 'open', orgName: 'Open Org', title: 'Park clean-up', description: 'Pick up litter.', cause: 'environment', area: 'east',
    venue: 'East Coast Park', meetingPoint: 'Carpark C1', bring: 'Water', startAt: start, endAt: end, hours: 2,
    cover: { colors: ['#1F4E6E', '#5B9BC2'], label: 'PARK\nCLEAN-UP' }, visibility: 'public', status: 'scheduled',
    registration: { open: true, approval: false, capacity: 10, waitlist: true, group: false }, ticketTypes: [],
    counts: { going: 0, pending: 0, waitlist: 0, attended: 0 }, hideExactLocation: false, checkInMode: 'standard',
    checkInLocked: false, notifyFollowers: true, createdBy: 'mei', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    ...over,
  });

  beforeEach(async () => {
    await orgFixtures();
    await seedDocs({ 'organisations/open/members/sam': { uid: 'sam', role: 'staff' } });
  });

  // Creates an event the way the app does: the event and its check-in codes in one write.
  function create(uid, id, data, withCodes = true) {
    const db = dbAs(uid);
    const batch = writeBatch(db);
    batch.set(doc(db, 'events', id), data);
    if (withCodes) batch.set(doc(db, `events/${id}/private/codes`), { checkIn: 'in-1234567', checkOut: 'out-1234567', rotatedAt: serverTimestamp() });
    return batch.commit();
  }

  it('an organisation admin creates an event, with its check-in codes', async () => {
    await assertSucceeds(create('mei', 'new1', newEvent()));
  });

  it('staff, volunteers and other organisations\' admins cannot create one', async () => {
    await assertFails(create('sam', 'new2', newEvent({ createdBy: 'sam' })));
    await assertFails(create('alice', 'new3', newEvent({ createdBy: 'alice' })));
    await assertFails(create('carol', 'new4', newEvent({ createdBy: 'carol' })));
  });

  it('a new event starts scheduled and empty, under its organisation\'s real name and its creator', async () => {
    await assertFails(create('mei', 'new5', newEvent({ counts: { going: 3, pending: 0, waitlist: 0, attended: 0 } })));
    await assertFails(create('mei', 'new6', newEvent({ status: 'cancelled' })));
    await assertFails(create('mei', 'new7', newEvent({ orgName: 'Somebody Else' })));
    await assertFails(create('mei', 'new8', newEvent({ createdBy: 'someone' })));
  });

  it('the end must come after the start', async () => {
    await assertFails(create('mei', 'new9', newEvent({ endAt: start })));
  });

  it('a volunteer cannot add check-in codes to an event', async () => {
    await assertFails(setDoc(doc(dbAs('alice'), 'events/pub/private/codes'), { checkIn: 'in-1234567', checkOut: 'out-1234567', rotatedAt: serverTimestamp() }));
  });

  describe('editing', () => {
    beforeEach(() => seedDocs({ 'events/ed': newEvent() }));
    const editAs = (uid, fields) => updateDoc(doc(dbAs(uid), 'events/ed'), { ...fields, updatedAt: serverTimestamp() });

    it('an admin edits the title, the time and the visibility', async () => {
      const later = new Date(end.getTime() + 3600e3);
      await assertSucceeds(editAs('mei', { title: 'Beach clean-up', endAt: later, hours: 3, visibility: 'followers' }));
    });

    it('the organisation and the counts cannot change', async () => {
      await assertFails(editAs('mei', { orgId: 'waiting' }));
      await assertFails(editAs('mei', { counts: { going: 5, pending: 0, waitlist: 0, attended: 0 } }));
    });

    it('staff and volunteers cannot edit', async () => {
      await assertFails(editAs('sam', { title: 'Changed' }));
      await assertFails(editAs('alice', { title: 'Changed' }));
    });

    it('an admin can cancel an event, and it stays cancelled', async () => {
      await assertSucceeds(editAs('mei', { status: 'cancelled' }));
      await assertFails(editAs('mei', { status: 'scheduled' }));
    });
  });
});

describe('registrations and the hours ledger: reading', () => {
  beforeEach(async () => {
    await orgFixtures();
    await seedDocs({
      'events/pub/registrations/alice': { uid: 'alice', status: 'going' },
      'events/fol/registrations/alice': { uid: 'alice', status: 'pending' },
      'events/pub/registrations/bob': { uid: 'bob', status: 'going' },
      'users/alice/hours/e1': { orgId: 'open', hours: 2 },
      'users/alice/hours/e2': { orgId: 'waiting', hours: 3 },
    });
  });

  const myRegs = (uid, who = uid) => query(collectionGroup(dbAs(uid), 'registrations'),
    where('uid', '==', who), where('status', 'in', ['going', 'pending']));

  it('a volunteer can list their own registrations across events', async () => {
    const snaps = await assertSucceeds(getDocs(myRegs('alice')));
    assert.equal(snaps.size, 2);
  });

  it('a volunteer cannot list or read someone else\'s registrations', async () => {
    await assertFails(getDocs(myRegs('alice', 'bob')));
    await assertFails(getDoc(doc(dbAs('alice'), 'events/pub/registrations/bob')));
  });

  it('a volunteer can read their own hours ledger, another volunteer cannot', async () => {
    await assertSucceeds(getDocs(collection(dbAs('alice'), 'users/alice/hours')));
    await assertFails(getDocs(collection(dbAs('bob'), 'users/alice/hours')));
    await assertFails(getDoc(doc(dbAs('bob'), 'users/alice/hours/e1')));
  });

  it('an organisation admin can read entries naming their organisation, and no others', async () => {
    await assertSucceeds(getDoc(doc(dbAs('mei'), 'users/alice/hours/e1')));
    await assertSucceeds(getDocs(query(collection(dbAs('mei'), 'users/alice/hours'), where('orgId', '==', 'open'))));
    await assertFails(getDoc(doc(dbAs('mei'), 'users/alice/hours/e2')));
    await assertFails(getDocs(collection(dbAs('mei'), 'users/alice/hours')));
  });

  it('a ledger entry needs confirmed attendance behind it', async () => {
    await assertFails(setDoc(doc(dbAs('alice'), 'users/alice/hours/e3'), { orgId: 'open', hours: 5 }));
  });
});

describe('registrations: joining and cancelling', () => {
  const later = new Date(Date.now() + 7 * 86400e3), earlier = new Date(Date.now() - 86400e3);
  const settings = (over = {}) => ({ open: true, approval: false, capacity: 10, waitlist: true, group: false, ...over });
  const counts = (over = {}) => ({ going: 0, pending: 0, waitlist: 0, attended: 0, ...over });
  const ev = (over = {}) => ({ orgId: 'open', visibility: 'public', status: 'scheduled', endAt: later, registration: settings(), counts: counts(), ...over });
  const regDoc = (uid, status) => ({
    uid, name: 'Alice A.', status, ticketTypeId: null, answers: {},
    registeredAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });

  beforeEach(async () => {
    await orgFixtures();
    await seedDocs({
      'events/e-open': ev(),
      'events/e-appr': ev({ registration: settings({ approval: true }) }),
      'events/e-full': ev({ registration: settings({ capacity: 1 }), counts: counts({ going: 1 }) }),
      'events/e-nowait': ev({ registration: settings({ capacity: 1, waitlist: false }), counts: counts({ going: 1 }) }),
      'events/e-cancelled': ev({ status: 'cancelled' }),
      'events/e-draft': ev({ visibility: 'draft' }),
      'events/e-closed': ev({ registration: settings({ open: false }) }),
      'events/e-past': ev({ endAt: earlier }),
      'events/e-open/private/location': { venue: 'Block 1' },
      'events/e-open/private/codes': { checkIn: 'in', checkOut: 'out' },
    });
  });

  // Joins the way the app does: the registration, the counts and the who's-going entry in one write.
  function join(uid, eventId, { status, counts: next, going = status === 'going', who = uid, moveCounts = true }) {
    const db = dbAs(uid);
    const batch = writeBatch(db);
    if (moveCounts) batch.update(doc(db, 'events', eventId), { counts: next, countsBy: who });
    batch.set(doc(db, `events/${eventId}/registrations/${who}`), regDoc(who, status));
    if (going) batch.set(doc(db, `events/${eventId}/going/${who}`), { name: 'Alice A.', since: serverTimestamp() });
    return batch.commit();
  }

  // Changes an existing registration's status, moving the counts and the who's-going entry with it.
  function change(uid, eventId, { status, counts: next, who = uid, goingEntry }) {
    const db = dbAs(uid);
    const batch = writeBatch(db);
    batch.update(doc(db, 'events', eventId), { counts: next, countsBy: who });
    batch.update(doc(db, `events/${eventId}/registrations/${who}`), { status, updatedAt: serverTimestamp(), ...(status === 'cancelled' ? {} : { registeredAt: serverTimestamp() }) });
    if (goingEntry === 'add') batch.set(doc(db, `events/${eventId}/going/${who}`), { name: 'Alice A.', since: serverTimestamp() });
    if (goingEntry === 'remove') batch.delete(doc(db, `events/${eventId}/going/${who}`));
    return batch.commit();
  }

  it('joins as going when approval is off and spots remain', async () => {
    await assertSucceeds(join('alice', 'e-open', { status: 'going', counts: counts({ going: 1 }) }));
  });

  it('cannot skip approval: going is refused, a request (pending) works', async () => {
    await assertFails(join('alice', 'e-appr', { status: 'going', counts: counts({ going: 1 }) }));
    await assertSucceeds(join('alice', 'e-appr', { status: 'pending', counts: counts({ pending: 1 }) }));
  });

  it('a full event only takes people on its waiting list', async () => {
    await assertFails(join('alice', 'e-full', { status: 'going', counts: counts({ going: 2 }) }));
    await assertSucceeds(join('alice', 'e-full', { status: 'waitlist', counts: counts({ going: 1, waitlist: 1 }) }));
  });

  it('a full event without a waiting list takes nobody', async () => {
    await assertFails(join('alice', 'e-nowait', { status: 'waitlist', counts: counts({ going: 1, waitlist: 1 }) }));
  });

  it('cannot register for a cancelled event, a draft, a closed registration or an event that has ended', async () => {
    for (const id of ['e-cancelled', 'e-draft', 'e-closed', 'e-past']) {
      await assertFails(join('alice', id, { status: 'going', counts: counts({ going: 1 }) }));
    }
  });

  it('the counts must move with the registration, by exactly one', async () => {
    await assertFails(join('alice', 'e-open', { status: 'going', counts: counts({ going: 1 }), moveCounts: false }));
    await assertFails(join('alice', 'e-open', { status: 'going', counts: counts({ going: 2 }) }));
    await assertFails(updateDoc(doc(dbAs('alice'), 'events/e-open'), { counts: counts({ going: 1 }), countsBy: 'alice' }));
  });

  it('cannot register someone else', async () => {
    await assertFails(join('alice', 'e-open', { status: 'going', counts: counts({ going: 1 }), who: 'bob' }));
  });

  it('can cancel their own registration, and the spot comes back', async () => {
    await seedDocs({
      'events/e-open': ev({ counts: counts({ going: 1 }) }),
      'events/e-open/registrations/alice': regDoc('alice', 'going'),
      'events/e-open/going/alice': { name: 'Alice A.' },
    });
    await assertSucceeds(change('alice', 'e-open', { status: 'cancelled', counts: counts(), goingEntry: 'remove' }));
  });

  it('cannot cancel someone else\'s registration', async () => {
    await seedDocs({
      'events/e-open': ev({ counts: counts({ going: 1 }) }),
      'events/e-open/registrations/bob': regDoc('bob', 'going'),
      'events/e-open/going/bob': { name: 'Bob B.' },
    });
    await assertFails(change('alice', 'e-open', { status: 'cancelled', counts: counts(), who: 'bob', goingEntry: 'remove' }));
  });

  it('cannot approve their own request', async () => {
    await seedDocs({
      'events/e-appr': ev({ registration: settings({ approval: true }), counts: counts({ pending: 1 }) }),
      'events/e-appr/registrations/alice': regDoc('alice', 'pending'),
    });
    await assertFails(change('alice', 'e-appr', { status: 'going', counts: counts({ going: 1 }), goingEntry: 'add' }));
  });

  it('can join again after cancelling', async () => {
    await seedDocs({ 'events/e-open/registrations/alice': regDoc('alice', 'cancelled') });
    await assertSucceeds(change('alice', 'e-open', { status: 'going', counts: counts({ going: 1 }), goingEntry: 'add' }));
  });

  it('who\'s going is readable with the event, and needs a going registration behind it', async () => {
    await seedDocs({ 'events/e-open/going/bob': { name: 'Bob B.' } });
    await assertSucceeds(getDocs(collection(dbAs('alice'), 'events/e-open/going')));
    await assertFails(getDocs(collection(dbAs('bob'), 'events/e-draft/going')));
    await assertFails(setDoc(doc(dbAs('alice'), 'events/e-open/going/alice'), { name: 'Alice A.', since: serverTimestamp() }));
  });

  it('the exact venue is for approved volunteers and members; the codes only for members', async () => {
    await seedDocs({
      'events/e-open/registrations/alice': regDoc('alice', 'going'),
      'events/e-open/registrations/bob': regDoc('bob', 'pending'),
    });
    await assertSucceeds(getDoc(doc(dbAs('alice'), 'events/e-open/private/location')));
    await assertFails(getDoc(doc(dbAs('bob'), 'events/e-open/private/location')));
    await assertFails(getDoc(doc(dbAs('carol'), 'events/e-open/private/location')));
    await assertFails(getDoc(doc(dbAs('alice'), 'events/e-open/private/codes')));
    await assertSucceeds(getDoc(doc(dbAs('mei'), 'events/e-open/private/codes')));
  });
});
