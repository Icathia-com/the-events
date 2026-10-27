# The Events: build brief for Claude Code

Written 28 Oct 2026 for Theersha. This file lives at the root of the `the-events` repository and is the single source of truth for the build. Claude Code reads it before every session. It follows the same pattern as the Life Centre app: plain HTML, CSS and JavaScript with no build step, Firebase for data and sign-in, GitHub Pages for hosting, work in small phases, test before reporting, never deploy without Theersha's approval.

## 1. What the app is

A mobile web app where approved non-profits post volunteer events and shifts, and volunteers find them, register, check in, and keep a verified record of their hours. Singapore first, built so other countries can be added. The approved design is the canvas "Volunteer Network app" (https://claude.ai/artifact/2hNSoeLu3TUSkS32uVtvFS). Build what is on the canvas; do not invent screens or copy.

Roles:
- **Volunteer**: anyone signed in. Browses, follows organisations, registers, checks in and out, sees their hours record.
- **Organisation admin**: a member of an approved organisation with role `admin`. Creates and manages that organisation's events, confirms attendance and hours, issues letters.
- **Organisation staff**: role `staff`. Can check volunteers in and out and see the volunteer list; cannot edit events.
- **Network admin**: Theersha. Approves organisations joining; sees everything.

## 2. How to work

- Read this brief, then `docs/PROGRESS.md`, at the start of every session. Append to `PROGRESS.md` at the end of every session: what was done, what was tested, what is next.
- Work in the phases in section 9, one at a time, smallest shippable slice first. Stop at the end of each phase and report; do not start the next phase without Theersha's go-ahead.
- Test in the browser (phone width, 390 px) and in the Firebase emulator before reporting. Security rules are tested with the emulator's rules unit tests; a phase is not done until its rules tests pass.
- Never run `git push`, never deploy, never change Firebase project settings, and never upgrade the billing plan without explicit approval in chat. Local commits are fine; name them plainly ("Phase 1: email-link sign-in").
- No how-to hint text in the UI. Sample data is labelled "Sample". Anything scrollable must also drag with the mouse.
- Licensing: original artwork only, Manrope from Google Fonts (OFL), no copied logos or assets from Luma, Meetup, Rodeo or anywhere else; those were layout references only.
- Keep secrets out of the repo. The Firebase web config below is public by design; service-account keys and any API secrets are not, and are never committed.

## 3. Stack and set-up (already created)

- **Hosting**: GitHub Pages from the `main` branch, root folder, at `https://icathia-com.github.io/the-events/`. All paths must be relative so the app works under `/the-events/`.
- **Front end**: HTML, CSS, ES-module JavaScript, no bundler, no framework. Firebase modular SDK loaded from the Google CDN (`https://www.gstatic.com/firebasejs/<version>/firebase-*.js`), pinned to one version in `js/firebase.js`.
- **Firebase project**: `the-events-58a8e` (name "The Events"), Spark plan. Firestore Standard edition in **asia-southeast1 (Singapore)**, production rules. Authentication: Email link (passwordless) and Google. Authorised domains include `icathia-com.github.io`. Web app "The Events web".
- **PWA**: `manifest.webmanifest` with the app name, Clay and Forest theme colour, standalone display, and original icons; a minimal service worker for the app shell only (no offline data in phase 1).

Web config for `js/firebase.js` (public client config; access is governed entirely by security rules):

```js
export const firebaseConfig = {
  apiKey: "AIzaSyCK4VXqnTpDkUGHS9ENrIyy3miaZU23GVo",
  authDomain: "the-events-58a8e.firebaseapp.com",
  projectId: "the-events-58a8e",
  storageBucket: "the-events-58a8e.firebasestorage.app",
  messagingSenderId: "524072327601",
  appId: "1:524072327601:web:78212447047de2fbeb8590"
};
```

Things that need the Blaze plan and are therefore **not** in phase 1: Cloud Functions, Cloud Storage uploads, custom email sending, PDF generation. Design the data so they can be added without migration.

## 4. Repository layout

```
the-events/
  index.html                Home (the entry; redirects to sign-in when signed out)
  discover.html
  event.html                ?id=<eventId>
  create.html               create and edit an event (admins)
  manage.html               ?id=<eventId>  manage menu
  volunteers.html           ?id=<eventId>
  checkin.html              ?id=<eventId>  check-in options and scanner
  checkout.html             ?id=<eventId>  check-out code, confirm hours, claims
  claim.html                ?id=<eventId>  volunteer claims hours
  hours.html                hours record, letter request
  organisations.html
  organisation.html         ?id=<orgId>
  profile.html
  notifications.html
  signin.html
  css/
    tokens.css              colours, type scale, radii, shadows, glass recipe (section 5)
    app.css                 layout, components
  js/
    firebase.js             init, exports db and auth
    auth.js                 sign-in, sign-out, current user and role helpers
    data.js                 all Firestore reads and writes (one place)
    ui.js                   shared components: bottom bar, glass card, sheet, toast, drag-to-scroll
    pages/<page>.js         one module per page
  firestore.rules
  firestore.indexes.json
  firebase.json             emulator config
  tests/rules.test.mjs      rules unit tests against the emulator
  docs/
    BACKEND-BRIEF.md        this file (also copied to the repo root)
    PROGRESS.md             running log
    DATA-MODEL.md           kept in sync with section 6
  assets/                   original icons, cause illustrations
```

## 5. Design tokens (from the canvas)

Copy these into `css/tokens.css` as custom properties and use nothing else.

- Background gradient: `linear-gradient(180deg, #9A4F33 0px, #C2704F 120px, #E5A98B 280px, #F2D3C1 480px, #F8EEE8 760px, #FAF5F1 100%)`.
- Ink `#1E1A17`, body `#4A3F38`, muted `#6B5E55`, forest (primary buttons) `#24412F`, confirmed green `#2E7D5B` on `rgba(46,125,91,.14)` with text `#1E6B42`, pending amber `#C9702D` on `rgba(201,112,45,.16)` with text `#8A4A12`, danger `#A32D2D`.
- Glass card: `background: rgba(255,255,255,.62); backdrop-filter: blur(22px); border: 1px solid rgba(255,255,255,.9); box-shadow: 0 12px 32px rgba(90,50,30,.10); border-radius: 24px` (28 for hero cards, 18 for small tiles, 17 to 20 for pills and chips). Use glass on cards, the bar and sheets only; list rows inside a card are plain.
- Bottom bar: 68 px tall, 34 px radius, four tabs (Home, Discover, Organisations, Notifications), active tab gets the white lens. Profile is the avatar top-right.
- Type: Manrope. Page title 33/500 white on the gradient; section title 20/600 with -0.02em; card title 15 to 16/700; body 14.5; meta 12.5 muted; chips 13/700. Touch targets at least 44 px.
- Event covers: organisations upload a photo (phase 2). Until then, a cover is a 135° gradient from the organisation's two colours with the event's short label; keep the same radii and a 1 px inner white stroke.
- Motion: press scale 0.97, sheets slide up 220 ms ease-out, no animation when `prefers-reduced-motion`.

## 6. Data model (Firestore)

All documents carry `createdAt`, `updatedAt` (server timestamps) and, where relevant, `createdBy` (uid). Times are stored as Firestore timestamps in UTC; the app displays them in `Asia/Singapore`, read from `organisations/{id}.timezone` so other countries can be added later. Areas and causes are fixed lists in `js/data.js`.

```
users/{uid}
  name, email, photoUrl, bio, joinedAt
  networkAdmin: boolean          (set only by hand in the console)
  follows: [orgId]               (max 200; denormalised for Home)
  hoursTotal: number             (maintained by the app on confirm)

organisations/{orgId}
  name, tagline, about, causes: [cause], area, timezone: "Asia/Singapore"
  logoColors: [hex, hex], givingUrl, email, address, website
  status: "pending" | "approved" | "suspended"
  stats: { events, volunteers, hours }   (recomputed by the app; display only)
  members/{uid}: { role: "admin" | "staff", name, addedAt }

events/{eventId}
  orgId, orgName, title, description, cause, area, venue, meetingPoint, bring
  startAt, endAt, hours (number, derived from start/end, editable by admin)
  cover: { colors: [hex, hex], label, photoUrl? }
  visibility: "public" | "followers" | "draft"
  status: "scheduled" | "cancelled"
  registration: { open: boolean, approval: boolean, capacity: number|null, waitlist: boolean, group: boolean, opensAt?, closesAt? }
  ticketTypes: [{ id, name, description, paid: boolean, amountOnSite?, approval, capacity?, opensAt?, closesAt? }]
  counts: { going, pending, waitlist, attended }   (maintained by the app)
  hideExactLocation: boolean
  checkInMode: "standard" | "express", checkInLocked: boolean
  codes: { checkIn: string, checkOut: string, rotatedAt }   (phase 1: static per event; rotation in phase 3)

events/{eventId}/registrations/{uid}
  name, status: "going" | "pending" | "waitlist" | "declined" | "cancelled", ticketTypeId
  answers: { questionId: value }, registeredAt, decidedAt?, decidedBy?

events/{eventId}/attendance/{uid}
  checkedInAt?, checkedInBy?, checkedOutAt?, checkedOutBy?
  hours: number, status: "checked_in" | "confirmed" | "claimed" | "declined"
  claimedAt?, autoConfirmAt?      (claim + 7 days when the volunteer had checked in)

users/{uid}/hours/{entryId}        the volunteer's ledger; one entry per confirmed attendance
  eventId, eventTitle, orgId, orgName, date, hours, confirmedBy ("code" | uid), confirmedAt, reference

events/{eventId}/questions/{questionId}   (phase 2)
events/{eventId}/codes/{code}             vouchers and access codes (phase 2)
events/{eventId}/announcements/{id}       (phase 2)
organisations/{orgId}/letterRequests/{id} (phase 3)
users/{uid}/notifications/{id}            (phase 3; phase 1 shows nothing here)
```

Indexes needed in phase 1: `events` by `status, visibility, startAt`; `events` by `orgId, startAt`; collection group `registrations` by `uid, status` (for "Your events" on Home). Put them in `firestore.indexes.json`.

## 7. Security rules (outline; write the real file and test it)

- Signed-in users can read their own `users/{uid}` and write `name, bio, photoUrl, follows` only. `networkAdmin` and `hoursTotal` are never client-writable except `hoursTotal` by the app's own confirm path (phase 1 allows the volunteer's client to append `users/{uid}/hours` only when a matching `attendance` doc has `status == "confirmed"`; phase 3 moves this to a Cloud Function).
- Anyone signed in can read `organisations` with `status == "approved"`; members can read their own org whatever its status; only the network admin can change `status`; org admins can edit their org's profile fields and `members`.
- Events: readable by anyone signed in when `visibility == "public"`, by followers when `"followers"`, by org members when `"draft"`. Only org admins can create and edit; `orgId` cannot change after creation; `counts` are only updated through the registration and attendance paths below.
- Registrations: a volunteer can create their own with `status` `"going"` when `registration.approval == false` and capacity allows, else `"pending"`; can set their own to `"cancelled"`; org admins can set `"going"`, `"declined"`, `"waitlist"`. Nobody can register for a cancelled event or a draft.
- Attendance: org admins and staff can write any field for their event's volunteers; a volunteer can only create a `"claimed"` entry for themselves after `endAt`, and only when they have a `"going"` registration; a volunteer can also set `status` to `"confirmed"` only when presenting the event's current check-out code (the client sends the code; the rule compares it to `events/{id}.codes.checkOut`).
- Hours ledger: readable by the volunteer and by admins of the org named on the entry; writable per the attendance condition above.
- Everything else: denied. Write rules tests for each bullet, including the negative cases.

## 8. Behaviour that must match the canvas

- **Sign-in** (`signin.html`): email link only for volunteers (enter email, open the link, done) and Google for anyone. After sign-in, create `users/{uid}` if missing and go to Home. Store the email in `localStorage` between sending and completing the link.
- **Home**: date, greeting, impact line (hours this year), quick actions (New event for admins, Discover for volunteers, My QR code), "Your events" cards with countdown and a Check in button on today's events, organisations you follow, the three-day shifts tile (drag sideways, today badge jumps back, pending tinted amber), then "All events" grouped by day with the area filter and a Map button. Admins get the "+ Event" floating button.
- **Discover**: popular (most registrations this week), browse by cause (filters the list above), browse by location (opens the map filtered), organisations to follow with Follow buttons.
- **Map** (phase 3; phase 1 shows the list with a "Map coming soon" state is not acceptable; instead hide the Map button until phase 3).
- **Event page**: both roles on one page; admin view only on the user's own organisation's events. Register, Request to join, Join waiting list, Registered, Pending approval states; More menu; hidden exact location until approved when `hideExactLocation`; meeting point, what to bring, hours line, description, who's going (first names and count), hosted by with Follow.
- **Create and edit event**: the canvas form; Restore draft from `localStorage`; "Volunteer spots" wording; visibility Public, Followers only, Draft.
- **Volunteers list**: tabs Going, Attended, Not yet marked, Waiting for approval, Invited (empty in phase 1); approve and decline; Mark attended; List/Scan pill.
- **Check-in**: scanner using the camera (`BarcodeDetector` where available, `jsQR` fallback, both MIT); Standard and Express modes; lock for staff; manual marking via the list.
- **Check-out and hours**: the organiser shows the check-out QR (full-screen mode); scanning it confirms the event's hours for that volunteer; Confirm all remaining check-ins; claims list with confirm and decline.
- **Claim hours**: volunteer side, exactly the canvas flow; claims with a prior check-in auto-confirm after 7 days (phase 1: the app confirms them when the volunteer next opens the app after `autoConfirmAt`; phase 3: a scheduled Function).
- **Hours record**: ledger with reference number `VN-<year>-<5 digits>`, totals, pending items, and a verification QR that opens `verify.html?ref=` (read-only page, phase 3). Letter requests are phase 3.
- **Profile**: X-style page; stats are events hosted, events attended, organisations followed, joined date; edit name and bio in place.
- **Organisations** and **Organisation page**: as on the canvas; Give opens `givingUrl` in a new tab; Apply to join creates `organisations/{id}` with `status: "pending"` (phase 2).
- **Notifications**: phase 3. In phase 1 the tab shows the empty state.

## 9. Phases

**Phase 1 (this brief's deliverable): sign in, see events, register, attend, hours.**
Sign-in; Home (without the Map button); Discover; event page with registration states; create and edit event; volunteers list with approve and mark attended; check-in scanner and check-out code; claim hours; hours record; profile; organisations and organisation page (read-only, follow); empty Notifications. Firestore rules with tests. Seed script for the sample organisations and events from the canvas, clearly labelled Sample. GitHub Pages live only after Theersha approves.

**Phase 2: manage the event.** Hosts, access and registration settings, ticket types, vouchers and access codes, registration questions, announcements (in-app only), insights, invite, event chat, organisation application and network-admin approval, event cover photo upload (needs Blaze for Storage, so ask first).

**Phase 3: the rest.** Push and email notifications and the Notifications tab, the live map (OpenStreetMap tiles with Leaflet, BSD-2), verification page, PDF hours record and signed letters, scheduled auto-confirm, rotating check-in codes, second Owner on the Firebase project.

## 10. Acceptance for phase 1

A volunteer can sign in with an email link on a phone, register for a sample event, be approved by Mei Lin's admin account, check in by scanning the organiser's code, be checked out by scanning the check-out code, and see 2 hours on their record with a reference number. A volunteer who was checked in but not out can claim, and the organiser can confirm it from the check-out page. The rules tests prove a volunteer cannot write anyone else's attendance or hours, cannot read a draft event, and cannot register for a cancelled event. Lighthouse on the phone profile: performance and accessibility both 90 or above. No console errors.

## 11. Seed data

Use the names from the canvas and nothing real: organisations Harvest Table SG, Silver Companions, Shoreline Keepers, Little Readers, Paws and Hearts Shelter, Green Corridor Collective; the eight sample events with their dates moved to the week after seeding; sample volunteers Aisha Rahman, Ben Tan, Chloe Lim, Darren Koh, Esther Ng, Farid Aziz, Grace Ong, Hari Subramaniam, Ivy Chen, Jun Wei; Mei Lin Tan as a Silver Companions admin. Mark every seeded document with `sample: true` so it can be deleted in one query before launch.

## 12. Out of scope for the first version

Donations in the app (Give links out), Stripe or any payment, SMS sending, Web3 fields, multi-language, iOS and Android store apps, anything not on the canvas.
