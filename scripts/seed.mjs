// Loads the canvas sample data into the emulators (brief section 11). Every document carries sample: true.
// It first clears the emulator's Firestore data, and it refuses to run against anything but the local emulators.
import { randomBytes } from 'node:crypto';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setLogLevel, Timestamp, writeBatch } from 'firebase/firestore';

const PROJECT = 'demo-the-events';
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const isLocal = (host) => /^(127\.0\.0\.1|localhost):\d+$/.test(host);
if (!PROJECT.startsWith('demo-') || !isLocal(FIRESTORE) || !isLocal(AUTH)) {
  throw new Error('The seed only runs against the local emulators under a demo- project.');
}

const reachable = (url) => fetch(url).then(() => true, () => false);
if (!(await reachable(`http://${FIRESTORE}/`)) || !(await reachable(`http://${AUTH}/`))) {
  console.error('The emulators are not running. Start them first with: npm run emulators');
  process.exit(1);
}

// The canvas is drawn on 27 Oct 2026. Every canvas date moves by the same number of days,
// so the canvas "today" becomes the seeding day (in Singapore) and the rest follow from tomorrow.
const DAY = 86400e3;
const CANVAS_TODAY = Date.UTC(2026, 9, 27);
const sgNow = new Date(Date.now() + 8 * 3600e3);
const SEED_TODAY = Date.UTC(sgNow.getUTCFullYear(), sgNow.getUTCMonth(), sgNow.getUTCDate());

// A canvas date and a Singapore wall-clock time, moved to the seeding week.
function at(canvasDay, hhmm = '12:00') {
  const [y, m, d] = canvasDay.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return Timestamp.fromMillis(Date.UTC(y, m - 1, d) - CANVAS_TODAY + SEED_TODAY + (hh - 8) * 3600e3 + mm * 60e3);
}
const daysAgo = (n) => Timestamp.fromMillis(Date.now() - n * DAY);

// Shifting dates breaks titles that name a weekday ("Saturday reading club"), so those move on to that weekday.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function toNamedWeekday(title, ts) {
  const named = WEEKDAYS.findIndex((d) => title.includes(d));
  if (named < 0) return 0;
  const sgWeekday = new Date(ts.toMillis() + 8 * 3600e3).getUTCDay();
  return ((named - sgWeekday + 7) % 7) * DAY;
}
const token = () => randomBytes(6).toString('hex');

const ORGS = {
  harvest: {
    name: 'Harvest Table SG', tagline: 'Food rescue and community pantries', causes: ['food'], area: 'central',
    logoColors: ['#8A5A1E', '#D9A24A'], since: '2026-02-01', email: 'hello@harvesttable.example',
    address: 'Community pantry, Toa Payoh', website: 'harvesttable.example', stats: { events: 38, volunteers: 240, hours: 760 },
    about: 'We collect surplus food from markets and distributors and sort it into weekly packs for families who need them. Most of our shifts are two to three hours of sorting and packing, with occasional delivery runs.',
    impact: [['12,400 food packs delivered', 'Since January, to 310 families'], ['Zero packs wasted in September', 'Every pack sorted was delivered within 48 hours'], ['New pantry opened in Toa Payoh', 'Set up by volunteers over two weekends']],
  },
  silver: {
    name: 'Silver Companions', tagline: 'Befriending seniors living alone', causes: ['elderly'], area: 'north',
    logoColors: ['#7A3E2A', '#D08A5E'], since: '2026-01-01', email: 'hello@silvercompanions.example',
    address: 'Yishun Street 11', website: 'silvercompanions.example', stats: { events: 52, volunteers: 180, hours: 1040 },
    about: 'We pair volunteers with seniors living alone in the north for regular visits, errands and festive gatherings. New volunteers are paired with someone who has visited before, and every first visit follows a short call with our coordinator.',
    impact: [['140 seniors visited regularly', 'At least twice a month, across Yishun and Sembawang'], ['Mid-Autumn gathering for 60 seniors', 'Run entirely by volunteers in September'], ['Grocery runs every week', 'For 22 seniors who cannot get out easily']],
  },
  shore: {
    name: 'Shoreline Keepers', tagline: 'Beach and park clean-ups', causes: ['environment'], area: 'east',
    logoColors: ['#1F4E6E', '#5B9BC2'], since: '2026-03-01', email: 'hello@shorelinekeepers.example',
    address: 'East Coast Park', website: 'shorelinekeepers.example', stats: { events: 26, volunteers: 410, hours: 980 },
    about: 'Monthly clean-ups along the east coast and in parks, with everything we collect weighed and reported. Gloves, bags and tongs are provided; you bring a hat and water.',
    impact: [['3.2 tonnes collected this year', 'Across 26 clean-ups'], ['Changi stretch adopted', 'Cleaned every first Saturday'], ['School partnership started', 'Two secondary schools join each quarter']],
  },
  readers: {
    name: 'Little Readers', tagline: 'Weekend reading and tuition', causes: ['education', 'children'], area: 'west',
    logoColors: ['#5A3E7A', '#9C7BC4'], since: '2026-04-01', email: 'hello@littlereaders.example',
    address: 'Jurong West community library', website: 'littlereaders.example', stats: { events: 44, volunteers: 95, hours: 520 },
    about: 'One-to-one reading with children aged 7 to 10 on Saturday mornings, plus craft afternoons. Volunteers commit to at least four Saturdays so the children see a familiar face.',
    impact: [['68 children reading weekly', 'Up from 40 in January'], ['Four Saturdays commitment kept by 80% of volunteers', 'Thank you'], ['Library room renovated', 'With a grant the volunteers applied for']],
  },
  paws: {
    name: 'Paws and Hearts Shelter', tagline: 'Dog walking and shelter care', causes: ['animals'], area: 'northeast',
    logoColors: ['#2E5C44', '#5FA37B'], since: '2026-05-01', email: 'hello@pawsandhearts.example',
    address: 'Pasir Ris Farmway', website: 'pawsandhearts.example', stats: { events: 60, volunteers: 130, hours: 880 },
    about: 'Walk and socialise shelter dogs with a handler, help with feeding and cleaning, and join adoption drives. Closed shoes and long trousers are a must.',
    impact: [['41 dogs adopted this year', 'Every one walked by volunteers first'], ['Daily walks, no gaps since June', 'Thanks to a volunteer rota'], ['Shelter roof repaired', 'Funded by the May adoption drive']],
  },
  corridor: {
    name: 'Green Corridor Collective', tagline: 'Tree planting and trail care', causes: ['environment'], area: 'central',
    logoColors: ['#3E5A1E', '#8CB83E'], since: '2026-06-01', email: 'hello@greencorridor.example',
    address: 'Rail Corridor, Bukit Timah', website: 'greencorridor.example', stats: { events: 18, volunteers: 220, hours: 540 },
    about: 'Planting native saplings and clearing trails along the old railway corridor, in the evenings when it is cooler. Tools and saplings are provided.',
    impact: [['1,900 saplings planted', 'Along three restored stretches'], ['Trail reopened at Bukit Timah', 'After eight volunteer evenings'], ['Nursery started', 'Growing next year\'s saplings']],
  },
};

const YISHUN_ABOUT = 'Visit seniors living alone in pairs for a chat, a quick check on how they are doing, and a hand with small errands. We pair every new volunteer with someone who has visited before.\n\nFirst-time volunteers are approved after a short call with our coordinator.';

// [id, canvas day, start, end, title, org, area, cause, spots, approval, cover label, venue, meeting point, bring, description]
// The first two are past events, so claims can be tried: the canvas claim (design/Claim-Hours.dc.html) and the
// Yishun visit in Mei Lin's hours record. The other eight are the sample events from the seeding day on.
const EVENTS = [
  ['changi', '2026-10-10', '08:00', '11:00', 'Changi beach clean-up', 'shore', 'east', 'environment', 40, false, 'CHANGI\nCLEAN-UP',
    'Changi Beach Park, carpark 7', 'Carpark 7, by the shelter', 'Hat, sunscreen and a reusable bottle. Gloves and bags are provided.',
    'A three-hour sweep of the Changi stretch we adopted. We weigh what we collect at the end and share the total with everyone who came.'],
  ['past-yishun', '2026-10-14', '14:00', '16:00', 'Befriending visit: Yishun seniors', 'silver', 'north', 'elderly', 10, true, 'YISHUN\nVISIT',
    'Yishun', 'Void deck of the block, by the lift lobby', 'A small snack to share and your volunteer lanyard', YISHUN_ABOUT],
  ['pantry', '2026-10-27', '17:00', '19:00', 'Evening pantry restock', 'harvest', 'central', 'food', 12, false, 'PANTRY\nRESTOCK',
    'Harvest Table community pantry, Toa Payoh', 'Pantry side door, next to the lift', 'Nothing; aprons are provided',
    'Restock the shelves of our community pantry after the evening delivery. Light lifting and sorting by expiry date.'],
  ['sort', '2026-10-28', '09:00', '12:00', 'Food pack sorting morning', 'harvest', 'central', 'food', 20, false, 'FOOD\nPACKS',
    'Harvest Table warehouse', 'Loading bay B, ask for the duty volunteer', 'Covered shoes and a water bottle',
    'Help us sort donated dry goods into family packs for the week’s deliveries. No experience needed; a team lead shows you the packing list. Standing for most of the shift.'],
  ['yishun', '2026-10-28', '14:00', '16:00', 'Befriending visit: Yishun seniors', 'silver', 'north', 'elderly', 10, true, 'YISHUN\nVISIT',
    'Yishun', 'Void deck of the block, by the lift lobby', 'A small snack to share and your volunteer lanyard', YISHUN_ABOUT],
  ['beach', '2026-10-31', '07:30', '10:00', 'East Coast beach clean-up', 'shore', 'east', 'environment', 60, false, 'BEACH\nCLEAN-UP',
    'East Coast Park, Area C', 'Carpark C1, by the bicycle rental', 'Hat, sunscreen and a reusable bottle. Gloves and bags are provided.',
    'A two-and-a-half-hour sweep of the shoreline. We weigh what we collect at the end and share the total with everyone who came.'],
  ['read', '2026-10-31', '10:00', '12:00', 'Saturday reading club', 'readers', 'west', 'education', 8, true, 'READING\nCLUB',
    'Jurong West community library room', 'Level 2 activity room', 'Nothing; books are provided',
    'Read one-to-one with children aged 7 to 10 for an hour, then play a short word game together.'],
  ['dogs', '2026-11-01', '09:00', '13:00', 'Shelter dog walking', 'paws', 'northeast', 'animals', 12, false, 'DOG\nWALKING',
    'Paws and Hearts shelter, Pasir Ris', 'Shelter front gate', 'Long trousers and closed shoes',
    'Walk and socialise shelter dogs with a handler. You are matched to a dog that suits your experience.'],
  ['trees', '2026-11-04', '18:00', '20:00', 'Tree planting on the green corridor', 'corridor', 'central', 'environment', 40, false, 'TREE\nPLANTING',
    'Rail Corridor, Bukit Timah stretch', 'The old railway station entrance', 'Gardening gloves if you have them, insect repellent',
    'Plant native saplings along a restored stretch of the corridor. Tools and saplings are provided.'],
  ['kids', '2026-11-07', '15:00', '17:00', 'Children’s craft afternoon', 'readers', 'west', 'children', 10, false, 'CRAFT\nAFTERNOON',
    'Jurong West community library room', 'Level 2 activity room', 'Nothing; materials are provided',
    'Help children make simple crafts and keep the table tidy. Good for first-time volunteers.'],
];

// The exact address for events with a hidden location, readable once a volunteer is approved.
const HIDDEN_VENUES = { yishun: 'Yishun Street 11, sample block', 'past-yishun': 'Yishun Street 11, sample block' };

// [key, name, follows]. Everyone signs in at name@example.com; uids are sample-<key>.
const PEOPLE = [
  ['aisha', 'Aisha Rahman', ['silver', 'shore']],
  ['ben', 'Ben Tan', ['harvest']],
  ['chloe', 'Chloe Lim', ['silver', 'readers']],
  ['darren', 'Darren Koh', ['shore']],
  ['esther', 'Esther Ng', ['silver', 'readers']],
  ['farid', 'Farid Aziz', ['corridor', 'shore']],
  ['grace', 'Grace Ong', ['silver', 'corridor']],
  ['hari', 'Hari Subramaniam', []],
  ['ivy', 'Ivy Chen', ['harvest', 'paws']],
  ['jun', 'Jun Wei', ['harvest', 'paws']],
  ['meilin', 'Mei Lin Tan', ['silver', 'shore', 'readers']],
];
const uidOf = (key) => `sample-${key}`;
// Same as shortName in js/data.js: "Aisha Rahman" shows as "Aisha R." in who's going.
const shortName = (name) => {
  const words = name.split(/\s+/);
  return `${(words.length >= 3 ? words.slice(0, -1) : words.slice(0, 1)).join(' ')} ${words.at(-1)[0]}.`;
};
const emailOf = (name) => `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
const nameOf = Object.fromEntries(PEOPLE.map(([key, name]) => [key, name]));

const REGISTRATIONS = {
  changi: { going: ['meilin', 'darren', 'farid'] },
  'past-yishun': { going: ['aisha', 'esther', 'meilin'] },
  pantry: { going: ['aisha', 'chloe', 'jun', 'meilin'] },
  sort: { going: ['ben', 'darren', 'esther', 'farid', 'grace', 'ivy'] },
  yishun: { going: ['aisha', 'ben', 'chloe', 'darren', 'esther', 'farid', 'grace'], pending: ['hari', 'ivy'] },
  beach: { going: ['aisha', 'darren', 'farid', 'hari', 'jun', 'meilin'] },
  read: { going: ['chloe', 'esther', 'grace'], pending: ['meilin'] },
  dogs: { going: ['ben', 'ivy', 'jun'] },
  trees: { going: ['farid', 'grace', 'hari'] },
  kids: {},
};

// Attendance at the past events: [event, person, status, check-in time].
// - Mei Lin checked in at the Changi clean-up but wasn't checked out: Home offers the canvas claim.
// - Farid's claim there was made 9 days ago, so it confirms itself the next time he opens the app.
// - Aisha checked in at the Yishun visit without checking out: her claim goes to Mei Lin.
// - Mei Lin's own hours there are confirmed (the first line of her hours record).
const ATTENDANCE = [
  ['changi', 'meilin', 'checked_in', '07:42'],
  ['changi', 'farid', 'claimed', '07:50'],
  ['past-yishun', 'aisha', 'checked_in', '13:52'],
  ['past-yishun', 'meilin', 'confirmed', null],
];

// Mei Lin's past hours, from the canvas hours record:
// [entry id, title, org, canvas day, hours, confirmed by, reference number, cover label].
const LEDGER = [
  ['past-yishun', 'Befriending visit: Yishun seniors', 'silver', '2026-10-14', 2, uidOf('meilin'), 482, 'YISHUN\nVISIT'],
  ['past-midautumn', 'Mid-Autumn visit: Ang Mo Kio', 'silver', '2026-09-27', 3, uidOf('meilin'), 483, 'MID-\nAUTUMN'],
  ['past-sort', 'Food pack sorting morning', 'harvest', '2026-09-26', 3, 'code', 484, 'FOOD\nPACKS'],
  ['past-grocery', 'Grocery run for homebound seniors', 'silver', '2026-09-06', 2, uidOf('meilin'), 485, 'GROCERY\nRUN'],
  ['past-reading', 'Reading club, four Saturdays', 'readers', '2026-08-29', 4, 'code', 486, 'READING\nCLUB'],
];

setLogLevel('error');
const [fsHost, fsPort] = FIRESTORE.split(':');
const testEnv = await initializeTestEnvironment({ projectId: PROJECT, firestore: { host: fsHost, port: Number(fsPort) } });
await testEnv.clearFirestore();

const written = {};
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const batch = writeBatch(db);
  const put = (path, data) => {
    batch.set(doc(db, path), { ...data, sample: true });
    const top = path.split('/').length > 2 ? path.split('/').slice(-2, -1)[0] : path.split('/')[0];
    written[top] = (written[top] || 0) + 1;
  };
  const stamps = { createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  // A sample announcement to the volunteers going to the Yishun visit, sent an hour ago (the unread dot on Home).
  const REMINDER_AT = Timestamp.fromMillis(Date.now() - 3600e3);

  for (const [id, o] of Object.entries(ORGS)) {
    put(`organisations/${id}`, {
      name: o.name, tagline: o.tagline, about: o.about, causes: o.causes, area: o.area, timezone: 'Asia/Singapore',
      logoColors: o.logoColors, givingUrl: `https://${o.website}/give`, email: o.email, address: o.address, website: o.website,
      status: 'approved', approvedAt: at(o.since), stats: o.stats,
      impact: o.impact.map(([title, line]) => ({ title, line })), createdBy: 'seed', ...stamps,
    });
  }
  put(`organisations/silver/members/${uidOf('meilin')}`, { uid: uidOf('meilin'), role: 'admin', name: 'Mei Lin Tan', addedAt: daysAgo(200) });

  for (const [id, day, start, end, title, org, area, cause, capacity, approval, label, venue, meetingPoint, bring, description] of EVENTS) {
    const regs = REGISTRATIONS[id];
    const nudge = toNamedWeekday(title, at(day, start));
    const startAt = Timestamp.fromMillis(at(day, start).toMillis() + nudge);
    const endAt = Timestamp.fromMillis(at(day, end).toMillis() + nudge);
    const hours = (endAt.toMillis() - startAt.toMillis()) / 3600e3;
    const attendance = ATTENDANCE.filter(([eventId]) => eventId === id);
    const by = org === 'silver' ? uidOf('meilin') : 'seed'; // who decided, checked in and confirmed
    // Registered (and approved) a few days before the event, or before today for events still to come.
    const before = (days) => Timestamp.fromMillis(Math.min(Date.now(), startAt.toMillis()) - days * DAY);
    put(`events/${id}`, {
      orgId: org, orgName: ORGS[org].name, title, description, cause, area, venue, meetingPoint, bring,
      startAt, endAt, hours,
      cover: { colors: ORGS[org].logoColors.slice(), label },
      visibility: 'public', status: 'scheduled',
      registration: { open: true, approval, capacity, waitlist: true, group: false },
      ticketTypes: [],
      counts: {
        going: (regs.going || []).length, pending: (regs.pending || []).length, waitlist: 0,
        attended: attendance.filter(([, , status]) => status === 'confirmed').length,
      },
      hideExactLocation: id in HIDDEN_VENUES, checkInMode: 'standard', checkInLocked: false,
      ...(id === 'yishun' ? { announcedAt: { going: REMINDER_AT } } : {}),
      createdBy: org === 'silver' ? uidOf('meilin') : 'seed', ...stamps,
    });
    put(`events/${id}/private/codes`, { checkIn: token(), checkOut: token(), rotatedAt: serverTimestamp() });
    if (HIDDEN_VENUES[id]) put(`events/${id}/private/location`, { venue: HIDDEN_VENUES[id] });
    if (id === 'yishun') {
      put(`events/${id}/announcements/sample-reminder`, {
        text: 'Please bring a water bottle. We meet at the void deck at 1:45 PM.', audience: 'going',
        by: uidOf('meilin'), byName: 'Mei Lin Tan', count: (regs.going || []).length, createdAt: REMINDER_AT,
      });
    }

    let n = 0;
    for (const status of ['going', 'pending']) {
      for (const key of regs[status] || []) {
        n += 1;
        const decided = approval && status === 'going' ? { decidedAt: before(n), decidedBy: by } : {};
        put(`events/${id}/registrations/${uidOf(key)}`, {
          uid: uidOf(key), name: nameOf[key], status, ticketTypeId: null, answers: {}, registeredAt: before(n + 1), ...decided, ...stamps,
        });
        if (status === 'going') put(`events/${id}/going/${uidOf(key)}`, { name: shortName(nameOf[key]), since: before(n + 1) });
      }
    }

    for (const [, key, status, time] of attendance) {
      put(`events/${id}/attendance/${uidOf(key)}`, {
        uid: uidOf(key), name: nameOf[key], status, hours, updatedAt: serverTimestamp(),
        ...(time ? { checkedInAt: Timestamp.fromMillis(at(day, time).toMillis() + nudge), checkedInBy: by } : {}),
        ...(status === 'claimed' ? { claimedAt: daysAgo(9), autoConfirmAt: daysAgo(2) } : {}),
        ...(status === 'confirmed' ? { checkedOutAt: endAt, checkedOutBy: by, confirmedAt: endAt, confirmedBy: by } : {}),
      });
    }
  }

  PEOPLE.forEach(([key, name, follows], i) => {
    const meilin = key === 'meilin';
    put(`users/${uidOf(key)}`, {
      name, email: emailOf(name), photoUrl: '', follows,
      bio: meilin ? 'Weekend volunteer, mostly with seniors and the occasional beach clean-up. Happy to pair up with first-timers.' : '',
      joinedAt: meilin ? at('2025-03-15') : daysAgo(40 + i * 23),
      ...(meilin ? { hoursTotal: LEDGER.reduce((sum, e) => sum + e[4], 0) } : {}), ...stamps,
    });
  });

  for (const [id, title, org, day, hours, confirmedBy, ref, label] of LEDGER) {
    const date = at(day, '10:00');
    put(`users/${uidOf('meilin')}/hours/${id}`, {
      eventId: id, eventTitle: title, orgId: org, orgName: ORGS[org].name, cover: { colors: ORGS[org].logoColors.slice(), label },
      date, hours, confirmedBy, confirmedAt: date,
      reference: `VN-${date.toDate().getUTCFullYear()}-${String(ref).padStart(5, '0')}`,
    });
  }

  await batch.commit();
});
await testEnv.cleanup();

// Sign-in accounts for the sample people, so each can sign in by email link in the emulator.
const res = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:batchCreate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ users: PEOPLE.map(([key, name]) => ({ localId: uidOf(key), email: emailOf(name), displayName: name, emailVerified: true })) }),
});
if (!res.ok) throw new Error(`Creating sample sign-in accounts failed: ${res.status} ${await res.text()}`);
const existing = ((await res.json()).error || []).length;

console.log('Sample data loaded into the emulator (Firestore was cleared first):');
for (const [what, count] of Object.entries(written)) console.log(`  ${what}: ${count}`);
console.log(`  sign-in accounts: ${PEOPLE.length - existing} created, ${existing} already there`);
console.log('Mei Lin Tan (Silver Companions admin) signs in as mei.lin.tan@example.com; volunteers as e.g. aisha.rahman@example.com.');
