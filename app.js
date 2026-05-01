// ═══════════════════════════════════════════════════════
//  StreamVault — app.js
//
//  ⚙️  CONFIGURATION — change this if your backend runs on a different port
// ═══════════════════════════════════════════════════════

const API_BASE = 'http://localhost:8000/api/v1';

// ── Self-test on load: pings /healthcheck and shows a banner if unreachable ──
async function checkBackendConnection() {
  try {
    const r = await fetch(API_BASE + '/healthcheck', {
      credentials: 'include',
      signal: AbortSignal.timeout(5000),
    });
    // Your healthcheck returns {statusCode:200, success:true, data:null}
    // r.ok = true means HTTP 200 — that is enough, backend is reachable
    if (r.ok) return true;
    throw new Error('not ok');
  } catch (e) {
    // Only show the banner for actual network failures (backend not running)
    // not for auth errors (401) which just mean user is not logged in yet
    if (e.message === 'Unauthorized') return false;
    const banner = document.createElement('div');
    banner.id = 'sv-offline-banner';
    banner.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;
      background:#1f1f28;border:1px solid rgba(248,113,113,.4);border-left:3px solid #f87171;
      padding:12px 20px;border-radius:10px;font-size:13px;color:#f1f0ff;
      font-family:'Outfit',sans-serif;max-width:460px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.5);
      display:flex;align-items:flex-start;gap:10px;`;
    banner.innerHTML = `
      <span style="font-size:18px;flex-shrink:0;">🔌</span>
      <div>
        <div style="font-weight:600;margin-bottom:4px;color:#f87171;">Backend not reachable</div>
        <div style="color:#a0a0b8;font-size:12px;line-height:1.7;">
          Run <code style="background:rgba(255,255,255,.08);padding:1px 6px;border-radius:4px;font-family:monospace;">npm run dev</code>
          in your backend folder, then refresh.<br/>
          Expected at: <code style="background:rgba(255,255,255,.08);padding:1px 6px;border-radius:4px;font-family:monospace;">${API_BASE}</code>
        </div>
      </div>
      <button onclick="this.remove()" style="background:none;border:none;color:#5c5c78;cursor:pointer;font-size:18px;padding:0;flex-shrink:0;line-height:1;margin-left:4px;">✕</button>`;
    // Remove any existing banner before adding new one
    document.getElementById('sv-offline-banner')?.remove();
    document.body.appendChild(banner);
    setTimeout(() => banner?.remove(), 10000);
    return false;
  }
}


// ══════════════════════════════════
//  STATE
// ══════════════════════════════════
const S = {
  user: null,
  videos: [],          // cached video list for related/search fallback
  history: JSON.parse(localStorage.getItem('sv_hist') || '[]'),
  prefs: JSON.parse(localStorage.getItem('sv_prefs') || '{"autoplay":true,"saveHistory":true,"emailNotif":false}'),
};

// ══════════════════════════════════
//  API HELPER
// ══════════════════════════════════
async function api(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const options = {
    credentials: 'include',
    headers: isForm ? {} : { 'Content-Type': 'application/json' },
    ...opts,
  };
  if (!isForm && options.body && typeof options.body === 'object') {
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(API_BASE + path, options);
  if (res.status === 401) { showAuth(); throw new Error('Unauthorized'); }
  // Safely parse JSON — if backend returns HTML (404 page etc) don't crash
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Not JSON — likely a 404 HTML page or server error
    throw new Error(`Non-JSON response from ${path}: ${text.slice(0, 80)}`);
  }
}

function ok(r) { return r && (r.success || r.statusCode === 200 || r.statusCode === 201); }

// ══════════════════════════════════
//  TOAST
// ══════════════════════════════════
function toast(msg, type = 'info') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'tOut .3s ease forwards';
    setTimeout(() => el.remove(), 320);
  }, 3500);
}

// ══════════════════════════════════
//  CONFIRM DIALOG
// ══════════════════════════════════
function confirm2(title, body, cb) {
  document.getElementById('dlg-title').textContent = title;
  document.getElementById('dlg-body').textContent = body;
  const ok2 = document.getElementById('dlg-ok');
  ok2.onclick = () => { closeModal('confirm-modal'); cb(); };
  openModal('confirm-modal');
}

// ══════════════════════════════════
//  MODAL
// ══════════════════════════════════
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// close on overlay click or Escape
document.addEventListener('click', e => {
  if (e.target.classList.contains('moverlay')) e.target.classList.remove('open');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.moverlay.open').forEach(m => m.classList.remove('open'));
});

// ══════════════════════════════════
//  UTILS
// ══════════════════════════════════
const $v = id => document.getElementById(id)?.value?.trim() || '';
const $fi = id => document.getElementById(id)?.files?.[0];
function $set(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function setLabel(inputId, labelId) {
  const f = $fi(inputId);
  if (f) { const el = document.getElementById(labelId); if (el) el.textContent = f.name; }
}
function setBusy(btn, busy, label = '') {
  btn.disabled = busy;
  btn.innerHTML = busy ? '<div class="spin"></div>' : `<span>${label}</span>`;
}
function autoResize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function fmtDur(s) {
  s = Math.floor(s || 0);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}
function ago(date) {
  if (!date) return '';
  const d = Math.floor((Date.now() - new Date(date)) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  if (d < 2592000) return Math.floor(d / 86400) + 'd ago';
  if (d < 31536000) return Math.floor(d / 2592000) + 'mo ago';
  return Math.floor(d / 31536000) + 'y ago';
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function avHTML(av, name, size = 30) {
  const i = initials(name);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,var(--accent2),var(--accent3));overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.38)}px;font-weight:700;color:#fff;flex-shrink:0;">
    ${av ? `<img src="${av}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />` : i}
  </div>`;
}

// ══════════════════════════════════
//  PAGE CONTROL
// ══════════════════════════════════
function showAuth() {
  document.getElementById('auth-page').classList.add('active');
  document.getElementById('app-page').classList.remove('active');
  document.getElementById('video-page').classList.remove('active');
}
function showApp() {
  document.getElementById('auth-page').classList.remove('active');
  document.getElementById('video-page').classList.remove('active');
  document.getElementById('app-page').classList.add('active');
  syncAvatars();
}
function showVideoPage() {
  document.getElementById('app-page').classList.remove('active');
  document.getElementById('auth-page').classList.remove('active');
  document.getElementById('video-page').classList.add('active');
  syncAvatars();
}
function syncAvatars() {
  ['h-avatar','vp-avatar'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = S.user?.avatar
      ? `<img src="${S.user.avatar}" alt="" onerror="this.style.display='none'" />`
      : (S.user?.fullName?.[0] || '?').toUpperCase();
  });
}

// ══════════════════════════════════
//  NAVIGATE
// ══════════════════════════════════
function navigate(view) {
  if (view !== 'video') {
    showApp();
    if (window.innerWidth < 900) closeSidebar();
  }
  document.querySelectorAll('.nlink').forEach(l => l.classList.remove('active'));
  const nl = document.getElementById('n-' + view);
  if (nl) nl.classList.add('active');

  const main = document.getElementById('main-content');
  main.innerHTML = `<div class="loading"><div class="spin" style="width:30px;height:30px;border-width:3px;margin-bottom:12px;"></div><div>Loading…</div></div>`;

  const map = {
    home: renderHome,
    subscriptions: renderSubscriptions,
    trending: () => renderHome(true),
    history: renderHistory,
    liked: renderLiked,
    playlists: renderPlaylists,
    tweets: renderTweets,
    dashboard: renderDashboard,
    profile: renderProfile,
    settings: renderSettings,
  };
  (map[view] || renderHome)();
}

// ══════════════════════════════════
//  SIDEBAR TOGGLE (mobile)
// ══════════════════════════════════
function toggleSidebar() {
  const s = document.getElementById('sidebar');
  s.classList.toggle('open');
}
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); }

// ══════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════
document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
  const map = { '/':'search', 'h':'home', 'd':'dashboard', 'p':'profile', 't':'trending', 'l':'liked', 'H':'history' };
  if (e.key === '/') { e.preventDefault(); document.getElementById('search-input')?.focus(); return; }
  if (map[e.key]) navigate(map[e.key]);
});

// ══════════════════════════════════
//  AUTH
// ══════════════════════════════════
function switchAuthTab(t) {
  ['login','register'].forEach(x => {
    document.getElementById('atab-' + x)?.classList.toggle('active', x === t);
    document.getElementById('aform-' + x)?.classList.toggle('active', x === t);
  });
}

async function handleLogin() {
  const id = $v('li'), pw = $v('lp');
  if (!id || !pw) { toast('Please fill in all fields', 'error'); return; }
  const btn = document.getElementById('login-btn');
  setBusy(btn, true);
  try {
    const body = { password: pw };
    id.includes('@') ? (body.email = id) : (body.username = id);
    const r = await api('/users/login', { method: 'POST', body });
    if (ok(r)) {
      S.user = r.data?.user || r.data;
      toast('Welcome back, ' + (S.user.fullName || S.user.username) + '!', 'success');
      showApp(); navigate('home');
    } else {
      toast(r.message || 'Login failed — check credentials', 'error');
    }
  } catch (e) {
    if (e.message !== 'Unauthorized') toast('Cannot reach server. Is the backend running on ' + API_BASE + '?', 'error');
  } finally { setBusy(btn, false, 'Sign In'); }
}

async function handleRegister() {
  const fn = $v('rfn'), un = $v('run'), em = $v('rem'), pw = $v('rpw');
  const avFile = $fi('rav');
  if (!fn || !un || !em || !pw || !avFile) { toast('All fields and avatar are required', 'error'); return; }
  if (pw.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
  const btn = document.getElementById('reg-btn');
  setBusy(btn, true);
  try {
    const fd = new FormData();
    fd.append('fullName', fn); fd.append('username', un.toLowerCase().replace(/\s/g,''));
    fd.append('email', em); fd.append('password', pw); fd.append('avatar', avFile);
    const cvFile = $fi('rcv'); if (cvFile) fd.append('coverImage', cvFile);
    const r = await api('/users/register', { method: 'POST', body: fd });
    if (ok(r)) {
      toast('Account created! Please sign in.', 'success');
      switchAuthTab('login');
    } else toast(r.message || 'Registration failed', 'error');
  } catch (e) {
    if (e.message !== 'Unauthorized') toast('Cannot reach server', 'error');
  } finally { setBusy(btn, false, 'Create Account'); }
}

async function handleLogout() {
  try { await api('/users/logout', { method: 'POST' }); } catch {}
  S.user = null;
  toast('Signed out', 'info');
  showAuth();
}

// ══════════════════════════════════
//  INIT / BOOT
// ══════════════════════════════════
async function init() {
  // Check backend is reachable first — shows a helpful banner if not
  checkBackendConnection();
  try {
    const r = await api('/users/current-user');
    if (ok(r) && r.data) {
      S.user = r.data;
      showApp(); navigate('home');
    } else showAuth();
  } catch {
    showAuth();
  }
}

// ══════════════════════════════════
//  VIDEO CARD HTML
// ══════════════════════════════════
function vcHTML(v) {
  const ch = v.owner?.fullName || v.owner?.username || 'Unknown';
  const isOwn = v.owner?._id === S.user?._id || v.owner?.username === S.user?.username;
  const av = v.owner?.avatar;
  return `
  <div class="vcard" onclick="openVideo('${esc(v._id)}')" oncontextmenu="showCtx(event,'${esc(v._id)}',${isOwn});return false;">
    <div class="vthumb">
      ${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : ''}
      <div class="vthumb-ph" style="${v.thumbnail?'display:none':''}">▶</div>
      <div class="vdur">${fmtDur(v.duration)}</div>
      ${v.isPublished === false ? `<div class="vcard-badge"><span class="tag tag-red">Private</span></div>` : ''}
    </div>
    <div class="vinfo">
      <div class="vtitle">${esc(v.title || 'Untitled')}</div>
      <div class="vmeta">
        <div class="vch-av">${av ? `<img src="${esc(av)}" alt="" onerror="this.style.display='none'"/>` : ''}${!av ? initials(ch) : ''}</div>
        <div>
          <div class="vch-name">${esc(ch)}</div>
          <div class="vstats">${fmtNum(v.views)} views · ${ago(v.createdAt)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════
//  HOME / TRENDING
// ══════════════════════════════════
async function renderHome(trending = false) {
  const sort = trending ? 'views' : 'createdAt';
  try {
    const r = await api(`/video?page=1&limit=24&sortBy=${sort}&sortType=desc`);
    S.videos = r.data?.docs || r.data?.videos || (Array.isArray(r.data) ? r.data : []);
    renderVideoGrid(S.videos, trending ? '🔥 Trending' : 'Latest Videos');
  } catch {
    renderMockHome(trending);
  }
}

function renderMockHome(trending) {
  const mock = [
    {_id:'m0',title:'Building a Full REST API with Node.js & Express',views:14200,duration:1340,owner:{username:'devguru',fullName:'Dev Guru'},createdAt:new Date(Date.now()-1e6).toISOString()},
    {_id:'m1',title:'MongoDB Aggregation Pipelines — Complete Guide',views:9800,duration:2240,owner:{username:'mongodev',fullName:'Mongo Dev'},createdAt:new Date(Date.now()-2e6).toISOString()},
    {_id:'m2',title:'JWT + Refresh Tokens — Secure Auth Pattern',views:21000,duration:1870,owner:{username:'swayam',fullName:'Swayam Singh'},createdAt:new Date(Date.now()-3e6).toISOString()},
    {_id:'m3',title:'Cloudinary — Upload, Transform & Optimize Media',views:6300,duration:980,owner:{username:'clouddev',fullName:'Cloud Dev'},createdAt:new Date(Date.now()-4e6).toISOString()},
    {_id:'m4',title:'Mongoose Schemas, Virtuals & Plugins',views:7600,duration:1520,owner:{username:'mongodev',fullName:'Mongo Dev'},createdAt:new Date(Date.now()-5e6).toISOString()},
    {_id:'m5',title:'Multer — Handling File Uploads in Express',views:5100,duration:890,owner:{username:'devguru',fullName:'Dev Guru'},createdAt:new Date(Date.now()-6e6).toISOString()},
    {_id:'m6',title:'CORS & Cookie Setup for Full Stack Apps',views:11200,duration:760,owner:{username:'fullstacker',fullName:'Full Stacker'},createdAt:new Date(Date.now()-7e6).toISOString()},
    {_id:'m7',title:'Pagination with mongoose-aggregate-paginate-v2',views:4400,duration:680,owner:{username:'swayam',fullName:'Swayam Singh'},createdAt:new Date(Date.now()-8e6).toISOString()},
  ];
  if (trending) mock.sort((a,b) => b.views - a.views);
  S.videos = mock;
  renderVideoGrid(mock, trending ? '🔥 Trending' : 'Latest Videos', true);
}

function renderVideoGrid(videos, title, isMock = false) {
  const main = document.getElementById('main-content');
  const hint = isMock ? `<div style="margin-bottom:16px;padding:10px 14px;background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.2);border-radius:var(--rsm);font-size:12px;color:var(--blue);">📡 Showing demo content — start your backend at <code style="font-family:var(--mono);">${API_BASE}</code> to load real data</div>` : '';
  if (!videos.length) {
    main.innerHTML = `
      <div class="sec-hdr fade"><div class="sec-title">${title}</div><button class="btn accent" onclick="openModal('upload-modal')">＋ Upload</button></div>
      ${hint}
      <div class="empty"><div class="empty-icon">📭</div><div class="empty-title">No videos yet</div><div class="empty-sub">Upload your first video to get started</div></div>`;
    return;
  }
  main.innerHTML = `
    <div class="sec-hdr fade">
      <div class="sec-title">${title}<small>${videos.length} videos</small></div>
      <button class="btn accent" onclick="openModal('upload-modal')">＋ Upload</button>
    </div>
    ${hint}
    <div class="vgrid fade">${videos.map(v => vcHTML(v)).join('')}</div>`;
}

// ══════════════════════════════════
//  SEARCH
// ══════════════════════════════════
async function doSearch() {
  const q = document.getElementById('search-input')?.value?.trim();
  if (!q) { toast('Enter a search term', 'info'); return; }
  showApp();
  document.getElementById('main-content').innerHTML = `<div class="loading"><div class="spin" style="width:30px;height:30px;border-width:3px;"></div></div>`;
  try {
    const r = await api(`/video?page=1&limit=24&query=${encodeURIComponent(q)}&sortBy=views&sortType=desc`);
    const vids = r.data?.docs || r.data?.videos || (Array.isArray(r.data) ? r.data : []);
    renderVideoGrid(vids, `🔍 "${esc(q)}"`);
  } catch {
    const f = S.videos.filter(v => v.title?.toLowerCase().includes(q.toLowerCase()));
    renderVideoGrid(f, `🔍 "${esc(q)}"`);
  }
}

// ══════════════════════════════════
//  VIDEO PLAYER
// ══════════════════════════════════
async function openVideo(id) {
  showVideoPage();
  const mainEl = document.getElementById('vp-main');
  const sideEl = document.getElementById('vp-sidebar');
  mainEl.innerHTML = `<div class="loading"><div class="spin" style="width:30px;height:30px;border-width:3px;"></div></div>`;
  sideEl.innerHTML = '';

  let video;
  if (id.startsWith('m')) {
    video = S.videos.find(v => v._id === id);
  } else {
    try {
      const r = await api(`/video/${id}`);
      video = r.data || null;
      // record view
      api(`/video/view/${id}`, { method: 'PATCH' }).catch(() => {});
    } catch { video = S.videos.find(v => v._id === id); }
  }

  if (!video) { toast('Video not found', 'error'); navigate('home'); return; }

  // save history
  if (S.prefs.saveHistory) {
    S.history = [id, ...S.history.filter(x => x !== id)].slice(0, 60);
    localStorage.setItem('sv_hist', JSON.stringify(S.history));
  }

  const ch = video.owner?.fullName || video.owner?.username || 'Unknown';
  const chAv = video.owner?.avatar;
  const isSubbed = video.isSubscribed || false;
  const isLiked = video.isLiked || false;

  mainEl.innerHTML = `
  <div class="fade">
    ${video.videoFile
      ? `<div class="vplayer-wrap"><video controls ${S.prefs.autoplay ? 'autoplay' : ''} src="${esc(video.videoFile)}" id="vid-el" onended="onVideoEnd()"></video></div>`
      : `<div class="vplayer-ph">▶</div>`}

    <h1 class="vp-title">${esc(video.title || 'Untitled')}</h1>

    <div class="vp-bar">
      <div class="vch-row">
        ${avHTML(chAv, ch, 42)}
        <div>
          <div class="vch-name-lg">${esc(ch)}</div>
          <div class="vch-subs">${fmtNum(video.owner?.subscribersCount || 0)} subscribers</div>
        </div>
        ${video.owner?._id !== S.user?._id
          ? `<button class="btn-subscribe ${isSubbed ? 'subbed' : ''}" id="sub-btn" onclick="toggleSub('${esc(video.owner?._id)}')">
              ${isSubbed ? '✓ Subscribed' : 'Subscribe'}
            </button>`
          : `<span class="tag tag-purple">Your Video</span>`}
      </div>
      <div class="act-btns">
        <button class="act-btn ${isLiked ? 'on' : ''}" id="like-btn" onclick="toggleVidLike('${esc(video._id)}')">
          👍 <span id="like-count">${fmtNum(video.likesCount || 0)}</span>
        </button>
        <button class="act-btn" onclick="openAddToPlaylist('${esc(video._id)}')">🎵 Save</button>
        <button class="act-btn" onclick="shareVideo()">🔗 Share</button>
        ${video.owner?._id === S.user?._id
          ? `<button class="act-btn" onclick="openEditVideo('${esc(video._id)}','${esc(video.title||'')}','${esc(video.description||'')}')">✏️ Edit</button>`
          : ''}
      </div>
    </div>

    <div class="vdesc-box collapsed" onclick="toggleDesc(this)">
      <div class="vdesc-meta">${fmtNum(video.views || 0)} views · ${ago(video.createdAt)}</div>
      <div class="vdesc-text">${esc(video.description || 'No description provided.')}</div>
      <div class="vdesc-toggle">Show more ▾</div>
    </div>

    <div class="cm-header">
      <div class="cm-title" id="cm-title">Comments</div>
    </div>
    <div class="cm-input-row">
      ${avHTML(S.user?.avatar, S.user?.fullName || '?', 32)}
      <div class="cm-input-wrap">
        <textarea class="cm-input" id="cm-inp" placeholder="Add a comment…" rows="1"
          oninput="autoResize(this)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();postComment('${esc(video._id)}');}"></textarea>
        <div class="cm-btns">
          <button class="btn ghost" onclick="$set('cm-inp','');autoResize(document.getElementById('cm-inp'))">Cancel</button>
          <button class="btn accent" onclick="postComment('${esc(video._id)}')">Comment</button>
        </div>
      </div>
    </div>
    <div id="cm-list"><div class="loading"><div class="spin"></div></div></div>
  </div>`;

  loadComments(video._id);

  // Sidebar — related videos
  const related = S.videos.filter(v => v._id !== id).slice(0, 12);
  sideEl.innerHTML = `
    <div class="rel-header">Up Next</div>
    ${related.map(v => `
      <div class="rel-card" onclick="openVideo('${esc(v._id)}')">
        <div class="rel-thumb">
          ${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : '▶'}
          <div class="rel-dur">${fmtDur(v.duration)}</div>
        </div>
        <div>
          <div class="rel-title">${esc(v.title || 'Untitled')}</div>
          <div class="rel-ch">${esc(v.owner?.fullName || v.owner?.username || '')}</div>
          <div class="rel-views">${fmtNum(v.views)} views</div>
        </div>
      </div>`).join('')}`;

  // autoplay next
  window._vpVideoId = id;
  window._vpVideoList = related;
}

function toggleDesc(el) {
  el.classList.toggle('collapsed');
  const t = el.querySelector('.vdesc-toggle');
  if (t) t.textContent = el.classList.contains('collapsed') ? 'Show more ▾' : 'Show less ▴';
}

function onVideoEnd() {
  if (!S.prefs.autoplay || !window._vpVideoList?.length) return;
  const next = window._vpVideoList[0];
  if (next) { toast('Playing next…', 'info'); setTimeout(() => openVideo(next._id), 1200); }
}

async function toggleVidLike(id) {
  const btn = document.getElementById('like-btn');
  if (!btn) return;
  try {
    await api(`/like/toggle/v/${id}`, { method: 'POST' });
    const isNow = btn.classList.toggle('on');
    const cnt = document.getElementById('like-count');
    if (cnt) {
      const cur = parseInt(cnt.textContent.replace(/[KMB]/g,'')) || 0;
      cnt.textContent = fmtNum(isNow ? cur + 1 : Math.max(0, cur - 1));
    }
    toast(isNow ? '👍 Liked' : 'Like removed', 'info');
  } catch { toast('Sign in to like videos', 'error'); }
}

async function toggleSub(channelId) {
  const btn = document.getElementById('sub-btn');
  if (!btn) return;
  try {
    await api(`/subscriber/${channelId}`, { method: 'POST' });
    const isNow = btn.classList.toggle('subbed');
    btn.textContent = isNow ? '✓ Subscribed' : 'Subscribe';
    toast(isNow ? '🔔 Subscribed!' : 'Unsubscribed', isNow ? 'success' : 'info');
  } catch { toast('Could not update subscription', 'error'); }
}

function shareVideo() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: document.title, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => toast('Link copied to clipboard!', 'success'));
  }
}

// ── COMMENTS ──
async function loadComments(videoId) {
  if (videoId.startsWith('m')) {
    document.getElementById('cm-list').innerHTML = `
      <div class="cm-card">
        ${avHTML(null, 'Swayam Singh', 30)}
        <div>
          <span class="cm-name">Swayam Singh</span><span class="cm-time">2h ago</span>
          <div class="cm-text">Great video! Really learned a lot. 🔥</div>
          <div class="cm-actions"><button class="cm-act">👍 12</button></div>
        </div>
      </div>
      <div style="text-align:center;padding:20px;font-size:13px;color:var(--text3);">
        Connect backend to see & post real comments.
      </div>`;
    return;
  }
  try {
    const r = await api(`/comment/${videoId}?page=1&limit=30`);
    const cms = r.data?.docs || r.data || [];
    const titleEl = document.getElementById('cm-title');
    if (titleEl) titleEl.textContent = `Comments (${cms.length})`;
    const el = document.getElementById('cm-list');
    if (!el) return;
    if (!cms.length) {
      el.innerHTML = `<div style="text-align:center;padding:24px;font-size:13px;color:var(--text3);">No comments yet — be the first!</div>`;
      return;
    }
    el.innerHTML = cms.map(c => cmCardHTML(c, videoId)).join('');
  } catch {
    const el = document.getElementById('cm-list');
    if (el) el.innerHTML = `<div style="padding:14px;font-size:13px;color:var(--text3);">Could not load comments.</div>`;
  }
}

function cmCardHTML(c, videoId) {
  const name = c.owner?.fullName || c.owner?.username || 'User';
  const isOwn = c.owner?._id === S.user?._id;
  return `
  <div class="cm-card" id="cmc-${esc(c._id)}">
    ${avHTML(c.owner?.avatar, name, 30)}
    <div style="flex:1;min-width:0;">
      <span class="cm-name">${esc(name)}</span>
      <span class="cm-time">${ago(c.createdAt)}</span>
      <div class="cm-text" id="cmt-${esc(c._id)}">${esc(c.content || '')}</div>
      <div class="cm-actions">
        <button class="cm-act ${c.isLiked?'liked':''}" onclick="likeComment('${esc(c._id)}',this)">
          👍 <span>${fmtNum(c.likesCount || 0)}</span>
        </button>
        ${isOwn ? `
          <button class="cm-act" onclick="editCmUI('${esc(c._id)}','${esc(c.content||'')}','${esc(videoId)}')">✏️ Edit</button>
          <button class="cm-act" onclick="deleteCm('${esc(c._id)}','${esc(videoId)}')">🗑 Delete</button>
        ` : ''}
      </div>
    </div>
  </div>`;
}

async function postComment(videoId) {
  const inp = document.getElementById('cm-inp');
  const content = inp?.value?.trim();
  if (!content) { toast('Write something first', 'info'); return; }
  if (videoId.startsWith('m')) { toast('Connect backend to post comments', 'info'); return; }
  inp.value = ''; autoResize(inp);
  try {
    const r = await api(`/comment/${videoId}`, { method: 'POST', body: { content } });
    if (ok(r)) { toast('Comment posted!', 'success'); loadComments(videoId); }
    else toast(r.message || 'Failed to post', 'error');
  } catch { toast('Error posting comment', 'error'); }
}

function editCmUI(cmId, current, videoId) {
  const el = document.getElementById('cmt-' + cmId); if (!el) return;
  el.outerHTML = `
    <textarea class="cm-edit-input" id="ce-${esc(cmId)}" rows="2" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();saveCm('${esc(cmId)}','${esc(videoId)}');}">${esc(current)}</textarea>
    <div class="cm-actions">
      <button class="cm-act" onclick="saveCm('${esc(cmId)}','${esc(videoId)}')">💾 Save</button>
      <button class="cm-act" onclick="loadComments('${esc(videoId)}')">Cancel</button>
    </div>`;
}

async function saveCm(cmId, videoId) {
  const inp = document.getElementById('ce-' + cmId);
  const content = inp?.value?.trim(); if (!content) return;
  try {
    const r = await api(`/comment/c/${cmId}`, { method: 'PATCH', body: { content } });
    if (ok(r)) { toast('Comment updated', 'success'); loadComments(videoId); }
    else toast(r.message || 'Failed', 'error');
  } catch { toast('Error', 'error'); }
}

async function deleteCm(cmId, videoId) {
  confirm2('Delete Comment', 'Remove this comment permanently?', async () => {
    try {
      await api(`/comment/c/${cmId}`, { method: 'DELETE' });
      toast('Comment deleted', 'info'); loadComments(videoId);
    } catch { toast('Error', 'error'); }
  });
}

async function likeComment(cmId, btn) {
  try {
    await api(`/like/toggle/c/${cmId}`, { method: 'POST' });
    btn.classList.toggle('liked');
  } catch {}
}

// ══════════════════════════════════
//  SUBSCRIPTIONS
// ══════════════════════════════════
async function renderSubscriptions() {
  const main = document.getElementById('main-content');
  try {
    // GET /subscriber/subscribed
    const r = await api('/subscriber/subscribed');
    const subs = r.data?.channels || r.data || [];
    if (!subs.length) {
      main.innerHTML = `
        <div class="sec-hdr fade"><div class="sec-title">Subscriptions</div></div>
        <div class="empty"><div class="empty-icon">📡</div><div class="empty-title">No subscriptions yet</div>
        <div class="empty-sub">Find channels you love and subscribe</div></div>`;
      return;
    }
    main.innerHTML = `
      <div class="sec-hdr fade"><div class="sec-title">Subscriptions<small>${subs.length}</small></div></div>
      <div class="vgrid fade">
        ${subs.map(s => `
          <div class="sub-card">
            <div class="sub-av">${s.avatar ? `<img src="${esc(s.avatar)}" alt="" onerror="this.style.display='none'"/>` : initials(s.fullName || s.username)}</div>
            <div class="sub-name">${esc(s.fullName || s.username || 'Channel')}</div>
            <div class="sub-un">@${esc(s.username || '')}</div>
            <button class="btn-subscribe subbed" onclick="toggleSubById('${esc(s._id)}',this)">✓ Subscribed</button>
          </div>`).join('')}
      </div>`;
  } catch {
    main.innerHTML = `
      <div class="sec-hdr fade"><div class="sec-title">Subscriptions</div></div>
      <div class="empty"><div class="empty-icon">📡</div><div class="empty-title">Could not load subscriptions</div>
      <div class="empty-sub">Make sure the backend is running</div></div>`;
  }
}

async function toggleSubById(id, btn) {
  try {
    // POST /subscriber/:channelId
    await api(`/subscriber/${id}`, { method: 'POST' });
    const isNow = btn.classList.toggle('subbed');
    btn.textContent = isNow ? '✓ Subscribed' : 'Subscribe';
    toast(isNow ? '🔔 Subscribed!' : 'Unsubscribed', isNow ? 'success' : 'info');
  } catch { toast('Could not update subscription', 'error'); }
}

// ══════════════════════════════════
//  WATCH HISTORY
// ══════════════════════════════════
function renderHistory() {
  const main = document.getElementById('main-content');
  const ids = S.history;
  const vids = ids.map(id => S.videos.find(v => v._id === id)).filter(Boolean);
  main.innerHTML = `
    <div class="sec-hdr fade">
      <div class="sec-title">Watch History<small>${vids.length} videos</small></div>
      ${vids.length ? `<button class="btn danger" onclick="clearHistory()">🗑 Clear All</button>` : ''}
    </div>
    <div class="fade">
    ${!vids.length
      ? `<div class="empty"><div class="empty-icon">🕐</div><div class="empty-title">No watch history yet</div><div class="empty-sub">Videos you watch will appear here</div></div>`
      : vids.map(v => `
        <div class="hist-card" onclick="openVideo('${esc(v._id)}')">
          <div class="hist-thumb">
            ${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : '▶'}
            <div class="hist-dur">${fmtDur(v.duration)}</div>
          </div>
          <div>
            <div class="hist-title">${esc(v.title || 'Untitled')}</div>
            <div class="hist-meta">${esc(v.owner?.fullName || v.owner?.username || '')} · ${fmtNum(v.views)} views · ${ago(v.createdAt)}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

function clearHistory() {
  confirm2('Clear History', 'Remove all watch history?', () => {
    S.history = [];
    localStorage.setItem('sv_hist', '[]');
    toast('History cleared', 'info'); navigate('history');
  });
}

// ══════════════════════════════════
//  LIKED VIDEOS
// ══════════════════════════════════
async function renderLiked() {
  const main = document.getElementById('main-content');
  try {
    const r = await api('/like/videos');
    const vids = r.data?.likedVideos || r.data?.docs || r.data || [];
    main.innerHTML = `
      <div class="sec-hdr fade"><div class="sec-title">Liked Videos<small>${vids.length}</small></div></div>
      ${!vids.length
        ? `<div class="empty"><div class="empty-icon">👍</div><div class="empty-title">No liked videos yet</div><div class="empty-sub">Like videos while watching to save them here</div></div>`
        : `<div class="vgrid fade">${vids.map(v => vcHTML(v)).join('')}</div>`}`;
  } catch {
    main.innerHTML = `
      <div class="sec-hdr fade"><div class="sec-title">Liked Videos</div></div>
      <div class="empty"><div class="empty-icon">👍</div><div class="empty-title">Could not load liked videos</div>
      <div class="empty-sub">Make sure the backend is running</div></div>`;
  }
}

// ══════════════════════════════════
//  TWEETS (Community)
// ══════════════════════════════════
async function renderTweets() {
  const main = document.getElementById('main-content');
  try {
    const r = await api(`/tweet/user/${S.user._id}`);
    const tws = r.data?.tweets || r.data?.docs || r.data || [];
    main.innerHTML = `
      <div class="sec-hdr fade">
        <div class="sec-title">Community<small>${tws.length} posts</small></div>
        <button class="btn accent" onclick="openModal('tweet-modal')">＋ New Post</button>
      </div>
      <div class="fade">
      ${!tws.length
        ? `<div class="empty"><div class="empty-icon">💬</div><div class="empty-title">No posts yet</div>
           <div class="empty-sub">Share something with your community</div>
           <button class="btn accent" style="margin:16px auto;display:flex;" onclick="openModal('tweet-modal')">＋ Create Post</button></div>`
        : tws.map(t => twCardHTML(t)).join('')}
      </div>`;
  } catch {
    main.innerHTML = `
      <div class="sec-hdr fade">
        <div class="sec-title">Community</div>
        <button class="btn accent" onclick="openModal('tweet-modal')">＋ New Post</button>
      </div>
      <div class="empty"><div class="empty-icon">💬</div><div class="empty-title">Could not load posts</div></div>`;
  }
}

function twCardHTML(t) {
  const name = t.owner?.fullName || t.owner?.username || 'User';
  const isOwn = t.owner?._id === S.user?._id || t.owner?.username === S.user?.username;
  return `
  <div class="tw-card" id="tw-${esc(t._id)}">
    <div class="tw-top">
      ${avHTML(t.owner?.avatar, name, 36)}
      <div>
        <div style="font-size:13px;font-weight:600;">${esc(name)}</div>
        <div style="font-size:11px;color:var(--text3);font-family:var(--mono);">${ago(t.createdAt)}</div>
      </div>
    </div>
    <div class="tw-content">${esc(t.content || '')}</div>
    <div class="tw-actions">
      <button class="tw-act ${t.isLiked?'liked':''}" onclick="likeTweet('${esc(t._id)}',this)">
        👍 <span>${fmtNum(t.likesCount || 0)}</span>
      </button>
      ${isOwn ? `
        <button class="tw-act" onclick="openEditTweet('${esc(t._id)}','${esc(t.content||'')}')">✏️ Edit</button>
        <button class="tw-act" onclick="deleteTweet('${esc(t._id)}')">🗑 Delete</button>
      ` : ''}
    </div>
  </div>`;
}

async function handleCreateTweet() {
  const content = $v('tw-content');
  if (!content) { toast('Write something first', 'error'); return; }
  const btn = document.getElementById('tw-btn'); setBusy(btn, true);
  try {
    const r = await api('/tweet', { method: 'POST', body: { content } });
    if (ok(r)) { toast('Posted!', 'success'); closeModal('tweet-modal'); $set('tw-content',''); navigate('tweets'); }
    else toast(r.message || 'Failed', 'error');
  } catch { toast('Error', 'error'); }
  finally { setBusy(btn, false, 'Post'); }
}

function openEditTweet(id, content) { $set('etw-id', id); $set('etw-content', content); openModal('edit-tweet-modal'); }

async function handleEditTweet() {
  const id = $v('etw-id'), content = $v('etw-content');
  if (!content) return;
  const btn = document.getElementById('etw-btn'); setBusy(btn, true);
  try {
    const r = await api(`/tweet/${id}`, { method: 'PATCH', body: { content } });
    if (ok(r)) { toast('Updated!', 'success'); closeModal('edit-tweet-modal'); navigate('tweets'); }
    else toast(r.message || 'Failed', 'error');
  } catch { toast('Error', 'error'); }
  finally { setBusy(btn, false, 'Save'); }
}

async function deleteTweet(id) {
  confirm2('Delete Post', 'Remove this community post permanently?', async () => {
    try {
      await api(`/tweet/${id}`, { method: 'DELETE' });
      toast('Post deleted', 'info'); navigate('tweets');
    } catch { toast('Error', 'error'); }
  });
}

async function likeTweet(id, btn) {
  try {
    await api(`/like/toggle/t/${id}`, { method: 'POST' });
    btn.classList.toggle('liked');
  } catch {}
}

// ══════════════════════════════════
//  PLAYLISTS
// ══════════════════════════════════
async function renderPlaylists() {
  const main = document.getElementById('main-content');
  try {
    const r = await api(`/playlist/user/${S.user._id}`);
    const pls = r.data?.playlists || r.data || [];
    main.innerHTML = `
      <div class="sec-hdr fade">
        <div class="sec-title">Playlists<small>${pls.length}</small></div>
        <button class="btn accent" onclick="openModal('playlist-modal')">＋ New Playlist</button>
      </div>
      <div class="fade">
      ${!pls.length
        ? `<div class="empty"><div class="empty-icon">🎵</div><div class="empty-title">No playlists yet</div>
           <div class="empty-sub">Curate your favorite videos</div>
           <button class="btn accent" style="margin:16px auto;display:flex;" onclick="openModal('playlist-modal')">＋ Create Playlist</button></div>`
        : pls.map(p => `
          <div class="pl-card">
            <div class="pl-thumb">🎵<div class="pl-cnt">${p.videos?.length || p.videosCount || 0}</div></div>
            <div style="flex:1;min-width:0;">
              <div class="pl-name">${esc(p.name || 'Untitled')}</div>
              <div class="pl-meta">${p.description ? esc(p.description.slice(0,90)) : 'No description'}</div>
              <div style="margin-top:8px;font-size:12px;color:var(--text3);font-family:var(--mono);">${p.videos?.length || 0} videos</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
              <button class="btn danger" onclick="deletePlaylist('${esc(p._id)}',event)">🗑 Delete</button>
            </div>
          </div>`).join('')}
      </div>`;
  } catch {
    main.innerHTML = `
      <div class="sec-hdr fade">
        <div class="sec-title">Playlists</div>
        <button class="btn accent" onclick="openModal('playlist-modal')">＋ New Playlist</button>
      </div>
      <div class="empty"><div class="empty-icon">🎵</div><div class="empty-title">Could not load playlists</div></div>`;
  }
}

async function handleCreatePlaylist() {
  const name = $v('pl-name'), desc = $v('pl-desc');
  if (!name) { toast('Name is required', 'error'); return; }
  const btn = document.getElementById('pl-btn'); setBusy(btn, true);
  try {
    const r = await api('/playlist', { method: 'POST', body: { name, description: desc } });
    if (ok(r)) { toast('Playlist created!', 'success'); closeModal('playlist-modal'); $set('pl-name',''); $set('pl-desc',''); navigate('playlists'); }
    else toast(r.message || 'Failed', 'error');
  } catch { toast('Error', 'error'); }
  finally { setBusy(btn, false, 'Create Playlist'); }
}

async function deletePlaylist(id, e) {
  e?.stopPropagation();
  confirm2('Delete Playlist', 'Remove this playlist permanently?', async () => {
    try {
      await api(`/playlist/${id}`, { method: 'DELETE' });
      toast('Playlist deleted', 'info'); navigate('playlists');
    } catch { toast('Error', 'error'); }
  });
}

async function openAddToPlaylist(videoId) {
  $set('atp-vid', videoId);
  const listEl = document.getElementById('atp-list');
  listEl.innerHTML = `<div class="loading"><div class="spin"></div></div>`;
  openModal('atp-modal');
  try {
    const r = await api(`/playlist/user/${S.user._id}`);
    const pls = r.data?.playlists || r.data || [];
    if (!pls.length) {
      listEl.innerHTML = `<div class="empty-sub" style="padding:20px;text-align:center;">No playlists yet. Create one below!</div>`;
      return;
    }
    listEl.innerHTML = pls.map(p => `
      <div class="pl-card" onclick="addToPlaylist('${esc(p._id)}','${esc(videoId)}')">
        <div class="pl-thumb" style="font-size:18px;">🎵<div class="pl-cnt">${p.videos?.length||0}</div></div>
        <div><div class="pl-name">${esc(p.name||'Untitled')}</div></div>
      </div>`).join('');
  } catch { listEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text3);">Could not load playlists</div>`; }
}

async function addToPlaylist(plId, vidId) {
  try {
    const r = await api(`/playlist/add/${vidId}/${plId}`, { method: 'PATCH' });
    if (ok(r)) { toast('Added to playlist!', 'success'); closeModal('atp-modal'); }
    else toast(r.message || 'Failed', 'error');
  } catch { toast('Error', 'error'); }
}

// ══════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════
async function renderDashboard() {
  const main = document.getElementById('main-content');
  let stats = {}, vids = [];
  try {
    const [sr, vr] = await Promise.all([api('/dashboard/stats'), api('/dashboard/videos')]);
    stats = sr.data || {}; vids = vr.data || [];
  } catch {}
  main.innerHTML = `
    <div class="sec-hdr fade">
      <div class="sec-title">Channel Dashboard</div>
      <button class="btn accent" onclick="openModal('upload-modal')">＋ Upload</button>
    </div>
    <div class="sgrid fade">
      <div class="scard"><div class="scard-icon">👁️</div><div class="scard-lbl">Total Views</div><div class="scard-val">${fmtNum(stats.totalViews||0)}</div><div class="scard-sub">↑ All time</div></div>
      <div class="scard"><div class="scard-icon">👥</div><div class="scard-lbl">Subscribers</div><div class="scard-val">${fmtNum(stats.totalSubscribers||0)}</div></div>
      <div class="scard"><div class="scard-icon">🎬</div><div class="scard-lbl">Videos</div><div class="scard-val">${fmtNum(stats.totalVideos||0)}</div></div>
      <div class="scard"><div class="scard-icon">👍</div><div class="scard-lbl">Total Likes</div><div class="scard-val">${fmtNum(stats.totalLikes||0)}</div></div>
    </div>
    <div class="sec-hdr fade"><div class="sec-title">Your Videos<small>${vids.length}</small></div></div>
    <div class="fade">
    ${!vids.length
      ? `<div class="empty"><div class="empty-icon">🎬</div><div class="empty-title">No videos yet</div>
         <button class="btn accent" style="margin:16px auto;display:flex;" onclick="openModal('upload-modal')">＋ Upload First Video</button></div>`
      : vids.map(v => `
        <div class="dash-vid-row">
          <div class="dash-vid-thumb" onclick="openVideo('${esc(v._id)}')">
            ${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" onerror="this.style.display='none'"/>` : '▶'}
          </div>
          <div style="flex:1;min-width:0;">
            <div class="dash-vid-title">${esc(v.title||'Untitled')}</div>
            <div class="dash-vid-meta">${fmtNum(v.views||0)} views · ${fmtDur(v.duration||0)} · ${ago(v.createdAt)}</div>
          </div>
          <div class="dash-vid-actions">
            <span class="tag ${v.isPublished!==false?'tag-green':'tag-red'}">${v.isPublished!==false?'Public':'Private'}</span>
            <button class="btn" onclick="openEditVideo('${esc(v._id)}','${esc(v.title||'')}','${esc(v.description||'')}')">✏️ Edit</button>
            <button class="btn" onclick="togglePublish('${esc(v._id)}')">👁 Toggle</button>
            <button class="btn danger" onclick="deleteVideo('${esc(v._id)}')">🗑</button>
          </div>
        </div>`).join('')}
    </div>`;
}

function openEditVideo(id, title, desc) { $set('ev-id',id); $set('ev-title',title); $set('ev-desc',desc); openModal('edit-video-modal'); }

async function handleEditVideo() {
  const id = $v('ev-id'), title = $v('ev-title'), desc = $v('ev-desc');
  if (!title) { toast('Title is required', 'error'); return; }
  const btn = document.getElementById('ev-btn'); setBusy(btn, true);
  try {
    const fd = new FormData(); fd.append('title', title); fd.append('description', desc);
    const tf = $fi('ev-thumb'); if (tf) fd.append('thumbnail', tf);
    const r = await api(`/video/${id}`, { method: 'PATCH', body: fd });
    if (ok(r)) { toast('Video updated!', 'success'); closeModal('edit-video-modal'); navigate('dashboard'); }
    else toast(r.message || 'Failed', 'error');
  } catch { toast('Error', 'error'); }
  finally { setBusy(btn, false, 'Save Changes'); }
}

async function togglePublish(id) {
  try {
    await api(`/video/toggle/publish/${id}`, { method: 'PATCH' });
    toast('Visibility updated', 'info'); navigate('dashboard');
  } catch { toast('Error', 'error'); }
}

async function deleteVideo(id) {
  confirm2('Delete Video', 'This cannot be undone. Delete this video permanently?', async () => {
    try {
      await api(`/video/${id}`, { method: 'DELETE' });
      toast('Video deleted', 'info'); navigate('dashboard');
    } catch { toast('Error deleting video', 'error'); }
  });
}

// ══════════════════════════════════
//  UPLOAD
// ══════════════════════════════════
async function handleUpload() {
  const title = $v('u-title'), desc = $v('u-desc'), dur = $v('u-dur');
  const vf = $fi('u-video'), tf = $fi('u-thumb');
  if (!title) { toast('Title is required', 'error'); return; }
  if (!vf) { toast('Video file is required', 'error'); return; }
  if (!tf) { toast('Thumbnail is required', 'error'); return; }

  const btn = document.getElementById('upload-btn');
  const prog = document.getElementById('prog-wrap');
  const fill = document.getElementById('prog-fill');
  const pct = document.getElementById('prog-pct');
  setBusy(btn, true);
  prog.classList.add('show');

  let p = 0;
  const iv = setInterval(() => {
    p = Math.min(p + Math.random() * 9, 88);
    fill.style.width = p + '%'; pct.textContent = Math.round(p) + '%';
  }, 500);

  try {
    const fd = new FormData();
    fd.append('title', title); fd.append('description', desc);
    fd.append('videoFile', vf); fd.append('thumbnail', tf);
    if (dur) fd.append('duration', dur);
    const r = await api('/video', { method: 'POST', body: fd });
    clearInterval(iv); fill.style.width = '100%'; pct.textContent = '100%';
    if (ok(r)) {
      toast('🎉 Video uploaded successfully!', 'success');
      closeModal('upload-modal');
      ['u-title','u-desc','u-dur'].forEach(id => $set(id,''));
      ['vf-lbl','tf-lbl'].forEach((id,i) => { const el=document.getElementById(id); if(el) el.textContent=i===0?'Choose video':'Choose thumbnail'; });
      navigate('dashboard');
    } else toast(r.message || 'Upload failed', 'error');
  } catch (e) {
    clearInterval(iv);
    toast('Upload failed — check backend connection (' + API_BASE + ')', 'error');
  } finally {
    setBusy(btn, false, 'Upload Video');
    setTimeout(() => prog.classList.remove('show'), 1000);
  }
}

// ══════════════════════════════════
//  PROFILE
// ══════════════════════════════════
async function renderProfile() {
  const main = document.getElementById('main-content');
  // Always start with current user data so the page never crashes
  let ch = { ...S.user };
  try {
    const r = await api(`/users/channel/${S.user.username}`);
    if (r && r.data) ch = { ...S.user, ...r.data };
  } catch {
    // Channel route failed (wrong path, non-JSON etc) — use S.user data, still render fine
  }
  renderProfilePage(main, ch);
}

function renderProfilePage(main, ch) {
  main.innerHTML = `
    <div class="profile-hdr fade">
      ${ch.coverImage
        ? `<img class="profile-cover" src="${esc(ch.coverImage)}" alt="" onerror="this.className='profile-cover-ph'" />`
        : `<div class="profile-cover-ph"></div>`}
      <div class="profile-av-row">
        <div class="profile-av">
          ${ch.avatar ? `<img src="${esc(ch.avatar)}" alt="" onerror="this.style.display='none'"/>` : initials(ch.fullName)}
        </div>
        <div style="flex:1;min-width:0;">
          <div class="profile-name">${esc(ch.fullName || 'My Channel')}</div>
          <div class="profile-un">@${esc(ch.username || '')}</div>
        </div>
        <button class="btn accent" onclick="openEditProfile()">✏️ Edit Profile</button>
      </div>
      <div class="profile-stats">
        <div><div class="pstat-val">${fmtNum(ch.subscribersCount||0)}</div><div class="pstat-lbl">Subscribers</div></div>
        <div><div class="pstat-val">${fmtNum(ch.channelsSubscribedToCount||0)}</div><div class="pstat-lbl">Subscriptions</div></div>
        <div><div class="pstat-val">${fmtNum(ch.videosCount||0)}</div><div class="pstat-lbl">Videos</div></div>
      </div>
    </div>
    <div class="tabs fade">
      <button class="tab-btn active" id="tb-videos" onclick="switchPTab('videos')">Videos</button>
      <button class="tab-btn" id="tb-posts"  onclick="switchPTab('posts')">Posts</button>
      <button class="tab-btn" id="tb-about"  onclick="switchPTab('about')">About</button>
    </div>
    <div id="ptab" class="fade"></div>`;
  switchPTab('videos');
}


async function switchPTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tb-' + tab)?.classList.add('active');
  const el = document.getElementById('ptab'); if (!el) return;
  el.innerHTML = `<div class="loading"><div class="spin"></div></div>`;

  if (tab === 'videos') {
    try {
      const r = await api('/video?page=1&limit=12&sortBy=createdAt&sortType=desc');
      const vids = r.data?.docs || r.data?.videos || (Array.isArray(r.data) ? r.data : []);
      el.innerHTML = vids.length
        ? `<div class="vgrid">${vids.map(v => vcHTML(v)).join('')}</div>`
        : `<div class="empty"><div class="empty-icon">🎬</div><div class="empty-title">No videos yet</div>
           <button class="btn accent" style="margin:14px auto;display:flex;" onclick="openModal('upload-modal')">＋ Upload</button></div>`;
    } catch { el.innerHTML = `<div class="empty"><div class="empty-icon">🎬</div><div class="empty-title">Could not load videos</div></div>`; }
  } else if (tab === 'posts') {
    try {
      const r = await api(`/tweet/user/${S.user._id}`);
      const tws = r.data?.tweets || r.data?.docs || r.data || [];
      el.innerHTML = tws.length
        ? tws.map(t => `<div class="tw-card"><div class="tw-content">${esc(t.content||'')}</div><div style="font-size:11px;color:var(--text3);margin-top:8px;font-family:var(--mono);">${ago(t.createdAt)}</div></div>`).join('')
        : `<div class="empty"><div class="empty-icon">💬</div><div class="empty-title">No posts yet</div></div>`;
    } catch { el.innerHTML = `<div class="empty"><div class="empty-title">Could not load posts</div></div>`; }
  } else {
    el.innerHTML = `
      <div class="settings-card">
        <div class="settings-title">Account Info</div>
        <div class="settings-row"><div><div class="sr-label">Email</div></div><span style="font-size:13px;color:var(--text3);">${esc(S.user?.email||'—')}</span></div>
        <div class="settings-row"><div><div class="sr-label">Username</div></div><span style="font-size:13px;color:var(--text3);">@${esc(S.user?.username||'—')}</span></div>
        <div class="settings-row"><div><div class="sr-label">Member Since</div></div><span style="font-size:13px;color:var(--text3);">${ago(S.user?.createdAt)}</span></div>
      </div>`;
  }
}

function openEditProfile() {
  $set('ep-name', S.user?.fullName || '');
  openModal('edit-profile-modal');
}

async function handleEditProfile() {
  const name = $v('ep-name');
  const btn = document.getElementById('ep-btn'); setBusy(btn, true);
  try {
    if (name && name !== S.user.fullName) {
      const r = await api('/users/update-account', { method: 'PATCH', body: { fullName: name } });
      if (ok(r)) S.user.fullName = name;
    }
    const avf = $fi('ep-av');
    if (avf) {
      const fd = new FormData(); fd.append('avatar', avf);
      const r = await api('/users/avatar', { method: 'PATCH', body: fd });
      if (ok(r) && r.data?.avatar) { S.user.avatar = r.data.avatar; syncAvatars(); }
    }
    const cvf = $fi('ep-cv');
    if (cvf) {
      const fd = new FormData(); fd.append('coverImage', cvf);
      await api('/users/cover-image', { method: 'PATCH', body: fd });
    }
    toast('Profile updated!', 'success'); closeModal('edit-profile-modal'); navigate('profile');
  } catch { toast('Error updating profile', 'error'); }
  finally { setBusy(btn, false, 'Save Profile'); }
}

// ══════════════════════════════════
//  SETTINGS
// ══════════════════════════════════
function renderSettings() {
  const main = document.getElementById('main-content');
  const p = S.prefs;
  main.innerHTML = `
    <div class="sec-hdr fade"><div class="sec-title">Settings</div></div>
    <div class="fade">

      <div class="settings-card">
        <div class="settings-title">👤 Profile</div>
        <div class="settings-row">
          <div><div class="sr-label">Display Name</div><div class="sr-sub">${esc(S.user?.fullName||'')}</div></div>
          <button class="btn accent" onclick="openEditProfile()">Edit</button>
        </div>
        <div class="settings-row">
          <div><div class="sr-label">Username</div><div class="sr-sub">@${esc(S.user?.username||'')}</div></div>
          <span class="tag tag-purple">Read-only</span>
        </div>
        <div class="settings-row">
          <div><div class="sr-label">Email</div><div class="sr-sub">${esc(S.user?.email||'')}</div></div>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-title">🔒 Security</div>
        <div class="settings-row">
          <div><div class="sr-label">Password</div><div class="sr-sub">Change your login password</div></div>
          <button class="btn" onclick="openModal('pw-modal')">Change</button>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-title">⚙️ Preferences</div>
        <div class="settings-row">
          <div><div class="sr-label">Autoplay next video</div><div class="sr-sub">Automatically play related videos when one ends</div></div>
          <div class="toggle ${p.autoplay?'on':''}" onclick="togglePref('autoplay',this)"></div>
        </div>
        <div class="settings-row">
          <div><div class="sr-label">Save watch history</div><div class="sr-sub">Track videos you've watched</div></div>
          <div class="toggle ${p.saveHistory?'on':''}" onclick="togglePref('saveHistory',this)"></div>
        </div>
        <div class="settings-row">
          <div><div class="sr-label">Email notifications</div><div class="sr-sub">Get updates about new subscribers &amp; comments</div></div>
          <div class="toggle ${p.emailNotif?'on':''}" onclick="togglePref('emailNotif',this)"></div>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-title">🔌 Backend</div>
        <div class="settings-row">
          <div><div class="sr-label">API Base URL</div><div class="sr-sub" style="font-family:var(--mono);word-break:break-all;">${API_BASE}</div></div>
          <span class="tag tag-green" id="api-status">●&nbsp;Connected</span>
        </div>
        <div class="settings-row">
          <div><div class="sr-label">Keyboard Shortcuts</div><div class="sr-sub">/=Search &nbsp;h=Home &nbsp;d=Dashboard &nbsp;p=Profile &nbsp;t=Trending &nbsp;l=Liked &nbsp;H=History</div></div>
        </div>
      </div>

      <div class="danger-card">
        <div class="danger-title">⚠️ Danger Zone</div>
        <div class="settings-row" style="border:none;padding-bottom:0;">
          <div><div class="sr-label" style="color:var(--red);">Clear Watch History</div><div class="sr-sub">Permanently remove all viewing history</div></div>
          <button class="btn danger" onclick="clearHistory()">Clear</button>
        </div>
        <div class="settings-row" style="border:none;padding-top:12px;padding-bottom:0;">
          <div><div class="sr-label" style="color:var(--red);">Sign Out</div><div class="sr-sub">Sign out of this account on this device</div></div>
          <button class="btn danger" onclick="handleLogout()">Sign Out</button>
        </div>
      </div>

    </div>`;

  // Live check API status
  api('/users/current-user').then(() => {
    const el = document.getElementById('api-status');
    if (el) { el.textContent = '● Connected'; el.className = 'tag tag-green'; }
  }).catch(() => {
    const el = document.getElementById('api-status');
    if (el) { el.textContent = '● Offline'; el.className = 'tag tag-red'; }
  });
}

function togglePref(key, el) {
  el.classList.toggle('on');
  S.prefs[key] = el.classList.contains('on');
  localStorage.setItem('sv_prefs', JSON.stringify(S.prefs));
  toast(`${key === 'autoplay' ? 'Autoplay' : key === 'saveHistory' ? 'Watch history' : 'Notifications'} ${S.prefs[key] ? 'enabled' : 'disabled'}`, 'info');
}

// ══════════════════════════════════
//  CHANGE PASSWORD
// ══════════════════════════════════
async function handleChangePassword() {
  const op = $v('pw-old'), np = $v('pw-new');
  if (!op || !np) { toast('Fill both fields', 'error'); return; }
  if (np.length < 8) { toast('New password must be at least 8 characters', 'error'); return; }
  const btn = document.getElementById('pw-btn'); setBusy(btn, true);
  try {
    const r = await api('/users/change-password', { method: 'POST', body: { oldPassword: op, newPassword: np } });
    if (ok(r)) { toast('Password updated!', 'success'); closeModal('pw-modal'); $set('pw-old',''); $set('pw-new',''); }
    else toast(r.message || 'Failed — check old password', 'error');
  } catch { toast('Error', 'error'); }
  finally { setBusy(btn, false, 'Update Password'); }
}

// ══════════════════════════════════
//  CONTEXT MENU (right-click on video card)
// ══════════════════════════════════
let _ctxId = null;
function showCtx(e, id, isOwn) {
  _ctxId = id;
  const m = document.getElementById('ctx-menu');
  // keep in viewport
  const x = Math.min(e.clientX, window.innerWidth - 180);
  const y = Math.min(e.clientY, window.innerHeight - 160);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  m.classList.add('open');
  document.getElementById('ctx-edit').style.display = isOwn ? 'flex' : 'none';
  document.getElementById('ctx-toggle').style.display = isOwn ? 'flex' : 'none';
  document.getElementById('ctx-del').style.display = isOwn ? 'flex' : 'none';
}
document.addEventListener('click', () => document.getElementById('ctx-menu')?.classList.remove('open'));

// boot
init();