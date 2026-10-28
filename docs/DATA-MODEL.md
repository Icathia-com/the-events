# Data model

Kept in sync with section 6 of BACKEND-BRIEF.md.

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

## Additions to section 6

Made while building Phase 1; the reasons are under "Decisions to confirm" in `docs/PROGRESS.md`.

```
events/{eventId}
  notifyFollowers: boolean              the form's "Notify followers"; nothing is sent until Phase 3
  ticketTypes                           a paid event has one "Standard" ticket with amountOnSite; free events have none
                                        until types are added on Access and registration (Phase 2). Each type: id,
                                        name, description, paid, amountOnSite?, approval, capacity?, opensAt?, closesAt?
  typeCounts: { typeId: number }        going registrations per ticket type (Phase 2), moved with the counts
  waitingList: [uid]                    the waiting list in order (Phase 2)
  waiting: { uid: { type, name } }      each waiting person's ticket type id and short name ("Aisha R.")
  movedUp, movedUpAt                    the last person moved up from the waiting list by a cancellation, and when
  announcedAt: { audience: timestamp }  when each audience last got an announcement (Phase 2, the unread dot)
events/{eventId}/announcements/{id}     text, audience ("going" | "waiting" | "attended"), by, byName, count,
                                        createdAt (Phase 2, in the app only; read only by that audience and the
                                        organisation's members)
events/{eventId}/private/codes          checkIn, checkOut, rotatedAt
                                        (in place of events.codes; only the organisation's members can read it)
events/{eventId}/private/location       venue: the exact address when hideExactLocation is true
                                        (the event's own venue then holds only the general area)

organisations/{orgId}
  approvedAt                            shown as "Approved member of the network since"
  impact: [{ title, line }]             Past impact on the organisation page
organisations/{orgId}/members/{uid}
  uid                                   lets people find their own memberships with a collection group query

events/{eventId}/registrations/{uid}
  uid                                   lets people find their own registrations with a collection group query
  movedUpAt                             when a cancellation moved this person up from the waiting list (Phase 2)
  email                                 the volunteer's sign-in email, for the organisation (Phase 2)
  answers: { questionId: value }        text, or true/false for checkbox and terms questions (Phase 2)
events/{eventId}/questions/{id}         type, text, options?, required, order (Phase 2). Mobile number, emergency
                                        contact and age group use the ids mobile, emergency and age; custom ones are
                                        text, options, checkbox, link, mobile, instagram, telegram, linkedin, company
                                        or terms
events/{eventId}/going/{uid}            name ("Aisha R."), since: who's going, readable with the event; one per going registration

users/{uid}/hours/{eventId}             the entry id is the event id: one entry per confirmed attendance
  cover: { colors, label }              the event's cover, kept with the entry like its title and organisation name

sample: true                            on every document the seed script writes
```

```
events/{eventId}
  countsBy                              the uid whose registration or attendance the last counts change followed
events/{eventId}/attendance/{uid}
  uid, name                             who it is (uid lets volunteers find their own with a collection group query)
  confirmedAt, confirmedBy              when and by whom the hours were confirmed: an admin's uid, or "code"
users/{uid}
  hoursBy                               the ledger entry the last hoursTotal change followed
references/{ref}                        uid, entryId: each VN-<year>-<5 digits> number, registered once
```

```
organisations/{orgId}/staffInvites/{email}
  email, role ("staff"), invitedBy, invitedAt
                                        an admin's invite; when that email signs in, it becomes members/{uid}
                                        with role "staff" and the invite is removed
events/{eventId}/attendance/{uid}
  code                                  the check-out code the volunteer scanned, when confirmedBy is "code", or on a
                                        claim the scan sent (no check-in, or outside the check-out window)
  confirmedBy                           also "auto": a claim after a check-in that confirmed itself 7 days later
                                        (the hours entry copies it)
```
