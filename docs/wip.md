# Work in progress - read this first when resuming

Kept current DURING a multi-step task so an interruption (usage limit, crash, new chat) loses
nothing. Update after every finished step; clear the task when it is done and recorded.
Resume = read this, check `git status` in both repos, carry on from "Next". Do not ask.

## Task: YouTube multi-account (Creator up to 5) + per-user daily upload cap (owner asked Oct 30 2026)

Why: ACCOUNT_CAPS says creator 5 per platform, but YouTube was single-record (youtubeTokens/{uid}),
so a second connect REPLACED the first. YouTube quota is 200 uploads/day shared by ALL users
(until ~Apr 2027), so more channels needs a per-user daily cap.

Facts found (Oct 30):
- Our only scope is youtube.upload. channels.list -> insufficientPermissions; tokeninfo has NO sub.
  So at connect time we cannot learn WHICH channel it is (owner's stored channelId/title are null).
- Decision: NO new OAuth scope (openid/youtube.readonly would touch the verified consent screen /
  API audit and could put an "unverified app" warning on the working flow). Instead: each
  connection gets a random id; label "YouTube channel N" until the FIRST upload, whose
  videos.insert response carries snippet.channelId + channelTitle -> stored as the label. If that
  channelId already belongs to another of the user's connections, the older duplicate is dropped.
- Legacy flat youtubeTokens/{uid} = account id `uid` (keeps old queued posts / accountFrom working).

Daily cap: free 0 (posting is paid), pro 3, creator 10 uploads per Pacific day (YouTube quota
resets midnight PT), counted across all the user's channels, in youtubeUploads/{uid}_{YYYY-MM-DD}
(transaction; refunded when the upload fails). Admins exempt. In tiers.js TIERS + constants/plan.js.

Steps:
1. [x] backend (DONE, live-tested 15/15, Tonefy-react commit pushed): storage (accounts map + legacy), connect/callback with canAddPlatformAccount,
       token refresh per account, status (accounts[] + back-compat), disconnect one/all, account
       delete revokes all, publish per account + cap + learn channel name, registry multiAccount,
       sweep passes youtube options on the multi path. node --check, restart, live test.
2. [ ] app: ConnectAccountsScreen YouTube card lists accounts + "Add another channel" (Creator);
       EditPostVideoScreen picks channel(s) like LinkedIn; ProfileScreen row. eslint/export checks.
3. [ ] website: connect-accounts, edit-post-video, profile, content-calendar read accounts[];
       check-website-js.py.
4. [ ] eas update; docs (social-posting.md, CLAUDE.md state); push both repos + website.

Uncommitted state: none. Next: step 2 (app).
