import { completeEmailLink, currentUser, isEmailLink, sendEmailLink, signInWithGoogle, storedEmail } from '../auth.js';
import { ensureUserDoc } from '../data.js';

const form = document.getElementById('email-form');
const emailInput = document.getElementById('email');
const submit = document.getElementById('email-submit');
const google = document.getElementById('google');
const choices = document.getElementById('signin-choices');
const sent = document.getElementById('sent');
const sentTo = document.getElementById('sent-to');
const status = document.getElementById('status');

const MESSAGES = {
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/missing-email': 'That email address doesn’t look right.',
  'auth/invalid-action-code': 'This sign-in link has expired or has already been used.',
  'auth/expired-action-code': 'This sign-in link has expired or has already been used.',
  'auth/network-request-failed': 'Couldn’t reach the sign-in service.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes.',
};

function showError(err) {
  if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
  console.warn(err);
  status.textContent = MESSAGES[err?.code] || 'Sign-in didn’t work.';
  status.hidden = false;
}

function setBusy(busy) {
  submit.disabled = busy;
  google.disabled = busy;
}

async function finish(user) {
  await ensureUserDoc(user);
  location.replace('index.html');
}

// Opened from the emailed link on a different device: ask for the email again, then sign in.
let linkNeedsEmail = false;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.hidden = true;
  const email = emailInput.value.trim();
  setBusy(true);
  try {
    if (linkNeedsEmail) {
      await finish(await completeEmailLink(email, location.href));
      return;
    }
    await sendEmailLink(email);
    sentTo.textContent = email;
    choices.hidden = true;
    sent.hidden = false;
  } catch (err) {
    showError(err);
  } finally {
    setBusy(false);
  }
});

google.addEventListener('click', async () => {
  status.hidden = true;
  setBusy(true);
  try {
    await finish(await signInWithGoogle());
  } catch (err) {
    showError(err);
    setBusy(false);
  }
});

async function start() {
  try {
    if (isEmailLink(location.href)) {
      const email = storedEmail();
      if (email) {
        await finish(await completeEmailLink(email, location.href));
        return;
      }
      linkNeedsEmail = true;
      submit.textContent = 'Sign in';
      google.hidden = true;
      document.getElementById('or').hidden = true;
    } else {
      const user = await currentUser();
      if (user) {
        await finish(user);
        return;
      }
    }
  } catch (err) {
    showError(err);
  }
  document.body.classList.remove('is-loading');
}

start();
