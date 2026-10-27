// Notifications (design/Notifications.dc.html): the empty state only. Notifications, their filters and settings
// come in Phase 3.
import { requireUser } from '../auth.js';
import { ensureUserDoc } from '../data.js';
import { avatarHtml, dragScroll, icon, renderBottomBar, reveal } from '../ui.js';

const user = await requireUser();
const profile = await ensureUserDoc(user);

document.getElementById('bell').innerHTML = icon('notifications', 28, 2);
document.getElementById('avatar').outerHTML = avatarHtml({ uid: user.uid, name: profile.name, email: user.email, photoUrl: profile.photoUrl });
renderBottomBar('notifications');
dragScroll(document.scrollingElement, 'y');
reveal();
