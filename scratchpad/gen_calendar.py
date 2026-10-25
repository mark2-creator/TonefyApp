import sys
sys.path.insert(0, '/home/ahumuza/tonefy-build/scripts')
from website_icons import icon
P = '/var/www/tonefy-ai/content-calendar.html'
s = open(P).read()
head_end = s.index('<body')
nav_start = s.index('<!-- Bottom Navigation -->')
css = '''
  <!-- Mirrors screens/CalendarScreen.js (Oct 25 2026). THE APP IS THE REFERENCE. -->
  <style>
    :root{--surface:#111}
    .cal-head{padding:16px;border-bottom:1px solid #1a1a1a}
    .cal-head h1{font-size:20px;font-weight:700}
    .main{padding:0 0 60px}
    .stats-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:16px;margin:0}
    .stat-card{border-radius:12px;padding:12px}
    .stat-num{font-size:24px}
    .stat-label{font-size:11px;margin-top:2px;color:#666}
    .calendar-card{margin:0 16px 16px;padding:14px;border-radius:14px}
    .cal-header{margin-bottom:12px}
    .cal-nav{border:0;font-size:18px}
    .cal-grid{gap:0;row-gap:2px}
    .cal-dow{color:#666}
    .cal-day{cursor:default}
    .cal-day.empty{visibility:hidden}
    .cal-day.has-post::after{width:4px;height:4px}
    .filter-tabs{padding:0 16px;margin-bottom:12px;scrollbar-width:none}
    .filter-tab{padding:7px 16px;border-color:transparent}
    .post-card{margin:0 16px 12px;padding:14px;border:0;border-left:3px solid var(--green);background:#111}
    .post-header{margin-bottom:6px}
    .post-caption{line-height:20px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .post-status{margin-bottom:10px}
    .post-status.failed{background:#2a1212;border-color:#5a2020;color:#f87171}
    .post-error{color:#666;font-size:12px;line-height:17px;margin:-4px 0 10px}
    .post-actions{margin-top:0}
    .empty-state{padding:40px}
    .empty-icon{color:#1a1a1a;margin-bottom:12px;line-height:0}
    .empty-icon.err{color:#f87171}
    .empty-sub{color:#666;font-size:13px;margin-bottom:16px}
    .btn-create{margin-top:0;border:0;cursor:pointer;font-family:inherit}
    .spin{width:22px;height:22px;border:2px solid #1a3a24;border-top-color:#2ecc71;border-radius:50%;animation:sp .7s linear infinite;margin:20px auto}
    @keyframes sp{to{transform:rotate(360deg)}}
    .sheet-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;display:flex;align-items:flex-end;justify-content:center}
    .sheet-ov[hidden]{display:none}
    .sheet{background:#111;border-radius:24px 24px 0 0;width:100%;max-width:560px;padding:24px 24px calc(24px + env(safe-area-inset-bottom))}
  </style>
'''
body = f'''<body style="--page-w:720px">
<div class="cal-head"><h1>Content Calendar</h1></div>
<div class="main">
  <div class="stats-row">
    <div class="stat-card"><div class="stat-num" id="sScheduled">0</div><div class="stat-label">Scheduled</div></div>
    <div class="stat-card"><div class="stat-num" id="sPosted">0</div><div class="stat-label">Posted</div></div>
    <div class="stat-card"><div class="stat-num" id="sMonth">0</div><div class="stat-label">This Month</div></div>
  </div>
  <div class="calendar-card gb">
    <div class="cal-header">
      <button class="cal-nav" id="prevM" aria-label="Previous month">‹</button>
      <div class="cal-month" id="calMonth"></div>
      <button class="cal-nav" id="nextM" aria-label="Next month">›</button>
    </div>
    <div class="cal-grid" id="calGrid"></div>
  </div>
  <div class="filter-tabs" id="filters">
    <button class="filter-tab active" data-f="all">All</button>
    <button class="filter-tab" data-f="scheduled">Scheduled</button>
    <button class="filter-tab" data-f="posted">Posted</button>
    <button class="filter-tab" data-f="failed">Failed</button>
  </div>
  <div id="postsList"><div class="spin"></div></div>
</div>

<div class="sheet-ov" id="confirmModal" hidden>
  <div class="sheet" role="dialog" aria-modal="true">
    <div style="font-size:18px;font-weight:700;margin-bottom:8px">Delete Post</div>
    <div style="color:#888;font-size:14px;margin-bottom:24px">Are you sure you want to delete this post?</div>
    <div style="display:flex;gap:10px">
      <button id="confirmCancel" style="flex:1;padding:14px;border-radius:25px;border:1px solid #2a2a2a;background:transparent;color:#888;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>
      <button id="confirmOkBtn" style="flex:1;padding:14px;border-radius:25px;border:1px solid #5a2020;background:#2a1212;color:#f87171;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">Delete</button>
    </div>
  </div>
</div>

<script type="module">
import {{ initializeApp }} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {{ getAuth, onAuthStateChanged }} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {{ getFirestore, collection, getDocs, query, where, doc, deleteDoc }} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
const app=initializeApp({{apiKey:"AIzaSyDcMeyTtu21RMpFKj90b4umvIqy4_WeQOY",authDomain:"gen-lang-client-0229110424.firebaseapp.com",projectId:"gen-lang-client-0229110424",storageBucket:"gen-lang-client-0229110424.firebasestorage.app",messagingSenderId:"5271163602306",appId:"1:527163602306:web:aaa3f48b5ecf11d00acb9b"}});
const auth=getAuth(app), db=getFirestore(app);
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const LABELS={{tiktok:'TikTok',youtube:'YouTube',facebook:'Facebook',instagram:'Instagram',pinterest:'Pinterest',linkedin:'LinkedIn'}};
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}}[c]));
let user=null, posts=[], filter='all', loading=true, error=null, cur=new Date(); cur.setDate(1);

// A post-now record has no scheduledFor (the server writes postedAt), so fall through
// the dates the way the app does or posted items never get a dot.
function postDate(p){{ for(const v of [p.scheduledFor,p.postedAt,p.createdAt]){{ const d=new Date(v); if(!Number.isNaN(d.getTime())) return d; }} return null; }}

function render(){{
  const today=new Date(), y=cur.getFullYear(), m=cur.getMonth();
  document.getElementById('sScheduled').textContent=posts.filter(p=>p.status==='queued').length;
  document.getElementById('sPosted').textContent=posts.filter(p=>p.status==='posted').length;
  document.getElementById('sMonth').textContent=posts.filter(p=>{{const d=postDate(p);return d&&d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear();}}).length;
  document.getElementById('calMonth').textContent=MONTHS[m]+' '+y;
  const days=new Set(posts.map(p=>{{const d=postDate(p);return d&&d.getMonth()===m&&d.getFullYear()===y?d.getDate():null;}}).filter(Boolean));
  let g=DAYS.map(d=>`<div class="cal-dow">${{d}}</div>`).join('');
  for(let i=0;i<new Date(y,m,1).getDay();i++) g+='<div class="cal-day empty"></div>';
  const n=new Date(y,m+1,0).getDate();
  for(let d=1;d<=n;d++){{
    const isToday=d===today.getDate()&&m===today.getMonth()&&y===today.getFullYear();
    g+=`<div class="cal-day${{isToday?' today':''}}${{days.has(d)?' has-post':''}}">${{d}}</div>`;
  }}
  document.getElementById('calGrid').innerHTML=g;

  const list=document.getElementById('postsList');
  if(loading){{ list.innerHTML='<div class="spin"></div>'; return; }}
  if(error){{
    list.innerHTML=`<div class="empty-state"><div class="empty-icon err">{icon('error_outline',48)}</div><div class="empty-title">Could not load your posts</div><div class="empty-sub">${{esc(error)}}</div><button class="btn-create" id="retry">Try again</button></div>`;
    document.getElementById('retry').onclick=load; return;
  }}
  const shown = filter==='all'?posts : filter==='scheduled'?posts.filter(p=>p.status==='queued')
    : filter==='posted'?posts.filter(p=>p.status==='posted') : posts.filter(p=>p.status==='failed'||p.status==='error');
  if(!shown.length){{
    list.innerHTML=`<div class="empty-state"><div class="empty-icon">{icon('inbox',48)}</div><div class="empty-title">No posts here</div><div class="empty-sub">Create a video and schedule it to get started</div><a class="btn-create" href="/idea-to-video.html">Create Video</a></div>`;
    return;
  }}
  list.innerHTML=shown.map(p=>{{
    const failed=p.status==='failed'||p.status==='error', posted=p.status==='posted';
    const d=postDate(p);
    return `<div class="post-card">
      <div class="post-header"><div class="post-platform">${{esc((p.platforms||[]).map(id=>LABELS[id]||id).join(', ')||'No platform')}}</div><div class="post-time">${{d?d.toLocaleDateString():''}}</div></div>
      <div class="post-caption">${{esc(p.caption||'Untitled')}}</div>
      <span class="post-status ${{posted?'posted':failed?'failed':''}}">${{posted?'Posted':failed?'Failed':'Scheduled'}}</span>
      ${{failed&&p.error?'<div class="post-error">This post could not be published. Open it and try posting again.</div>':''}}
      <div class="post-actions">
        <button class="btn-edit" data-edit="${{esc(p.id)}}">Edit</button>
        <button class="btn-del" data-del="${{esc(p.id)}}">Delete</button>
      </div>
    </div>`;
  }}).join('');
}}

async function load(){{
  loading=true; error=null; render();
  try{{
    const snap=await getDocs(query(collection(db,'scheduledPosts'),where('userId','==',user.uid)));
    posts=snap.docs.map(d=>({{id:d.id,...d.data()}})).sort((a,b)=>(postDate(b)||0)-(postDate(a)||0));
  }}catch(e){{ error=navigator.onLine===false?'You are offline. Check your connection and try again.':'Something went wrong on our side. Please try again.'; }}
  loading=false; render();
}}

render();  // the month shows at once, before any data arrives
onAuthStateChanged(auth,u=>{{ if(!u){{ location.href='/login.html'; return; }} user=u; load(); }});
document.getElementById('prevM').onclick=()=>{{ cur=new Date(cur.getFullYear(),cur.getMonth()-1,1); render(); }};
document.getElementById('nextM').onclick=()=>{{ cur=new Date(cur.getFullYear(),cur.getMonth()+1,1); render(); }};
document.getElementById('filters').onclick=e=>{{
  const b=e.target.closest('.filter-tab'); if(!b) return;
  document.querySelectorAll('.filter-tab').forEach(t=>t.classList.toggle('active',t===b));
  filter=b.dataset.f; render();
}};
const modal=document.getElementById('confirmModal');
document.getElementById('confirmCancel').onclick=()=>{{ modal.hidden=true; }};
modal.onclick=e=>{{ if(e.target===modal) modal.hidden=true; }};
document.getElementById('postsList').onclick=e=>{{
  const ed=e.target.closest('[data-edit]'), dl=e.target.closest('[data-del]');
  if(ed){{
    const p=posts.find(x=>x.id===ed.dataset.edit); if(!p) return;
    const B='https://api.fitlifesolutions.site', vu=p.videoUrl||'';
    sessionStorage.setItem('tonefy_video_url',vu); sessionStorage.setItem('tonefy_video_path',vu.startsWith(B)?vu.slice(B.length):vu); sessionStorage.setItem('edit_post_id',p.id);
    sessionStorage.setItem('tonefy_default_caption',p.caption||'');
    location.href='/edit-post-video.html';
  }}
  if(dl){{
    modal.hidden=false;
    document.getElementById('confirmOkBtn').onclick=async()=>{{
      modal.hidden=true;
      try{{ await deleteDoc(doc(db,'scheduledPosts',dl.dataset.del)); posts=posts.filter(p=>p.id!==dl.dataset.del); render(); }}
      catch(err){{ alert('Could not delete this post. Please try again.'); }}
    }};
  }}
}};
</script>

'''
head = s[:head_end].replace('</head>', css + '</head>', 1)
open(P,'w').write(head + body + s[nav_start:])
print('ok')
