// Firebase init. The SDK version is pinned here and only here: other modules import SDK functions from this file.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { connectAuthEmulator, getAuth } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { connectFirestoreEmulator, getFirestore } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

export {
  GoogleAuthProvider, isSignInWithEmailLink, onAuthStateChanged, sendSignInLinkToEmail,
  signInWithEmailLink, signInWithPopup, signOut,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
export {
  arrayRemove, arrayUnion, collection, collectionGroup, doc, getDoc, getDocs, orderBy, query, serverTimestamp,
  setDoc, Timestamp, updateDoc, where,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: "AIzaSyCK4VXqnTpDkUGHS9ENrIyy3miaZU23GVo",
  authDomain: "the-events-58a8e.firebaseapp.com",
  projectId: "the-events-58a8e",
  storageBucket: "the-events-58a8e.firebasestorage.app",
  messagingSenderId: "524072327601",
  appId: "1:524072327601:web:78212447047de2fbeb8590"
};

// On localhost everything runs on the emulators under a demo- project, so nothing reaches the live project.
export const onLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);

const app = initializeApp(onLocalhost ? { ...firebaseConfig, projectId: 'demo-the-events' } : firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

if (onLocalhost) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
