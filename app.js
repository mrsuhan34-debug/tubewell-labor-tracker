const $ = s => document.querySelector(s);
const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = n => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const fmtDate = s => { const [y, m, d] = s.split('-'); return bn(d + '/' + m + '/' + y); };
const LABEL = { half: 'হাফ ডে', full: 'ফুল ডে', double: 'ডাবল' };

let role = sessionStorage.getItem('role');
let tab = 'hajiri';
let date = todayStr();

const S = () => Object.assign({ half: 250, full: 500, double: 1000, staffPin: '1234', adminPin: '9999' }, DB.data.settings.main || {});
const workers = () => Object.values(DB.data.workers).sort((a, b) => a.created - b.created);

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2200);
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

/* ---------- লগইন ---------- */
function showLogin() {
  $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
}
$('#pinBtn').onclick = () => {
  const p = $('#pin').value.trim(), s = S();
  if (p === s.adminPin) role = 'admin';
  else if (p === s.staffPin) role = 'staff';
  else { $('#pinErr').textContent = 'ভুল পিন'; return; }
  sessionStorage.setItem('role', role);
  $('#pin').value = ''; $('#pinErr').textContent = '';
  start();
};
$('#pin').addEventListener('keydown', e => { if (e.key === 'Enter') $('#pinBtn').click(); });
$('#logout').onclick = () => { sessionStorage.removeItem('role'); role = null; showLogin(); };

function start() {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
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
  renderTabs();
  const v = $('#view');
  const demo = DB.online ? '' : '<div class="demo">⚠️ ডেমো মোড: ডেটা শুধু এই ফোনে থাকছে। সবাই একসাথে দেখতে Firebase সেটআপ করুন (README দেখুন)।</div>';
  v.innerHTML = demo + (tab === 'hajiri' ? viewHajiri() : tab === 'dues' ? viewDues() : viewAdmin());
}

function viewHajiri() {
  const works = Object.values(DB.data.works).filter(w => w.date === date).sort((a, b) => a.created - b.created);
  const wl = workers();
  let h = `<div class="card"><div class="row between"><div style="flex:1"><label style="margin-top:0">তারিখ</label><input type="date" id="dateSel" value="${date}"></div></div>
    <button class="btn primary big" style="margin-top:10px" data-act="addWork">➕ নতুন কাজ যোগ করুন</button></div>`;
  if (!works.length) h += `<div class="empty">${fmtDate(date)} তারিখে কোনো কাজ যোগ করা হয়নি।</div>`;
  works.forEach(w => { h += workCard(w, wl); });
  return h;
}

function workCard(w, wl) {
  const atts = wl.map(k => DB.data.atts[w.id + '_' + k.id]).filter(Boolean);
  const total = atts.reduce((s, a) => s + (a.amount || 0), 0);
  const unpaid = atts.reduce((s, a) => s + (a.amount && !a.paid ? a.amount : 0), 0);
  let h = `<div class="card">`;
  if (w.photo) h += `<img class="work-photo" src="${w.photo}">`;
  if (w.text) h += `<div class="note">📍 ${esc(w.text)}</div>`;
  if (w.voice) h += `<audio controls src="${w.voice}"></audio>`;
  h += `<div class="sum">মোট মজুরি: ${bn(total)} টাকা · বাকি: <b style="color:#d92d20">${bn(unpaid)}</b> টাকা</div>`;
  if (!wl.length) h += `<div class="empty">আগে অ্যাডমিন প্যানেল থেকে লেবার যোগ করুন।</div>`;
  wl.forEach(k => { h += workerRow(w, k); });
  if (role === 'admin') h += `<div style="text-align:right;margin-top:8px"><button class="btn danger sm" data-act="delWork" data-w="${w.id}">এই কাজ মুছুন</button></div>`;
  return h + '</div>';
}

function workerRow(w, k) {
  const a = DB.data.atts[w.id + '_' + k.id];
  const s = S();
  const pic = k.photo ? `<img src="${k.photo}">` : `<div class="avatar">👷</div>`;
  let r = `<div class="wk">${pic}<div class="name">${esc(k.name)}</div>`;
  const ids = `data-w="${w.id}" data-k="${k.id}"`;
  if (!a) {
    r += `<button class="tick" data-act="pres" ${ids}>✔</button><button class="cross" data-act="abs" ${ids}>✖</button>`;
  } else if (a.status === 'absent') {
    r += `<span class="badge abs">অনুপস্থিত</span><button class="undo" data-act="reset" ${ids}>পরিবর্তন</button>`;
  } else if (a.status === 'present') {
    r += `<span class="badge">উপস্থিত</span><button class="undo" data-act="reset" ${ids}>পরিবর্তন</button>
      <div class="opts">${['half', 'full', 'double'].map(t => `<button data-act="pick" data-t="${t}" ${ids}>${LABEL[t]}<small>${bn(s[t])} টাকা</small></button>`).join('')}</div>`;
  } else {
    r += `<span class="badge">${LABEL[a.status]}</span>
      <button class="pay ${a.paid ? 'green' : 'red'}" data-act="pay" ${ids}>${bn(a.amount)} টাকা${a.paid ? ' ✓ দেওয়া' : ''}</button>
      ${a.paid ? '' : `<button class="undo" data-act="reset" ${ids}>পরিবর্তন</button>`}`;
  }
  return r + '</div>';
}

/* বাকি: কার কত টাকা জমা আছে (মাঝে ফাঁক থাকলেও হিসাব থাকবে) */
function viewDues() {
  const wl = workers();
  if (!wl.length) return '<div class="empty">কোনো লেবার নেই।</div>';
  let grand = 0, h = '';
  wl.forEach(k => {
    const list = Object.values(DB.data.atts).filter(a => a.workerId === k.id && a.amount && !a.paid)
      .map(a => ({ a, w: DB.data.works[a.workId] })).filter(x => x.w)
      .sort((x, y) => x.w.date.localeCompare(y.w.date));
    const sum = list.reduce((s, x) => s + x.a.amount, 0);
    grand += sum;
    const pic = k.photo ? `<img src="${k.photo}">` : `<div class="avatar">👷</div>`;
    h += `<div class="card"><div class="row">${pic}<div style="flex:1"><b>${esc(k.name)}</b><div class="${sum ? 'due' : 'ok'}">${sum ? bn(sum) + ' টাকা বাকি' : '✓ কিছু বাকি নেই'}</div></div></div>`;
    list.forEach(x => {
      h += `<div class="row between" style="padding:6px 0;border-top:1px solid #edf1f6"><span>${fmtDate(x.w.date)} · ${LABEL[x.a.status]}${x.w.text ? ' · ' + esc(x.w.text.slice(0, 20)) : ''}</span><b>${bn(x.a.amount)}</b></div>`;
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
    <p style="font-size:12px;color:#6b7785">নতুন রেট শুধু ভবিষ্যতের হাজিরিতে কাজ করবে, পুরনো হিসাব বদলাবে না।</p>
    <button class="btn primary" data-act="saveRates">রেট সেভ করুন</button></div>`;
  h += `<div class="card"><h2>পিন বদলান</h2>
    <label>কর্মচারীর পিন</label><input type="text" id="pStaff" value="${esc(s.staffPin)}">
    <label>অ্যাডমিন পিন</label><input type="text" id="pAdmin" value="${esc(s.adminPin)}">
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
function closeModal() { stopRec(); $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; }

function workModal() {
  openModal(`<h3>নতুন কাজ</h3>
    <label>কাজের জায়গার ছবি</label>
    ${tmp.photo ? `<img class="work-photo" src="${tmp.photo}">` : ''}
    <input type="file" id="wPhoto" accept="image/*" capture="environment">
    <label>জায়গার বিবরণ (লিখে)</label>
    <textarea id="wText" placeholder="যেমন: রহিম সাহেবের বাড়ি, মেইন রোডের পাশে">${esc(tmp.text || '')}</textarea>
    <label>অথবা ভয়েস নোট</label>
    ${tmp.voice ? `<audio controls src="${tmp.voice}"></audio>` : ''}
    <div class="row">
      <button class="btn" id="recBtn">${tmp.recording ? '⏹ থামান' : '🎤 রেকর্ড করুন'}</button>
      ${tmp.voice ? '<button class="btn danger sm" id="recDel">মুছুন</button>' : ''}
    </div>
    <div class="row" style="margin-top:16px">
      <button class="btn" data-act="closeModal" style="flex:1">বাতিল</button>
      <button class="btn primary" data-act="saveWork" style="flex:2">কাজ সেভ করুন</button>
    </div>`);
  $('#wPhoto').onchange = async e => { if (e.target.files[0]) { tmp.photo = await img(e.target.files[0], 800, 0.6); workModal(); } };
  $('#wText').oninput = e => { tmp.text = e.target.value; };
  $('#recBtn').onclick = toggleRec;
  if ($('#recDel')) $('#recDel').onclick = () => { tmp.voice = null; workModal(); };
}

let mr, chunks = [];
async function toggleRec() {
  if (tmp.recording) { stopRec(); return; }
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: true });
    mr = new MediaRecorder(st, { audioBitsPerSecond: 16000 });
    chunks = [];
    mr.ondataavailable = e => chunks.push(e.data);
    mr.onstop = () => {
      st.getTracks().forEach(t => t.stop());
      const r = new FileReader();
      r.onload = () => { tmp.voice = r.result; tmp.recording = false; workModal(); };
      r.readAsDataURL(new Blob(chunks, { type: mr.mimeType }));
    };
    mr.start(); tmp.recording = true; workModal();
    setTimeout(() => { if (mr && mr.state === 'recording') mr.stop(); }, 60000);
  } catch (e) { alert('মাইক্রোফোন চালু করা যায়নি। পারমিশন দিন।'); }
}
function stopRec() { if (mr && mr.state === 'recording') mr.stop(); }

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
  if (tb) { tab = tb.dataset.tab; render(); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const { act, w, k, t } = b.dataset;
  const key = w + '_' + k;
  const A = DB.data.atts[key];

  if (act === 'addWork') { tmp = {}; workModal(); }
  else if (act === 'closeModal') closeModal();
  else if (act === 'saveWork') {
    if (tmp.recording) { toast('আগে রেকর্ড থামান'); return; }
    if (!tmp.photo && !tmp.text && !tmp.voice) { toast('ছবি, লেখা বা ভয়েস নোট দিন'); return; }
    DB.set('works', uid(), { date, photo: tmp.photo || null, text: (tmp.text || '').trim(), voice: tmp.voice || null, created: Date.now() });
    closeModal(); toast('কাজ যোগ হয়েছে');
  }
  else if (act === 'delWork') {
    if (!confirm('এই কাজ ও এর সব হাজিরি মুছবেন?')) return;
    Object.keys(DB.data.atts).filter(i => i.startsWith(w + '_')).forEach(i => DB.del('atts', i));
    DB.del('works', w);
  }
  else if (act === 'pres') DB.set('atts', key, { workId: w, workerId: k, status: 'present', amount: 0, paid: false });
  else if (act === 'abs') DB.set('atts', key, { workId: w, workerId: k, status: 'absent', amount: 0, paid: false });
  else if (act === 'pick') DB.set('atts', key, { status: t, amount: Number(S()[t]) || 0, paid: false });
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
    if (a.length < 4 || s.length < 4 || a === s) { toast('দুটি আলাদা পিন দিন (কমপক্ষে ৪ অক্ষর)'); return; }
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
});

document.addEventListener('change', e => {
  if (e.target.id === 'dateSel' && e.target.value) { date = e.target.value; render(); }
});

DB.onChange(() => {
  if (!$('#modal').classList.contains('hidden')) return; // মোডাল খোলা থাকলে রি-রেন্ডার নয়
  render();
});
if (role) start(); else showLogin();
