# The website (tonefy-ai.fitlifesolutions.site)

Moved verbatim out of CLAUDE.md on Oct 4 2026 to keep that file small. Facts here are a
record of when they were written; CLAUDE.md holds the current state.

## The website has no build check, and three pages were dead (Sep 17 2026)

**Three of the site's pages shipped inline scripts that did not PARSE**, and had for an
unknown length of time: `connect-accounts.html` (a stray `});`), `dashboard.html` (two
consts of the same name in one scope) and `edit-post-video.html` (a `showConfirm` callback
never closed). All three the same shape - an edit that wrapped code in a callback and left
the braces unbalanced.

**A script that does not parse does not run at all.** These were not pages with one broken
feature; they were pages where NOTHING happened - no auth redirect, no status load, no
buttons, no tabs. `connect-accounts.html` also called `showToast`, `showConfirm` and
`closeConfirm`, none of which was ever defined, with `closeConfirm` wired to an onclick in
the markup.

**Why it went unnoticed: the app has `expo export` and eslint; the website has nothing.**
It is hand-written HTML served straight by nginx, so a syntax error ships silently and
reads as a page that merely does nothing.

**Guard added: `scripts/check-website-js.py`** (in the APP repo, with the other guards,
since the website repo has no tooling of its own). Run it after any website edit:

```bash
python3 scripts/check-website-js.py          # defaults to /var/www/tonefy-ai
```

It checks TWO things, because parsing is not enough: every inline script must parse, AND
must not call a name nothing defines - a page whose script parses perfectly still throws on
first render if it calls a helper nobody wrote. The second check runs **eslint's own
`no-undef`**, not a regex: a hand-written identifier matcher reported five working pages as
broken (`async` arrows and destructuring from a dynamic import both defeat it), and a guard
that cries wolf is a guard nobody runs. It is told about two things these pages do
legitimately - `window.foo = ...` to expose a handler to an inline onclick, which creates a
global but declares no binding, and `tailwind` from a `<script src>`.

**It has paid for itself three times already**: it caught an unclosed `if` I introduced
while editing `profile.html`, a `LOGO` map referenced by a renderer after the edit meant to
add it silently failed, and - unprompted - `idea-to-video.html` calling `showToast` on five
error paths with the function defined nowhere, so a failed generation threw
`ReferenceError` instead of showing the message and left the button stuck loading.
Verified by breaking a page deliberately and confirming it is caught, not only by watching
it pass.

**Also fixed while in there:** the site's TikTok disconnect deleted the Firestore field and
stopped, leaving the token live at TikTok - the same gap item 41 closed in the app, still
open here. It calls `/tiktok/disconnect` now. And `connect-accounts.html` no longer writes
the connection record itself; the success page hands the server a single-use code and the
server writes the binding (see the client-written-record bug pattern).

**CLOSED Sep 17 2026: the site now carries all six platforms.** Connect Accounts and
Profile are generated from ONE table rather than six hand-written panels - which is how the
page fell three platforms behind in the first place - and both read the `/status` endpoints
rather than Firestore, so a token cleared server-side reports as disconnected instead of
showing a stale "Connected". `/api/tiktok/status` was added for this: TikTok was the only
platform where each client had its own idea of what connected meant. The homepage badges
for Facebook and Instagram now match the app; X keeps "coming soon", which is true - its
API charges for writes.

**Website Profile now matches the app's sections** but one: **Build** is genuinely
app-only, since it reports the OTA bundle and a website has no bundle. Plan & Credits,
Connected Accounts for all six, profile photo upload, Security and Admin are all there.

**2FA is TOTP, so it needs no reCAPTCHA** - that is only for phone/SMS MFA, and an earlier
estimate here said otherwise. **The login challenge has to exist BEFORE enrolment is
offered**: an account with 2FA on does not fail to sign in, it stops half way with
`auth/multi-factor-auth-required`, so a client that only knows how to enrol will lock its
user out with "Sign in failed". `login.html` handles the challenge; `profile.html` enrols.
The QR is drawn in the browser from the otpauth uri rather than fetched from a chart
service - that image IS the second factor, and posting it to a third party would be
handing the secret away.

**`/admin.html` is owner-only in the UI and 404 for everyone else at the API.** The uid
check on Profile and on the page decides whether it is DRAWN; `requireAdmin` against
`ADMIN_UIDS` is the real gate, and it answers **404 rather than 403**, which does not even
admit the endpoints exist. Verified with a fresh account.
**Its account list reads `rows`, not `users`** - the endpoint's own field name, and the
first version of the page read `.users` and would have shown an empty list. Everything else is there: Plan & Credits with the real
credits and reset date, the plan-ended row, Connected Accounts for all six, and profile
photo upload through the same `/api/profile-photo` the app posts to.

**The two admin screens are one screen in two places (Sep 18 2026).** They had drifted:
the app led with the email address and kept the real name only in a detail sheet - and
**23 of 24 accounts have a displayName**, so it was hiding the thing that identifies a
person. The website led with the name but showed less of everything else and could not
change anything. Both now draw the same two lines - name, then address + videos +
credits + country, with the address dropping off the second line when it IS the title -
the same three flags, and the same plan editor. `personLines()` in `AdminPeople.js`
builds both lines for the row AND its sheet, so those two cannot disagree either.

The website's Accounts list is now collapsed behind the same toggle the app uses and
**fetches nothing until it is opened** - listing accounts walks the whole auth list and
every `userVideos` document server-side. The count in the closed row comes from the
stats already on screen, so it can say how many there are without asking for any. Its
rows had carried `cursor:pointer` with no handler behind them, which is the website
version of a dead control.

**A headless browser is the check this page needed, and it is cheap.** The page was
rendered with snap chromium against the real API payload, with only the Firebase auth
and `fetch` stubbed so every drawing line is the real one - collapsed, expanded, and
with the sheet open. A second check greps `id="..."` against every `el('...')`, since a
typo'd id is `null` and a TypeError at runtime that nothing static sees. Note snap
chromium can only read and write under `$HOME`, not `/tmp`.

**Glyph paths for the website come from `fonts.gstatic.com/s/i/materialicons/<name>/v1/24px.svg`**,
not from memory - `scripts/website_icons.py` says so at the point it matters. Google
ships a transparent bounding-box `<path fill="none">` alongside the real one; drop it.
The app's equivalent rule is checking a name against the installed glyphmap: both exist
because a wrong icon renders as a shape rather than an error.

**Cards on the website wear the spinning gradient border** - CSS, a rotating conic
gradient behind an opaque panel inset by the border width, which is the same trick the app
plays with a spinning square. Same stops, same 4.2s, same reduced-motion behaviour.

**When this file's design skill and the app disagree, THE APP IS THE REFERENCE** (owner,
Sep 18 2026). That settled the tab-strip colour: green on both, and the skill was
corrected rather than the code.

**What is still NOT on the website, deliberately:** the timeline editor. It is built on
Reanimated worklets and gesture handlers that do not cross to the web, so it is a second
product rather than a port. The split to aim for is ACCOUNT parity - one login, one plan,
one set of connected accounts, one library - not feature parity.
