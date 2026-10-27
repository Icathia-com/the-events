// Sign-in, sign-out and the current user.
import {
  auth, GoogleAuthProvider, isSignInWithEmailLink, onAuthStateChanged, sendSignInLinkToEmail,
  signInWithEmailLink, signInWithPopup, signOut as firebaseSignOut,
} from './firebase.js';

const EMAIL_KEY = 'theEvents.emailForSignIn';

// Resolves once Firebase knows whether someone is signed in.
export function currentUser() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => { stop(); resolve(user); });
  });
}

// For pages that need a signed-in user: sends everyone else to sign-in.
export async function requireUser() {
  const user = await currentUser();
  if (!user) {
    location.replace('signin.html');
    return new Promise(() => {});
  }
  return user;
}

export async function sendEmailLink(email) {
  const url = new URL('signin.html', location.href).href;
  await sendSignInLinkToEmail(auth, email, { url, handleCodeInApp: true });
  localStorage.setItem(EMAIL_KEY, email);
}

export const isEmailLink = (href) => isSignInWithEmailLink(auth, href);

export const storedEmail = () => localStorage.getItem(EMAIL_KEY);

export async function completeEmailLink(email, href) {
  const { user } = await signInWithEmailLink(auth, email, href);
  localStorage.removeItem(EMAIL_KEY);
  return user;
}

export async function signInWithGoogle() {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  return user;
}

export const signOut = () => firebaseSignOut(auth);
