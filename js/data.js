// All Firestore reads and writes.
import { db, doc, getDoc, serverTimestamp, setDoc } from './firebase.js';

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
