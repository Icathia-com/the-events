// Home placeholder for this slice: the signed-in name and Sign out.
import { requireUser, signOut } from '../auth.js';
import { ensureUserDoc } from '../data.js';

const user = await requireUser();
const profile = await ensureUserDoc(user);

const name = profile.name || user.displayName;
document.getElementById('user-name').textContent = name || user.email;
document.getElementById('user-email').textContent = name ? user.email : '';
document.body.classList.remove('is-loading');

document.getElementById('sign-out').addEventListener('click', async () => {
  await signOut();
  location.replace('signin.html');
});
