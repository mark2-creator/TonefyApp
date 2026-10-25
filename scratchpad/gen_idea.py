import sys, re
sys.path.insert(0, '/home/ahumuza/tonefy-build/scripts')
import website_icons
NEW = {
 'record_voice_over': 'M9 13c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm7.76-9.64l-1.68 1.69c.84 1.18.84 2.71 0 3.89l1.68 1.69c2.02-2.02 2.02-5.07 0-7.27zM20.07 2l-1.63 1.63c2.77 3.02 2.77 7.56 0 10.74L20.07 16c3.9-3.89 3.91-9.95 0-14z',
 'crop_free': 'M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z',
 'subtitles': 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z',
 'movie_filter': 'M18 4l2 3h-3l-2-3h-2l2 3h-3l-2-3H8l2 3H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zm-6.75 11.25L10 18l-1.25-2.75L6 14l2.75-1.25L10 10l1.25 2.75L14 14l-2.75 1.25zm5.69-3.31L16 14l-.94-2.06L13 11l2.06-.94L16 8l.94 2.06L19 11l-2.06.94z',
 'speed': 'M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z',
}
src = open(website_icons.__file__).read()
add = ''.join(f"    '{k}': '{v}',\n" for k, v in NEW.items() if f"'{k}':" not in src)
if add:
    src = src.replace("PATHS = {\n", "PATHS = {\n" + add, 1); open(website_icons.__file__, 'w').write(src)
    website_icons.PATHS.update(NEW)
icon = website_icons.icon

P = '/var/www/tonefy-ai/idea-to-video.html'
s = open(P).read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:80]); s = s.replace(a, b)

def card(key, ic, col, bg, label, val_id, val):
    return (f'''    <button type="button" class="set-card" onclick="openModal('{key}')">
      <span class="set-ic" style="color:{col};background:{bg}">{icon(ic, 22)}</span>
      <span class="set-txt"><span class="set-label">{label}</span><span class="set-val" id="{val_id}">{val}</span></span>
      <span class="set-chev">{icon('chevron_right', 22)}</span>
    </button>''')

step1 = f'''<!-- Step 1 - as the app's IdeaToVideoScreen step 1: the idea, a hint, then optional settings. -->
<div class="step active" id="s1">
  <div class="idea-head"><span class="idea-ic">{icon('lightbulb', 22)}</span><span class="step-title" style="margin:0">Your Idea</span></div>
  <div class="idea-box"><textarea id="prompt" placeholder="What is your video about? For example: 3 easy ways to save money" rows="5"></textarea></div>
  <p class="hint">One sentence is enough. We write the script, add a voice and find the clips.</p>
  <div class="opt-label">OPTIONAL SETTINGS</div>
  <p class="hint" style="margin:0 0 12px 4px">Good choices are already made. Change any of them if you like.</p>
{card('voice','record_voice_over','#60a5fa','#0f1f35','Voice','lVoice','Sarah · US Female')}
{card('ratio','crop_free','#a78bfa','#1a1035','Format','lRatio','9:16 · TikTok/Reels')}
{card('caption','subtitles','#34d399','#0a2a1a','Captions','lCaption','Classic · White + black outline')}
{card('transition','movie_filter','#f472b6','#2a0f1f','Transition','lTransition','Fade · Smooth fade between clips')}
{card('speed','speed','#fb923c','#2a1500','Speed','lSpeed','1x · Normal speed')}
{card('music','music_note','#facc15','#2a2000','Music','lMusic','Cinematic · Epic background music')}
  <div id="aiScenes"></div>
  <div class="prog-wrap" id="p1"><div class="prog-track"><div class="prog-fill" id="pf1"></div></div><div class="prog-label" id="pl1"></div></div>
  <div class="gen-bar">
    <button class="gen-btn" id="b1" onclick="generateScript()" disabled>{icon('auto_awesome', 22)}<span>Generate Script</span></button>
  </div>
</div>

'''
i = s.index('<!-- Step 1 -->'); j = s.index('<!-- Step 2 -->')
s = s[:i] + step1 + s[j:]

rep('''  <textarea id="script" style="flex:1;min-height:220px"></textarea>
''', '''  <textarea id="script" style="flex:1;min-height:220px"></textarea>
  <div id="reportScript"></div>
''')
rep('''  <div class="prog-wrap" id="p3">''', '''  <button class="btn btn-quiet" id="previewVo" type="button" style="border-color:#2ECC71;color:var(--text)">Preview Voiceover</button>
  <audio id="voAudio" preload="none"></audio>
  <div class="prog-wrap" id="p3">''')
rep('''    <button class="btn btn-green" id="b3" onclick="generateVideo()">Generate Video</button>
  </div>''', '''    <button class="btn btn-green" id="b3" onclick="generateVideo()">Generate Video</button>
  </div>
  <p class="wait-note" id="waitNote">Making your video takes about 2 minutes. You can leave this page while it works.</p>''')
rep('''  <div class="step-sub">Preview, download or share your video.</div>
  <video id="vid" controls playsinline loop></video>
  <div class="step-actions">
    <button class="btn btn-green" onclick="goPostVideo()">Post / Schedule</button>
    <button class="btn btn-green" onclick="copyLink()">Copy Link</button>
    <button class="btn btn-dark" onclick="dlVideo()">Download MP4</button>
    <button class="btn btn-purple" onclick="resetAll()">Create another Video</button>
  </div>''', f'''  <video id="vid" controls playsinline loop></video>
  <!-- The app's order (Oct 2026): what nearly everyone wants first is the file, so Save is the
       one green button; posting and the link are real but secondary, so they are outlined. -->
  <div class="step-actions" style="margin-top:0;padding-top:0">
    <button class="btn btn-green" onclick="dlVideo()">{icon('download', 20)}<span>Save to my device</span></button>
    <button class="btn btn-quiet" onclick="goPostVideo()">Post or schedule</button>
    <button class="btn btn-quiet" onclick="copyLink()">Copy link</button>
    <button class="btn btn-purple" onclick="resetAll()">Create Another Video</button>
    <div id="reportVideo"></div>
  </div>''')

css = '''
  <style>
    /* Oct 25 2026: step 1 and the buttons as the app draws them (screens/IdeaToVideoScreen.js). */
    .step-title{font-size:22px;font-weight:700}
    .idea-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}
    .idea-ic{width:40px;height:40px;border-radius:12px;background:#1a2a1e;border:1px solid #2a3a2e;color:#54e98a;display:flex;align-items:center;justify-content:center}
    .idea-box{background:#111;border:1px solid #1a1a1a;border-radius:20px;padding:16px;margin-bottom:8px}
    .idea-box textarea{background:transparent;border:0;padding:0;font-size:16px;line-height:24px;min-height:120px;resize:none;outline:none}
    .hint{color:#666;font-size:12px;line-height:17px;margin:4px 0 0 4px}
    .opt-label{color:#666;font-size:11px;font-weight:600;letter-spacing:1.5px;margin:24px 0 4px 4px}
    .set-card{display:flex;align-items:center;width:100%;background:#111;border:1px solid #1a1a1a;border-radius:20px;padding:14px;margin-bottom:10px;cursor:pointer;font-family:inherit;text-align:left;color:inherit}
    .set-card:hover{background:#151515}
    .set-ic{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin-right:14px;flex:none}
    .set-txt{flex:1;min-width:0;display:flex;flex-direction:column}
    .set-label{color:#666;font-size:11px;font-weight:600;letter-spacing:.5px;margin-bottom:2px}
    .set-val{color:#54e98a;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .set-chev{color:#888;line-height:0}
    .ai-card{background:#111;border:1px solid #1a1a1a;border-radius:20px;padding:14px;margin-bottom:10px}
    a.ai-card{display:block;color:inherit;text-decoration:none}
    .ai-head{display:flex;align-items:flex-start;gap:12px;color:#888}
    .ai-title{font-size:14px;font-weight:700;color:#fff}
    .ai-sub{font-size:12px;line-height:17px;color:#666;margin-top:2px}
    .ai-pro{display:inline-flex;align-items:center;gap:4px;color:#f5c451;font-size:12px;font-weight:700}
    .ai-chips{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
    .ai-chip{min-width:44px;padding:8px 14px;border-radius:20px;border:1px solid #2a2a2a;background:#0a0a0a;color:#fff;font-weight:700;font-family:inherit;cursor:pointer}
    .ai-chip.on{background:#2ECC71;border-color:#2ECC71;color:#000}
    .ai-chip:disabled{opacity:.35;cursor:default}
    .gen-bar{position:sticky;bottom:88px;background:var(--bg);padding-top:12px;margin-top:8px}
    .gen-btn{width:100%;height:50px;border-radius:16px;border:0;background:#2ECC71;color:#003919;font-size:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;font-family:inherit}
    .gen-btn:disabled{opacity:.4;cursor:not-allowed}
    .btn-quiet{background:transparent;color:var(--text);border:1px solid #1a1a1a}
    .btn-purple{background:#7c3aed}
    .wait-note{color:#666;font-size:12px;line-height:17px;text-align:center;margin-top:4px}
    .dot.active{background:#54e98a}
    .step-count{color:#666}
  </style>
'''
rep('  <link rel="stylesheet" href="/assets/app-wide.css" />', css + '  <link rel="stylesheet" href="/assets/app-wide.css" />')

# --- script ---
rep("import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';",
    "import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';\nimport { reportLink, openReport } from '/assets/report.js';")
rep("onAuthStateChanged(auth, u => { if(!u){location.href='/login.html';return;} user=u; });",
    "onAuthStateChanged(auth, u => { if(!u){location.href='/login.html';return;} user=u; loadAiScenes(); });")
rep("let S={step:1,voiceId:'gtts-us',aspectRatio:'9:16',captionStyle:'classic',transition:'fade',musicTrack:'background',audioUrl:'',videoUrl:''};",
    """const SPEEDS=[{id:1.0,label:'1x',desc:'Normal speed'},{id:1.25,label:'1.25x',desc:'Slightly faster'},{id:1.5,label:'1.5x',desc:'Fast'},{id:2.0,label:'2x',desc:'Double speed'}];
const FRESH=()=>({step:1,voiceId:'gtts-us',aspectRatio:'9:16',captionStyle:'classic',transition:'fade',musicTrack:'background',videoSpeed:1.0,aiScenes:0,audioUrl:'',videoUrl:''});
let S=FRESH();

// A sentence for people, never the raw error (CLAUDE.md: never show e.message). The server's
// own `error` text is already written for people (publicError) and is shown as it is.
function friendly(e, fallback){
  if (navigator.onLine === false) return 'You are offline. Check your connection and try again.';
  if (e && /timed out/i.test(e.message||'')) return 'This is taking longer than usual. Your video may still appear in My Videos.';
  return fallback;
}

// The Generate button waits for an idea, as in the app.
const promptEl=document.getElementById('prompt'), b1=document.getElementById('b1');
const syncB1=()=>{ b1.disabled=!promptEl.value.trim(); };
promptEl.addEventListener('input', syncB1); syncB1();

// AI scenes - the app's AiScenesRow: hidden unless the feature is available, an offer for
// free accounts, a 0..perVideo choice for paid ones (capped by what is left this month).
async function loadAiScenes(){
  const host=document.getElementById('aiScenes');
  try{
    const st=await get('/api/ai-scenes/status');
    if(!st||!st.available){ host.innerHTML=''; return; }
    const E=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    if(!st.enabled){
      host.innerHTML=`<a class="ai-card" href="/upgrade.html"><div class="ai-head">"""+icon('auto_awesome',20)+"""<div style="flex:1"><div class="ai-title" style="color:#888">AI scenes</div><div class="ai-sub">Generate your opening scenes with AI instead of stock footage</div></div><span class="ai-pro">"""+icon('diamond',12)+"""Pro</span></div></a>`;
      return;
    }
    const max=Math.min(st.perVideo, st.remaining);
    if(S.aiScenes===0 && max>=1) S.aiScenes=1;
    if(S.aiScenes>max) S.aiScenes=max;
    const sub=st.unlimited?'Admin account: no monthly limit. Scenes that cannot be generated use stock footage.'
      : st.remaining>0?`${st.remaining} of ${st.perCycle} left this month. Scenes that cannot be generated use stock footage and are not counted.`
      : `All ${st.perCycle} used this month. They refresh with your credits.`;
    const draw=()=>{
      host.innerHTML=`<div class="ai-card"><div class="ai-head">"""+icon('auto_awesome',20)+"""<div style="flex:1"><div class="ai-title">AI scenes</div><div class="ai-sub">${E(sub)}</div></div></div>
        <div class="ai-chips">${Array.from({length:st.perVideo+1},(_,n)=>`<button type="button" class="ai-chip${S.aiScenes===n?' on':''}" data-n="${n}" ${n>max?'disabled':''}>${n}</button>`).join('')}</div></div>`;
      host.querySelectorAll('.ai-chip').forEach(b=>b.onclick=()=>{ S.aiScenes=+b.dataset.n; draw(); });
    };
    draw();
  }catch(e){ host.innerHTML=''; }
}

// Report links, as the app puts under the script and the finished video.
document.getElementById('reportScript').innerHTML=reportLink('Report this script');
document.getElementById('reportScript').firstChild.onclick=()=>openReport({kind:'script',screen:'IdeaToVideo',contentText:document.getElementById('script').value,getToken:tok});
document.getElementById('reportVideo').innerHTML=reportLink();
document.getElementById('reportVideo').firstChild.onclick=()=>openReport({kind:'video',screen:'IdeaToVideo',contentUrl:S.videoUrl?BACKEND+S.videoUrl:null,getToken:tok});

// Preview the voiceover before making the video (the app's step 3 button).
const vo=document.getElementById('voAudio'), pv=document.getElementById('previewVo');
pv.onclick=()=>{
  if(!S.audioUrl) return;
  const src=/^https?:/.test(S.audioUrl)?S.audioUrl:BACKEND+S.audioUrl;
  if(vo.src!==src) vo.src=src;
  if(vo.paused){ vo.play().catch(()=>showToast('This voiceover could not be played.')); } else vo.pause();
};
vo.onplay=()=>{ pv.textContent='Pause Preview'; }; vo.onpause=vo.onended=()=>{ pv.textContent='Preview Voiceover'; };""")
rep("  }catch(e){showToast(e.message);}\n  btn.disabled=false;btn.innerHTML='Generate Script';",
    "  }catch(e){showToast(friendly(e,'Your script could not be written. Please try again.'));}\n  btn.disabled=false;btn.innerHTML='"+icon('auto_awesome',22)+"<span>Generate Script</span>';syncB1();")
rep("  }catch(e){showToast(e.message);}\n  btn.disabled=false;btn.innerHTML='Generate Voiceover';",
    "  }catch(e){showToast(friendly(e,'Your voiceover could not be made. Please try again.'));}\n  btn.disabled=false;btn.innerHTML='Generate Voiceover';")
rep("showToast('Error: '+e.message);}", "showToast(friendly(e,'Your video could not be made. Please try again.'));}\n  document.getElementById('waitNote').textContent='Making your video takes about 2 minutes. You can leave this page while it works.';")
rep("else if(j.status==='failed'){clearInterval(iv);rej(new Error(j.message));}", "else if(j.status==='failed'){clearInterval(iv);rej(new Error('failed'));}")
rep("musicTrack:S.musicTrack})", "musicTrack:S.musicTrack,videoSpeed:S.videoSpeed,aiScenes:S.aiScenes})")
rep("  prog(3,5,'Analyzing script into scenes...');", "  prog(3,5,'Analyzing script into scenes...');\n  document.getElementById('waitNote').textContent='Still working. You can leave this page: your video will be waiting in My Videos.';")
rep("window.resetAll=function(){ S={step:1,voiceId:'gtts-us',aspectRatio:'9:16',captionStyle:'classic',transition:'fade',musicTrack:'background',audioUrl:'',videoUrl:''};",
    "window.resetAll=function(){ S=FRESH(); loadAiScenes();")
# modal: speed type
rep("const titles={voice:'Choose Voice',ratio:'Video Format',caption:'Caption Style',transition:'Transition Effect',music:'Background Music'};",
    "const titles={voice:'Choose Voice',ratio:'Video Format',caption:'Caption Style',transition:'Transition Effect',speed:'Video Speed',music:'Background Music'};")
rep("const items=type==='voice'?VOICES:type==='ratio'?RATIOS:type==='caption'?CAPS:type==='transition'?TRANSITIONS:MUSIC;",
    "const items=type==='voice'?VOICES:type==='ratio'?RATIOS:type==='caption'?CAPS:type==='transition'?TRANSITIONS:type==='speed'?SPEEDS:MUSIC;")
rep("const selId=type==='voice'?S.voiceId:type==='ratio'?S.aspectRatio:type==='caption'?S.captionStyle:type==='transition'?S.transition:S.musicTrack;",
    "const selId=type==='voice'?S.voiceId:type==='ratio'?S.aspectRatio:type==='caption'?S.captionStyle:type==='transition'?S.transition:type==='speed'?S.videoSpeed:S.musicTrack;")
rep("      else if(type==='transition')S.transition=item.id;\n      else S.musicTrack=item.id;",
    "      else if(type==='transition')S.transition=item.id;\n      else if(type==='speed')S.videoSpeed=item.id;\n      else S.musicTrack=item.id;")
# labels: no `.icon` (it was undefined: picking a voice showed "undefined Sarah")
i = s.index('function updateLabels(){'); j = s.index('}\n', s.index("document.getElementById('lMusic')", i)) + 2
s = s[:i] + """function updateLabels(){
  // Items have no .icon - the old labels printed "undefined Sarah · US Female" after a pick.
  const v=VOICES.find(x=>x.id===S.voiceId),r=RATIOS.find(x=>x.id===S.aspectRatio),cap=CAPS.find(x=>x.id===S.captionStyle);
  const tr=TRANSITIONS.find(x=>x.id===S.transition),mu=MUSIC.find(x=>x.id===S.musicTrack),sp=SPEEDS.find(x=>x.id===S.videoSpeed);
  document.getElementById('lVoice').textContent=v.label+' · '+v.accent;
  document.getElementById('lRatio').textContent=r.label+' · '+r.desc;
  document.getElementById('lCaption').textContent=cap.label+' · '+cap.desc;
  document.getElementById('lTransition').textContent=tr.label+' · '+tr.desc;
  document.getElementById('lSpeed').textContent=sp.label+' · '+sp.desc;
  document.getElementById('lMusic').textContent=mu.label+' · '+mu.desc;
}
""" + s[j:]
open(P, 'w').write(s)
print('ok')
