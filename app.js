const APP_VERSION = 5;
const $ = s => document.querySelector(s);
const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = n => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const fmtDate = s => { const [y, m, d] = s.split('-'); return bn(d + '/' + m + '/' + y); };
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(y, m - 1, d + n); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); };
const LABEL = { half: 'হাফ ডে', full: 'ফুল ডে', double: 'ডাবল' };
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
};

/* একটি কাজের দিনগুলো: dates = ['২০২৬-১১-০৭', '২০২৬-১১-০৮', ...] (দিন ১, দিন ২ ...) */
const workDates = w => (w.dates && w.dates.length) ? w.dates : [w.date];
const aKey = (w, n, k) => w + '_d' + n + '_' + k;
const attDate = a => { const w = DB.data.works[a.workId]; return w ? workDates(w)[(a.day || 1) - 1] || null : null; };
const dayOpen = {}; // 'কাজ_দিন' -> খোলা/বন্ধ (ডিফল্ট: শেষ দিন খোলা)

let role = ss.get('role');
let tab = 'hajiri';
let date = todayStr();
let userAct = false;

const S = () => Object.assign({ half: 250, full: 500, double: 1000, staffPin: '1234', adminPin: '9999' }, DB.data.settings.main || {});
const workers = () => Object.values(DB.data.workers).sort((a, b) => a.created - b.created);
const mount3d = (el, m) => { if (typeof Scene3D !== 'undefined') Scene3D.mount(el, m); };

/* কোন ফাইল পুরনো বা আপলোড হয়নি তা ধরে */
function fileProblems() {
  const p = [];
  if (DB.version !== APP_VERSION) p.push('db.js');
  if (typeof Scene3D === 'undefined' || Scene3D.version !== APP_VERSION) p.push('scene3d.js');
  if (typeof THREE === 'undefined') p.push('three.js (ইন্টারনেট থেকে লোড হয়নি)');
  return p;
}
const warnHtml = () => {
  const p = fileProblems();
  return p.length ? `<div class="warn">⚠️ কিছু ফাইল পুরনো বা আপলোড হয়নি: <b>${p.join(', ')}</b>। জিপের সব ফাইল আবার আপলোড করে ডিপ্লয় করুন।</div>` : '';
};

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2600);
}

function img(file, max, q) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => {
      const i = new Image();
      i.onload = () => {
        const k = Math.min(1, max / Math.max(i.width, i.height));
        const c = document.createElement('canvas');
        c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
        c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', q));
      };
      i.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
const blobToDataURL = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

/* ---------- লগইন ---------- */
function showLogin() {
  $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
  $('#verL').textContent = 'সংস্করণ ' + bn(APP_VERSION);
  $('#loginWarn').innerHTML = warnHtml();
  mount3d($('#loginHero'), 'login');
}
$('#pinBtn').onclick = () => {
  const p = $('#pin').value.trim(), s = S();
  if (p === s.adminPin) role = 'admin';
  else if (p === s.staffPin) role = 'staff';
  else { $('#pinErr').textContent = 'ভুল পিন'; return; }
  ss.set('role', role);
  $('#pin').value = ''; $('#pinErr').textContent = '';
  start();
};
$('#pin').addEventListener('keydown', e => { if (e.key === 'Enter') $('#pinBtn').click(); });
$('#logout').onclick = () => { ss.del('role'); role = null; tab = 'hajiri'; showLogin(); };

function start() {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#roleTag').textContent = role === 'admin' ? 'অ্যাডমিন' : 'কর্মচারী';
  mount3d($('#appHero'), 'banner');
  render();
}

/* ---------- রেন্ডার ---------- */
function renderTabs() {
  const t = [['hajiri', '📋 হাজিরি'], ['dues', '💰 বাকি']];
  if (role === 'admin') t.push(['admin', '⚙️ অ্যাডমিন']);
  $('#tabs').innerHTML = t.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('');
}

function render() {
  if (!role) return showLogin();
  if (tab === 'admin' && role !== 'admin') tab = 'hajiri';
  renderTabs();
  const demo = DB.online ? '' : '<div class="demo">⚠️ ডেমো মোড: ডেটা শুধু এই ফোনে থাকছে। সবাই একসাথে দেখতে Firebase সেটআপ করুন (README দেখুন)।</div>';
  $('#view').innerHTML = warnHtml() + demo +
    (tab === 'hajiri' ? viewHajiri() : tab === 'dues' ? viewDues() : viewAdmin()) +
    `<div class="ver">সংস্করণ ${bn(APP_VERSION)}</div>`;
}

function viewHajiri() {
  const wl = workers();
  // যে কাজের এই তারিখে একটি দিন আছে, অথবা আগের দিন শেষ হয়েছে (যাতে আজ আবার "দিন যোগ" করা যায়)
  const works = Object.values(DB.data.works).filter(w => {
    const ds = workDates(w);
    return ds.includes(date) || addDays(ds[ds.length - 1], 1) === date;
  }).sort((a, b) => a.created - b.created);
  let h = `<div class="card"><label style="margin-top:0">তারিখ</label><input type="date" id="dateSel" value="${date}">
    <button class="btn primary big" style="margin-top:12px" data-act="addWork">➕ নতুন কাজ যোগ করুন</button></div>`;
  if (!works.length) h += `<div class="empty">${fmtDate(date)} তারিখে কোনো কাজ নেই।</div>`;
  works.forEach(w => { h += workCard(w, wl); });
  return h;
}

function workCard(w, wl) {
  const ds = workDates(w), N = ds.length;
  let total = 0, unpaid = 0;
  ds.forEach((_, i) => wl.forEach(k => {
    const a = DB.data.atts[aKey(w.id, i + 1, k.id)];
    if (a && a.amount) { total += a.amount; if (!a.paid) unpaid += a.amount; }
  }));
  let h = `<div class="card">`;
  if (w.photo) h += `<img class="work-photo" src="${w.photo}">`;
  if (w.text) h += `<div class="note">📍 ${esc(w.text)}</div>`;
  if (w.voice) h += `<div class="voice-l">🔊 ভয়েস নোট</div><audio controls preload="metadata" src="${w.voice}"></audio>`;
  if (ds[N - 1] < date) h += `<div class="hint">এই কাজ আগের দিনের। আজও চললে নিচে "দিন যোগ করুন" চাপুন।</div>`;
  h += `<div class="sum">${N > 1 ? bn(N) + ' দিনে ' : ''}মোট মজুরি: ${bn(total)} টাকা · বাকি: <b style="color:var(--red)">${bn(unpaid)}</b> টাকা</div>`;
  if (!wl.length) h += `<div class="empty">আগে অ্যাডমিন প্যানেল থেকে লেবার যোগ করুন।</div>`;
  ds.forEach((d, i) => { h += daySection(w, wl, i + 1, d, N); });
  h += `<button class="btn add" data-act="addDay" data-w="${w.id}">➕ দিন ${bn(N + 1)} যোগ করুন</button>`;
  if (role === 'admin') h += `<div style="text-align:right;margin-top:10px"><button class="btn danger sm" data-act="delWork" data-w="${w.id}">এই কাজ মুছুন</button></div>`;
  return h + '</div>';
}

function daySection(w, wl, n, d, N) {
  const dk = w.id + '_' + n;
  const open = dk in dayOpen ? dayOpen[dk] : n === N;
  let t = 0, u = 0, cnt = 0;
  wl.forEach(k => {
    const a = DB.data.atts[aKey(w.id, n, k.id)];
    if (a) { cnt++; if (a.amount) { t += a.amount; if (!a.paid) u += a.amount; } }
  });
  let h = `<div class="day"><button class="day-h" data-act="toggleDay" data-w="${w.id}" data-n="${n}">
    <span>${open ? '▾' : '▸'} দিন ${bn(n)} · ${fmtDate(d)}</span>
    <span class="day-s">${bn(t)} টাকা${u ? ' · বাকি ' + bn(u) : ''}</span></button>`;
  if (open) {
    wl.forEach(k => { h += workerRow(w, n, k); });
    if (n === N && N > 1 && (role === 'admin' || cnt === 0))
      h += `<div style="text-align:right;margin-top:8px"><button class="btn danger sm" data-act="delDay" data-w="${w.id}" data-n="${n}">দিন ${bn(n)} বাদ দিন</button></div>`;
  }
  return h + '</div>';
}

function workerRow(w, n, k) {
  const a = DB.data.atts[aKey(w.id, n, k.id)];
  const s = S();
  const pic = k.photo ? `<img src="${k.photo}">` : `<div class="avatar">👷</div>`;
  const ids = `data-w="${w.id}" data-n="${n}" data-k="${k.id}"`;
  let r = `<div class="wk">${pic}<div class="name">${esc(k.name)}</div>`;
  if (!a) {
    r += `<button class="tick" data-act="pres" ${ids}>✔</button><button class="cross" data-act="abs" ${ids}>✖</button>`;
  } else if (a.status === 'absent') {
    r += `<span class="badge abs">অনুপস্থিত</span><button class="undo" data-act="reset" ${ids}>পরিবর্তন</button>`;
  } else if (a.status === 'present') {
    r += `<span class="badge">উপস্থিত</span><button class="undo" data-act="reset" ${ids}>পরিবর্তন</button>
      <div class="opts">${['half', 'full', 'double'].map(t => `<button data-act="pick" data-t="${t}" ${ids}>${LABEL[t]}<small>${bn(s[t])} টাকা</small></button>`).join('')}</div>`;
  } else {
    r += `<span class="badge">${LABEL[a.status]}</span>
      <div class="sub"><button class="pay ${a.paid ? 'green' : 'red'}" data-act="pay" ${ids}>${bn(a.amount)} টাকা${a.paid ? ' ✓ দেওয়া' : ''}</button>
      ${a.paid ? '' : `<button class="undo" data-act="reset" ${ids}>পরিবর্তন</button>`}</div>`;
  }
  return r + '</div>';
}

/* বাকি: কার কোন দিনের কত টাকা বাকি (মাঝে ফাঁক থাকলেও হিসাব থাকবে) */
function viewDues() {
  const wl = workers();
  if (!wl.length) return '<div class="empty">কোনো লেবার নেই।</div>';
  let grand = 0, h = '';
  wl.forEach(k => {
    const list = Object.values(DB.data.atts).filter(a => a.workerId === k.id && a.amount && !a.paid)
      .map(a => ({ a, w: DB.data.works[a.workId], d: attDate(a) })).filter(x => x.w && x.d)
      .sort((x, y) => x.d.localeCompare(y.d));
    const sum = list.reduce((s, x) => s + x.a.amount, 0);
    grand += sum;
    const pic = k.photo ? `<img src="${k.photo}">` : `<div class="avatar">👷</div>`;
    h += `<div class="card"><div class="row">${pic}<div style="flex:1"><b>${esc(k.name)}</b><div class="${sum ? 'due' : 'ok'}">${sum ? bn(sum) + ' টাকা বাকি' : '✓ কিছু বাকি নেই'}</div></div></div>`;
    list.forEach(x => {
      const multi = workDates(x.w).length > 1;
      h += `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span>${fmtDate(x.d)}${multi ? ' · দিন ' + bn(x.a.day || 1) : ''} · ${LABEL[x.a.status]}${x.w.text ? ' · ' + esc(x.w.text.slice(0, 18)) : ''}</span><b>${bn(x.a.amount)}</b></div>`;
    });
    if (sum) h += `<button class="btn primary big" style="margin-top:10px" data-act="payAll" data-k="${k.id}">সব ${bn(sum)} টাকা দেওয়া হয়েছে</button>`;
    h += '</div>';
  });
  return `<div class="card"><h2>সবার মোট বাকি</h2><div class="due">${bn(grand)} টাকা</div></div>` + h;
}

function viewAdmin() {
  const s = S();
  let h = `<div class="card"><h2>মজুরির রেট (টাকা)</h2>
    <div class="grid2"><div><label>হাফ ডে</label><input type="number" id="rHalf" value="${s.half}"></div>
    <div><label>ফুল ডে</label><input type="number" id="rFull" value="${s.full}"></div>
    <div><label>ডাবল</label><input type="number" id="rDouble" value="${s.double}"></div></div>
    <p style="font-size:12px;color:var(--muted)">নতুন রেট শুধু ভবিষ্যতের হাজিরিতে কাজ করবে, পুরনো হিসাব বদলাবে না।</p>
    <button class="btn primary" data-act="saveRates">রেট সেভ করুন</button></div>`;
  h += `<div class="card"><h2>পিন বদলান</h2>
    <label>কর্মচারীর পিন (শুধু সংখ্যা)</label><input type="text" inputmode="numeric" id="pStaff" value="${esc(s.staffPin)}">
    <label>অ্যাডমিন পিন (শুধু সংখ্যা)</label><input type="text" inputmode="numeric" id="pAdmin" value="${esc(s.adminPin)}">
    <button class="btn primary" style="margin-top:10px" data-act="savePins">পিন সেভ করুন</button></div>`;
  h += `<div class="card"><div class="row between"><h2>লেবার তালিকা</h2><button class="btn primary sm" data-act="addWorker">➕ নতুন লেবার</button></div>`;
  const wl = workers();
  if (!wl.length) h += '<div class="empty">এখনো কোনো লেবার নেই।</div>';
  wl.forEach(k => {
    const pic = k.photo ? `<img src="${k.photo}">` : `<div class="avatar">👷</div>`;
    h += `<div class="wk">${pic}<div class="name">${esc(k.name)}</div>
      <button class="btn sm" data-act="editWorker" data-k="${k.id}">এডিট</button>
      <button class="btn danger sm" data-act="delWorker" data-k="${k.id}">মুছুন</button></div>`;
  });
  return h + '</div>';
}

/* ---------- মোডাল ---------- */
let tmp = {};
function openModal(html) { const m = $('#modal'); m.innerHTML = `<div class="sheet">${html}</div>`; m.classList.remove('hidden'); }
function closeModal() { cancelRec(); $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; render(); }

function workModal() {
  const rec = !!tmp.recording;
  openModal(`<h3>নতুন কাজ</h3>
    <label>১. কাজের জায়গার ছবি</label>
    ${tmp.photo ? `<img class="work-photo" src="${tmp.photo}">` : ''}
    <input type="file" id="wPhoto" accept="image/*" capture="environment">
    <label>২. জায়গার বিবরণ (লিখে)</label>
    <textarea id="wText" placeholder="যেমন: রহিম সাহেবের বাড়ি, মেইন রোডের পাশে">${esc(tmp.text || '')}</textarea>
    <label>৩. অথবা ভয়েস নোট</label>
    ${tmp.voice ? `<audio controls preload="metadata" src="${tmp.voice}"></audio>` : ''}
    <div class="row wrap">
      <button class="btn ${rec ? 'danger' : ''}" id="recBtn">${rec ? '⏹ থামান' : '🎤 রেকর্ড করুন'}</button>
      ${rec ? '<span class="rec"><i class="rec-dot"></i><span id="recT">০:০০</span></span>' : ''}
      ${tmp.voice && !rec ? '<button class="btn danger sm" id="recDel">মুছুন</button>' : ''}
    </div>
    ${tmp.err ? `<div class="err">${esc(tmp.err)}</div>` : ''}
    ${rec ? '' : `<details ${tmp.err ? 'open' : ''}><summary>মাইক চলছে না? অন্য উপায়</summary>
      <label>ফোনের রেকর্ডার দিয়ে রেকর্ড করুন বা অডিও ফাইল বাছুন</label>
      <input type="file" id="wAudio" accept="audio/*" capture></details>`}
    <div class="row" style="margin-top:16px">
      <button class="btn" data-act="closeModal" style="flex:1">বাতিল</button>
      <button class="btn primary" data-act="saveWork" style="flex:2">কাজ সেভ করুন</button>
    </div>`);
  $('#wPhoto').onchange = async e => { if (e.target.files[0]) { tmp.photo = await img(e.target.files[0], 800, 0.6); workModal(); } };
  $('#wText').oninput = e => { tmp.text = e.target.value; };
  $('#recBtn').onclick = toggleRec;
  if ($('#recDel')) $('#recDel').onclick = () => { tmp.voice = null; tmp.err = ''; workModal(); };
  if ($('#wAudio')) $('#wAudio').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 700 * 1024) { tmp.err = 'অডিও ফাইল বড় (সর্বোচ্চ প্রায় ৪০ সেকেন্ড)। ছোট করে রেকর্ড করুন।'; workModal(); return; }
    tmp.voice = await blobToDataURL(f); tmp.err = ''; workModal();
  };
}

/* ---- ভয়েস রেকর্ডার ---- */
let mr = null, chunks = [], recTimer = null, recStream = null, discard = false;
const MAX_REC = 40; // সেকেন্ড (ডেটাবেসের ১ এমবি সীমার মধ্যে থাকার জন্য)

function canRec() { return !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
function pickMime() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  const c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const t of c) if (MediaRecorder.isTypeSupported(t)) return t;
  return '';
}
async function micMsg(e) {
  const n = e && e.name;
  let st = '';
  try { st = (await navigator.permissions.query({ name: 'microphone' })).state; } catch (_) {}
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') {
    if (st === 'denied')
      return 'এই সাইটের জন্য মাইক বন্ধ (Block) করা আছে। ঠিকানার বাঁ পাশের আইকনে চাপুন → অনুমতি (Permissions) → মাইক্রোফোন → অনুমতি দিন, তারপর পেজ রিলোড করুন। তাতেও না হলে: ফোনের সেটিংস → অ্যাপ → Chrome → অনুমতি → মাইক্রোফোন → অনুমতি দিন। অথবা নিচের "অন্য উপায়" ব্যবহার করুন।';
    return 'মাইকের অনুমতি দেওয়া হয়নি। আবার "রেকর্ড করুন" চাপুন এবং পপআপে "অনুমতি দিন (Allow)" চাপুন। না এলে নিচের "অন্য উপায়" ব্যবহার করুন।';
  }
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'এই ফোনে মাইক্রোফোন পাওয়া যায়নি।';
  if (n === 'NotReadableError') return 'মাইক্রোফোন অন্য অ্যাপ ব্যবহার করছে। সেটি বন্ধ করে আবার চেষ্টা করুন।';
  return 'রেকর্ড শুরু হয়নি (' + (n || 'error') + ')। নিচের "অন্য উপায়" ব্যবহার করুন।';
}
function stopTracks() { if (recStream) { recStream.getTracks().forEach(t => t.stop()); recStream = null; } }

async function toggleRec() {
  if (tmp.recording) { if (mr && mr.state === 'recording') mr.stop(); return; }
  tmp.err = '';
  if (!window.isSecureContext || !canRec()) {
    tmp.err = 'এই ব্রাউজারে সরাসরি রেকর্ড চলছে না। নিচের "অন্য উপায়" থেকে ফোনের রেকর্ডার ব্যবহার করুন।';
    workModal(); return;
  }
  try { recStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { tmp.err = await micMsg(e); workModal(); return; }
  try {
    const mime = pickMime();
    mr = mime ? new MediaRecorder(recStream, { mimeType: mime, audioBitsPerSecond: 24000 }) : new MediaRecorder(recStream);
  } catch (e) {
    try { mr = new MediaRecorder(recStream); }
    catch (e2) { stopTracks(); tmp.err = await micMsg(e2); workModal(); return; }
  }
  chunks = []; discard = false;
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = async () => {
    clearInterval(recTimer); stopTracks(); tmp.recording = false;
    if (discard) return;
    const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
    if (blob.size < 500) { tmp.err = 'কিছু রেকর্ড হয়নি, আবার চেষ্টা করুন।'; workModal(); return; }
    tmp.voice = await blobToDataURL(blob); workModal();
  };
  mr.start(1000);
  tmp.recording = true; workModal();
  const t0 = Date.now();
  recTimer = setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000), el = $('#recT');
    if (el) el.textContent = bn(Math.floor(s / 60) + ':' + pad(s % 60));
    if (s >= MAX_REC && mr && mr.state === 'recording') mr.stop();
  }, 500);
}
function cancelRec() {
  discard = true; clearInterval(recTimer);
  if (mr && mr.state === 'recording') { try { mr.stop(); } catch (e) {} }
  stopTracks(); if (tmp) tmp.recording = false;
}

function workerModal(id) {
  const k = id ? DB.data.workers[id] : {};
  tmp = { id, photo: k.photo || null, name: k.name || '' };
  openModal(`<h3>${id ? 'লেবার এডিট' : 'নতুন লেবার'}</h3>
    <label>ফটো</label>
    <div id="wkPrev">${tmp.photo ? `<img class="avatar" src="${tmp.photo}" style="width:90px;height:90px">` : ''}</div>
    <input type="file" id="kPhoto" accept="image/*" capture="user">
    <label>নাম</label><input type="text" id="kName" value="${esc(tmp.name)}">
    <div class="row" style="margin-top:16px">
      <button class="btn" data-act="closeModal" style="flex:1">বাতিল</button>
      <button class="btn primary" data-act="saveWorker" style="flex:2">সেভ করুন</button></div>`);
  $('#kPhoto').onchange = async e => {
    if (e.target.files[0]) { tmp.photo = await img(e.target.files[0], 240, 0.7); $('#wkPrev').innerHTML = `<img class="avatar" src="${tmp.photo}" style="width:90px;height:90px">`; }
  };
}

/* ---------- ক্লিক হ্যান্ডলার ---------- */
document.addEventListener('click', e => {
  const tb = e.target.closest('[data-tab]');
  if (tb) { tab = tb.dataset.tab; userAct = true; render(); userAct = false; return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  userAct = true;
  try { handle(b); } finally { userAct = false; }
});

function handle(b) {
  const { act, w, k, t, n } = b.dataset;
  const N = Number(n);
  const key = (w && n && k) ? aKey(w, n, k) : null;
  const A = key ? DB.data.atts[key] : null;

  if (act === 'addWork') { tmp = {}; workModal(); }
  else if (act === 'closeModal') closeModal();
  else if (act === 'saveWork') {
    if (tmp.recording) { toast('আগে রেকর্ড থামান'); return; }
    if (!tmp.photo && !tmp.text && !tmp.voice) { toast('ছবি, লেখা বা ভয়েস নোট দিন'); return; }
    if ((tmp.photo || '').length + (tmp.voice || '').length + (tmp.text || '').length > 900000) { toast('ছবি + ভয়েস মিলিয়ে বেশি বড়। ছোট ভয়েস দিন।'); return; }
    DB.set('works', uid(), { date, dates: [date], photo: tmp.photo || null, text: (tmp.text || '').trim(), voice: tmp.voice || null, created: Date.now() });
    closeModal(); toast('কাজ যোগ হয়েছে');
  }
  else if (act === 'delWork') {
    if (!confirm('এই কাজ ও এর সব দিনের হাজিরি মুছবেন?')) return;
    Object.keys(DB.data.atts).filter(i => i.startsWith(w + '_d')).forEach(i => DB.del('atts', i));
    DB.del('works', w);
  }
  else if (act === 'addDay') {
    const wk = DB.data.works[w], ds = workDates(wk).slice(), last = ds[ds.length - 1];
    const next = todayStr() > last ? todayStr() : addDays(last, 1);
    ds.push(next);
    dayOpen[w + '_' + ds.length] = true;
    DB.set('works', w, { dates: ds });
    toast(`দিন ${bn(ds.length)} যোগ হয়েছে (${fmtDate(next)})`);
  }
  else if (act === 'delDay') {
    const wk = DB.data.works[w], ds = workDates(wk).slice();
    if (N !== ds.length || ds.length < 2) return;
    const ks = Object.keys(DB.data.atts).filter(i => i.startsWith(w + '_d' + n + '_'));
    if (ks.length && !confirm(`দিন ${bn(n)}-এর ${bn(ks.length)}টি হাজিরি সহ মুছবেন?`)) return;
    ks.forEach(i => DB.del('atts', i));
    ds.pop(); delete dayOpen[w + '_' + n];
    DB.set('works', w, { dates: ds });
  }
  else if (act === 'toggleDay') {
    const total = workDates(DB.data.works[w]).length, dk = w + '_' + n;
    const cur = dk in dayOpen ? dayOpen[dk] : N === total;
    dayOpen[dk] = !cur; render();
  }
  else if (act === 'pres') DB.set('atts', key, { workId: w, day: N, workerId: k, status: 'present', amount: 0, paid: false });
  else if (act === 'abs') DB.set('atts', key, { workId: w, day: N, workerId: k, status: 'absent', amount: 0, paid: false });
  else if (act === 'pick') {
    // একই তারিখে একই লেবার আরেক কাজে ধরা থাকলে সতর্ক করে (ডাবল হিসাব আটকাতে)
    const wk = DB.data.works[w], who = DB.data.workers[k], dd = workDates(wk)[N - 1];
    const other = Object.values(DB.data.atts).find(a => a.workerId === k && !(a.workId === w && (a.day || 1) === N) && a.amount > 0 && attDate(a) === dd);
    if (other && !confirm(`${who.name} এই তারিখে আরেকটি কাজে ${LABEL[other.status]} (${bn(other.amount)} টাকা) ধরা আছে। এখানেও যোগ করবেন?`)) return;
    DB.set('atts', key, { status: t, amount: Number(S()[t]) || 0, paid: false });
  }
  else if (act === 'reset') { if (!A || !A.paid) DB.del('atts', key); }
  else if (act === 'pay') {
    if (A.paid) { if (!confirm('"দেওয়া হয়েছে" বাতিল করে আবার বাকি করবেন?')) return; DB.set('atts', key, { paid: false, paidAt: null }); }
    else DB.set('atts', key, { paid: true, paidAt: Date.now() });
  }
  else if (act === 'payAll') {
    const wk = DB.data.workers[k];
    const list = Object.entries(DB.data.atts).filter(([, a]) => a.workerId === k && a.amount && !a.paid);
    const sum = list.reduce((s, [, a]) => s + a.amount, 0);
    if (!confirm(`${wk.name}-কে ${bn(sum)} টাকা দেওয়া হয়েছে?`)) return;
    list.forEach(([id]) => DB.set('atts', id, { paid: true, paidAt: Date.now() }));
  }
  else if (act === 'saveRates') {
    DB.set('settings', 'main', { half: Number($('#rHalf').value) || 0, full: Number($('#rFull').value) || 0, double: Number($('#rDouble').value) || 0 });
    toast('রেট সেভ হয়েছে');
  }
  else if (act === 'savePins') {
    const a = $('#pAdmin').value.trim(), s = $('#pStaff').value.trim();
    if (!/^\d{4,8}$/.test(a) || !/^\d{4,8}$/.test(s) || a === s) { toast('দুটি আলাদা পিন দিন (৪-৮ সংখ্যা)'); return; }
    DB.set('settings', 'main', { adminPin: a, staffPin: s }); toast('পিন সেভ হয়েছে');
  }
  else if (act === 'addWorker') workerModal(null);
  else if (act === 'editWorker') workerModal(k);
  else if (act === 'saveWorker') {
    const name = $('#kName').value.trim();
    if (!name) { toast('নাম দিন'); return; }
    const id = tmp.id || uid();
    DB.set('workers', id, { name, photo: tmp.photo || null, created: (DB.data.workers[id] || {}).created || Date.now() });
    closeModal();
  }
  else if (act === 'delWorker') {
    if (!confirm('এই লেবার মুছবেন? তার পুরনো হাজিরির হিসাবও বাদ যাবে।')) return;
    Object.entries(DB.data.atts).filter(([, a]) => a.workerId === k).forEach(([id]) => DB.del('atts', id));
    DB.del('workers', k);
  }
}

document.addEventListener('change', e => {
  if (e.target.id === 'dateSel' && e.target.value) { date = e.target.value; render(); }
});

/* অডিও চলার সময় রি-রেন্ডার করলে শব্দ কেটে যায়, তাই চলাকালে অপেক্ষা করে */
let pendingRender = false;
const anyPlaying = () => [...document.querySelectorAll('audio')].some(a => !a.paused && !a.ended);
DB.onChange(() => {
  if (!$('#modal').classList.contains('hidden')) return; // মোডাল খোলা থাকলে রি-রেন্ডার নয়
  if (anyPlaying() && !userAct) { pendingRender = true; return; }
  render();
});
document.addEventListener('pause', e => {
  if (e.target.tagName === 'AUDIO' && pendingRender) { pendingRender = false; render(); }
}, true);

if (role) start(); else showLogin();
