// Rules tests for users/{uid}. `npm test` starts the Firestore emulator and runs this file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, setLogLevel,
  updateDoc, where,
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

  it('nobody can write an organisation yet', async () => {
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
