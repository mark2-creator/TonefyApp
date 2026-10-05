# Google verifications

Moved verbatim out of CLAUDE.md on Oct 4 2026 to keep that file small. Facts here are a
record of when they were written; CLAUDE.md holds the current state.

## Google runs FOUR separate verifications, and only one of them is still unstarted

Confused once already (Sep 27 2026), so the list is here rather than inferred:

| | What it is | Status |
|---|---|---|
| **Play Console identity** | proves who the developer is, to publish at all | passed **11 Aug 2026** |
| **Payments / bank** | lets real subscription money settle | passed **7 Sep 2026** |
| **YouTube API Services compliance** | quota and YouTube policy; the month-long email thread | **OPEN** since 9 Sep |
| **OAuth app verification** | the consent screen's warning, the app name/logo, the 100-user cap | **NEVER STARTED** |

**The YouTube audit does NOT cover the consent screen.** Different team, different
submission, different outcome - and assuming the open thread covered it is the mistake
that gets made.

**CAVEAT on that conclusion, found Sep 27 while filling the form: the Cloud project's
Developer contact is `ahumuzamark254@gmail.com`, NOT the main address.** Google notifies
that address about this project, and the mailbox search below covered only
`ahumuzamark21213@gmail.com`, which is where the Gmail connector is attached. So an
acknowledgement could exist unseen in the other inbox. **Check `...254` before submitting
anything to Google**, and add `...21213` to the contact list so correspondence reaches the
inbox that is actually read. `...254` is the address verified as the Brevo sender (item
18) and is not otherwise watched.

**"Never started" is evidenced, not assumed** - searched the whole mailbox including trash
and spam for `oauth-verification@google.com`, `api-verification@google.com`, "OAuth
verification", "unverified app", "verification request", "brand verification" and
"restricted scope": **zero results**. Google emails on receipt AND on outcome, so a
submitted request would have left two. **Before submitting anything to Google, search the
mailbox first** - a duplicate request sets a review back rather than forward.

**Independent confirmation from another direction:** the consent screen still reads
`fitlifesolutions.site wants access to your Google Account` instead of "Tonefy AI".
Google suppresses the app name and logo for UNVERIFIED apps only (item 40), so the
branding being absent is itself proof the verification has not passed.

**What OAuth verification actually buys:** removes the "Google hasn't verified this app"
interstitial and its Advanced -> "unsafe" path, restores the name and logo, and lifts the
**100-user cap** on sensitive scopes. Currently 1 YouTube connection, so the cap is a
future ceiling rather than a present problem - the interstitial is the real cost, since a
user connecting YouTube must click through a screen that reads as a security warning.

**DECIDED Sep 27 2026: submit it NOW, in parallel with the audit.** I had advised waiting
for the audit to close; the owner's counter was better and the advice was changed. The
wait is UNBOUNDED - the audit has no committed date and could close next quarter - while
the cost of waiting is active and concrete: every user who tries to connect YouTube meets
a screen that reads as a security warning. My "running two reviews invites them to
reference each other" was speculation stated as risk; the two are different teams and
different submissions, and OAuth verification takes weeks of its own, so starting now
overlaps the clocks instead of stacking them. The one real dependency is small and
recoverable: if the audit forces a scope change, resubmit with the new scopes.

**The Console's real order, and I got it wrong twice before the screens settled it.**
The Verification centre greys out "Prepare for verification" and says *"You need to verify
and publish your branding before you can request verification"*, so I told the owner
branding was the gate and that my earlier Audience-page instruction had been wrong. Then
the Branding page turned out to be **already complete and saved** - every field filled,
logo uploaded, Save greyed out - which makes branding not the gate at all.

**And that guess was wrong too - the Audience page shows `Publishing status: In
production`.** So branding was complete AND the app was already published, and neither
was the gate. **Nothing was blocking it except that the request had never been made.**
The Audience page simply carries a banner - *"Your app requires verification. When you
have finished configuring your information, please submit your app for review"* - with a
button straight to the Verification centre. Three guesses at a gate that did not exist,
each from reasoning about the flow rather than reading a screen.

**The same page confirms, in Google's own words, what this app has been paying for:**
`OAuth user cap: 1 user / 100 user cap`, and *"If your users are seeing the 'unverified
app' screen, it is because your OAuth request includes additional scopes that haven't been
approved."* The cap and the warning screen are real and documented on the page itself.

**Both contact inboxes were checked and neither holds any Google verification mail**, so
"never submitted" survives the caveat above - there is no duplicate risk.

### Blocked Sep 27 2026: every prerequisite is met and the button stays greyed

Worked through the whole Console with the owner. **All of this is confirmed in place**, so
do not re-check it:

- Branding complete and SAVED - name, logo (120x120), home/privacy/terms URLs all live,
  authorised domains `fitlifesolutions.site` + `gen-lang-client-0229110424.firebaseapp.com`,
  both contact emails added
- Publishing status **In production**, user type External, `1 user / 100 user cap`
- `.../auth/youtube.upload` registered under **sensitive scopes** with a justification at
  998/1000 chars
- Demo video live and saved as `https://www.youtube.com/watch?v=f1qjACbJies`
  (the field had still pointed at the DELETED `diNcnX-CIKU` - fixed)
- `fitlifesolutions.site` verified in Search Console as a **Domain property**, under
  **the same account** that owns the Cloud project (`ahumuzamark21213@gmail.com`), DNS TXT
  `google-site-verification=5M1yThBbxGMVp2B5RiPVx5U4CMexQDSELmxnshWnguk`

**And "Prepare for verification" is still greyed**, with the Verification centre repeating
*"You need to verify and publish your branding before you can request verification"*.

**Reading worth carrying: "Your branding is not being shown to users" is probably a
STATEMENT, not a to-do.** The branding genuinely is not shown, because the app is
unverified - which is the thing being applied for. If so the Data access card's message is
a template that does not match this project's state, and clicking will never clear it.

**I guessed at a blocking step FIVE times** - Audience, branding, Testing status, the dead
video link, Search Console ownership - and each was wrong, every one corrected by a
screenshot rather than by reasoning. **The rule earned here: when a checklist is fully
satisfied and a control stays disabled, stop theorising and take the other route.**

**ANSWER FOUND, by looking it up instead of reasoning: brand verification is its OWN
flow, with its own button, on the BRANDING page - not in the Verification centre.**
Google's documented steps
(developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification):

1. Branding page -> fill app name, logo, developer contact (all already done here)
2. **Click "Verify Branding"** to start the evaluation
3. Status becomes **"Ready to publish"**
4. **Click "Publish branding"**

So the Verification centre's *"you need to verify and publish your branding"* is LITERAL -
it names those two buttons. Brand verification is a real prerequisite that had simply
never been run, which is why "Prepare for verification" is greyed. The button did not
appear in any of the mobile screenshots; **try a DESKTOP browser**, since the Google Auth
Platform pages collapse controls at narrow widths and all of this was done on a phone.

Note for after: *"Branding modifications are not permitted while verification is in
progress"*, so do not edit those fields once it is submitted. Results are valid 7 days.

**There is NO support form for this** - I gave the owner
`support.google.com/cloud/contact/oauth_app_verification` from memory and it 404s.
Google's docs state submission happens only through the Console. **Sixth wrong answer of
the session, and the first one that a single web search would have prevented: the earlier
five came from reasoning about the flow, this one from reciting a URL. Look it up.**

**AND THE BUTTON IS NOT THERE.** Checked on the Branding page with Chrome's "Desktop
site" already enabled: the page ends at Save / Discard changes with no "Verify Branding"
anywhere. Google's docs describe a control this account's Console does not have - most
likely because the docs predate the newer **Google Auth Platform** UI this project is on.

**Google's own documentation is a dead end on this.** The OAuth App Verification Help
Center gives no contact route, and its FAQ has no entry for a greyed-out "Prepare for
verification" or for branding verification being unavailable. Both were read directly.

**STOPPED Sep 27 2026 with everything prepared and nothing submitted.** Remaining options,
in order of cost: try the Console from a REAL desktop computer (not a phone in desktop
mode - rendering still differs); then Google Cloud Support via Help -> Create a case.

**UNBLOCKED Oct 2 2026: the owner verified and published the branding** (the button did exist after
all), and the Verification centre form opened. Its "Additional info" box (1000 chars) got: the Play
URL, the reviewer login `youtube.audit@tonefyai.app` (**sign-in re-tested the same day: OK, plan
creator, 300 credits, 3 sample videos whose files return 200**), the real tap path (My Videos > Post
> YouTube row "Connect & post"; disconnect via Profile > Connected Accounts), the single project id,
the fact that the website makes no YouTube API calls, and a note that the API compliance review is
running in parallel. **Watch `ahumuzamark254@gmail.com` too**: it is a contact address on the
consent screen, and Google's questions can go there.

The questionnaire was answered **No to all four questions, both boxes ticked**. **No CASA security
assessment applies**: `youtube.upload` is a SENSITIVE scope, not a RESTRICTED one, and CASA is
required only for restricted scopes. Do not let a later email talk anyone into paying for one.
**While the review runs, edit neither the branding nor the publishing status** (Audience page). A
change to either can reset or void the request.

**Nothing operational is blocked by this**, which is why it was right to stop: YouTube
uploads work (7 real posts), and the only costs are the consent warning screen and the
100-user cap with 1 user used. It can wait weeks without harm.

Everything the submission needs is prepared in `~/ytshots/oauth-verification-pack.md` and
`~/ytshots/oauth-scope-justification.txt`, and the demo video is live at
`https://www.youtube.com/watch?v=f1qjACbJies`.

**The lesson is the one this file keeps recording from a different direction: read the
screen before instructing from it.** Both wrong answers came from reasoning about what
Google's flow probably does instead of asking the owner what his Console showed.

**Submission pack written to `~/ytshots/oauth-verification-pack.md`** - every Console
field, the scope justification to paste, and the rejection list checked against what we
have. The 120x120 consent-screen logo is `~/ytshots/tonefy-oauth-logo-120.png` (the 1024
icon flattened to opaque; Google needs exactly 120x120 and no alpha).

**The one blocker is the demo video, and it is DELETED rather than private** - the owner
could not find it, and checking settled which: `diNcnX-CIKU` returns `"status":"ERROR"`,
which is what YouTube answers for a video that no longer exists, where a private one says
`LOGIN_REQUIRED` / "This video is private". **oEmbed cannot tell those two apart** - it
returns nothing for both - so fetch the watch page and read the status when it matters.

**The source file survived at `~/ytshots/tonefy-oauth-demo.mp4`** (5.1 MB, 5m 29s) and was
sent to the owner to re-upload as Unlisted. **Frames were sampled before sending rather
than trusting the filename**: it shows dashboard -> Connect YouTube -> the Google consent
screen reading "fitlifesolutions.site wants access to your Google Account" -> Edit & Post
-> YouTube Studio with the uploaded video. That consent-screen frame is the one thing this
review must see, which is why `2Dciwsx1vLs` does NOT substitute - it satisfies the YouTube
audit by showing posting work, and never shows a grant.

**Keeping the raw recordings paid off here.** Everything else in `~/ytshots` is evidence
for reviews that have already been answered; this one became the only copy of a required
artifact after the YouTube upload was removed.

**The strongest part of the application is the narrowness**: one scope, `youtube.upload`,
with the fact that we declined `youtube.readonly` - and therefore cannot read back the
channel name - offered as evidence of restraint rather than hidden as a limitation.

## OAuth app verification APPROVED (Oct 4 2026, 12:45 UTC)

Email from `api-oauth-dev-verification-reply@google.com` (cc ...254@): "We've approved your OAuth App
Verification request for project 527163602306 (gen-lang-client-0229110424) for the following scopes:
.../auth/youtube.upload". Submitted Oct 2, approved in two days. The subject says "[Action Needed]" but
the body asks for nothing beyond standing reminders: keep project Owner/Editor accounts current, and
**a new scope or any change to the consent screen configuration needs a new verification** (it cannot be
inherited). Effect: the consent screen shows "Tonefy AI" with its logo instead of
"fitlifesolutions.site", the "Google hasn't verified this app" interstitial is gone, and the 100-user cap
on the sensitive scope is lifted. **It does NOT lift forced-private uploads** - that is the separate
YouTube API Services compliance audit, still open (status request sent Oct 3).

## YouTube API Services audit - still waiting (Oct 5 2026)

The owner asked why it takes so long. Timeline: submitted Aug 27; three rounds of questions Sep 3-9, each
answered within a day; Google's Sep 9 "we will conduct our review... and notify you"; silence since;
polite status request on the same `youtube-disputes` thread Oct 3 (a Saturday) - no reply by Oct 5.
Google gives these audits no deadline or queue position; several weeks to past two months is common
once the questions phase ends. Agreed plan: wait about a week; if still silent around Oct 12, one more
follow-up on the SAME thread; never resubmit the form (a duplicate can restart the review); change
nothing in the YouTube scopes or OAuth consent screen meanwhile (OAuth verification passed Oct 4 and
any change needs re-verification). Until it passes, users publish from YouTube Studio via the app's
"View" link (Visibility -> Public); afterwards add a Public/Unlisted/Private choice to the YouTube sheet.
