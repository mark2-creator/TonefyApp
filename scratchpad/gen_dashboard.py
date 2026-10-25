import sys, re
sys.path.insert(0, '/home/ahumuza/tonefy-build/scripts')
from website_icons import icon
P = '/var/www/tonefy-ai/dashboard.html'
src = open(P).read()
nav = src[src.index('<!-- Bottom Navigation -->'):src.index('</nav>', src.index('<!-- Bottom Navigation -->'))+6]
bnav_css = src[src.index('  <style>\n    .bottom-nav'):]
bnav_css = bnav_css[:bnav_css.index('</style>')+8]

PLAY = 'https://play.google.com/store/apps/details?id=com.ahumuza21213.TonefyApp'
# Mirror of screens/DashboardScreen.js `sections`. href = the website page; None = not on the website yet.
SECTIONS = [
  ('Video', 'movie', '#2ecc71', [
    ('Idea to Video', 'Transform your ideas into stunning videos.', 'auto_awesome', '#2ecc71', '/idea-to-video.html'),
    ('Script to Video', 'Transform your scripts into engaging videos.', 'description', '#92ccff', None),
    ('URL to Video', 'Convert web pages into videos.', 'link', '#92ccff', None),
    ('Edit Video', 'Edit and combine your media into one video.', 'content_cut', '#58e5c2', None),
    ('My Videos', 'Browse your video library.', 'video_library', '#2ecc71', '/my-videos.html'),
    ('Record to Video', 'Turn recordings into polished videos.', 'fiber_manual_record', '#ff6b6b', None),
  ]),
  ('Audio', 'headphones', '#92ccff', [
    ('Empty Audio', 'Write your own script and voice it.', 'add_box', '#92ccff', None),
    ('Idea to Audio', 'Transform your ideas into stunning audio.', 'auto_awesome', '#2ecc71', None),
    ('Script to Audio', 'Transform your scripts into engaging voiceover.', 'description', '#58e5c2', None),
  ]),
  ('Design', 'palette', '#58e5c2', [
    ('Thumbnail', 'Create stunning thumbnails for your videos.', 'image', '#2ecc71', None),
    ('Social', 'Post and schedule to your accounts.', 'group', '#92ccff', '/connect-accounts.html'),
  ]),
]
IDEAS = ['3 easy ways to save money', 'Why sleep matters for your health', 'Fun facts about Lake Victoria']

def card(t, d, ic, col, href):
    if href:
        return (f'<a class="card" href="{href}"><span class="card-icon" style="color:{col};background:{col}18">{icon(ic, 22)}</span>'
                f'<span class="card-title">{t}</span><span class="card-desc">{d}</span></a>')
    return (f'<button type="button" class="card soon" data-tool="{t}"><span class="card-icon">{icon(ic, 22)}</span>'
            f'<span class="card-title">{t}</span><span class="card-desc">{d}</span><span class="soon-tag">Coming soon</span></button>')

sections = '\n'.join(
  f'''    <section class="section">
      <div class="section-header" style="color:{c}">{icon(ic, 16)}<span class="section-title">{title}</span></div>
      <div class="grid">
        {"".join(card(*x) for x in cards)}
      </div>
    </section>''' for title, ic, c, cards in SECTIONS)

chips = ''.join(f'<a class="idea-chip" href="/idea-to-video.html?prompt={i.replace(" ", "%20")}">{icon("lightbulb_outline", 12)}<span>{i}</span></a>' for i in IDEAS)

def srow(href, ic, label, desc):
    return (f'<a class="setting-row" href="{href}"><span class="setting-left"><span style="color:#2ecc71;line-height:0">{icon(ic, 22)}</span>'
            f'<span><span class="setting-label">{label}</span><span class="setting-desc">{desc}</span></span></span>'
            f'<span style="color:#555;line-height:0">{icon("chevron_right", 22)}</span></a>')

html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Cache-Control" content="no-cache" />
  <meta charset="UTF-8" />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard — Tonefy AI</title>
  <!-- Mirrors screens/DashboardScreen.js (dark theme). THE APP IS THE REFERENCE: change the
       app first, then this. Tools the website does not have yet stay visible, dimmed, and open
       a "Coming soon" sheet pointing to the app - never a link to a page that does not exist
       (13 of 15 tiles were 404s until Oct 25 2026). -->
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    :root {{ --bg: #0a0a0a; --card: #111; --border: #1a1a1a; --green: #2ECC71; --text: #fff; --sub: #666; }}
    html, body {{ background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; min-height: 100vh; }}
    a {{ color: inherit; text-decoration: none; }}
    button {{ font: inherit; color: inherit; background: none; border: 0; text-align: left; cursor: pointer; }}
    .navbar {{ display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--bg); z-index: 100; }}
    .nav-brand {{ font-size: 20px; font-weight: 800; color: #2ecc71; letter-spacing: .5px; }}
    .nav-right {{ display: flex; align-items: center; gap: 12px; }}
    .icon-btn {{ padding: 4px; color: #888; line-height: 0; }}
    .avatar {{ width: 36px; height: 36px; border-radius: 50%; background: #1a1a1a; border: 1px solid #2ecc7133; display: flex; align-items: center; justify-content: center; overflow: hidden; color: #2ecc71; font-weight: 800; font-size: 16px; }}
    .avatar img {{ width: 36px; height: 36px; object-fit: cover; }}
    .main {{ padding: 0 0 48px; }}
    .greeting {{ padding: 20px 16px 8px; }}
    .greeting h1 {{ font-size: 22px; font-weight: 700; }}
    .greeting p {{ font-size: 13px; color: var(--sub); margin-top: 4px; }}
    .section {{ padding: 0 16px; margin-top: 24px; }}
    .section-header {{ display: flex; align-items: center; gap: 8px; margin-bottom: 12px; line-height: 0; }}
    .section-title {{ color: var(--text); font-size: 15px; font-weight: 700; line-height: 1.2; }}
    .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
    @media (min-width: 900px) {{ .grid {{ grid-template-columns: repeat(4, 1fr); }} }}
    .card {{ display: flex; flex-direction: column; align-items: flex-start; background: var(--card); border-radius: 14px; padding: 14px; transition: background .15s, transform .1s; }}
    .card:hover {{ background: #161616; }}
    .card:active {{ transform: scale(.97); }}
    .card-icon {{ width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }}
    .card-title {{ font-weight: 700; font-size: 13px; margin-bottom: 4px; color: var(--text); }}
    .card-desc {{ color: var(--sub); font-size: 11px; line-height: 15px; }}
    .card.soon {{ opacity: .65; }}
    .card.soon .card-icon {{ color: #5a5a5a; background: #5a5a5a18; }}
    .card.soon .card-title {{ color: #5a5a5a; }}
    .card.soon .card-desc {{ color: #4a4a4a; }}
    .soon-tag {{ color: #5a5a5a; font-size: 10px; font-weight: 600; margin-top: 6px; }}
    .gb-card {{ margin: 16px 16px 0; padding: 18px; border-radius: 14px; }}
    .first-tag, .banner-tag {{ font-size: 10px; font-weight: 700; letter-spacing: 1.5px; margin-bottom: 6px; color: var(--sub); }}
    .first-title {{ font-size: 20px; font-weight: 700; }}
    .first-body {{ font-size: 13px; line-height: 19px; margin-top: 6px; color: var(--sub); }}
    .first-btn {{ display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--green); color: #000; border-radius: 12px; padding: 13px; margin-top: 16px; font-weight: 700; font-size: 15px; }}
    .first-or {{ font-size: 12px; margin: 16px 0 8px; color: var(--sub); }}
    .idea-row {{ display: flex; flex-wrap: wrap; gap: 8px; }}
    .idea-chip {{ display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: var(--bg); border-radius: 20px; padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--sub); }}
    .idea-chip span {{ color: var(--text); }}
    .banner {{ margin-top: 28px; padding: 20px; min-height: 140px; position: relative; overflow: hidden; }}
    .banner-tag {{ color: #2ecc71; margin-bottom: 8px; }}
    .banner-title {{ font-size: 22px; font-weight: 700; line-height: 28px; }}
    .banner-sub {{ font-size: 12px; margin-top: 4px; color: var(--sub); }}
    .banner-btn {{ display: inline-block; margin-top: 24px; background: #2ecc71; color: #000; border-radius: 20px; padding: 8px 16px; font-weight: 700; font-size: 12px; }}
    .banner-art {{ position: absolute; right: 16px; bottom: 16px; color: #2ecc71; opacity: .15; line-height: 0; }}
    [hidden] {{ display: none !important; }}

    /* Bottom sheet, as the app's modalSheet: #111, 24px top corners, handle, header with a close. */
    .overlay {{ position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: flex-end; justify-content: center; z-index: 200; }}
    .sheet {{ background: #111; border-radius: 24px 24px 0 0; padding: 24px 24px calc(24px + env(safe-area-inset-bottom)); width: 100%; max-width: 560px; }}
    .handle {{ width: 40px; height: 4px; background: #333; border-radius: 2px; margin: 0 auto 20px; }}
    .sheet-head {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }}
    .sheet-title {{ font-size: 18px; font-weight: 700; }}
    .sheet-close {{ color: #888; line-height: 0; padding: 4px; }}
    .sheet-body {{ color: #888; font-size: 14px; line-height: 1.5; }}
    .setting-row {{ display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #1a1a1a; }}
    .setting-row:last-of-type {{ border-bottom: 0; }}
    .setting-left {{ display: flex; align-items: center; gap: 14px; }}
    .setting-label {{ display: block; font-size: 14px; font-weight: 600; }}
    .setting-desc {{ display: block; font-size: 11px; color: var(--sub); margin-top: 2px; }}
    .sheet-btn {{ display: block; width: 100%; margin-top: 24px; border-radius: 14px; padding: 14px; text-align: center; font-weight: 600; font-size: 14px; background: #1a1a1a; color: #888; }}
    .sheet-btn.go {{ background: var(--green); color: #000; font-weight: 700; }}

    /* The app's GradientBorder, as CSS: a rotating conic gradient behind an opaque panel inset by
       the border width. Violet into pink on a deep purple ring - decoration, never a brand colour.
       The app puts it on the first-video card and the featured banner, and nowhere else here. */
    @property --gb-angle {{ syntax: '<angle>'; initial-value: 0deg; inherits: false; }}
    .gb {{
      position: relative;
      background:
        linear-gradient(var(--card), var(--card)) padding-box,
        conic-gradient(from var(--gb-angle), #3b1a5c, #8b5cf6, #ec4899, #a855f7, #3b1a5c, #8b5cf6, #ec4899, #a855f7, #3b1a5c) border-box;
      border: 1.5px solid transparent;
      animation: gb-spin 4200ms linear infinite;
    }}
    @keyframes gb-spin {{ to {{ --gb-angle: 360deg; }} }}
    @media (prefers-reduced-motion: reduce) {{ .gb {{ animation: none; }} }}
  </style>

{bnav_css}
  <link rel="stylesheet" href="/assets/app-wide.css" />
</head>
<body style="--page-w:1040px">
  <nav class="navbar">
    <div class="nav-brand">Tonefy AI</div>
    <div class="nav-right">
      <button type="button" class="icon-btn" id="settingsBtn" aria-label="Settings">{icon("settings", 22)}</button>
      <a href="/profile.html" class="avatar" id="navAvatar" aria-label="Profile">{icon("person", 20)}</a>
    </div>
  </nav>
  <main class="main">
    <div class="greeting">
      <h1 id="welcomeMsg">Welcome!</h1>
      <p>Choose a workflow to get started</p>
    </div>

    <div class="gb gb-card" id="firstCard" hidden>
      <div class="first-tag">START HERE</div>
      <div class="first-title">Make your first video</div>
      <p class="first-body">Type an idea and Tonefy writes the script, adds a voice and finds the clips for you. It takes about two minutes.</p>
      <a class="first-btn" href="/idea-to-video.html">{icon("auto_awesome", 20)}<span>Start with an idea</span></a>
      <div class="first-or">Or tap an idea to try:</div>
      <div class="idea-row">{chips}</div>
    </div>

{sections}

    <div class="gb gb-card banner">
      <div class="banner-tag">FEATURED TOOL</div>
      <div class="banner-title">Video<br>Translator</div>
      <div class="banner-sub">Re-voice any clip in 14 languages</div>
      <a class="banner-btn" href="{PLAY}" target="_blank" rel="noopener">Try it in the app</a>
      <span class="banner-art">{icon("translate", 80)}</span>
    </div>
  </main>

  <div class="overlay" id="settingsSheet" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
      <div class="handle"></div>
      <div class="sheet-head"><span class="sheet-title" id="settingsTitle">Settings</span><button type="button" class="sheet-close" data-close aria-label="Close">{icon("close", 20)}</button></div>
      {srow("/profile.html", "person", "Profile", "Manage your account")}
      {srow("/privacy.html", "lock", "Privacy", "How we handle your data")}
      {srow("/contact.html", "help", "Help &amp; Support", "Get help or report an issue")}
      <button type="button" class="sheet-btn" data-close>Close</button>
    </div>
  </div>

  <div class="overlay" id="soonSheet" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="soonTitle">
      <div class="handle"></div>
      <div class="sheet-head"><span class="sheet-title" id="soonTitle">Coming soon</span><button type="button" class="sheet-close" data-close aria-label="Close">{icon("close", 20)}</button></div>
      <p class="sheet-body"><span id="soonName"></span> is ready in the Tonefy AI app now, and it is coming to the website soon. Your account and videos are the same in both.</p>
      <a class="sheet-btn go" href="{PLAY}" target="_blank" rel="noopener">Get the app</a>
    </div>
  </div>

{nav}

<script type="module">
  import {{ requireAuth, auth }} from '/firebase-auth.js';
  import {{ getFirestore, collection, query, where, limit, getDocs }} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

  // Sheets: open, close from the header, the Close button, the backdrop or Escape.
  const open = (el) => {{ el.hidden = false; }};
  const close = (el) => {{ el.hidden = true; }};
  document.querySelectorAll('.overlay').forEach((ov) => {{
    ov.addEventListener('click', (e) => {{ if (e.target === ov || e.target.closest('[data-close]')) close(ov); }});
  }});
  document.addEventListener('keydown', (e) => {{ if (e.key === 'Escape') document.querySelectorAll('.overlay').forEach(close); }});
  document.getElementById('settingsBtn').onclick = () => open(document.getElementById('settingsSheet'));
  document.querySelectorAll('.card.soon').forEach((c) => {{
    c.onclick = () => {{ document.getElementById('soonName').textContent = c.dataset.tool; open(document.getElementById('soonSheet')); }};
  }});

  requireAuth(async (u) => {{
    const av = document.getElementById('navAvatar');
    if (u.photoURL) {{
      const img = document.createElement('img'); img.src = u.photoURL; img.alt = '';
      av.replaceChildren(img);
    }} else {{
      av.textContent = (u.displayName || u.email || '?')[0].toUpperCase();
    }}
    // First name, as the app greets.
    const firstName = u.displayName?.split(' ')[0] || u.email?.split('@')[0] || 'Creator';
    document.getElementById('welcomeMsg').textContent = 'Welcome, ' + firstName + '!';

    // "Make your first video" only when we KNOW there is no video yet (utils/firstVideo.js);
    // a failed read (offline) shows nothing rather than guessing.
    const key = 'tonefy.madeVideo.' + u.uid;
    if (localStorage.getItem(key) === 'yes') return;
    try {{
      const snap = await getDocs(query(collection(getFirestore(), 'userVideos'), where('userId', '==', u.uid), limit(1)));
      if (snap.empty) document.getElementById('firstCard').hidden = false;
      else localStorage.setItem(key, 'yes');
    }} catch (e) {{ /* offline or denied: no card */ }}
  }});
</script>
</body>
</html>
'''
open(P, 'w').write(html)
print('ok', len(html))
