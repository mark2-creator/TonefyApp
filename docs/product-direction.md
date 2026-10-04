# Product direction (stated by the owner)

Moved verbatim out of CLAUDE.md on Oct 4 2026 to keep that file small. Facts here are a
record of when they were written; CLAUDE.md holds the current state.

## Product direction (stated by the owner, not derivable from the code)

- **Social posting is one of the reasons Tonefy exists**, not a side feature. **DONE as of
  Sep 14 2026:** six platforms are wired - TikTok, YouTube, Facebook, Instagram, Pinterest,
  LinkedIn (X deferred, paid API) - with connect cards, Post rows and Profile status, all
  using official `BrandLogos`. **And posting is now a paid benefit, enforced (owner decision
  Sep 14 2026):** `/api/post-now` AND the scheduled sweep refuse a `free` plan (403 /
  fail-the-post) via `getUserPlanData`, and the app shows a diamond + "Pro" and an upgrade
  prompt on every Post button + "Post Now" + "Save to queue" (`isPremium` from `usePlan`).
  Free accounts can create/edit videos and CONNECT accounts, but not post/schedule. Fail
  OPEN on a plan-lookup error (treat as paid), matching the render endpoints. The legal docs
  were updated the same day (`tonefy-website`): privacy 2.3 covers all six platforms + token
  storage/deletion, terms 4.7 covers Meta/Pinterest/LinkedIn, terms 7.1 states posting is a
  Pro/Creator feature. So this bullet's old "nothing in tiers.js reflects this yet" is
  RESOLVED - posting is gated, though it's gated in the post routes, not as a `tiers.js` cap.
- **MULTIPLE ACCOUNTS PER PLATFORM (Pro/Creator differentiator, in progress Sep 15 2026).**
  Owner-approved plan: **connect cap `ACCOUNT_CAPS = {free:1, pro:1, creator:5}`** per
  platform (connecting a 1st account is allowed on any plan so free can link + upgrade to
  post; a 2nd per platform is the Creator perk). **Architecture** (backend, low-blast-radius):
  `connectedAccounts/{uid}.{platform}` moves from a single object to an ARRAY of
  `{accountId,label,connectedAt}`, read via the tolerant `accountsArray()` (handles old
  object OR new array); tokens for the uid-keyed platforms move into a MAP inside the same
  doc, `{platform}Tokens/{uid}.accounts[accountId]` (no doc-key migration; TikTok already
  per-openId). A publisher opts in with `multiAccount:true` + `listAccounts()`; `/api/post-now`
  and the sweep publish to each chosen (or all) account for those, while non-multi platforms
  keep the exact single `accountFrom()` path - so platforms convert one at a time without
  risking the others. Helpers: `appendPlatformAccount` (dedupe), `canAddPlatformAccount`
  (cap gate). **DONE end to end: LinkedIn, Instagram, Facebook, Pinterest and TikTok**
  (backend + app UI: ConnectAccounts lists accounts with per-account disconnect +
  "Add another"/Creator-gate, Profile shows "N accounts", Edit&Post names the count and
  posts to all by default), each verified against the real API with the owner's own
  account migrated. An account PICKER on Edit&Post (choose which of several to post to)
  is a deferred nice-to-have; today it posts to all connected.

  **YouTube is the one that CANNOT be converted, and this is settled rather than pending.**
  It has no account identity we can read: the app requests only `youtube.upload`, and
  `channels.list(mine:true)` answers **"Request had insufficient authentication scopes"** -
  checked against the live API with the owner's real refresh token, which also reports its
  granted scope as exactly `youtube.upload`. That is why `connectedAccounts.youtube` has
  carried `channelId: null, channelTitle: null` since it was connected. **Do not key
  YouTube on channelId** - a working connection has none, and the sweep would declare it
  dead. Converting anyway would key every account on one placeholder, which is what the
  single-account path already does, so it would buy nothing. The unblock is a scope
  (`youtube.readonly`), and that means re-running the Google API Services audit currently
  in progress with a deliberately minimal single scope - an external cost, not a code one.
  Same shape of reason as TikTok's, and the same conclusion: wait for the review.

  **Facebook is the one platform where ONE grant yields MANY accounts.** An account there
  is a PAGE, and Meta's own permission dialog is where the user picks which Pages to share
  - so `metaFetchPage` taking only the first was discarding a deliberate choice.
  `metaFetchPages` reads them all and the callback adds them one at a time, **re-checking
  the cap per Page** because each append changes what the next check is measured against;
  a partial add is a success with a note on `facebook-success.html`
  (`?accounts=…&notice=account_limit`), not a failure. **Revoking is per Facebook USER, not
  per Page** - `DELETE /me/permissions` drops the whole grant - so removing one Page of
  three only revokes once no remaining Page still relies on that same user token.

  **Pinterest had no readable id either, and got solved rather than deferred.**
  `/v5/user_account` needs `user_accounts:read`, which this app does not request (and
  adding a scope mid-review for Standard access, forcing everyone to reconnect, is the
  same bad trade YouTube's would be). But **`/v5/boards` carries `owner.username` under
  `boards:read`, which we DO hold** - so the username comes from there. Worth knowing
  generally: *when the obvious identity endpoint is out of scope, look for the identity
  riding on an endpoint you can already call.* An account with no boards has no owner to
  report; it is held under a `'default'` key and upgraded in place once a name is
  readable, rather than counting as a second account the cap would refuse.

  **Two traps that bit during these conversions, both worth checking on the next one:**
  - **The token REFRESH writes to the document root.** Pinterest's did. Left alone it
    resurrects a flat token beside the accounts map and nothing refreshes the one being
    read. It must write into the account's own entry, and the callback should clear the
    flat fields as it migrates.
  - **`accountsArray` has to know the platform's id field.** It dug for every id except a
    username, so a legacy Pinterest record read as ZERO accounts - the owner's existing
    connection would have shown as disconnected. Caught by running the deployed reader
    against the real record before shipping. **Run the tolerant reader against live data,
    not just against a fixture.**

  **Each conversion has a stale-truthiness trap on the READING side.** `!!acc.facebook` is
  true for an emptied array, so ProfileScreen would have kept saying "Connected" after the
  last Page was removed. Whenever a platform converts, grep every reader of
  `acc.{platform}` for a bare truthiness test, not just the writers.

  **The discriminating test for "is the multiAccount branch actually live"**: post with an
  `accounts: { <platform>: ['bogus-id'] }` selection. The multi path filters to empty and
  refuses; the single path ignores the selection entirely and posts for real. Non-destructive
  and it cannot pass by accident.

  **Facebook is the one platform where ONE grant yields MANY accounts**, and that shaped
  its slice. An account here is a PAGE, and Meta's own permission dialog is where the user
  picks which Pages to share - so `metaFetchPage` taking only the first was discarding a
  deliberate choice. `metaFetchPages` reads them all and the callback adds them one at a
  time, **re-checking the cap per Page** because each append changes what the next check is
  measured against; a partial add is a success with a note on `facebook-success.html`
  (`?accounts=…&notice=account_limit`), not a failure. **Revoking is per Facebook USER, not
  per Page** - `DELETE /me/permissions` drops the whole grant - so removing one Page of
  three only revokes once no remaining Page still relies on that same user token. Getting
  that backwards would silently kill the other two.

  **Each conversion has a stale-truthiness trap on the READING side.** `!!acc.facebook` is
  true for an emptied array, so ProfileScreen would have kept saying "Connected" after the
  last Page was removed. Whenever a platform converts, grep every reader of
  `acc.{platform}` for a bare truthiness test, not just the writers.

  **The discriminating test for "is the multiAccount branch actually live"**: post with an
  `accounts: { <platform>: ['bogus-id'] }` selection. The multi path filters to empty and
  refuses; the single path ignores the selection entirely and posts for real. Non-destructive
  and it cannot pass by accident.
- **The editor's toolbar is a roadmap and stays that way.** 75 tools are defined,
  ~20 built; the rest fall through to "Coming soon" via `toolTapAction`. **Do not remove
  the unbuilt ones** - the stated intent is to reach CapCut-level breadth and build them
  one at a time as revenue allows. Build order is by what costs nothing to run: the
  ffmpeg-native tools first, since this box already has every filter they need
  (`vidstabdetect`/`vidstabtransform`, `minterpolate`, `tmix`, `chromakey`/`despill`,
  `afftdn`/`atadenoise`, `reverse`/`areverse`, `eq`, `unsharp`, `deshake` - all verified
  present Aug 16 2026). Roughly half the unbuilt toolbar is labour, not spend.
- **Genuinely-AI tools are a later, separately-funded tier.** BG Remover, AI remove/expand,
  Eye contact, Lip sync, Retouch, Relight, Auto reframe and voice isolation need real
  models. **Google is the wrong provider for most of them** - Gemini understands video but
  cannot segment, inpaint or lip-sync, and Veo generates video rather than editing yours.
  Veo is also unviable at current pricing: $0.10/sec (Fast 720p) is **$6/minute against
  $0.117/minute of Pro revenue**, ~51x. If Veo is ever offered it has to be a separately
  priced add-on, never bundled into credits.
- ~~**Video Translator is the cheapest big win available** and is not built~~ — **BUILT
  Aug 16 2026, see item 33.** `/api/translate-video` (job-based, 14 languages) plus the
  `translate` toolbar tool. Leaving the old wording here unstruck cost a session: it was
  read as current and Video Translator was recommended as the next thing to build, to
  the person who had already paid for it being built. **A roadmap line is stale the
  moment the thing ships — strike it in the same commit, do not rely on a later item
  contradicting it.** Still unverified on a device.
