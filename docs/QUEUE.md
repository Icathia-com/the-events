# Work queue for The Events

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

## Phase 1 queue (done)

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

## Phase 2 queue

Added 28 Oct 2026. Same rules as above. Commits are named "Phase 2, slice <letter>: <name>". Resume from the first slice PROGRESS.md doesn't show as done.

Time-boxed blocks: note the start time in PROGRESS.md and check the time between slices. After about 1 hour 45 minutes of a two-hour block, don't start a new slice. When time is up, finish the current slice or undo its unfinished changes, so nothing is left half-done.

Not in this queue: event chat (needs live updates) and cover photo upload (needs the paid Firebase plan). Never push, deploy, run firebase login, touch the live project, or install anything globally.

### Slice A: Phase 1 follow-ups
Skip anything PROGRESS.md already shows as done.
- Decisions 1, 2, 4, 5 and 7 from the Phase 1 report are approved; mark them decided.
- 3: the check-out code confirms hours only if the volunteer was checked in, and only from 30 minutes before the event's end until 3 hours after. Any other scan creates a claim. Rules tests for both cases.
- 6: a "Past events" section on the organiser's view of their own organisation page, with the count of pending claims, each linking to its checkout.html.
- Check the site works when served from a /the-events/ subfolder: links, manifest start_url, service worker scope, icons. Fix what breaks.
- Leave npm audit and the commit email as they are. Theersha gives her GitHub address before the first push.

### Slice B: Access and registration (design/Access.dc.html)
- access.html: visibility, accept registrations, volunteer spots with a waiting list, group registration, ticket types (Free or Paid on site with an amount; per-type approval, spots, opens and closes).
- When someone cancels, the first person on the waiting list moves up automatically (in a transaction).
- The event page lets volunteers pick a ticket type when there's more than one, and shows on-site amounts as "S$X, paid at the event".
- Rules tests.

### Slice C: Registration questions (design/Questions.dc.html)
- Per-event settings: mobile, emergency contact and age group, each Off, Optional or Required, plus custom questions of the types on the design.
- Registering asks them in a sheet. Answers are stored on the registration and shown to the organisation's admins and staff when they tap a volunteer in the Volunteers list.
- Rules: answers are readable only by that volunteer and that organisation's admins and staff. Tests.

### Slice D: Announcements, in-app only (design/Blasts.dc.html)
- Compose and choose the audience. Stored in events/{id}/announcements.
- Volunteers in the audience see them on the event page, newest first, and an unread dot on that event's card on Home.
- Show push, email and SMS as disabled options with a "Soon" tag.
- Rules: only the event's admins write; only the chosen audience reads. Tests.

### Slice E: Hosts (design/Hosts.dc.html)
- Add people to an event by email as co-host (edit, approve, announce), staff (check in and out) or guest speaker (shown on the event page only). Partner organisations shown on the event page.
- Rules: event co-hosts get admin powers for that event only. Tests.

### Slice F: Organisation applications
- apply.html ("Apply to join" on the Organisations tab): name, tagline, causes, area, contact details, about, giving link. Creates the organisation with status pending and the applicant as its admin.
- admin.html for the network admin: pending applications with Approve and Decline.
- Applicants see their application's status on their Profile. Pending organisations stay invisible to everyone else.
- Rules: only a networkAdmin can change status. Tests.

### Slice G: Vouchers and access codes (design/Vouchers.dc.html)
- The four kinds on the design (reserved spots, skip approval, unlock a hidden event, discount on the on-site fee), with a use limit and an expiry date. Volunteers enter a code on the event page.
- Volunteers must never be able to list or read codes: validate them inside the rules with get(). Tests, including guessing and reusing past the limit.

### Slice H: Invite and Insights (design/Invite.dc.html, design/Insights.dc.html)
- Invite past volunteers, or everyone who attended a past event. This creates invited records shown in the Volunteers "Invited" tab and as an "Invited" card on the volunteer's Home. No emails until Phase 3.
- Insights: registered, waiting, cancelled, spots filled, attendance, and where registrations came from (record the source: Home, Discover, organisation page, invite, or a shared link with ?src=). Leave page-view counts out and note it as a decision.
