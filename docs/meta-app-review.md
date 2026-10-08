# Meta (Facebook + Instagram) - Business Verification and App Review pack

Prepared Oct 8 2026, the day the URSB registration came through. Everything on OUR side is done
(website legal pages, data-deletion page, reviewer access); what remains happens in Meta's consoles,
which only the owner can reach. Paste the blocks below as they are.

## 0. Facts every form must use - copied from the URSB documents, keep them identical

| Field | Value |
|---|---|
| Legal business name | **AHUMUZA FITLIFE SOLUTIONS** (certificate spelling; Meta matching ignores case) |
| Registration no. | **80043893223863** (URSB, Business Names Registration Act) |
| Type | Sole proprietorship (individual), owner MARK AHUMUZA |
| Address | Muliro Zone, Luwero Central, Luwero Town Council, **Luweero** District, Uganda (form: "muliro, luwero central, luwero town council wave_3 ... district luweero") |
| Registered / commenced | certificate 08 Oct 2026 / business commenced 05 Oct 2026 |
| Website | https://tonefy-ai.fitlifesolutions.site (shows the legal name, reg. no. and address in the Privacy Policy section 1 and Terms section 1 since Oct 8 2026) |

**Documents to upload for Business Verification: BOTH PDFs.** The certificate proves the name and
number but has NO address; the stamped "Statement of Particulars" (the application form) is the one
showing name + address. National ID only if Meta asks for it.

## 1. Business portfolio (business.facebook.com)

1. The owner ALREADY has a portfolio, named "Fitlifesolutions" (seen Oct 8 2026). Do not make a second
   one - **rename it** to **Ahumuza Fitlife Solutions** (Settings -> Business info -> Edit) BEFORE
   starting verification, so the name matches the URSB documents. The app keeps its own name, Tonefy AI;
   an app is allowed to have a different name from the business that owns it.
2. Security Center -> Start verification -> enter the legal name, address and website above -> upload
   the certificate + statement of particulars.
3. Contact method: **Email to hello@fitlifesolutions.site** (Cloudflare Email Routing -> owner's Gmail). NOT
   phone/SMS/WhatsApp: those need documents showing the phone number, and neither URSB document has one
   (checked Oct 8 2026). Email needs name + address, which the Statement of Particulars shows.
   Old note: A domain email is preferred by Meta; the site domain is
   `fitlifesolutions.site`. If verification asks for domain verification, tell Claude - a DNS TXT
   record or a meta-tag file on the website is a five-minute change on our side.

## 2. Developer app settings (developers.facebook.com -> the Tonefy app)

- App type: Business; Business portfolio: Ahumuza Fitlife Solutions (after verification).
- App icon 1024x1024: the Play Store icon (`assets/icon.png` in the app repo).
- Privacy Policy URL: https://tonefy-ai.fitlifesolutions.site/privacy.html
- Terms of Service URL: https://tonefy-ai.fitlifesolutions.site/terms.html
- User data deletion: choose **"Data deletion instructions URL"** -> https://tonefy-ai.fitlifesolutions.site/data-deletion.html
- App domains: `fitlifesolutions.site`. Category: Photo & Video (or Productivity).
- Contact email: ahumuzamark21213@gmail.com.
- Facebook Login redirect URI and Instagram Login redirect URI: already configured (connections work
  for admins today) - do not change them.

## 3. Permissions to request - EXACTLY these, nothing else

The code asks for these and only these (`FB_SCOPES` / `IG_SCOPES` in server.js). Requesting a
permission the app does not use is a standard rejection.

**Facebook Login:** `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
**Instagram API with Instagram Login:** `instagram_business_basic`, `instagram_business_content_publish`

(NOT `instagram_basic` / `instagram_content_publish` - those belong to the Facebook-Login route for
Instagram, which Tonefy does not use.)

### Justification texts ("How will your app use this permission?")

**pages_show_list**
> Tonefy AI is an Android video editor that lets a creator publish the video they made in the app to
> their own Facebook Page. After the user logs in with Facebook from Profile > Connected Accounts > Connect Facebook Page, we
> call /me/accounts to list the Pages they manage so they can choose which Page Tonefy may post to. We
> show only the Page names and pictures, store only the chosen Page's ID, name and token, and use the
> list for nothing else.

**pages_read_engagement**
> Facebook requires pages_read_engagement together with pages_manage_posts for an app to publish
> content as a Page. Tonefy uses it only for that: publishing the user's own video to the Page they
> chose, as described under pages_manage_posts. We do not read comments, reactions, insights,
> followers or any other Page content.

**pages_manage_posts**
> This is the core of the feature. When the user taps Post (or Post Now) on a video they created in
> Tonefy AI, we upload that video to the Facebook Page they selected, with the caption they wrote. Every
> post is a single, explicit action by the user (or a time the user scheduled themselves). Tonefy never
> posts automatically, never edits or deletes the user's existing posts, and only posts to Pages the
> user chose.

**instagram_business_basic**
> When a user connects Instagram from Profile > Connected Accounts > Connect Instagram Account (Instagram Login), we read their
> professional account's ID and username so the app can show which account a video will be published
> to. Nothing else is read.

**instagram_business_content_publish**
> When the user taps Post on a video they made in Tonefy AI and selects Instagram, we publish that video
> to their Instagram professional account as a Reel with the caption they wrote. Each publish is a
> single explicit user action (or a time the user scheduled). We never post automatically and never
> modify or delete existing media.

## 4. Test instructions (App Review -> "Provide verification details")

> Tonefy AI is an Android app: https://play.google.com/store/apps/details?id=com.ahumuza21213.TonefyApp
> Sign in with: Email youtube.audit@tonefyai.app / Password TonefyReview2026! (this account is on our
> Creator plan, so posting is unlocked, and Facebook/Instagram are enabled for it while the app is in
> review).
>
> Facebook: 1) Profile > Connected Accounts > Facebook > Connect Facebook Page. 2) Log in with your Facebook test
> user and allow access to a Page. 3) Back in the app, the Page shows as connected. 4) Home > Idea to
> Video > type "3 easy ways to save money" > Generate Script > Generate Voiceover > Generate Video
> (about 2 minutes). 5) Post or schedule > write a caption > under POST TO tap Post on the Facebook row
> (or select it and tap Post Now). 6) The row shows "Posted - View"; tap View to open the post on the
> Page.
>
> Instagram: same, using Profile > Connected Accounts > Instagram > Connect Instagram Account (Instagram
> Login with a professional account),
> then Post on the Instagram row. The video is published as a Reel.
>
> If generating a video is inconvenient, any video already in My Videos can be posted the same way
> (My Videos > a video > Post).

## 5. Screencasts (one per platform, 1-3 minutes, English UI, record on the phone)

Meta rejects a video that skips the login. Show, without cuts:
1. The app open, signed in. Profile > Connected Accounts.
2. Tap Facebook > Connect Facebook Page -> the Facebook Login dialog -> the permission screen naming each permission
   -> choose the Page -> back in the app, connected.
3. Make or open a video, Post or schedule, type a caption, Post on the Facebook row.
4. "Posted - View" -> tap View -> the post visible on the Facebook Page.
Repeat for Instagram (Instagram Login screen, allow, post, the Reel on the profile).
Upload the same recording to each permission of that platform.

## 6. After approval

1. In the developer app, switch to **Live**.
2. Tell Claude: set `META_LIVE=true` in `backend/.env`, restart, and the app + website stop showing
   "Coming soon" to everyone. `META_REVIEWER_UIDS` can then be removed.

Review usually takes several days to two weeks. If rejected, paste the rejection text to Claude.
