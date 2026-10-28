# Try it

How to run The Events on this computer with the sample data, and try each flow as a volunteer and as Mei Lin. Everything runs on the Firebase emulators, so nothing touches the live project and no email is sent.

## Start

1. Open two PowerShell windows in the project folder, `C:\Users\theer\OneDrive\Documents\The Event App`.
2. In the first window, start the emulators and leave them running:

   ```
   npm run emulators
   ```

   Wait until it says "All emulators ready".
3. In the second window, load the sample data, then start the website:

   ```
   npm run seed
   npm run serve
   ```

4. Open http://127.0.0.1:8000 in Edge or Chrome. For phone size, press F12, then Ctrl+Shift+M, and set the width to 390.

`npm run seed` resets everything to the starting sample data. Run it again whenever you want a fresh start; the website and the emulators can stay running.

## Sign in

1. Type one of the sample emails below and choose "Email me a sign-in link".
2. No email is sent. The sign-in link appears in the emulators window, after "To sign in as …, follow this link". It is also on the Logs page of the Emulator UI, http://127.0.0.1:4000/logs.
3. Copy the link and open it in the same browser window. You land on Home.

Sample people (all made up):

- Mei Lin Tan, admin of Silver Companions: `mei.lin.tan@example.com`
- Volunteers: `aisha.rahman`, `ben.tan`, `chloe.lim`, `darren.koh`, `esther.ng`, `farid.aziz`, `grace.ong`, `hari.subramaniam`, `ivy.chen` and `jun.wei`, each followed by `@example.com`

To be two people at once, for example Mei Lin and a volunteer, use a normal window for one and an InPrivate window (Ctrl+Shift+N) for the other.

## As a volunteer

Jun (`jun.wei@example.com`) starts with no registrations, so he's a good one to try.

- **Home**: your events, the shifts strip (drag it sideways), All events with the area filter, and My QR code.
- **Discover** and **Organisations**: search, browse by cause and area, and follow an organisation.
- **An event**:
  - Register for the food pack sorting morning.
  - Request to join the Yishun visit, which needs approval.
  - In the More menu: add to calendar, share the link, or cancel your registration.
- **Profile**: edit your name and bio, and open the Hours record.

## As Mei Lin

- **+ Event**: create an event. Change it later with Edit event in the event's More menu.
- **Volunteers**: on the Yishun visit, choose Manage, then Volunteers. Approve or decline requests, and mark people attended.
- **Check-in**:
  - Open the QR scanner and scan a volunteer's My QR code.
  - Choose Standard or Express, and lock the setting for staff.
  - Add staff by email. For example, add `ben.tan@example.com`; when Ben signs in, he can open Check-in for the Yishun visit.
- **Check-out and hours**: the event's check-out code (with Show full screen), Confirm all, or Confirm for one person.
  - A volunteer's scan of the check-out code confirms their hours only if they were checked in, and only from 30 minutes before the event ends until 3 hours after.
  - Any other scan sends a claim, which Mei Lin confirms or declines on the same page.
  - The sample events don't end at the time you're trying this, so scanning straight after checking in sends a claim.
- **Past events**: on Silver Companions' organisation page, Mei Lin sees its past events with the number of claims waiting. Each one opens that event's check-out page.
- **Access and registration**: Manage, then Access and registration.
  - Here she sets visibility, accepting registrations, volunteer spots and the waiting list, and ticket types.
  - Each ticket type has its own price (free, or paid on site), approval, spots and registration dates.
  - To see the waiting list move: set the Yishun visit to 7 spots, so it's full. Jun joins the waiting list, choosing a ticket type if there's more than one. When Aisha cancels, Jun moves up.
- **Registration questions**: Manage, then Registration questions. Tap Mobile number, Emergency contact or Age group to switch it between Off, Optional and Required, or add your own questions. Volunteers answer them in a sheet when they register. Mei Lin sees the answers when she taps a volunteer in the Volunteers list.
- **Cancel event**: Manage, then Cancel event.

**Scanning needs a camera.** On a laptop:

1. Show the code in the other window: the volunteer's My QR code, or Mei Lin's check-out code.
2. Take a photo of it with your phone.
3. Hold the phone up to the webcam.

Without a camera, use "Mark attendance by hand" and the Confirm buttons on the check-out page instead.

## Claims

The sample data includes two past events.

- **Aisha** (`aisha.rahman@example.com`) was checked in at last week's Yishun visit but not checked out.
  1. Her Home shows "Claim 2 hours for Befriending visit: Yishun seniors". She claims without a code.
  2. Her Hours record shows the claim waiting.
  3. Mei Lin confirms or declines it on that event's check-out page. To get there, she opens Silver Companions' organisation page and chooses the visit under Past events.
  4. After Mei Lin confirms, Aisha's Hours record shows the visit with a reference number.
- **Esther** (`esther.ng@example.com`) was going to the same visit but never checked in. Her claim waits for Mei Lin.
- **Mei Lin** has her own claim card on Home, for the Changi beach clean-up. This is the example drawn on the canvas.
- **Farid** (`farid.aziz@example.com`) claimed the Changi clean-up more than 7 days ago. His claim confirms itself as soon as he opens the app.

## Tests

The rules tests start their own emulators and clear the data:

1. Stop the emulators: press Ctrl+C in their window.
2. Run `npm test`.
3. Start the emulators again, then run `npm run seed`.

## Stop

Press Ctrl+C in each window.
