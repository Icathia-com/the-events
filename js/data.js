// All Firestore reads and writes.
import {
  arrayRemove, arrayUnion, collection, collectionGroup, db, doc, getDoc, getDocs, orderBy, query, serverTimestamp,
  setDoc, Timestamp, updateDoc, where,
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

// Organisations

export const getOrganisation = async (orgId) => withId(await getDoc(doc(db, 'organisations', orgId)));

export async function listOrganisations() {
  const snaps = await getDocs(query(collection(db, 'organisations'), where('status', '==', 'approved')));
  return allWithIds(snaps).sort((a, b) => a.name.localeCompare(b.name));
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

// Every event of an organisation the user is a member of, drafts included.
export async function listOrgEvents(orgId) {
  const snaps = await getDocs(query(collection(db, 'events'), where('orgId', '==', orgId), orderBy('startAt')));
  return allWithIds(snaps);
}
