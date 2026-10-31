# Work in progress - read this first when resuming

Kept current DURING a multi-step task so an interruption (usage limit, crash, new chat) loses
nothing. Update after every finished step; clear the task when it is done and recorded.
Resume = read this, check `git status` in both repos, carry on from "Next". Do not ask.

## Task: social connections that expire (owner approved Oct 31 2026)
Found: Instagram 60-day token never refreshed; LinkedIn 60-day token expiry never read; Pinterest
refresh does not save the rotated refresh_token; nothing tells the user a connection died.
Steps:
1. Backend: IG refresh sweep (graph.instagram.com/refresh_access_token, accounts older than 7 days,
   6-hourly + at boot), store expiresAt; mark `expired` on code 190 at publish/refresh (IG, FB, LI,
   Pinterest); reconnect callbacks reset `expired:false`; Pinterest saves new refresh_token;
   LinkedIn checks expiresAt before posting; status endpoints return per-account needsReconnect/expiresAt.
2. App ConnectAccountsScreen: "Reconnect" on accounts with needsReconnect (+ LinkedIn expiring soon).
3. Website connect-accounts.html: same.
4. Checks, publish OTA, docs (history 58), push both repos.
Done: 1 (backend commit pushed, live; IG sweep flagged owner IG = 190 checkpoint "log in to instagram.com")
Next: step 2 app ConnectAccountsScreen
