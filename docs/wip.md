# Work in progress - read this first when resuming

Kept current DURING a multi-step task so an interruption (usage limit, crash, new chat) loses
nothing. Update after every finished step; clear the task when it is done and recorded.
Resume = read this, check `git status` in both repos, carry on from "Next". Do not ask.

## Task: website matches the app (Oct 25 2026, owner: "everything on the site should match the app")
Rule: THE APP IS THE REFERENCE (tonefy-design). Go page by page, read the app screen, make the site match
(structure, copy, colours, icon wells, card treatment). Website-only pages (upgrade, api-docs) just follow
the design rules. Unbuilt site tools: visible, dimmed, "Coming soon" sheet pointing to the app - never 404.
Found: 13 of 15 dashboard tiles were 404 links.
Steps (mark [x] + commit website after each):
1. [x] bottom nav (MainTabs) - every page
2. [x] dashboard (DashboardScreen): app card list, coloured icon wells, plain sections, first-video card, settings?
3. [x] profile (ProfileScreen)
4. [x] content-calendar (CalendarScreen)
5. [x] my-videos (+ assets/report.js: ReportLink for the site) (MyVideosScreen)
6. [x] idea-to-video (IdeaToVideoScreen)
7. [x] connect-accounts, edit-post-video (per-platform Post sheets NOT ported - follow-up)
8. [ ] login/signup (AuthScreen), admin
9. [ ] record in docs/website.md + CLAUDE.md, clear this
Uncommitted: none yet.

## Previous: none in progress
Last finished (Oct 25 2026): website wide-screen layout (docs/website.md "Wide-screen layout").
