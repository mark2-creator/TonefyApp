# Social posting - platforms, history, checks

Moved verbatim out of CLAUDE.md on Oct 4 2026 to keep that file small. Facts here are a
record of when they were written; CLAUDE.md holds the current state.

## The Content Calendar, and why it looked empty (Sep 16 2026)

Reported as showing 0 Scheduled / 0 Posted / 0 This Month on an account with **33 posts**
in Firestore. Four independent app-side defects, each of which alone produces exactly that
screen, plus a fifth that made the feature unreachable. **The backend half was fine
throughout** - proven by creating a real queued post and watching the sweep publish it to
LinkedIn for real (`urn:li:ugcPost:…`, status `posted`, deleted afterwards).

**The diagnosis order is the lesson.** Before touching the screen, the same query was run
three ways: as admin (33 docs), as a client-authenticated REST query (33), and through the
**actual Firebase JS SDK the app uses** (33 — 17 posted, 16 failed). That eliminated data,
rules and the query itself in a few minutes and left only the screen. *When a screen shows
nothing, prove the data is reachable by the same path the app uses before reading a line of
the component.*

- **`const user = auth.currentUser` captured at first render.** Null while Firebase was
  still restoring the session, so `user.uid` threw, an empty `catch (e) {}` swallowed it,
  and a mount-only effect never retried. Read the uid **at call time**, and drive the load
  from `onAuthStateChanged` + a `focus` listener as well as mount.
- **Errors were swallowed**, so a failed read and an empty calendar looked identical - and
  that difference is the entire diagnosis. Same lesson as the filmstrip: an instrument is
  cheaper than a guess.
- **Dots and dates keyed on `scheduledFor`, which a post-now record does not have** (the
  server writes `postedAt`). Every posted item was `new Date(undefined)` - no dot ever
  appeared, and each card read "Invalid Date".
- **Anything not `'posted'` displayed as "Scheduled"**, so 16 FAILED posts sat there
  claiming they were still coming, while the server had written the reason onto each.

**The fifth, and the one that made scheduling pointless:** `saveToQueue` wrote
`platforms: tiktokConnected ? ['tiktok'] : []`. Scheduling is the only thing that section
offers which the per-platform rows do not, and it could target **only TikTok** - the one
platform that cannot post publicly yet. With TikTok not connected it wrote an empty array,
**and the sweep skips a post with no platforms**, so it stayed queued forever while the
Calendar called it pending. `postNow` had the same hardcoding. Both now act on every
connected platform and **refuse rather than write a post with nowhere to go**.

**Do not turn the per-platform rows into toggles.** Their comments say why: a toggle states
an intention whose action lived at the bottom of the screen, so flipping one appeared to do
nothing. They are one-tap Post buttons on purpose; the bottom section is for WHEN.

## Connecting a SECOND TikTok account is a two-trip journey, by TikTok's design

Two separate things had to be fixed here, and the second one cannot be fixed - only
explained. Worth keeping because both look like our bugs and only one was.

**1. TikTok skips its own authorisation page.** "Add another account" sent the user to
TikTok, which saw a valid session, silently re-authorised the account ALREADY connected,
and returned - and the success page said "Connected!". Straight from TikTok's Login Kit
docs for `/v2/auth/authorize/`: *"When set to 0, skips the authorization page for valid
sessions. When set to 1, always displays the authorization page."* Default is 0. Fixed by
sending **`disable_auto_auth=1`, but only when adding** - on a first connect there is
nothing to choose between and going straight through is the better experience. The
authorisation page matters because **it is the only place TikTok offers "Switch account"**.

**PROVEN Sep 16 2026: two real TikTok accounts connected** (`Fitlifesolutions.site` +
`Fitlifesolutions.blog`), both uid-bound with `video.publish` and live tokens, both listed
in the app with their own disconnect. **What finally worked was a full LOG OUT of TikTok in
the browser, not "Switch account"** - after that the second account went through first try.
Everything before it failed for one reason: the browser session kept resolving to the
account already connected, so TikTok authorised that one no matter what the switch UI
appeared to do.

**The diagnosis lesson here is worth more than the fix.** Four rounds went by with the
symptom reported as "the app only shows 1 account" and the app was correct every time -
the server logs settled it in seconds each round: the last `/tiktok/callback` was hours
old, or it carried the SAME openId. **When a client reports a missing record, check
whether the write was ever attempted before looking at the read.** Three separate
non-bugs were ruled out this way (the list rendering, the cap, the plan) without touching
any of them.

**2. "Switch account" loses the OAuth request, and that is TikTok's to own.** Tapping it
goes to `tiktok.com/login`, and after signing in the user lands on the **For You feed** -
not back at the consent screen. The documented authorize parameters are `client_key`,
`scope`, `response_type`, `redirect_uri`, `state` and `disable_auto_auth`; none of them
survives a detour through login. So the real flow is: switch account → get left on
TikTok's feed → return to Tonefy → tap "Add another account" AGAIN, which now authorises
as the newly signed-in account. **The app says this before opening the browser**, because
being dumped on TikTok's feed reads as failure when in fact the switch worked and only
the second trip is missing.

**Two traps from implementing it**, both invisible to lint and to `expo export`:
- **`onPress={fn}` hands the press EVENT to the first parameter.** `connectTikTok(adding
  = false)` wired as `onPress={connectTikTok}` receives a truthy event object, so a FIRST
  connect would have taken the add path. Wrap every call site in an arrow function when
  the handler takes arguments.
- **`showAlert` dismisses on a backdrop tap and the back button without running any
  button's `onPress`.** Awaiting a promise that only its buttons resolve therefore hangs
  forever on a dismissal. Pass `{ cancelable: false }` whenever the sheet's outcome is
  awaited.

## Posting was free through the legacy TikTok route (fixed Sep 17 2026)

`/api/post-now` has charged for posting since Sep 14. **`/tiktok/post-video` - the older
single-platform route - never did.** It checked the token, the ownership and the media
host, and skipped the plan entirely, so posting to TikTok was free for anyone who called
it. **The WEBSITE called it by default**, which is how a paywalled feature was being given
away on one of the two clients. Gated now, failing OPEN on a lookup error to match
post-now.

**The general shape: a second route to the same capability is a second place the rule has
to be written.** Same reason the TikTok ownership check now lives inside `publishToTikTok`
rather than in each of the three callers.

**The website's Edit & Post now uses `/api/post-now` like the app**, so the plan check, the
per-account ownership check and the server-side record all apply. It used to let the
CLIENT write the "posted" record after calling the legacy route - so a post that failed
could still be written down as posted. Its platform switches now CHOOSE where a post goes;
they used to connect and disconnect the account, so turning a platform off disconnected it.

## Social posting: the chain is built, TikTok is in sandbox

Everything from connect to publish now works and was built Aug 21 2026 - but **the
TikTok credentials are sandbox-only and the Content Posting API has not been applied
for**, so a real post cannot succeed yet. Do not spend time debugging a failed publish
against that; it is the app registration, not the code.

```
connect TikTok      tokens persisted in Firestore (see below)
post now            verifyToken + ownership check + own-host-only videoUrl
save to queue       scheduledPostSweep publishes due items every 5 minutes
schedule for later  day within 14 days + quarter-hour, chips not a native picker
failures            written back onto the post with the reason
```

Three fixes underneath it, each of which had to come before the one after:

- **`tiktokTokens` was a plain in-memory `{}`**, so every `pm2 restart` disconnected
  every account - silently, because the "Connected" badge reads `connectedAccounts`
  which the client writes and which survives. Now `tiktokTokens/{openId}` in Firestore,
  its own collection rather than `connectedAccounts/{uid}` because that document is
  readable by its owner and these are bearer credentials. **No security rule mentions
  that path, and Firestore denies where no rule matches**, so it is Admin-SDK-only by
  construction.
- **`/tiktok/post-video` was unauthenticated and did `fetch(videoUrl)` on a client
  string.** Anyone could post to any account whose openId they knew (an openId is not a
  secret), and anyone could make this box fetch any address - `127.0.0.1:5000` and the
  cloud metadata endpoint included, on a VPS running five other pm2 services. Now
  `verifyToken` inline, an ownership check against `connectedAccounts/{uid}`, and
  `videoUrl` restricted to https on this host under `/videos` or `/uploads`. The
  ownership lookup fails CLOSED - unlike the plan checks, being wrong here posts to a
  stranger's account.
- **Nothing read `scheduledPosts`.** "Add to queue" wrote a document, said "Added to
  queue!", and the post was never sent while the Calendar listed it as pending.

`publishToTikTok` is a function the route and the sweep both call, deliberately - two
implementations of "send this to TikTok" drift the first time one gets a fix.

## Social platforms: who can actually use each one (Sep 27 2026)

`/api/platforms` reports all six `enabled: true`, and **that only means CONFIGURED on the
server** - it says nothing about whether a stranger can connect. The gates are per
platform and they are what this table is for. Real publish counts are from
`scheduledPosts`.

| Platform | Usable by any user? | Gate | Proof |
|---|---|---|---|
| **TikTok** | **YES** | none - production app, Direct Post audit approved Sep 24 | 16 posted; on-device Sep 27 |
| **Pinterest** | **YES** | none - Standard access approved Sep 24 | 1 posted (created + deleted) |
| **LinkedIn** | **YES** | none - both products are self-serve, no review | 2 posted |
| **YouTube** | **capped** | OAuth app unverified (warning screen + 100-user cap); API compliance review OPEN since Sep 9 | 7 posted |
| **Facebook** | **NO** | Meta dev mode - admins/testers only. Business Verification blocked on URSB | Page upload proven directly (unpublished, deleted) |
| **Instagram** | **NO** | same Meta gate, plus the account must be Professional | Reels container reached FINISHED; publish deliberately skipped |
| **X** | not built | API charges for video writes (~$100/mo) | - |

**So: 3 fully live, 1 working but capped, 2 waiting on URSB, 1 deferred.**

**URSB blocks exactly two platforms, not the roadmap.** Meta's Business Verification wants
a document in a business's legal name, which is what the URSB registration would provide
(item 44). It does NOT gate TikTok, Pinterest, LinkedIn or YouTube - those cleared on
their own reviews, none of which asked for a business registration.

**The honest caveat on all six: every test used the OWNER's own accounts.** The approvals
for TikTok and Pinterest and LinkedIn's self-serve products are app-level, so they should
hold for anyone, but no second real user has connected and posted. The first outside user
to try is still the real test.

**A failed count in that table is not a broken platform** - Pinterest's 6 failures are
mostly the under-4-second refusals and the Trial-access period before Sep 24, and TikTok's
7 include the sandbox era and the spam-risk window.

## FitLife now posts through Tonefy's Pinterest and LinkedIn grants (Sep 29 2026)

FitLife's `~/social-publish.py` reads the OWNER's tokens from `pinterestTokens/{uid}` and
`linkedinTokens/{uid}` (uid `sWyTCf...`, accounts `chirlieanderson` and `dYU1_OASCN`) with
this backend's service account, and may refresh the Pinterest one in the same shape
`pinValidToken` writes. Details live in `~/fitlife/CLAUDE.md`. **What it means here:**
disconnecting either account in the app, renaming those collections, or changing the
per-account map shape silently stops FitLife's posting - it alerts on Telegram, but check
that script before reshaping the token store.

Two Tonefy-side findings from building it:

- **Pinterest blocks the whole `fitlifesolutions.site` domain as spam, `tonefy-ai.`
  included** - a pin linking to it answers HTTP 429, code 9, "may lead to spam". Tonefy's
  own publisher sends no `link`, so app posting is unaffected; what is affected is ever
  pinning the Tonefy website. The appeal is the owner's to file.
- **`publishToLinkedIn` sends `commentary` unescaped.** It is LinkedIn "little text", where
  `( ) [ ] { } < > @ | # * _ ~ \` are syntax, so a user caption containing a parenthesis
  or a hashtag is cut off at that character or refused. FitLife escapes them
  (`li_escape`); the backend does not yet. Small fix, needs a `pm2 restart`.

## Owner's three-platform post, checked Oct 3 2026: all three LANDED, two had no words

One video posted from Edit & Post to TikTok, YouTube and Pinterest, ~15:07 UTC. Every record is
`posted` with a publish id, no errors.
- **TikTok:** direct post (`v_pub_file~`), with the caption typed into the TikTok sheet. Fine.
- **YouTube (`_WLA500ezZE`): uploaded, and PRIVATE - which is Google's rule, not a fault.** The
  watch page answers `LOGIN_REQUIRED` / "Private video". Until the YouTube API Services audit (open
  since Sep 9) passes, every `videos.insert` from the project is forced private whatever is requested;
  `publishToYouTube` defaults to private for exactly that reason, and the app's success sheet already
  says "on your channel as a private video while our YouTube app is under review".
- **Pinterest (`1043216701211408060`): LIVE and public**, a 10s video pin on the public board
  "Fitness & Workouts". The board is NOT chosen by anyone - `publishToPinterest` takes the first board
  `/v5/boards?page_size=1` returns.
- **The real defect: YouTube was titled "Untitled" and the pin "Tonefy video", both with empty
  descriptions.** The TikTok sheet has its OWN caption field; the Edit & Post screen's caption box,
  which YouTube/Pinterest use, was still empty - so the owner wrote his words once and only TikTok got
  them. And the server's fallbacks (`'Untitled'` for YouTube, `'Tonefy video'` for Pinterest and
  LinkedIn) published words the user never wrote - our brand name on his pin, the exact shape the
  TikTok "Created with Tonefy AI" fix removed on Sep 27.
- Debugging note: the Pinterest token field is `accounts[id].token`, not `accessToken` - reading the
  wrong field gives a 401 that looks like a dead connection.
- **FIXED the same day (owner approved fixes 1-3):**
  1. **Write once:** a caption typed in the TikTok sheet fills the Edit & Post caption box when that is
     empty (never overwrites one already written), so the YouTube/Pinterest posts that follow carry it.
  2. **No title-less posts:** `needsCaption()` in `EditPostVideoScreen` - posting, Post Now and Save to
     queue to YouTube, Pinterest or LinkedIn with an empty caption now asks for one. Those three show the
     caption as the post's TITLE; TikTok/Facebook/Instagram show none and stay optional.
  3. **No invented titles server-side:** Pinterest's `title`/`description` and LinkedIn's media `title`
     are omitted when the caption is empty instead of "Tonefy video". Verified on Pinterest with a real
     captionless pin through the live `/api/post-now` (title came back `""`), then deleted (204 -> 404)
     with its scheduledPosts record. **LinkedIn: confirmed by the owner's own real post at 15:42 UTC**,
     made with an empty caption on the fixed server (restarted ~15:22): accepted
     (`urn:li:ugcPost:7512175336672079873`), and its public page plays the video at 360/640/720p. Note
     the API cannot read it back - `GET /rest/posts` answers 403 because the app holds only
     `w_member_social`, by design - so check LinkedIn posts through the public
     `linkedin.com/feed/update/<urn>/` page instead. YouTube keeps
     `'Untitled'` server-side only as a last resort, since the API rejects an empty title; the app now
     prevents reaching it.
  App update `0e2837cc-8ac6-4442-ae4b-55f75a6ab44f`.
- **Pinterest board picker - BUILT Oct 3 2026.** `GET /api/pinterest/boards` lists every connected
  account's boards (per ACCOUNT - a board id only works with its own account's token; paginated, 250
  cap). post-now and the scheduled sweep pass `{ pinterest: { boards: { accountId: boardId } } }`
  (`cleanPinterestOptions` keeps only numeric ids) to `publishToPinterest`, which reads the chosen
  board back with that account's token and **refuses a board that is gone rather than posting
  elsewhere**; no choice keeps the old first-board behaviour, so older clients and older queued posts
  are unchanged. App: `components/PinterestBoardSheet.js`, opened by the Pinterest row's Post after
  the plan/connection/caption checks; remembers the last board per account in AsyncStorage
  (`tonefy.pinterestBoards`), which Post Now and Save to queue also send; the row shows the board.
  The sheet CLOSES before posting so the result alert is never hidden under a Modal. Verified: board
  list (9 boards), a Pin onto the non-first board "Weight Loss Journey" (confirmed by board_id, then
  deleted), a foreign board id refused, and a client-side `scheduledPosts` write carrying the
  `pinterest` field allowed by the rules. App update `c2dd5190-85a0-41e8-95dd-401e205f19c0`.

## Post analytics: possible, but every platform gates it behind a scope we lack

Asked Sep 27 2026 - best time to post, which video performed, follower growth. **The
answer is yes in principle and NOT with the permissions this app holds**, and that was
established by calling the endpoints rather than reading docs:

```
scopes held: user.info.basic, video.publish, video.upload
POST /v2/video/list/   (per-video views/likes/comments) -> 401 scope_not_authorized
GET  /v2/user/info/    (follower_count, likes_count)    -> 401 scope_not_authorized
```

**TikTok needs `video.list` and the stats fields of `user.info`.** Both are ordinary Login
Kit scopes, but adding a scope to an approved app means **another review AND every
connected account reconnecting** - a granted scope is not retroactive, so all existing
tokens keep the old grant. The same trap YouTube's `channels.list` already sits in.

**Every other platform is worse, not better:**
- **YouTube** needs `yt-analytics.readonly`; the app requests only `youtube.upload`, and
  the API Services compliance review is OPEN. Do not touch the scopes mid-review.
- **Meta** insights need further permissions on top of an app still in dev mode.
- **Pinterest** has per-pin analytics behind a scope not requested.
- **LinkedIn** member-post analytics are essentially unavailable without the Community
  Management API.

**What needs NO new scope is our own first-party record** - what was posted, when, to
which platform and account, from which video. `scheduledPosts` already carries most of
it. That supports "what you posted and how consistently", and cannot support views,
likes or best-time-to-post, because we never see those numbers.

**And the honest statistical point**: 34 posts in 30 days is far too few for a
best-time-to-post claim to mean anything - it needs dozens of posts per slot before the
signal beats the noise. TikTok's own Creator tools already give the user this for a
Business account, accurately, today.

**Recommendation recorded: do not add scopes while reviews are in flight.** Three are
(YouTube open, Meta blocked on URSB, TikTok Direct Post approved only Sep 24). The cheap
move meanwhile is to keep recording post metadata richly so there is history to join
against the day the scopes land.
