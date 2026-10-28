# Progress

Running log for The Events. Newest session at the bottom. Each entry covers what was done, what was tested and what's next.

Work order: `docs/QUEUE.md` (moved there from `QUEUE_1.md` at the repo root on 28 Oct), one slice at a time. Visual reference: `design/`, the approved canvas screens.

## Decisions to confirm

Choices made without Theersha's input, each tagged with the slice that made it.

- Slice 1: Commits in this repo use Theersha <theersha@gmail.com>, the email on the GitHub repo's first commits. The answer to the identity question was the repo link, so this was inferred.
- Slice 1: `.firebaserc` defaults to `demo-the-events`, and the live project appears only as the alias `live`. A stray `firebase` command therefore hits the emulator-only demo project.
- Slice 1: People who sign in by email link have no name until they set one on Profile (slice 5). Until then the app shows their email address.
- Slice 1: `hoursTotal` isn't written at first sign-in. A missing value counts as 0, and the hours slices add it.
- Slice 2 (security): The check-out code and the exact venue of hidden-location events don't live in the event document, as section 6 has it. They're in `events/{id}/private/codes` and `events/{id}/private/location` instead. Firestore can't hide one field of a document someone may read, so any volunteer could otherwise read the check-out code and confirm their own hours.
- Slice 2: The Organisations canvas shows a seventh organisation, Bright Steps. The brief lists six, so it isn't seeded.
- Slice 2: Seeded spot counts come from real seeded registrations among the ten sample volunteers. Some differ from the canvas: the beach clean-up shows 6 going, not 35.
- Slice 2: Organisation stats (events, volunteers, hours) are seeded with the canvas numbers. Section 6 calls them display only.
- Slice 2: `npm run seed` clears the emulator's Firestore data before loading, so every run starts from the same sample state. Emulator sign-in accounts are kept.
- Slice 2: Sample sign-in emails use example.com, a domain reserved for examples: `mei.lin.tan@example.com`, `aisha.rahman@example.com` and so on.
- Slice 2: Mei Lin's past hours (14 hours over five entries, from the canvas hours record) carry references VN-2026-00482 to 00486. The canvas shows one reference for the whole record; the brief gives each entry its own, and the brief wins.
- Slice 2: Organisations get two fields the canvas needs but section 6 lacks: `approvedAt` ("member since") and `impact` (Past impact). Members and registrations also store `uid`, so people can find their own with a query. All of this is noted in `docs/DATA-MODEL.md`.
- Slice 2: Seeded dates move by whole days. An event whose title names a weekday ("Saturday reading club") moves on to that weekday.
- Slice 3: Instruction-like sentences on the canvas are left out, because the brief says no how-to hint text. On Home that's "Pick a shift from the list below." and the QR dialog's "The organisation scans this at the event…". Everything else on the screen follows the canvas.
- Slice 3: QR codes come from the app's own generator (`js/qr.js`, tested against jsQR). The approved jsQR library only reads codes. A personal code holds `TE1:<uid>`; a code for one of today's events holds `TE1:<uid>:<eventId>`.
- Slice 3: Small controls keep their canvas size but get a 44 px touch area, as the brief requires.
- Slice 3: The greeting uses a first name: everything but the last word for three-word names ("Mei Lin"), otherwise the first word.
- Slice 3: The impact line is hidden for someone with no hours this year; the canvas only shows the case with hours. Waiting-list registrations don't appear in "Your events"; the canvas shows only going and pending.
- Slice 3: Home's "Claim 3 hours" card comes with claims in slice 9. The sign-out button from slice 1 moves to Profile (slice 5), where the canvas has it.
- Slice 3 (production): Beyond section 6, Firestore will need an index on events by orgId, status, visibility and startAt (followers-only events on Home). It will also need a collection group index on `members.uid` ("which organisations am I in"). Both are in `firestore.indexes.json`. The emulator doesn't check indexes, and nothing has been deployed.
- Slice 4: "Who's going" reads a public list of first names, `events/{id}/going/{uid}`, because registrations stay private to the volunteer and the organisation. The rules allow an entry only alongside a going registration.
- Slice 4: The canvas location box is a drawn placeholder map. The live map is Phase 3, so for now the location card shows only the address lines.
- Slice 4: The canvas More menu also has "Share event poster" and "Report event". Neither is in the Phase 1 queue, so they're left out.
- Slice 4: States the canvas doesn't draw use short labels on the main button: "On the waiting list", "Not approved", "Full", "Cancelled", "Ended", "Registration closed".
- Slice 4: When an event is full, a volunteer can join its waiting list themselves (the canvas's "Join waiting list"); section 7 only lists going and pending for volunteers. Moving people up from the waiting list is an admin action (slice 7), since doing it automatically needs a Cloud Function.
- Slice 4: Someone who cancelled can register again. Someone the organisation declined can't request the same event again.
- Slice 4: Organisation staff get the volunteer view plus the "Check in volunteers" bar; the admin view is for admins. The top-right share button opens the More menu, as on the canvas.
- Slice 5: "Popular this week" is the next seven days' events with the most registrations (going plus pending). Volunteers can't see when other people registered, so a strict "registered this week" count isn't possible.
- Slice 5: Browse by location filters the list, and the Map buttons stay hidden until Phase 3.
- Slice 5: Shown later, not now:
  - "Run a non-profit? Apply to join" (Phase 2).
  - Letter requests on the organisation page (Phase 3).
  - Profile's notification settings and its gear button (Phase 3).
  - The hours card's "Record, PDF and signed letters" line, since PDFs and letters are Phase 3.
- Slice 5: More instruction-like text left out: "Follow to hear about the next one." (organisation page), "Email and mobile number are changed under Settings." and the "for example…" bio placeholder (Profile).
- Slice 5: "Events hosted" counts events the person created for an organisation they admin.
- Slice 5: Hours entries keep the event's cover (`cover` on `users/{uid}/hours`), like they keep its title. Past events show the real cover even if the event is gone.
- Slice 5: Discover marks sample data as "Singapore · Sample events". The canvas Discover has no sample label, but the brief asks for one.
- Slice 6: Photo covers need Cloud Storage (Phase 2), so the cover is one of the canvas's six colour gradients, with a label made from the title. The canvas's photo button is hidden until then.
- Slice 6: "Paid on site" is stored as a single "Standard" ticket type with `amountOnSite`; free events have no ticket types. Proper ticket types are Phase 2.
- Slice 6: "Notify followers" is saved on the event (`notifyFollowers`), but nothing is sent until Phase 3. So the done screen leaves out the canvas's "Your followers are notified."
- Slice 6: Someone who admins more than one organisation creates events for the first; a chooser can come later. An event with no area chosen counts as Islandwide, as on the canvas. An event can last up to 24 hours.
- Slice 6: Form placeholders drop the canvas's "for example…" wording ("Meeting point", "Description", "What to bring"). Restore draft keeps the draft only on this device, as the brief says.
- Slice 7 (rules): Every change to an event's counts names the person whose registration or attendance it follows (`countsBy` on the event). The rules check that the counts moved by exactly that person's change. That's what lets admins approve and mark attendance while the counts stay honest.
- Slice 7: Confirmed hours follow section 7's Phase 1 path:
  - The organisation confirms attendance.
  - The volunteer's own app then adds the hours entry the next time it opens (Home or Profile). Each entry gets a reference number `VN-<year>-<5 digits>`, registered once in `references/{ref}` so no number is ever reused, and `hoursTotal` moves by the same hours (`hoursBy` names the entry).
  - If the organisation undoes a confirmation, the entry and its hours go on the volunteer's next visit; that reference number stays retired.
- Slice 7: Attendance records `confirmedAt` and `confirmedBy` (the admin's uid, or `code` from slice 8), and the hours entry copies both.
- Slice 7: Attendance can be marked at any time, even before the event; the canvas sets no limit. A guard such as "only once the event has started" could be added later.
- Slice 7: Approving is refused when every spot is taken; raising the spots in Edit event makes room. People on the waiting list are listed under "Waiting for approval", where Approve moves them up.
- Slice 7: "N past events" on the volunteers list counts confirmed events with your organisation only, since an admin can't see a volunteer's hours elsewhere.
- Slice 7: Instruction-like lines left out: the second line of each empty state ("Share the event link…"), and the summary's "Hours are added to each volunteer's profile when you mark them attended".
- Slice 7: Cancelling says "Registered volunteers will see it as cancelled. This cannot be undone." The canvas says "Everyone who registered gets a cancellation notice right away", but notices are Phase 3; the button is "Cancel event". "Clone event" and "Transfer to another organisation" are marked Soon.
- Slice 7 (production): Two more collection group indexes: attendance by uid and status, and hours entries by orgId. Both are in `firestore.indexes.json`.
- Slice 8: jsQR's licence is Apache-2.0, not MIT as the brief says. It's still free to use. It loads from jsDelivr, pinned to 1.4.0 with an integrity hash, and only on phones without the built-in barcode reader.
- Slice 8: Check-in records arrival only; hours are confirmed at check-out. So the canvas's "Checked in · 2 hours added" reads "Checked in", and Express reads "Checks the volunteer in the moment their code is scanned".
- Slice 8: Check-in staff belong to the organisation and can scan at any of its events, since members are organisation-wide in section 6. The canvas's "for this event only" is left out.
- Slice 8: Staff are added by email (`organisations/{id}/staffInvites/{email}`) and become staff when that person signs in. The canvas also offers a mobile number, but there's no phone sign-in, so it's email only.
- Slice 8: The check-out QR holds a link to the event page with the code. A volunteer can scan it from Home's "Check out" button or with any phone camera.
- Slice 8: Check-out with the code has no time limit and doesn't need a check-in first, since neither the brief nor the canvas sets one. A volunteer who is going and has the code can confirm their own hours, so a photo of the code passed on would work too; rotating codes (Phase 3) close that gap. The code stays the same for the whole event in Phase 1, as section 6 says, so the canvas's "New code every minute" is left out. The attendance record keeps the code that was scanned (`code`), which the rules check.
- Slice 8: Left out: letter requests on Check-out and hours (Phase 3), and the canvas's "Sample scan" button.
- Slice 8 (production): A collection group index on `staffInvites.email`, so people can find their invites when they sign in. It's in `firestore.indexes.json`.
- Slice 9: A claim is always for the event's hours, as in the canvas's "Claim 3 hours without a code"; the rules check this.
- Slice 9: Auto-confirm, Phase 1:
  - A claim made after a check-in confirms itself 7 days later. The volunteer's app does it the next time it opens Home, Profile, the hours record or the claim page.
  - The rules count the 7 days by the server's clock.
  - These confirmations are stored as `confirmedBy: "auto"` (section 6 only lists "code" or an admin's uid), and the record says "confirmed automatically after 7 days".
- Slice 9: Home shows a claim card for each event of the last 30 days that ended without hours confirmed or claimed, newest first. Older events can still be claimed at `claim.html?id=`.
  - The canvas only draws the checked-in card. Without a check-in, the second line reads "No check-in recorded · Thu 15 Oct".
- Slice 9: On the claim page:
  - "You will get a notification either way." is left out, since notifications are Phase 3. So is the canvas's "Sample scan" button.
  - States the canvas doesn't draw use short lines: "Claim declined", "Claims are for volunteers who were going to this event." and "Hours can be claimed once the event has ended."
- Slice 9: Hours record:
  - Each line shows its own reference number, as the brief has it.
  - The record's Reference is the newest entry's. The canvas's VN-2026-00482 is Mei Lin's newest entry, and this way each version of the record has its own reference.
  - The verification code opens `verify.html?ref=` with that reference. That page is Phase 3, so the link doesn't work yet.
  - Period runs from the earliest entry's month to the latest's: "Aug to Oct 2026" for Mei Lin, where the canvas says "Jan to Oct 2026".
  - "Confirmed by" names the person only on their own record ("confirmed by Mei Lin Tan", as on the canvas). Otherwise it says "confirmed by the organiser", because volunteers can't read organisers' profiles.
  - The heading reads "The Events" where the canvas says "Volunteer Network". Share and Download PDF are hidden until Phase 3, along with the letter request card.
- Slice 9 (seed): The brief lists eight sample events. Two past events from the canvas are added so claims can be tried:
  - The Changi beach clean-up, 17 days before seeding. Mei Lin checked in but wasn't checked out. Farid's claim is past its auto-confirm date. Darren was going and has no check-in.
  - The Yishun visit from Mei Lin's hours record. Aisha checked in but wasn't checked out. Esther was going and has no check-in. Mei Lin's own hours are confirmed.
- Slice 9 (rules): When a volunteer writes their own attendance (a check-out with the code, or a claim), it must carry the name on their registration. That stops a made-up name appearing in the organiser's lists.
- Slice 10: Section 10's "check in by scanning the organiser's code" is built as the organiser scanning the volunteer's code. That's how the canvas Check-in screen and the queue have it, and section 7 lets only the organisation record a check-in. The event's own check-in code (`private/codes.checkIn`) is created with each event but not used in Phase 1.
- Slice 10: Organisers have no list of past events in Phase 1. A past event's claims are on its check-out page, reached by its link (`checkout.html?id=…`). On the canvas a notification leads there, and notifications are Phase 3. A past-events list for admins could come sooner.
- Slice 10: The app icon is an original mark: a Forest calendar card with a cream tick, on Clay. There's a rounded version, a full-bleed version for Android's masks and iOS, and an SVG for the browser tab.
- Slice 10: The manifest uses Clay `#9A4F33` (the top of the page gradient) for both the theme and the splash background, with standalone display.
- Slice 10: The service worker fetches the app's own files from the network first, and serves them from its cache only when offline. Firebase traffic never passes through it.
- Slice 10, for speed:
  - Firestore Lite replaces the full Firestore SDK: 43 KB instead of 184 KB, with the same reads, writes, batches and transactions. Phase 1 has no live listeners or offline data, which are the parts it leaves out.
  - Sign-in starts without Google's pop-up helpers. They load only when someone chooses Google.
  - Manrope is served from `assets/fonts` (the same Google Fonts files, with the OFL licence) instead of the Google Fonts service. Pages no longer wait on two more servers, and opening a page sends no request to Google Fonts.
- Slice 10: Pages wait for the web font, up to a second, before showing, so text doesn't jump when it arrives. Page headers that need no data show straight away.
- Slice 10: Home now loads in two rounds of reads instead of seven. Staff invitations and the hours sync run once Home is showing, so newly confirmed hours update the impact line a moment later.
- Slice 10: Notifications shows only "Nothing here yet". The canvas's second line ("Reminders, new events from organisations you follow and changes to your registrations appear here.") is left out, because nothing arrives there until Phase 3.
- Slice 10: Lighthouse was measured on this computer against the emulators, with a local server that compresses files as GitHub Pages does (`npm run serve` doesn't compress). It should be checked again on the live site after deploy.

## 28 Oct 2026: toolchain check (no app code yet)

**Done**
- The session opened in `C:\Users\theer`, which has no brief. The brief is in `C:\Users\theer\OneDrive\Documents\The Event App`, and an identical copy is in Downloads. Theersha chose this folder for the project.
- Toolchain check:
  - git 2.56.0, in `C:\Program Files\Git`.
  - Java: Temurin 21.0.12.1, in `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`. Its `bin` folder is already on the machine PATH and `JAVA_HOME` is set machine-wide, so no PATH change is needed.
  - Node.js and npm: not usable. Windows lists Node 24.21.0 as installed at `D:\` (10 Oct 2026), but this PC has no D: drive now. The machine PATH still has the dead entries `D:\` and `D:\Git\cmd`.
  - Firebase CLI: not installed.
  - VS Code was started before Git and Java were added to the PATH, so this session and VS Code's terminals can't see them. Quitting and reopening VS Code fixes that.

**Tested**
- git and java both run when called by their full path. Nothing else could be tested.

**Next**
1. Theersha: uninstall the old Node.js entry, install Node LTS into `C:\Program Files\nodejs`, then quit VS Code and reopen it on this folder.
2. Once Theersha says yes, run `npm install -g firebase-tools`. `firebase login` isn't needed for this slice, because emulator runs and tests use a `demo-` project ID.
3. First slice of Phase 1, as Theersha set it out on 28 Oct:
   - The repo layout from section 4, with empty files for pages outside this slice.
   - `css/tokens.css` from section 5, plus a minimal `css/app.css` with the gradient background, glass card, buttons and four-tab bottom bar.
   - `js/firebase.js` with the section 3 config and one pinned gstatic SDK version. It connects to the Auth and Firestore emulators on localhost.
   - `signin.html` with email link and Google. On first sign-in it creates `users/{uid}` (section 6) and then goes to `index.html`. For now `index.html` shows the signed-in name and a sign-out button.
   - `firebase.json` and `.firebaserc` (project `the-events-58a8e`), set up for the Auth and Firestore emulators.
   - `firestore.rules` for `users/{uid}` only (section 7). `tests/rules.test.mjs` proves a user can read and write their own allowed fields, can't set `networkAdmin` or `hoursTotal`, and can't read anyone else's user document.
   - Testing: run the rules tests on the emulator, then sign in through the Auth emulator at 390 px using the email link. Report and stop.

## 28 Oct 2026: Phase 1, slice 1: Foundation and sign-in

**Toolchain** (fresh session; the D: drive is back, and Theersha is keeping Node and Git there)
- git 2.56.0. `where git` lists only `D:\Git\cmd\git.exe`; the unused copy in `C:\Program Files\Git` isn't on PATH.
- Node v24.22.1 (`D:\node.exe`), npm 11.19.1. PowerShell runs npm directly, so the `.cmd` fallback isn't needed.
- Java: Temurin 21.0.12.1, with `JAVA_HOME` set.
- Firebase CLI 15.34.1, installed globally with Theersha's approval. No `firebase login`.

**Git**
- Connected this folder to `https://github.com/Icathia-com/the-events`. Local `main` starts from GitHub's two commits (the brief and README) and tracks `origin/main`. Never pushed.
- Commit identity for this repo only: Theersha <theersha@gmail.com>.

**Done**
- Repo layout from section 4. Pages outside this slice, `js/ui.js` and `assets/` are empty for now. `docs/BACKEND-BRIEF.md` is a copy of the root brief, and `docs/DATA-MODEL.md` is section 6 copied verbatim.
- `css/tokens.css` from section 5, plus the bottom bar and lens values taken from the canvas Home screen. `css/app.css` has the gradient background, glass card, fields, buttons, the four-tab bar and reduced motion.
- `js/firebase.js` pins Firebase JS SDK 13.0.0 from gstatic and re-exports the SDK functions the app uses, so the version lives in one place. On localhost it switches to project `demo-the-events` and connects to the Auth (9099) and Firestore (8080) emulators.
- `js/auth.js` (email link, Google popup, sign-out, `requireUser`) and `js/data.js` (`ensureUserDoc`).
- `signin.html` covers email link and Google; the email is kept in `localStorage` between sending and completing. A link opened on another device asks for the email again. The canvas has no sign-in screen, so the labels follow section 8 and stay bare.
- `index.html` is a placeholder: the signed-in name (or email), Sign out, and the bar. Signed-out visitors go to sign-in.
- On first sign-in, `users/{uid}` gets `name, email, photoUrl, bio, follows, joinedAt, createdAt, updatedAt`. `hoursTotal` is left out (absent means 0). The confirm path in the hours slice will add it, and the rules will need to allow that then.
- `firestore.rules` covers `users/{uid}` only; everything else is denied. `firebase.json` configures the Auth, Firestore and UI emulators. `.firebaserc` has `demo-the-events` as the default, and the live project only as the alias `live`.
- `package.json` scripts: `npm run emulators`, `npm run serve` (http-server on 127.0.0.1:8000) and `npm test`. Dev dependencies, pinned: firebase 13.0.0, @firebase/rules-unit-testing 6.0.0, http-server 14.1.1.
- Favicon is `data:,` until the PWA icons exist, to stop a 404 in the console.

**Tested**
- `npm test`: 14 of 14 rules tests pass. They cover create, read and update of own allowed fields, and rejection of `networkAdmin`, `hoursTotal`, email changes, someone else's email, more than 200 follows, deleting, another user's profile, and signed-out reads.
- Browser, headless Edge at 390 × 844 against the emulators:
  - Signed out, `index.html` goes to sign-in.
  - Sending the email link shows the sent state.
  - The link, taken from the Emulator UI Logs tab, lands on Home, and `users/{uid}` is created with the fields above.
  - Sign out returns to sign-in.
  - Google through the emulator's account picker lands on Home.
  - No horizontal overflow, no console errors.

**Notes**
- No OneDrive file-lock errors during installs or emulator runs.
- `npm audit` reports 5 high-severity issues in dev-only packages, which run only locally. `npm audit fix --force` was not run.
- npm skipped the install scripts for `@firebase/util`, `protobufjs` and `re2` (its allow-scripts check). Everything works without them.

- Mid-session Theersha sent the design screens and `QUEUE_1.md`. They are saved as `design/` (copied from `Downloads\design-reference\design`) and `QUEUE_1.md`, and from here on the queue sets the order.

**Next**
- Slice 2 from `QUEUE_1.md`: data layer and sample data.

## 28 Oct 2026: Phase 1, slice 2: Data layer and sample data

**Done**
- `js/data.js`:
  - The fixed area and cause lists.
  - Profile reads and edits (name, bio, photo), follow and unfollow.
  - Organisation reads, including "which organisations am I a member of".
  - Event reads: one event, upcoming public events, and all of one organisation's events for its members.
  - Reads and writes for registrations, attendance and the hours ledger come with the slices that add their rules (4, 7, 8 and 9), so each lands tested.
- `scripts/seed.mjs` (`npm run seed`):
  - Six organisations and the eight canvas events. The evening pantry restock is today at 5 pm Singapore time, and the rest start tomorrow.
  - The ten sample volunteers plus Mei Lin Tan, admin of Silver Companions. Each has an emulator sign-in account.
  - 35 registrations. The Yishun visit has 7 going and 2 waiting for approval, as on the canvas Volunteers screen. Mei Lin is going to the pantry restock and the beach clean-up, and waiting for approval at the reading club.
  - Each event's private check-in and check-out codes. Mei Lin's five past hours entries.
  - Every document has `sample: true`. The script refuses to run against anything but the local emulators under a `demo-` project.
- Rules: approved organisations are readable by anyone signed in. Members and the network admin also see pending ones, and members can see their own membership. Events:
  - Public events are readable by anyone signed in.
  - Followers-only events are readable by followers.
  - Drafts are readable only by organisation members and the network admin.
  - Nobody can write organisations or events yet.
- `firestore.indexes.json`: the three indexes from section 6.

**Tested**
- `npm test`: 32 of 32 pass. The new cases:
  - Signed-out visitors are refused.
  - Pending organisations are hidden from non-members.
  - Unfiltered lists of organisations or events are refused.
  - Non-followers can't read followers-only events, and volunteers can't read drafts, even from organisations they follow.
  - Members can list their organisation's drafts. Volunteers can't see other people's memberships, and can't write.
- `npm run seed` twice in a row: same result both times (6 organisations, 1 member, 8 events, 9 private docs, 35 registrations, 11 users, 5 hours entries, 11 sign-in accounts). Spot-checked times, counts and Mei Lin's 14 hours in the emulator.
- Browser at 390 px, signed in by email link as Mei Lin and as Aisha, calling every new `data.js` function. Mei Lin sees her Silver Companions membership and its events. Aisha is refused that list. Follow, unfollow and profile edits save. No console errors.

**Next**
- Slice 3: shared UI and Home.

## 28 Oct 2026: Phase 1, slice 3: Shared UI and Home

**Done**
- `js/ui.js`:
  - The four-tab bottom bar, the profile avatar, and "+ Event" for organisation admins.
  - Centred dialogs and slide-up sheets, with Escape, focus kept inside, and focus returned on close. Toasts.
  - Mouse drag-to-scroll for the page and every sideways strip; a drag doesn't count as a click.
  - Event covers and organisation marks from their two colours.
  - Dates and times shown in the organisation's timezone (Singapore).
  - All user text is HTML-escaped.
- `js/qr.js`: a QR code generator (byte mode, error correction level M, versions 1 to 10).
- Home (`index.html`, `js/pages/index.js`), from `design/Home.dc.html`:
  - The date, greeting and "hours volunteered this year" line, and the avatar.
  - Quick actions: New event for admins, Discover for volunteers, and My QR code.
  - "Your events": cards with a countdown, "Waiting for approval" in amber, and Check in on today's events, which opens the QR code for that event.
  - The first three organisations followed, then "Find organisations".
  - The shifts strip: it drags sideways, the today badge jumps back, and pending shifts are tinted amber.
  - "All events" grouped by day, with spot chips and the area filter. Public events and the followers-only events of organisations followed are shown together. The Map button stays hidden until Phase 3.
- Rules: people can list their own registrations across events (a collection group query on their uid). The hours ledger is readable by the volunteer, and by admins of the organisation named on each entry.
- Data: `myRegistrations`, `hoursBetween` and `listFollowerEvents`.

**Tested**
- `npm test`: 63 of 63 pass (37 rules tests, 26 QR tests). The QR tests decode every version's largest text and one byte more, plus non-English text.
- Browser, headless Edge at 390 × 844, signed in by email link:
  - As Aisha: 3 of her events, with "In 15 hours" and Check in on today's pantry restock. 2 organisations followed. Today's shift is in the strip. All 8 events in 6 day groups, marked "Sample events".
  - North leaves only the Yishun visit.
  - A mouse drag moves the strip without opening a day. The today badge goes back to today.
  - My QR code opens and closes with Escape.
  - As Mei Lin: "14 hours volunteered this year", New event, "+ Event", and her pending reading club in amber.
  - No sideways scrolling, no console errors.

**Notes**
- `npm test` starts its own emulators, so stop `npm run emulators` first.

**Next**
- Slice 4: event page and registration.

## 28 Oct 2026: Phase 1, slice 4: Event page and registration

**Done**
- `event.html` (`js/pages/event.js`), from `design/Event-Detail.dc.html`:
  - Volunteer view:
    - The cover with its cause and area, the host chip, the date and time, and the spots chip.
    - The main button: Register, Request to join, Join waiting list, Registered, Pending approval.
    - Contact goes to the organisation's contact details.
    - More: Add to calendar (an `.ics` download), Share event link (the phone's share sheet, or copy where there isn't one), Event QR code (drawn locally), Cancel my registration.
    - The location card hides the exact venue until the volunteer is approved.
    - Meeting point, what to bring, the hours line, the description, who's going (first names and the count), and the host with Follow.
  - Admin view, on your own organisation's events: Invite and Message (marked Soon until Phase 2), Manage, More (with Edit event), and "Check in volunteers" with the going count.
- `data.js`: `joinEvent` and `cancelRegistration` run as transactions. Each writes the registration, the event's counts and the who's-going entry together. Also `getMyRegistration`, `getMyRole`, `listGoing`, `getExactVenue` and `shortName`.
- Rules (section 7):
  - The event decides a new registration's status: going, pending when approval is on, or the waiting list when full.
  - Nobody can register for a cancelled, draft, closed or finished event.
  - A volunteer can cancel only their own registration, and can't approve themselves.
  - The event's counts must move by exactly the registration's change, in the same write, and can't move any other way.
  - Who's-going entries need a going registration behind them.
  - The exact venue is readable by approved volunteers and the organisation; the check-in and check-out codes only by the organisation.
- Seed: a who's-going entry for each of the 32 going registrations.

**Tested**
- `npm test`: 76 of 76 pass. The 13 new registration tests cover each case above, including counts moved by two, counts moved without a registration, registering someone else, and joining again after cancelling.
- Browser at 390 px, signed in by email link:
  - Aisha opens the sorting morning: "14 spots left", Register. After Register: "Registered", "13 spots left", and the who's-going line counts her. After cancelling from More: "Register" and "14 spots left" again.
  - Follow and unfollow work.
  - The calendar file holds the right title, start and place. Share hands over the event link. The QR dialog opens.
  - The reading club shows "Approval required" and Request to join, then "Pending approval".
  - On the Yishun visit, Aisha (going) sees the exact venue; Hari (pending) sees only "North, Singapore". A missing event shows "This event isn’t available."
  - Mei Lin gets the admin view: Invite and Message marked Soon, Manage, More with Edit event, and "7 going".
  - No sideways scrolling, no console errors.

**Next**
- Slice 5: Discover, Organisations, the organisation page and Profile.

## 28 Oct 2026: Phase 1, slice 5: Discover, Organisations, organisation page, Profile

**Done**
- `discover.html` (`design/Discover.dc.html`):
  - Popular this week, with search.
  - Browse by cause, with counts, filtering the list. Browse by location, with gradient area cards, filtering the list.
  - Organisations to follow, with Follow buttons.
- `organisations.html` (`design/Organisations.dc.html`):
  - Search and cause chips.
  - For admins, the "Your organisation" card: "2 requests waiting · 1 event tomorrow", worked out from the organisation's events.
  - "You follow", then the other organisations, each with its cause, area and upcoming count.
- `organisation.html` (`design/Organisation.dc.html`):
  - The hero with its band, mark, causes, area and stats. Follow, Contact, and Give (opens the giving page in a new tab).
  - Upcoming events, Past impact, Contact, and "member since".
  - The organisation's admins get "Your organisation", New event, and an in-place edit of About and the giving link.
- `profile.html` (`design/Profile.dc.html`):
  - Name, role line, bio and joined date.
  - Events hosted, events attended and organisations followed. The hours total links to `hours.html`.
  - Past events from the hours ledger.
  - Name and bio edited in place. "Your organisation", and Sign out.
- Shared in `ui.js`: event rows, organisation marks, the spots chip, follow buttons that save at once, and cover labels. Every sideways strip marks itself, so dragging it doesn't drag the page.
- Rules: organisation admins can edit their organisation's profile fields only. Status, stats and approval stay out of reach, and the giving link must be https. `data.js`: `updateOrganisation`, `listOrgPublicEvents`, `listHours`.

**Tested**
- `npm test`: 80 of 80 pass. New: admins edit About and the giving link; they can't change status, stats or approval; http and javascript links are refused; staff, volunteers and other organisations' admins can't edit.
- Browser at 390 px, signed in by email link:
  - As Aisha:
    - Discover's Popular this week: the Yishun visit, sorting morning, beach clean-up and pantry restock. Environment, North and search ("dog") filter correctly, and Clear resets.
    - Following Harvest Table on Discover shows on Home (3 organisations). Unfollowing it on Organisations takes Home back to 2. The Animals chip shows only Paws and Hearts.
    - The Silver Companions page shows its stats, Following, Give to its https giving page, the Yishun visit, three impact lines, and no edit button.
    - A new bio survives a reload.
  - As Mei Lin:
    - The "Your organisation" card reads "· 2 requests waiting · 1 event tomorrow".
    - On Silver Companions she gets "Your organisation" and New event. An http giving link is refused, and the new About and https link survive a reload.
    - Her Profile: 1 hosted, 5 attended, 3 followed, 14 hours, five past events with their covers, and "Your organisation". Sign out goes to sign-in.
  - No sideways scrolling, no console errors.

**Next**
- Slice 6: create and edit event.

## 28 Oct 2026: Phase 1, slice 6: Create and edit event

**Done**
- `create.html` (`js/pages/create.js`), from `design/Event-Create.dc.html`:
  - The cover preview and its colour button; the event name.
  - Start and end with the timeline dots.
  - Location: area chips, venue and meeting point. Description: the text and what to bring.
  - Require approval; Price, Free or Paid on site with an amount.
  - Cause, visibility (Public, Followers only, Draft), volunteer spots, and Notify followers.
  - Restore draft: the form is kept in `localStorage` while being filled in.
  - The done screen: View event, Back to Home, Create another.
- `create.html?id=` edits an event: the same form, prefilled, with Save, going back to the event page.
- Only the organisation's admins can use the page. Everyone else sees one plain line.
- `data.js`: `createEvent` writes the event and its private check-in and check-out codes in one batch. `updateEvent` changes only the fields edited, so registration counts are never overwritten. `ui.js`: `zonedDate` and `zonedParts` convert the form's Singapore date and time to and from timestamps.
- Rules:
  - Only the organisation's admins create its events. A new event must be scheduled, with zero counts, the organisation's real name and its creator.
  - The end must be after the start.
  - Edits can't change the organisation or the counts, and a cancelled event can't be brought back.
  - The codes are created with the event, by its admin.

**Tested**
- `npm test`: 89 of 89 pass. The 9 new create and edit cases include a staff member, a volunteer and another organisation's admin each trying, and a faked name, creator or count.
- Browser at 390 px, as Mei Lin:
  - "+ Event" opens the form for Silver Companions.
  - She fills in a grocery run (North, a venue and meeting point, a description, approval on, S$5 on site, Elderly).
  - After a reload, "Restore draft?" brings the whole form back.
  - An end before the start is refused.
  - Create shows the done screen. The event page shows the right day, "10 spots left" and the venue. The event appears in Home's list and under Elderly on Discover.
  - Edit event opens the form prefilled. A new title and 20 spots save and show on the event page.
- Browser at 390 px, as Aisha: both create and edit refuse her.
- No sideways scrolling, no console errors. The date and time fields fit 12-hour times ("09:00 AM") at 390 px.

**Next**
- Slice 7: the Manage menu and the volunteers list.

## 28 Oct 2026: Phase 1, slice 7: Manage menu and volunteers list

**Done**
- `manage.html` (`design/Manage-Event.dc.html`):
  - The event card with its spots and visibility chips. Every row from the canvas is shown.
  - Event details, Volunteers (with going and waiting counts), Check-in options, Check-out and hours, Check in volunteers, and Cancel event work. The other ten rows are dimmed with "Soon".
  - Cancel event asks for confirmation in a sheet first.
  - Staff see the menu without Event details and Cancel.
- `volunteers.html` (`design/Volunteers.dc.html`):
  - Tabs: Going, Attended, Not yet marked, Waiting for approval, with counts. Search, and sort by name.
  - Approve and Decline, for admins. Mark attended, and undo, for admins and staff.
  - The attended summary, and the List and Scan pill.
- The Phase 1 confirm path:
  - Marking someone attended confirms their attendance and the event's hours.
  - The volunteer's app adds the matching hours entry, with its reference number, on Home or Profile (`syncHours`).
- Rules:
  - Admins decide registrations (going, declined, waiting list). Admins and staff record attendance, only for volunteers who are going.
  - Counts move only with the named person's change.
  - Hours entries must match the confirmed attendance and the event exactly, register a new reference number, and move `hoursTotal` by the same hours. They can be removed only once the confirmation is gone.
  - `hoursTotal` can't change on its own.
  - Admins can list the hours entries that name their organisation.

**Tested**
- `npm test`: 101 of 101 pass. The 12 new cases:
  - Admin approve and decline. Staff and volunteers can't approve.
  - Counts naming the wrong person are refused.
  - Staff can mark attended. Attendance needs a going registration and must move the count. Volunteers can't record their own.
  - An entry can't be made without confirmation or with other hours. A reference number can't be reused. `hoursTotal` can't change alone.
  - Admins can list their organisation's entries, and other organisations' admins can't.
- Browser at 390 px:
  - Mei Lin's Manage menu for the Yishun visit: "7 of 10 spots filled", 6 working rows, 10 marked Soon.
  - Volunteers starts with Going 7, Waiting 2. She approves Hari and declines Ivy (Going 8, Waiting 0), then marks Hari attended ("Attended · 2 hours added", "1 attended · 2 volunteer hours").
  - Search "aish" finds Aisha, and sort by name works.
  - Hari signs in: Home says "2 hours volunteered this year", and his entry exists with reference VN-2026-94350, confirmed by Mei Lin. `hoursTotal` is 2, and Profile shows the event.
  - Mei Lin undoes the mark. On Hari's next visit the entry and his hours are gone.
  - Cancel event, behind the sheet: "Cancelled" on Manage and on the event page.
  - No sideways scrolling, no console errors.

**Next**
- Slice 8: check-in and check-out.

## 28 Oct 2026: Phase 1, slice 8: Check-in and check-out

**Done**
- `js/scanner.js`: the full-screen camera scanner from the canvas, with the corner brackets, scan line and result card. It reads with the phone's built-in barcode reader, or with jsQR where there isn't one. Without a camera it says "Camera not available".
- `checkin.html` (`design/Check-In.dc.html`):
  - Open QR scanner, and Mark attendance by hand (the volunteers list) with "N of M marked".
  - The default scan mode, Standard or Express. Admins save it on the event; staff can change it on their own phone unless it's locked.
  - Lock for check-in staff, for admins.
  - Check-in staff: the list, "+ Add staff" by email, and remove or withdraw, for admins. An empty state when there are none.
  - Scanning a volunteer's personal code checks them in (Standard after a tap, Express at once). Codes for someone not going, for another event, or that aren't the app's say so on the card.
- `checkout.html` (`design/Check-Out.dc.html`):
  - The event's check-out QR, with Show full screen.
  - Checked in, Hours confirmed and Not yet.
  - "Checked in, not checked out", with Confirm all and a Confirm button per person.
  - Hours claims, with Confirm and Decline (claims arrive in slice 9).
- Volunteers:
  - Home's card for an event they've checked in to shows "Check out". It opens the scanner, and reading the organiser's code confirms their hours.
  - The code is a link to the event page, so a phone's own camera app works too.
  - The hours entry follows straight away, through slice 7's `syncHours`.
- Staff: an admin's invite becomes a staff membership when that person signs in (`claimInvites`).
- Rules:
  - A volunteer can confirm their own attendance only with the event's check-out code, only for the event's hours, and only while going. The attended count moves with it.
  - After a check-in, the check-out keeps the organisation's check-in record.
  - Only admins invite and remove staff. An invite can only be accepted by the person whose verified email it names, and only as staff.

**Tested**
- `npm test`: 109 of 109 pass (83 rules tests, 26 QR tests). The 8 new rules tests cover:
  - A staff check-in.
  - A volunteer confirming with the code, and the wrong code, other hours or someone else's attendance refused.
  - The check-in record kept after check-out.
  - Invites by admins only, and accepting an invite on sign-in.
  - No staff without an invite, and no admin through one.
  - Removing staff.
- Browser at 390 px, two headless Edge windows against the emulators. Their fake cameras show real QR codes drawn by `js/qr.js`.
- Organiser window, as Mei Lin:
  - Check-in for the Yishun visit shows "0 of 7 marked".
  - The scanner reads Aisha's personal code, and her card shows "Registered 26 Oct". Check in turns it into "Checked in", and her attendance record says checked in by Mei Lin.
  - Check-out shows 1 checked in and 1 not yet.
- Volunteer window, as Aisha:
  - Home's Yishun card shows "Check out".
  - Her camera reads the check-out code: "2 hours confirmed", and Home now says "2 hours volunteered this year".
  - Mei Lin's check-out page then shows 1 hours confirmed and 0 not yet.
- More cases:
  - Chloe is checked in, and Mei Lin confirms her from the list.
  - Opening the check-out link directly (the camera-app path) confirms Aisha's pantry hours and tidies the address.
  - A wrong code says "That check-out code didn’t work." and writes nothing.
  - Aisha's ledger holds both entries, each with its own reference number.
  - Express and the lock save on the event. An Express scan of Aisha says "Already checked in".
  - Mei Lin invites ben.tan@example.com. After Ben signs in he's listed as staff. On Check-in he gets the scanner, with no lock, no "+ Add staff" and the mode fixed.
- No sideways scrolling.
- The only console message is the browser's own note that the wrong code was refused (a 403 from Firestore). The rules check the code, since volunteers can't read it.

**Next**
- Slice 9: claim hours and the hours record.

## 28 Oct 2026: Phase 1, slice 9: Claims and the hours record

**Done**
- `claim.html` (`design/Claim-Hours.dc.html`):
  - The event card, then one of the canvas states:
    - With a check-in: "You checked in at 1:52 PM".
    - Without one: "No check-in recorded".
  - Scan the organiser's check-out code, or "Claim 2 hours without a code".
  - After claiming: "Claim sent to Silver Companions". With a check-in it confirms itself on a date 7 days later.
  - After a scan or a confirmation: "2 hours confirmed".
  - Also: Claim declined, not going, and not ended yet.
- Home: the canvas claim card ("Claim 3 hours for Changi beach clean-up · You checked in on Sun 11 Oct but were not checked out") under Your events.
- `hours.html` (`design/Hours-Record.dc.html`):
  - The record: volunteer, confirmed hours, period and reference.
  - Each entry with its organisation, date, how it was confirmed, its reference number and its hours.
  - The verification code (`verify.html?ref=`).
  - Claims still waiting, each with View.
- `data.js`:
  - `claimHours` and `getMyAttendance`.
  - `syncHours` first confirms claims that are past their date. Home, Profile, the record and the claim page all run it.
- `scanner.js`: the volunteer's check-out scan is shared by Home and the claim page.
- Rules:
  - After the event, a volunteer who was going can claim its hours for themselves: the event's hours, under their registered name.
  - A claim after a check-in must set its auto-confirm date 7 days ahead.
  - The volunteer's app can confirm the claim once that date has passed, and 7 days after the claim by the server's clock. The attended count moves with it.
  - A declined claim can't be claimed again.
- Seed: the two past events and their attendance (see Decisions to confirm).

**Tested**
- `npm test`: 117 of 117 pass (91 rules tests, 26 QR tests). The 8 new rules tests cover:
  - Claiming after the event.
  - Claims refused before the end, without a going registration, for other hours, for someone else, under another name, or confirming themselves.
  - The auto-confirm date: 7 days after a check-in, and none without one.
  - The organiser confirming and declining.
  - Auto-confirm once due, and not before its date or 7 days after the claim.
  - A declined claim staying declined.
- Browser at 390 px against the emulators:
  - Aisha:
    - Her Home shows "Claim 2 hours for Befriending visit: Yishun seniors" for the past Yishun visit.
    - She claims: "Claim sent to Silver Companions", confirming itself on Wed 4 Nov (7.00 days ahead), with her check-in kept.
    - Her record shows "2 hours waiting for confirmation".
  - Esther, who has no check-in: her claim reads "The organiser needs to confirm you were there."
  - Mei Lin:
    - Her Home shows her own Changi claim card.
    - On the Yishun visit's check-out page she confirms Aisha's claim ("2 h confirmed") and declines Esther's ("Declined").
  - Aisha's record then has the visit with reference VN-2026-69806, period Oct 2026, the verification code and no pending claims. Esther's claim page says "Claim declined", and her Home no longer offers the claim.
  - Mei Lin claims her Changi hours. Her record matches the canvas: 14 hours, reference VN-2026-00482, five lines "confirmed by Mei Lin Tan" or "by check-out code", and "3 hours waiting for confirmation · Changi beach clean-up · Shoreline Keepers · confirms itself on 4 Nov".
  - Farid opens the app: his claim past its date confirms itself ("3 hours volunteered this year"), and his record says "confirmed automatically after 7 days".
  - Darren scans the Changi check-out code from the claim page: "3 hours confirmed". The Changi counts end at 2 attended.
  - No sideways scrolling, no console errors.
- Slice 8's two-browser check-in and check-out test still passes with the new seed and the shared scanner.

**Next**
- Slice 10: the app manifest and service worker, the empty Notifications page, the section 10 acceptance checks, Lighthouse, and `docs/TRY-IT.md`.
## 28 Oct 2026: Phase 1, slice 10: Polish and acceptance

**Done**
- `manifest.webmanifest`: name, standalone display, Clay theme, and the icons in `assets/` (192, 512, maskable 512, Apple touch, SVG). Every page links the manifest and the icons.
- `sw.js`, the app shell service worker. It keeps the app's own pages, styles, scripts, icons and font for opening offline, and keeps no data.
- `notifications.html`: the canvas empty state, "Nothing here yet", with the tab bar.
- Speed (see Decisions to confirm):
  - Firestore Lite.
  - Sign-in without Google's pop-up helpers at start.
  - Manrope served with the app.
  - A preconnect to the Firebase SDK's server, and preloads for the shared scripts and the font.
  - Pages shown once the font is ready, and static headers shown straight away.
  - Home's reads in two rounds.
  - `syncHours` checks due claims alongside its other reads, and the record, claim and Profile pages read in parallel with it.
- `docs/TRY-IT.md`: how to start the emulators, load the sample data, sign in, and try each flow as a volunteer and as Mei Lin.

**Tested**
- `npm test`: 118 of 118 pass (92 rules tests, 26 QR tests). New: a volunteer can't write anyone else's ledger or hours total.
- Section 10 acceptance, end to end at 390 px, in two browsers whose fake cameras show real codes:
  1. Jun signs in with an email link from the emulator.
  2. He asks to join the Yishun visit ("Pending approval"), and Mei Lin approves him.
  3. Her scanner reads Jun's code and checks him in.
  4. Jun scans the check-out code from Home: "2 hours confirmed".
  5. His record shows 2 hours and reference VN-2026-42681.
  6. Aisha, checked in but not out at last week's visit, claims. Mei Lin confirms it on the check-out page ("2 h confirmed"), and it reaches Aisha's record with a reference.
  7. No console errors.
- The rules tests cover the rest of section 10: a volunteer can't write anyone else's attendance or hours, can't read a draft event, and can't register for a cancelled event.
- Lighthouse 12.8.2, phone profile (simulated slow 4G, 4× slower CPU), cold cache, signed in, compressed files:

  | Page | Performance | Accessibility |
  |---|---|---|
  | Sign-in | 97 | 100 |
  | Home | 92 | 100 |
  | Discover | 98 | 100 |
  | Event (Yishun visit) | 95 | 100 |
  | Organisations | 100 | 100 |
  | Organisation (Silver Companions) | 95 | 100 |
  | Profile | 91 | 100 |
  | Hours record | 94 | 100 |
  | Claim | 93 | 100 |
  | Notifications | 100 | 100 |
  | Manage (Mei Lin) | 95 | 100 |
  | Volunteers (Mei Lin) | 92 | 100 |
  | Check-in (Mei Lin) | 95 | 100 |
  | Check-out and hours (Mei Lin) | 95 | 100 |
  | Create event (Mei Lin) | 94 | 100 |

  With only Firestore Lite in place, eight pages scored 84 to 89, and Volunteers had a layout shift of 0.106 (the web font arriving late). The font and loading changes brought every page to 91 or above, and layout shift is now 0 on every page.
- The service worker activates, the manifest and icons load, and the sign-in page opens offline.
- The earlier browser checks still pass with the changes: Home (slice 3), check-in and check-out (slice 8), and claims (slice 9).

**Notes**
- Lighthouse and playwright-core run from a scratch folder outside the project; nothing was added to `package.json`.
- No OneDrive file-lock errors in this session.

**Next**
- The Phase 1 queue is done. Waiting for Theersha on:
  - the decisions above;
  - pushing to GitHub and deploying (the rules and indexes need deploying with the site);
  - a Lighthouse check on the live site.

## 28 Oct 2026: Phase 2 block, started 10:13

- A two-hour unattended block, started 10:13 (from Get-Date). No new slice starts after about 11:58.
- The Phase 2 slices (A to H) are in `docs/QUEUE.md` under "Phase 2 queue". The queue file moved from `QUEUE_1.md` at the root to `docs/QUEUE.md`, the name Theersha now uses, with the Phase 1 queue kept as it was.
