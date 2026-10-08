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
