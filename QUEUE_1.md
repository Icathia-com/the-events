# Work queue: Phase 1 of The Events

Written 28 Oct 2026. Claude Code works through this file top to bottom, one slice at a time, without waiting for Theersha between slices. It is meant to fill several hours of unattended work. BACKEND-BRIEF.md stays the source of truth; this file only sets the order and the definition of done.

## How to run this queue

- Start every session by reading BACKEND-BRIEF.md, docs/PROGRESS.md and this file. Resume from the first slice not marked done in PROGRESS.md.
- For each slice: build it, test it, fix it, update PROGRESS.md (what was done, what was tested, anything left), make one local commit named "Phase 1, slice N: <name>", then move straight on to the next slice.
- Visual reference: the `design/` folder holds the approved screens from the design canvas as `.dc.html` files. They are prototypes. They use `{{ }}` placeholders, `<sc-for>` and `<sc-if>` tags and localStorage sample data. Copy their layout, spacing, colours, wording and states exactly, but not their code structure. Build real pages per section 4 of the brief, reading from Firestore through js/data.js. If a design file and the brief disagree, the brief wins; note the difference under "Decisions to confirm".
- Test at 390 px wide in the browser against the emulators, and run the full rules test suite after any rules change. A slice is done only when its tests pass and the page has no console errors.
- When something needs a decision Theersha hasn't made, don't stop. Make the most conservative choice that matches the design files, write it under a "Decisions to confirm" heading in PROGRESS.md, and carry on.
- If a slice still fails after a few honest attempts, write down exactly what's failing in PROGRESS.md and move to the next slice that doesn't depend on it. If every remaining slice depends on it, stop.

## Stop and wait for Theersha only if

- you would need to git push, deploy, run firebase login, or touch the live project `the-events-58a8e` or its billing;
- you need a new global install, or any package beyond those already approved (firebase-tools globally; local dev dependencies for testing and serving; jsQR for the scanner);
- OneDrive file locking breaks npm or the emulators;
- the toolchain stops working (Node and Git live on D:; if D: disappears, stop).

Everything else continues automatically.

## Slices

### Slice 1: Foundation and sign-in
As in the session prompt: repo layout, tokens.css, app.css basics, firebase.js with emulator switching, signin.html (email link and Google), users/{uid} creation, users rules and tests, emulator config with a demo- project ID. Design reference: none for sign-in. Use the Clay and Forest tokens, one glass card, the app name "The Events", an email field and two buttons, and no hint text.

### Slice 2: Data layer and sample data
- js/data.js: every Firestore read and write goes through here (organisations, events, registrations, attendance, hours ledger, user profile, follows).
- scripts/seed.mjs: loads the sample organisations, events and people from section 11 of the brief into the emulator, every document with `sample: true`, event dates moved to start from tomorrow. Mei Lin Tan is an admin of Silver Companions. Include one event for today.
- firestore.indexes.json from section 6.
- Rules and tests: anyone signed in can read approved organisations; public events are readable by anyone signed in; draft events only by org members; followers-only events only by followers.
- Done when: `npm run seed` fills the emulator and the rules tests pass, including the negative cases.

### Slice 3: Shared UI and Home
- js/ui.js: bottom bar (Home, Discover, Organisations, Notifications), glass card, bottom sheet, toast, drag-to-scroll on every scrollable area, the top-right profile avatar, and the "+ Event" floating button for org admins.
- index.html (Home) from design/Home.dc.html: date, greeting, impact line from the user's hours this year, quick actions, "Your events" cards with countdown and Check in on today's events, organisations you follow, the three-day shifts tile (drag sideways, today badge jumps back, pending tinted amber), then "All events" grouped by day with the area filter. Hide the Map button until Phase 3.
- Done when: signed in as a sample volunteer, Home shows their registrations and the full list from the emulator.

### Slice 4: Event page and registration
- event.html from design/Event-Detail.dc.html: volunteer view with Register, Request to join, Join waiting list, Registered and Pending approval states; the More menu (Add to calendar as an .ics download, Share link via the Web Share API with a copy fallback, Event QR code drawn locally); hidden exact location until approved; meeting point, what to bring, the hours line, who's going (first names and count), and the host with Follow.
- Admin view on the user's own organisation's events: Invite (disabled until Phase 2), Message (disabled until Phase 2), Manage, More, and Check in volunteers.
- Registration rules and tests per section 7: capacity, approval, waitlist, no registering for cancelled or draft events, a volunteer can cancel only their own registration. Keep `counts` consistent with a transaction.
- Done when: a sample volunteer can register, see Registered, cancel, and see the spot count change, and the rules tests pass.

### Slice 5: Discover, Organisations, Organisation page, Profile
- discover.html from design/Discover.dc.html: popular this week (most registrations), browse by cause (filters the list), browse by location (filters the list for now, since there's no map until Phase 3), organisations to follow.
- organisations.html from design/Organisations.dc.html and organisation.html from design/Organisation.dc.html: read-only for volunteers; Follow and unfollow; Give opens givingUrl in a new tab; the admin's own org shows New event and an edit for About and the giving link. Hide Apply to join and Letter requests until later phases.
- profile.html from design/Profile.dc.html: events hosted, events attended, organisations followed, joined date, hours total linking to hours.html, and editing name and bio in place.
- Done when: follow and unfollow persist and update Home, and profile edits persist.

### Slice 6: Create and edit event
- create.html from design/Event-Create.dc.html: cover (gradient picker for now; photo upload is Phase 2), name, start and end, area chips with venue and meeting point, description with what to bring, require approval, price (Free or Paid on site with an amount), cause, visibility, volunteer spots, notify followers (store the flag only; nothing is sent until Phase 3), and Restore draft from localStorage.
- Editing reuses the same page with `?id=`. Only org admins can create or edit; orgId can't change.
- Rules tests for event create and edit, including a staff member or volunteer trying to edit.
- Done when: Mei Lin creates an event that then appears on Home and Discover, and can edit it.

### Slice 7: Manage menu and Volunteers list
- manage.html from design/Manage-Event.dc.html: show every item from the design, but only Event details, Volunteers, Check-in options, Check-out and hours, and Cancel event work in Phase 1. Show the others as disabled rows with a small "Soon" tag. Cancel event sets status to cancelled behind a confirm sheet.
- volunteers.html from design/Volunteers.dc.html: tabs Going, Attended, Not yet marked and Waiting for approval (leave out the Invited tab until Phase 2), Approve and Decline, Mark attended (writes attendance and adds the event's hours), search and sort.
- Attendance rules and tests per section 7.
- Done when: Mei Lin approves a pending sample volunteer and marks them attended, and the volunteer's hours ledger gets an entry.

### Slice 8: Check-in and check-out
- checkin.html from design/Check-In.dc.html: camera scanner using BarcodeDetector, with jsQR (MIT) as the fallback; Standard and Express modes; lock for staff; staff list (adding staff writes organisations/{orgId}/members with role staff).
- Each volunteer shows their personal QR from Home's My QR code (uid plus event id, drawn locally). Scanning it checks them in.
- checkout.html from design/Check-Out.dc.html: the event's check-out QR (full-screen mode), Confirm all for remaining check-ins, and the claims list with Confirm and Decline.
- The volunteer side: scanning the check-out code from Home confirms their hours (the rule compares the code with events/{id}.codes.checkOut).
- Done when: the full check-in then check-out flow works in the emulator with two browser windows (organiser and volunteer), and the rules tests pass.

### Slice 9: Claims and the hours record
- claim.html from design/Claim-Hours.dc.html: the claim flow; a claim after a check-in sets autoConfirmAt to 7 days later; on app open, the app confirms any of the user's claims past autoConfirmAt.
- hours.html from design/Hours-Record.dc.html: the ledger with reference numbers `VN-<year>-<5 digits>`, the total, pending items, and the verification QR pointing at `verify.html?ref=` (the page itself is Phase 3). Hide the letter-request card until Phase 3.
- Done when: a claim shows as pending, the organiser confirms it from checkout.html, and it appears on the record with a reference.

### Slice 10: Polish and acceptance
- manifest.webmanifest and a minimal app-shell service worker per section 3; original icons in Clay and Forest.
- notifications.html: the empty state from design/Notifications.dc.html only.
- Run the section 10 acceptance checks end to end in the emulator and fix what fails. Run Lighthouse at mobile size and get performance and accessibility to 90 or above.
- Write docs/TRY-IT.md: plain-English steps for Theersha to start the emulators, seed the data, and try every flow as a volunteer and as Mei Lin.
- Then stop. Report what's done, what's in "Decisions to confirm", and anything that failed.
