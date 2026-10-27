// Rules tests for users/{uid}. `npm test` starts the Firestore emulator and runs this file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, setLogLevel,
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

const dbAs = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
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

  it('nobody can write an event yet', async () => {
    await assertFails(setDoc(doc(dbAs('mei'), 'events/new'), { orgId: 'open', visibility: 'public', status: 'scheduled' }));
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

  it('nobody can write the hours ledger yet', async () => {
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
    if (moveCounts) batch.update(doc(db, 'events', eventId), { counts: next });
    batch.set(doc(db, `events/${eventId}/registrations/${who}`), regDoc(who, status));
    if (going) batch.set(doc(db, `events/${eventId}/going/${who}`), { name: 'Alice A.', since: serverTimestamp() });
    return batch.commit();
  }

  // Changes an existing registration's status, moving the counts and the who's-going entry with it.
  function change(uid, eventId, { status, counts: next, who = uid, goingEntry }) {
    const db = dbAs(uid);
    const batch = writeBatch(db);
    batch.update(doc(db, 'events', eventId), { counts: next });
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
    await assertFails(updateDoc(doc(dbAs('alice'), 'events/e-open'), { counts: counts({ going: 1 }) }));
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
