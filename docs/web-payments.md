# Web payments - Flutterwave (built Oct 8 2026, OFF until keys)

## What and why
- **30-day Pro / Creator passes**, bought on the WEBSITE only, in UGX: Pro **30,000**, Creator **65,000**
  (= Uganda Play prices $8.25 / $17.69 at ~3,700, rounded down - neither route is cheaper).
- **Paid once, never renews by itself.** Mobile money cannot be auto-charged and most users are
  Ugandan; nobody is ever charged without pressing Pay.
- Card + MTN/Airtel mobile money through Flutterwave **hosted checkout** (`payment_options:
  mobilemoneyuganda,card`), v3 API.
- **Google Play rule:** a plan bought on the web may be USED in the Android app, but the app must
  never link to, mention or steer anyone to web payment. Nothing in the app points at `upgrade.html`.
  Email/website may mention it.

## Code
- `backend/webPayments.js` - config/start/confirm/webhook/expireSweep. Design notes in its header.
- `server.js`: `/api/web-pay/config|start|confirm` (behind verifyToken), **`/flw-webhook` outside /api**
  (Flutterwave has no Firebase token; checks `verif-hash` == `FLW_WEBHOOK_HASH`), `webPay.expireSweep()`
  runs before `creditResetSweep()` in the 10-minute tick.
- Grant = Flutterwave `GET /v3/transactions/{id}/verify` (or `verify_by_reference`) must say
  successful + our tx_ref + UGX + amount >= price; then ONE Firestore transaction flips
  `webPayments/{tx_ref}` pending -> granted and writes `users/{uid}`: `plan`, `creditsRemaining`
  (tier credits, + leftover when renewing the same plan), `creditsResetAt = webPassUntil`,
  `webPassPlan`, `webPassTxRef`, `webPassStatus: 'active'`. Page and webhook racing = granted once (tested).
- Refused: active Google Play subscription, a pass with more than 5 days left (renewal window: the
  new 30 days start at the old end), admins, a hand-set paid plan.
- Expiry: `webPassStatus 'ended'`, plan -> free with min(credits, 10). Does NOT set
  `subscriptionStatus` (that field means a Play lapse to the app).
- `aiScenes.js`: an active web pass counts as purchased (full AI-scene allowance). Admin stats count
  `webPasses` separately (UGX, not in the USD MRR); user rows show source `web`.
- Website: `upgrade.html` (plans + Pay; "coming soon" while off), `payment-done.html` (Flutterwave
  `redirect_url`; polls ~2 min for mobile-money approval; cancelled/failed states), `refunds.html`
  (full refund: charged but not activated, double charge, within 7 days if no video made; reply in 3
  business days; Play purchases follow Play), Terms 7.2/7.3 and Privacy 2.1/7 updated (Flutterwave
  processor; payment records kept 7 years - NOT purged on account delete, on purpose), footers link
  Refunds, Profile -> Plans row.
- Test: `backend/test-web-payments.mjs` (fake Flutterwave, real Firestore, disposable account). 16/16
  passed Oct 8 2026.

## To switch on (owner)
1. Flutterwave account + business KYC (same URSB documents). TEST keys work before KYC.
2. Add to `backend/.env` himself (secrets never in chat): `FLW_SECRET_KEY=FLWSECK_TEST-...`,
   `FLW_WEBHOOK_HASH=<long random phrase>`. Restart.
3. Flutterwave dashboard -> Settings -> Webhooks: URL `https://api.fitlifesolutions.site/flw-webhook`,
   secret hash = the same phrase.
4. Sandbox purchase end to end (test card / test mobile money), check Admin revenue, then swap to LIVE keys.
- If the account only offers v4 (OAuth client id/secret) keys, the module needs adapting - it speaks v3.

## Oct 8 2026: prices SHOWN in dollars, CHARGED in shillings
Owner wanted "$ for everyone, like Play". Tested: a Flutterwave checkout in USD offers **card only** -
mobile money disappears (MTN/Airtel wallets are UGX). So `PASSES` carries a display-only `usd`
(Pro $8.25, Creator $17.69 = the Uganda Play prices); `upgrade.html` shows "$8.25 ... paid as UGX 30,000"
and the button "Pay $8.25"; the charge and every check in `confirm` stay UGX (Exness does the same).
Test mode: only `FLW_TEST_UIDS` can start a payment (a TEST key takes fake cards). The phone's checkout
spinning forever on Oct 8 was a 390 B/s connection - the page loads in seconds on a normal one.

## Oct 8 2026 (later): shillings for Uganda ONLY - supersedes the section above
Owner: "Let the shillings be shown to only Ugandan users ... I don't want a user from UK or US to be shown
shillings." `currencyFor(user, loc)` -> **UGX** (mobile money + card, Pro 30,000 / Creator 65,000) when the
profile country is Uganda OR Cloudflare's `/cdn-cgi/trace` puts the visitor in UG; otherwise **USD by card
only** (Pro $8.25 / Creator $17.69). The page reads `loc` and sends it to `/config?loc=` and `/start`; the
pending record stores the currency + amount and `confirm` checks against THAT (old records: UGX). Both
signals are claims, deliberately: either answer charges the same money.
**First end-to-end sandbox payment PASSED Oct 8 2026 22:38 EAT** (owner, MoMo test number, ahumuzamark254@):
page granted Pro, webhook confirmed the same tx, granted once. Account reset to free, test records deleted.
Before going live: check the LIVE Flutterwave account may collect USD (test mode allowed it), and empty
FLW_TEST_UIDS. Open question for the owner: Play charges high-income countries double ($13.99 US Pro) while
the web pass is $8.25 everywhere outside Uganda.

## Oct 8 2026 (latest): Play's price per country, mobile money across Africa - supersedes both sections above
Owner: (1) match Play's higher prices in rich countries - "Yes"; (2) "Kenya, Tanzania, Rwanda, most African
countries pay using mobile money ... we may lock out users who don't have cards."
`offerFor(regionFor(user, loc), plan)` in `backend/webPayments.js`:
| Where | Charged | Pro / Creator | Methods |
|---|---|---|---|
| UG | UGX | 30,000 / 65,000 | MTN, Airtel, card |
| RW | RWF | 10,500 / 22,500 (Play $6.99/$14.99 at ~1,504) | mobile money, card |
| GH | GHS | 90 / 200 (Play) | mobile money, card |
| ZM | ZMW | 170 / 360 (Play $6.99/$14.99 at ~23.9) | mobile money, card |
| NG | NGN | 10,000 / 22,000 (Play) | bank transfer, USSD, card |
| Play's 44 doubled markets | USD | 13.99 / 29.99 | card |
| everywhere else | USD | 8.25 / 17.69 | card |
**Probed Oct 8 on the TEST account** (headless checkout, read the payment-method list): mobile money shows for
UGX/RWF/GHS/ZMW; NGN shows bank transfer + USSD; **TZS, XOF, XAF show card only; KES fails to initialise
("Initialization failed") even for card** - those currencies are not enabled on the account. Ask Flutterwave
during activation to enable KES (M-Pesa), TZS mobile money and francophone mobile money; after a test checkout
shows the method, add one line to `LOCAL` (Play: KE KES 1,000/2,200, TZ TZS 18,000/40,000, CI/SN XOF 4,700/10,000,
CM XAF 4,700/10,100). Until then those countries pay USD by card. Region = Cloudflare `loc` first, else the
profile country name -> ISO code via Intl.DisplayNames (retired codes like DD/UK skipped - "Germany" mapped to
DD and "United Kingdom" to UK before that fix). The LIVE account may differ from test - re-probe after activation.

## Oct 8 2026 (night): the Flutterwave account is NIGERIAN - a Ugandan one is applied for
The owner's account (ahumuzamark21213@, phone shown +234) was created under **Nigeria**, the self-serve
signup's only country; activation then demands a Nigerian NIN + BVN. **Never fill those in.** Self-serve
signup is Nigeria-only (read off app.flutterwave.com/register Oct 8); every other country, Uganda included,
goes through **flutterwave.com/ug/contact-sales**. Submitted Oct 8 ~23:30 EAT from hello@fitlifesolutions.site
(company AHUMUZA FITLIFE SOLUTIONS, registered, under $1M, asked for UGX/KES/TZS/RWF/GHS/ZMW/XOF/XAF/USD and to
close or move the Nigerian account); auto-reply "a member of our team will contact you shortly". The Nigerian
account's TEST keys stay in .env for sandbox only. When the Ugandan account arrives: new keys, re-run the
currency probes, adjust `LOCAL`. Fee seen in the test receipt: UGX 900 on 30,000 (3%, mobile money).
**Fallback if no reply in ~a week: Pesapal** (signs up Ugandan businesses directly; MTN, Airtel, M-Pesa, cards).
