# Progress

Running log for The Events. Newest session at the bottom. Each entry covers what was done, what was tested and what's next.

Work order: `QUEUE_1.md` (repo root), one slice at a time. Visual reference: `design/`, the approved canvas screens.

## Decisions to confirm

Choices made without Theersha's input, each tagged with the slice that made it.

- Slice 1: Commits in this repo use Theersha <theersha@gmail.com>, the email on the GitHub repo's first commits. The answer to the identity question was the repo link, so this was inferred.
- Slice 1: `.firebaserc` defaults to `demo-the-events`, and the live project appears only as the alias `live`. A stray `firebase` command therefore hits the emulator-only demo project.
- Slice 1: People who sign in by email link have no name until they set one on Profile (slice 5). Until then the app shows their email address.
- Slice 1: `hoursTotal` isn't written at first sign-in. A missing value counts as 0, and the hours slices add it.

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
