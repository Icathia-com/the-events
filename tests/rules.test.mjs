// Rules tests for users/{uid}. `npm test` starts the Firestore emulator and runs this file.
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, setLogLevel, updateDoc } from 'firebase/firestore';

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
    await assertFails(getDoc(userRef(testEnv.unauthenticatedContext().firestore(), 'bob')));
  });
});
