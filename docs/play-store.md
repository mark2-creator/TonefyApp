# Play Store - listing, ratings, builds, RTDN, pricing

Moved verbatim out of CLAUDE.md on Oct 4 2026 to keep that file small. Facts here are a
record of when they were written; CLAUDE.md holds the current state.

## Play RTDN (Real-time Developer Notifications) - live Sep 16 2026

Play does not POST to us. It publishes into a **Cloud Pub/Sub topic we own**, and Pub/Sub
pushes to our URL. The queue is the point: it retries while this box is down, so a deploy
cannot lose a cancellation.

```
Google Play → projects/gen-lang-client-0229110424/topics/play-rtdn
            → subscription play-rtdn-push
            → POST https://api.fitlifesolutions.site/play-notifications?key=<RTDN_VERIFY_TOKEN>
```

- **The endpoint is OUTSIDE `/api`**, like the OAuth callbacks, because everything under
  `/api` is behind `verifyToken` and Pub/Sub has no Firebase token to present. It
  authenticates with a shared secret in the query string (`RTDN_VERIFY_TOKEN` in `.env`,
  gitignored), compared with `timingSafeEqual`. **With no secret set the route refuses
  everything** rather than accepting anonymous posts that move people's plans around.
- **THE PAYLOAD IS NOT TRUSTED, and this is the design.** Pub/Sub is at-least-once and
  unordered: the same message arrives twice, and a RENEWED can land after the EXPIRED that
  followed it. Only the `purchaseToken` is read; the state comes from asking Play through
  `applyPlayVerdict`, the same function the sweep uses. **RTDN is a TRIGGER for a check
  that already exists, not a second implementation of it** - which is also what makes a
  replay harmless, since asking Play twice gives the same answer twice.
- **It acks BEFORE doing the work.** A Play lookup plus a Firestore write outlasts Pub/Sub's
  ack deadline, so a slow-but-fine run would be redelivered as though it had failed.
- **A voided purchase (refund/chargeback) is decided locally**, because Play has no
  `subscriptionsv2` state for one. That is the single case where waiting six hours is a
  real loss rather than a courtesy.

**The verdict has to go BOTH ways, and this was a genuine one-way door before.** Reacting
to `ON_HOLD` is only safe if recovery restores the plan - and nothing could have: the sweep
reads `plan in [pro, creator]`, so it can never see an account it has already set to free.
A recovered subscriber would have stayed on free forever. `applyPlayVerdict` restores, and
the sweep gained a second query (`subscriptionStatus == 'expired'`) so the backstop covers
recovery too. **Restoring only ever undoes what WE did** - it requires the expired marker,
so a plan set by hand in the console is never touched by Play's opinion.

**Setup, and the step that silently fails.** The topic needs
`google-play-developer-notifications@system.gserviceaccount.com` granted **Publisher on the
topic itself**. Miss it and nothing ever arrives, with no error anywhere. The Firebase
admin service account has **no project-level permissions** (it could not even read whether
an API was enabled), so the owner granted it **Pub/Sub Admin** temporarily, the topic /
binding / push subscription were created by script, and the role was **revoked afterwards**
- confirmed revoked, and confirmed that Firestore, Auth and token signing still work.
Nothing in the running system needs it: Play publishes, Pub/Sub pushes, and the endpoint
only reads. **Domain verification was NOT required** for the push endpoint.

Note the Cloud project's **display name is "Openclaw"** while its id is
`gen-lang-client-0229110424` (number 527163602306) - the Console says Openclaw, which looks
like the wrong project and is not.

Play Console → Monetise with Play → Monetisation setup → Real-time developer notifications
holds the topic name, with **"Subscriptions and voided purchases only"** selected, matching
exactly what the handler covers.

**Proven end to end**, not reasoned about: a real "Send test notification" from Play Console
arrived and was understood (`[RTDN] test notification received - the pipe works`,
09:29:35Z). Before that, against the deployed endpoint with a real expired purchase token:
unauthenticated and wrong-secret posts refused 403, EXPIRED downgraded creator→free with
credits clamped 300→10, the same message replayed changed nothing, an unknown token was a
no-op, and a voided purchase took a pro account back.

## "Is the fix actually on the phone?" - Profile → Build answers it

`ProfileScreen` has a **Build** section reporting `Updates.isEmbeddedLaunch`, channel,
runtime and the update's publish time. Added Aug 18 2026 after the question was
answered by inference three times and was wrong at least twice - once as a "grey
screen" that was a stale bundle (item 29), and again during the filmstrip hunt above,
where a correct "still broken" report was about a build that did not contain the fix.

**Check it before diagnosing any device report.** "Original install (no update
applied)" means no OTA has ever been applied and the bundle is whatever shipped in the
APK.

**`App.js` checks for updates in a mount-only effect**, so resuming from background
never re-checks - only a cold start does. And on a slow connection `fetchUpdateAsync`
can fail silently, leaving the app looking current when it is not. Both matter for
this project's testers, who are largely on Ugandan mobile data. Still unaddressed:
there is no "downloading update" state, and `reloadAsync()` is called mid-session,
which can restart the app under someone who is editing.

## Play Store discovery / ASO (Sep 25 2026)

Reported as "not being discovered, very few impressions". Diagnosed against the live
listing through the Play Developer API rather than from the Console screenshots.

**The single biggest fault was the title: `"Tonefy AI"` - 9 of 30 characters, and not
one word anybody searches for.** Title is the heaviest-weighted field Play indexes, and
the app was spending it entirely on a brand nobody knows yet. Now
**`"Tonefy AI: AI Video Generator"`** (29/30).

Also fixed the same day, all through `edits.listings.update`:
- **Short description** rewritten to carry the terms with real intent behind them:
  `"AI video maker: script to video, auto captions, voiceover & post to TikTok"` (74/80).
- **Full description** 970 -> 2505 chars. The old one **never mentioned social posting**,
  which is both the app's clearest differentiator against CapCut and a whole keyword
  surface that was simply absent.
- **`en-US` added.** The listing existed in `en-GB` ONLY, and every locale is its own
  search index.

**Accuracy matters more than keywords here.** The description names TikTok, YouTube,
Pinterest and LinkedIn as working and Facebook/Instagram as "on the way", because Meta is
still in dev mode pending Business Verification (item 44) - a store listing claiming a
feature a new user cannot use earns one-star reviews, which costs more than the keyword
gains.

**The listing was backed up first** to `~/ytshots/play-listing-backup-2026-09-25.json`
(not the scratchpad, which a reboot wipes).

**Checked and found already CORRECT - do not re-diagnose these:** the category is
`VIDEO_PLAYERS` (Video Players & Editors), production is live at versionCode 12 with all
countries targeted, and the public listing returns 200. An early read of the page HTML
appeared to say the category was "Tools"; that was a false positive from elsewhere in the
markup, and the structured data says `applicationCategory: VIDEO_PLAYERS`. **Grep the
structured data, not the whole page.**

**A rating left from a TESTING TRACK is private feedback and never becomes a public
star** (seen Sep 26 2026: the owner's own 5-star shows on his device under "Your private
feedback", while `reviews.list` reports zero). That is the actual reason the public rating
is 0, and it has a consequence for `utils/rateApp.js`: **anyone installed via the internal
or closed track who taps Rate leaves feedback that cannot move the public rating.** Public
stars only come from installs off the PUBLIC production listing. Worth considering moving
real users off the testing tracks now that production is live - Play serves a tester the
highest-priority track they are opted into (item 29), so they also see a
"(Internal Beta)" title suffix and a red "may be unsecure or unstable" banner that a real
user never sees. **The public listing itself is clean** - verified by fetching it: title
`Tonefy AI: AI Video Generator`, no beta label, new description live.

**Oct 3 2026: why it was STILL zero - nobody was ever asked.** `recordWinAndMaybeAsk()` had exactly
ONE call site, after a successful social POST in `EditPostVideoScreen` - and posting is a paid feature
with 0 paying subscribers, so not one real user has ever seen the prompt. Also confirmed via the API:
0 reviews, and `internal` + `alpha` tracks are still live on vc12 beside production, so anyone still
enrolled as a tester rates PRIVATELY (the testers.get API returns `{}` - the list lives in Console email
lists it cannot read). Plan proposed to the owner: call the prompt on free-tier successes, testers leave
the programme via `play.google.com/apps/testing/<pkg>`, honest direct asks (no incentives, no
review-gating - both are Play policy violations), the owner NOT rating his own app, and
`expo-store-review` in the next native build.

**DONE the same day.** `recordWinAndMaybeAsk()` now fires 2.5s after ANY finished render/export -
from `JobsContext`, the one place every video path reports a finish - and on `AudioResultScreen`.
Saves to the phone call `recordWin()`: they COUNT but never ask, because those screens show their own
"Saved" sheet and BrandedAlert has a single host, so a prompt would replace it. Unchanged: never on
the first success, at most every 60 days, never again after "Rate". Published as update group
`c52e2a91-8802-4a7c-a42b-02161dca5570`.
- **`expo-store-review` is installed and loaded LAZILY** (its JS calls `requireNativeModule` at
  import - the expo-secure-store trap). With the module, Google's in-app sheet is shown **directly,
  with no question of ours first: Google's in-app review guidelines forbid any pre-prompt** ("Do you
  like the app?"). Without it (build 12 and older) our own sheet, reworded to "Rate Tonefy on Google
  Play?" - the old "Enjoying Tonefy?" opener is review-gating, which Play policy forbids.
- **Build 13 (versionCode 13) cut for it on Oct 3 2026**, same keystore `qMlH7ffwtv` - the only native
  change since build 12 is `expo-store-review`. Verified inside the AAB before upload: 58 in-app-review
  references in the dex, BILLING + POST_NOTIFICATIONS present, READ_MEDIA_VIDEO/IMAGES absent, RNIap
  intact, runtimeVersion 1.1.0. AAB kept at `~/builds/tonefy-vc13.aab`. **Uploaded to `internal` only**
  (production + alpha still vc12) for the owner to check on device before promotion - and the owner
  must leave the testing programme only AFTER that, or he cannot receive the internal build.
- **RELEASED Oct 3 2026 after the owner checked it on device: vc13 is on production, alpha AND internal
  (100%, all tracks in step).** Alpha was moved too on purpose - Play serves a tester their
  highest-priority track (item 29), so a closed-test tester would otherwise have stayed on vc12. Google
  reviews a production release first; it shows "In review" before it reaches devices.
- **Leaving testing, as it actually went (owner, Oct 3 2026):** removing the email from the Console
  tester list made the opt-out link answer "App not available - your account isn't currently eligible",
  but the Play Store app kept showing "(Internal Beta)" and "Your private feedback" - and **Clear cache
  was not enough. Settings -> Apps -> Google Play Store -> Storage -> CLEAR STORAGE fixed it at once**:
  normal title, no warning, a public "Rate this app" section. Give testers that step, not "wait a day".
- The in-app sheet is quota-limited by Google and reports nothing back, so it is never marked "done";
  the 60-day rule decides re-asking. It also does not appear for every install - a no-show is normal.

**27 accounts and ZERO ratings, which is a ranking problem rather than a vanity one** -
Play sorts a zero-rating app below anything with any rating, for every term it might
otherwise appear for. `utils/rateApp.js` asks after a POST succeeds (their video is
actually live), never on a first success, never twice in 60 days. **Deliberately not
`expo-store-review`**: it is the nicer control but a native module, so it would reach
nobody already holding the app - `Linking` ships over the air today, and swapping in
`StoreReview.requestReview()` later needs no other change here.

**What is still OWNER work, and why it cannot be done from here:**
- ~~**Screenshots: 2, where Play allows 8.**~~ **DONE Sep 25 2026 - 5 live on both
  locales.** The owner designed them in Canva with phone mockups, at exactly 1080x1920
  sRGB with no alpha, and sent them over with `scp` from Termux (the link ran at ~800KB/s,
  not the 18.8K/s the phone's status bar suggested - **measure the transfer, do not plan
  around the status bar**). Order is deliberate, since the first two or three are what
  most browsers ever see: hero value proposition, dashboard workflows, post + schedule,
  a real video in the editor, connected accounts.
  Two of the eight files that arrived were not screenshots at all (a bank statement and an
  old sale graphic) and one design was a near-duplicate of another with a different mockup
  frame - **5 distinct frames beat 6 with a visible repeat.** Originals kept in `~/shots/`,
  the two they replaced in `~/shots/old-listing/`.
  **A raw 720x1612 phone capture was tested against Play and ACCEPTED**, in a throwaway
  edit that was discarded rather than committed - so screenshots need no resizing, and the
  2:1 aspect-ratio limit I expected does not bite. `edits.images.upload` appends, so
  controlling ORDER means `deleteall` then uploading in sequence.
  **CLOSED the same evening - 8 live, the Play maximum.** The owner sent four more
  designs covering exactly the gap: the timeline editor with its filmstrip and toolbar,
  Caption Style 138, the Auto Captions sheet and Transition 133. Final order answers, in
  sequence, *what is this* (hero), *can it do what it claims* (dashboard's four generation
  entry points), *is it any good* (the real editor), then the visual proof, the depth, and
  the differentiator: hero, dashboard, editor, captions 138, auto captions, transitions,
  Post To, Edit & Post.
  **Nine designs existed and Play caps phone shots at 8**, so Connected Accounts was
  dropped - a settings list is the weakest seller, and it was also the frame most exposed
  by Meta's dev mode.
  **`edits.insert` answered 503 once**, and the googleapis client does **not** retry POSTs
  (`httpMethodsToRetry` is GET/HEAD/PUT/OPTIONS/DELETE). It failed before an edit existed,
  so nothing was half-applied - but any script driving this API wants its own retry on
  429/5xx or a transient blip reads as a real failure.
  **A re-send of the whole folder is mostly duplicates** - dedupe by md5 before treating
  anything as new; 6 of the 10 files the second transfer brought were byte-identical to
  what was already live.
  **They show Facebook and Instagram as Connected**, which a public user cannot reach while
  Meta is in dev mode (item 44). Flagged to the owner, who chose to ship them as they are
  while that work continues - a deliberate call, not an oversight. Swap that frame when
  Meta goes live.
- **No promo video** on the listing. **Play takes a YouTube URL, never an uploaded file**
  - it is the `video` field on `edits.listings.update`, one per locale. Tested in throwaway
  edits Sep 26 2026: `watch?v=`, `youtube.com/shorts/` and `youtu.be/` are **all three
  accepted** at validate time, so the URL form is not the constraint.
  **The constraint is that a promo video takes the FIRST slot in the media carousel**,
  ahead of every screenshot - so a weak video costs the hero frame its position, which is
  a net loss. The two demo videos that exist (`2Dciwsx1vLs`, `WupTWthv9H0`) are YouTube-
  and TikTok-AUDIT demos: reviewer-paced, one letterboxed portrait-in-16:9 with grey bars,
  the other a zoomed capture with overlapping text and "Coming soon" badges on Facebook and
  Instagram. **Judge this from the THUMBNAIL** (`img.youtube.com/vi/<id>/maxresdefault.jpg`)
  - that still is what the carousel actually shows. Both were rejected on that basis.
  **DECIDED Sep 26 2026 (owner): no promo video, deliberately - not an outstanding task.**
  "If the video is going to replace our hero lets leave it." An empty slot costs nothing;
  a weak video costs the best frame in the set. Revisit only with a purpose-made 20-30s
  landscape promo, and judge it by its thumbnail before setting it.
  (`diNcnX-CIKU`, the old OAuth demo, has since gone private - oEmbed is the quick liveness
  check.)
- **Tags** (up to 5, Console-only) and **store listing experiments** are not exposed by
  the API.

**Expect a lag.** Play re-indexes a changed listing over roughly a week, and an app three
weeks into production with no ratings is slow to rank whatever the copy says. The keyword
work decides which searches it can appear in at all; ratings decide where in them.

## Subscription prices are REGIONAL since Oct 3 2026 - doubled in 44 markets only

**Owner decision: x2 in high-income markets, unchanged everywhere else.** Applied through the Play
Developer API and verified price by price: of 696 regional prices (2 products x 2 base plans x 174
regions) exactly 176 changed, every one in the approved list, ratio 2.00-2.13 (.99 rounding up).

| | Pro monthly / yearly | Creator monthly / yearly |
|---|---|---|
| **US** (was) | **$13.99 / $139.99** ($6.99 / $69.99) | **$29.99 / $299.99** ($14.99 / $149.99) |
| UK | GBP 11.99 / 123.99 | GBP 26.99 / 269.99 |
| Germany | EUR 13.99 / 139.99 | EUR 29.99 / 309.99 |
| **Uganda - unchanged** | $8.25 / $82.59 | $17.69 / $176.99 |

- **Doubled (44):** US CA GB IE FR DE NL BE LU AT CH LI DK SE NO FI IS IT ES PT MT CY SI EE LV LT SK CZ HR
  AU NZ JP KR SG HK TW MO IL AE QA KW SA BH OM.
- **Borderline, deliberately KEPT (12):** PL HU GR RO BG CL CR UY PA BS TT SC. Revisit with sales data.
- **Kept (118):** everything else - Uganda, Kenya, Nigeria, India, Brazil, South Africa and the rest.
  Most real users are Ugandan (7 of the 9 accounts with a country set), which is the reason for the split.
- **Why then:** 0 paying subscribers, so no one was moved - Play needs existing subscribers to accept a
  rise. Raising later is the hard direction; lowering is easy.
- **Backups:** `~/ytshots/play-subs-backup-2026-10-03.json` (before) and `...-after-...` (after). Restore by
  patching a backup's basePlans back.
- **The API call that does it:** `monetization.subscriptions.patch`, `updateMask: basePlans`, the WHOLE
  subscription object, and **`regionsVersion.version` must be current (`2026/01` at the time)** - an
  old one is refused with a misleading currency error ("Expected USD but got ARS"); Play names the
  latest version in the error when you send a too-new one. A refused patch changes nothing.
- **The plans screen no longer carries fallback prices** - with regional pricing any single number is
  wrong for most people; it shows Play's price or "Price in Google Play". Cards now list AI scenes
  (10 Pro / 40 Creator). Published as update group `c0b06482-8635-42de-9dcb-d8dc9eb53194`.
- Margin at the new US prices, worst-case AI use: Pro $11.89 net - $1.73 = **$10.16**, Creator
  $25.49 - $6.91 = **$18.58** per subscriber per month.

## First public reviews (Oct 3-4 2026)

After the testers were removed from the tester list (their Play Store needed "Clear storage" to
notice), build 13 went to production with the rating prompt after any finished video. Three public
5-star reviews followed within a day, all on **vc13**, all from Ugandan devices (Galaxy A23, Nokia 2.4,
Galaxy A16), each praising posting to all platforms. `reviews.list` returns them (it only shows reviews
with text from the last 7 days - not a total). The public listing showed no average yet: Play shows the
aggregate only after enough ratings and with a processing lag; Google does not publish the threshold.
The owner asked why ratings show for other apps and not his, and why there is no rating option before
download: **Play shows "Rate this app" only to accounts that installed the app - true for every app.**
**All three replied to on Oct 4** (owner approved) with `reviews.reply`. Note: `reviews.list` did not
show the replies for a while afterwards - `reviews.get` per review did. Reply to every new review.

**Oct 6 2026 - reviews public on the listing.** The owner confirmed on the Play Store that
Tonefy AI's reviews (the three 5-star reviews of Oct 3-4, with their developer replies) now
show publicly on the listing - the first time store visitors can see ratings.
