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
