const APP_VERSION = 6;
const NEED = { db: 5, scene: 5 }; // db.js ও scene3d.js-এর সংস্করণ
const $ = s => document.querySelector(s);
const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = n => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const ymd = ts => { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const fmtDate = s => { const [y, m, d] = s.split('-'); return bn(d + '/' + m + '/' + y); };
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(y, m - 1, d + n); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); };
const num = v => Number(v) || 0;
const sumBy = (arr, f) => (arr || []).reduce((s, x) => s + num(f(x)), 0);
const LABEL = { half: 'হাফ ডে', full: 'ফুল ডে', double: 'ডাবল' };
const CATS = [
  { k: 'mal', l: 'মালামাল', i: '🧱' },
  { k: 'mistri', l: 'মিস্ত্রি', i: '🔧' },
  { k: 'gari', l: 'গাড়ি / যাতায়াত', i: '🚚' },
  { k: 'other', l: 'অন্যান্য', i: '📝' }
];
const catOf = k => CATS.find(c => c.k === k) || CATS[3];
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
};

/* একটি কাজের দিনগুলো: dates = ['২০২৬-১১-০৭', '২০২৬-১১-০৮', ...] (দিন ১, দিন ২ ...) */
const workDates = w => (w.dates && w.dates.length) ? w.dates : [w.date];
const aKey = (w, n, k) => w + '_d' + n + '_' + k;
const attDate = a => { const w = DB.data.works[a.workId]; return w ? workDates(w)[(a.day || 1) - 1] || null : null; };
/* টাকা দেওয়া: paidAmt = এ পর্যন্ত যত টাকা দিয়েছি (আংশিকও হতে পারে) */
const paidOf = a => a.paidAmt != null ? num(a.paidAmt) : (a.paid ? num(a.amount) : 0);
const dueOf = a => Math.max(0, num(a.amount) - paidOf(a));
const workName = w => { const t = (w.text || '').split('\n')[0].trim(); return t ? t.slice(0, 30) : (w.photo ? 'ছবির কাজ' : (w.voice ? 'ভয়েস নোটের কাজ' : 'কাজ')); };
const thumb = w => w.photo ? `<img class="thumb" src="${w.photo}">` : `<div class="thumb ph">🛠</div>`;
const av = (k, cls) => k.photo ? `<img class="av ${cls || ''}" src="${k.photo}">` : `<div class="av ph ${cls || ''}">👷</div>`;
const dayOpen = {}; // 'কাজ_দিন' -> খোলা/বন্ধ (ডিফল্ট: শেষ দিন খোলা)
const accOpen = {}; // কাজের হিসাব প্যানেল খোলা/বন্ধ

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
  if (DB.version !== NEED.db) p.push('db.js');
  if (typeof Scene3D === 'undefined' || Scene3D.version !== NEED.scene) p.push('scene3d.js');
  if (typeof THREE === 'undefined') p.push('three.js (ইন্টারনেট থেকে লোড হয়নি)');
  return p;
}
const warnHtml = () => {
  const p = fileProblems();
  return p.length ? `<div class="warn">⚠️ কিছু ফাইল পুরনো বা আপলোড হয়নি: <b>${p.join(', ')}</b>। ওই ফাইলের নতুন কোড বসিয়ে আবার ডিপ্লয় করুন।</div>` : '';
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
  if (role === 'admin') { t.push(['acct', '📊 হিসাব']); t.push(['admin', '⚙️ অ্যাডমিন']); }
  $('#tabs').innerHTML = t.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('');
}

function render() {
  if (!role) return showLogin();
  if ((tab === 'admin' || tab === 'acct') && role !== 'admin') tab = 'hajiri';
  renderTabs();
  const demo = DB.online ? '' : '<div class="demo">⚠️ ডেমো মোড: ডেটা শুধু এই ফোনে থাকছে। সবাই একসাথে দেখতে Firebase সেটআপ করুন (README দেখুন)।</div>';
  $('#view').innerHTML = warnHtml() + demo +
    (tab === 'hajiri' ? viewHajiri() : tab === 'dues' ? viewDues() : tab === 'acct' ? viewAcct() : viewAdmin()) +
    `<div class="ver">সংস্করণ ${bn(APP_VERSION)}</div>`;
}

function focusWork(wid) {
  setTimeout(() => {
    const el = document.getElementById('work-' + wid);
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800);
  }, 60);
}

/* ---------- হাজিরি ---------- */
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
    if (a && a.amount) { total += num(a.amount); unpaid += dueOf(a); }
  }));
  let h = `<div class="card" id="work-${w.id}">`;
  if (w.photo) h += `<img class="work-photo" src="${w.photo}">`;
  if (w.text) h += `<div class="note">📍 ${esc(w.text)}</div>`;
  if (w.voice) h += `<div class="voice-l">🔊 ভয়েস নোট</div><audio controls preload="metadata" src="${w.voice}"></audio>`;
  if (ds[N - 1] < date) h += `<div class="hint">এই কাজ আগের দিনের। আজও চললে নিচে "দিন যোগ করুন" চাপুন।</div>`;
  h += `<div class="sum">${N > 1 ? bn(N) + ' দিনে ' : ''}মোট মজুরি: ${bn(total)} টাকা · বাকি: <b style="color:var(--red)">${bn(unpaid)}</b> টাকা</div>`;
  if (!wl.length) h += `<div class="empty">আগে অ্যাডমিন প্যানেল থেকে লেবার যোগ করুন।</div>`;
  ds.forEach((d, i) => { h += daySection(w, wl, i + 1, d, N); });
  h += `<button class="btn add" data-act="addDay" data-w="${w.id}">➕ দিন ${bn(N + 1)} যোগ করুন</button>`;
  if (role === 'admin') h += acctPanel(w);
  if (role === 'admin') h += `<div style="text-align:right;margin-top:10px"><button class="btn danger sm" data-act="delWork" data-w="${w.id}">এই কাজ মুছুন</button></div>`;
  return h + '</div>';
}

function daySection(w, wl, n, d, N) {
  const dk = w.id + '_' + n;
  const open = dk in dayOpen ? dayOpen[dk] : n === N;
  let t = 0, u = 0, cnt = 0;
  wl.forEach(k => {
    const a = DB.data.atts[aKey(w.id, n, k.id)];
    if (a) { cnt++; if (a.amount) { t += num(a.amount); u += dueOf(a); } }
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
  const key = aKey(w.id, n, k.id);
  const a = DB.data.atts[key];
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
    const p = paidOf(a), due = dueOf(a);
    r += `<span class="badge">${LABEL[a.status]}</span><div class="sub">`;
    if (p === 0) r += `<button class="pay red" data-act="payModal" data-id="${key}">${bn(a.amount)} টাকা</button><button class="undo" data-act="reset" ${ids}>পরিবর্তন</button>`;
    else if (due > 0) r += `<button class="pay green" data-act="payModal" data-id="${key}">✓ ${bn(p)} দেওয়া</button><button class="pay red" data-act="payModal" data-id="${key}">${bn(due)} বাকি</button>`;
    else r += `<button class="pay green" data-act="payModal" data-id="${key}">${bn(a.amount)} টাকা ✓ দেওয়া</button>`;
    r += '</div>';
  }
  return r + '</div>';
}

/* ---------- বাকি ---------- */
function dueList(kid) {
  return Object.entries(DB.data.atts)
    .filter(([, a]) => a.workerId === kid && num(a.amount) > 0 && dueOf(a) > 0)
    .map(([id, a]) => ({ id, a, w: DB.data.works[a.workId], d: attDate(a) }))
    .filter(x => x.w && x.d)
    .sort((x, y) => x.d.localeCompare(y.d) || x.id.localeCompare(y.id));
}
/* টাকা দিলে সবচেয়ে পুরনো বাকি আগে মেটে */
function allocate(list, amt) {
  const out = []; let left = amt;
  for (const x of list) { if (left <= 0) break; const p = Math.min(left, dueOf(x.a)); out.push({ x, p }); left -= p; }
  return out;
}

function viewDues() {
  const wl = workers();
  if (!wl.length) return '<div class="empty">কোনো লেবার নেই।</div>';
  let grand = 0, h = '';
  const clear = [];
  wl.forEach(k => {
    const list = dueList(k.id);
    const sum = list.reduce((s, x) => s + dueOf(x.a), 0);
    grand += sum;
    if (!sum) { clear.push(k); return; }
    h += `<div class="card"><div class="row">${av(k)}<div style="flex:1"><b style="font-size:17px">${esc(k.name)}</b><div class="due">${bn(sum)} টাকা বাকি</div></div>
      <button class="btn primary sm" data-act="workerPay" data-k="${k.id}">💵 টাকা দিন</button></div><div class="dlist">`;
    list.forEach(x => {
      const multi = workDates(x.w).length > 1, p = paidOf(x.a);
      h += `<button class="due-row" data-act="openWork" data-w="${x.w.id}" data-n="${x.a.day || 1}">
        ${thumb(x.w)}
        <span class="dr-t"><b>${esc(workName(x.w))}</b><small>${fmtDate(x.d)}${multi ? ' · দিন ' + bn(x.a.day || 1) : ''} · ${LABEL[x.a.status]}</small></span>
        <span class="dr-a"><b>${bn(dueOf(x.a))}</b>${p ? `<small>${bn(p)} দেওয়া</small>` : ''}</span><span class="dr-go">›</span></button>`;
    });
    h += '</div></div>';
  });
  let top = `<div class="card"><h2>সবার মোট বাকি</h2><div class="due">${bn(grand)} টাকা</div></div>`;
  if (!grand) top = `<div class="card"><h2>সবার মোট বাকি</h2><div class="due ok">✓ কারও কিছু বাকি নেই</div></div>`;
  if (clear.length) h += `<div class="card"><h2>বাকি নেই</h2>${clear.map(k => `<div class="row" style="padding:6px 0">${av(k, 'sm')}<span style="flex:1;font-weight:600">${esc(k.name)}</span><span class="ok">✓</span></div>`).join('')}</div>`;
  return top + h;
}

/* ---------- কাজের হিসাব (শুধু অ্যাডমিন) ---------- */
function wagesOf(w) {
  let total = 0, paid = 0;
  Object.values(DB.data.atts).forEach(a => { if (a.workId === w.id && num(a.amount) > 0) { total += num(a.amount); paid += paidOf(a); } });
  return { total, paid };
}
function acct(w) {
  const price = num(w.price), recv = sumBy(w.recv, x => x.amt), exp = sumBy(w.exp, x => x.amt);
  const wg = wagesOf(w), expTotal = exp + wg.total;
  return { price, recv, receivable: price - recv, exp, wg, expTotal, profit: price - expTotal };
}
const profitTxt = ac => !ac.price ? 'দাম দেওয়া হয়নি' : (ac.profit >= 0 ? `লাভ ${bn(ac.profit)} টাকা` : `লস ${bn(-ac.profit)} টাকা`);
const profitCls = ac => !ac.price ? 'muted' : (ac.profit >= 0 ? 'ok' : 'neg');

function acctPanel(w) {
  const ac = acct(w), open = !!accOpen[w.id];
  let h = `<div class="acc"><button class="acc-h" data-act="toggleAcc" data-w="${w.id}">
    <span>${open ? '▾' : '▸'} 💼 কাজের হিসাব <small>(শুধু অ্যাডমিন)</small></span><b class="${profitCls(ac)}">${profitTxt(ac)}</b></button>`;
  if (!open) return h + '</div>';
  h += `<div class="acc-b">
    <div class="ar"><span>কাজের দাম (কত টাকায় ধরেছি)</span><b>${ac.price ? bn(ac.price) + ' টাকা' : '—'}</b></div>
    <button class="btn sm" data-act="priceModal" data-w="${w.id}">✏️ দাম ${ac.price ? 'বদলান' : 'লিখুন'}</button>

    <div class="ar sep"><span>কাস্টমারের থেকে পাওয়া</span><b class="ok">${bn(ac.recv)} টাকা</b></div>`;
  (w.recv || []).forEach(x => {
    h += `<div class="ent"><span>${fmtDate(ymd(x.at))}${x.note ? ' · ' + esc(x.note) : ''}</span><b>${bn(num(x.amt))}</b><button class="x" data-act="delEntry" data-w="${w.id}" data-t="recv" data-e="${x.id}">✖</button></div>`;
  });
  h += `<button class="btn sm" data-act="entryModal" data-w="${w.id}" data-t="recv">➕ টাকা পেলাম</button>`;
  if (ac.price) h += `<div class="ar"><span>কাস্টমারের কাছে এখনো পাওনা</span><b class="${ac.receivable > 0 ? 'neg' : 'ok'}">${bn(ac.receivable)} টাকা</b></div>`;

  h += `<div class="ar sep"><span>খরচ</span><b>${bn(ac.exp)} টাকা</b></div>`;
  (w.exp || []).forEach(x => {
    const c = catOf(x.cat);
    h += `<div class="ent"><span>${c.i} ${c.l}${x.note ? ' · ' + esc(x.note) : ''}</span><b>${bn(num(x.amt))}</b><button class="x" data-act="delEntry" data-w="${w.id}" data-t="exp" data-e="${x.id}">✖</button></div>`;
  });
  h += `<button class="btn sm" data-act="entryModal" data-w="${w.id}" data-t="exp">➕ খরচ যোগ করুন</button>
    <div class="ar"><span>👷 লেবারের মজুরি <small>(হাজিরি থেকে নিজে থেকে)</small></span><b>${bn(ac.wg.total)} টাকা</b></div>
    <div class="ar"><span>মোট খরচ</span><b>${bn(ac.expTotal)} টাকা</b></div>`;
  if (ac.price) {
    const pct = Math.round(ac.expTotal / ac.price * 100);
    h += `<div class="pbar"><i class="${pct > 100 ? 'over' : ''}" style="width:${Math.min(100, pct)}%"></i></div><small class="muted">বাজেটের ${bn(pct)}% খরচ হয়েছে</small>
      <div class="profit ${ac.profit >= 0 ? 'ok' : 'neg'}">${ac.profit >= 0 ? 'নিজের লাভ' : 'লস'}: ${bn(Math.abs(ac.profit))} টাকা</div>`;
  } else h += `<div class="hint">কাজের দাম লিখলে লাভ-লস দেখাবে।</div>`;
  return h + '</div></div>';
}

function viewAcct() {
  const works = Object.values(DB.data.works).sort((a, b) => b.created - a.created);
  if (!works.length) return '<div class="empty">এখনো কোনো কাজ নেই।</div>';
  let price = 0, recv = 0, exp = 0;
  const rows = works.map(w => { const ac = acct(w); price += ac.price; recv += ac.recv; exp += ac.expTotal; return { w, ac }; });
  const profit = price - exp;
  let h = `<div class="card"><h2>সব কাজের হিসাব</h2>
    <div class="ar"><span>কাজের মোট দাম</span><b>${bn(price)} টাকা</b></div>
    <div class="ar"><span>কাস্টমারের থেকে পাওয়া</span><b class="ok">${bn(recv)} টাকা</b></div>
    <div class="ar"><span>মোট খরচ (মজুরি সহ)</span><b>${bn(exp)} টাকা</b></div>
    <div class="profit ${profit >= 0 ? 'ok' : 'neg'}">${profit >= 0 ? 'মোট লাভ' : 'মোট লস'}: ${bn(Math.abs(profit))} টাকা</div></div>
    <div class="card"><h2>কাজ অনুযায়ী</h2><div class="dlist">`;
  rows.forEach(({ w, ac }) => {
    const ds = workDates(w);
    h += `<button class="due-row" data-act="openWork" data-w="${w.id}" data-n="${ds.length}" data-acc="1">
      ${thumb(w)}<span class="dr-t"><b>${esc(workName(w))}</b><small>${fmtDate(ds[0])}${ds.length > 1 ? ' থেকে ' + bn(ds.length) + ' দিন' : ''} · দাম ${ac.price ? bn(ac.price) : '—'}</small></span>
      <span class="dr-a"><b class="${profitCls(ac)}" style="font-size:13px">${profitTxt(ac)}</b></span><span class="dr-go">›</span></button>`;
  });
  return h + '</div></div>';
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
const closeBtn = (label) => `<button class="btn" data-act="closeModal" style="flex:1">${label || 'বাতিল'}</button>`;

/* ছবির জন্য দুই বাটন: ক্যামেরায় তোলা + গ্যালারি থেকে বাছা */
function photoBtns(prefix) {
  return `<div class="row wrap">
    <button type="button" class="btn" data-act="pickFile" data-t="${prefix}Cam">📷 ছবি তুলুন</button>
    <button type="button" class="btn" data-act="pickFile" data-t="${prefix}Gal">🖼 গ্যালারি থেকে বাছুন</button></div>
    <input type="file" accept="image/*" capture="environment" id="${prefix}Cam" hidden>
    <input type="file" accept="image/*" id="${prefix}Gal" hidden>`;
}
function bindPhoto(prefix, max, q, cb) {
  [prefix + 'Cam', prefix + 'Gal'].forEach(i => {
    $('#' + i).onchange = async e => { if (e.target.files[0]) { tmp.photo = await img(e.target.files[0], max, q); cb(); } };
  });
}

function workModal() {
  const rec = !!tmp.recording;
  openModal(`<h3>নতুন কাজ</h3>
    <label>১. কাজের জায়গার ছবি</label>
    ${tmp.photo ? `<img class="work-photo" src="${tmp.photo}">` : ''}
    ${photoBtns('wPhoto')}
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
      <div class="row wrap" style="margin-top:8px">
        <button type="button" class="btn sm" data-act="pickFile" data-t="wAudRec">🎙 ফোনের রেকর্ডার খুলুন</button>
        <button type="button" class="btn sm" data-act="pickFile" data-t="wAudFile">📁 ফাইল থেকে বাছুন</button></div>
      <input type="file" accept="audio/*" capture id="wAudRec" hidden>
      <input type="file" accept="audio/*" id="wAudFile" hidden></details>`}
    <div class="row" style="margin-top:16px">
      ${closeBtn()}
      <button class="btn primary" data-act="saveWork" style="flex:2">কাজ সেভ করুন</button>
    </div>`);
  bindPhoto('wPhoto', 800, 0.6, workModal);
  $('#wText').oninput = e => { tmp.text = e.target.value; };
  $('#recBtn').onclick = toggleRec;
  if ($('#recDel')) $('#recDel').onclick = () => { tmp.voice = null; tmp.err = ''; workModal(); };
  ['wAudRec', 'wAudFile'].forEach(i => {
    const el = $('#' + i); if (!el) return;
    el.onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 700 * 1024) { tmp.err = 'অডিও ফাইল বড় (সর্বোচ্চ প্রায় ৪০ সেকেন্ড)। ছোট করে রেকর্ড করুন।'; workModal(); return; }
      tmp.voice = await blobToDataURL(f); tmp.err = ''; workModal();
    };
  });
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
  const tech = `\n(কারণ: ${n || 'error'}${st ? ' · অবস্থা: ' + st : ''})`;
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') {
    if (st === 'denied')
      return 'এই সাইটে মাইক বন্ধ (Block) করা আছে। ঠিক করতে:\n১) ঠিকানার বাঁ পাশের আইকনে (🔒 বা ⚙) চাপুন\n২) "অনুমতি / Permissions" → "মাইক্রোফোন" → "অনুমতি দিন"\n৩) পেজ রিলোড করে আবার "রেকর্ড করুন" চাপুন\nতাতেও না হলে: ফোনের সেটিংস → অ্যাপ → Chrome → অনুমতি → মাইক্রোফোন → "অ্যাপ ব্যবহারের সময় অনুমতি দিন"।' + tech;
    return 'মাইকের অনুমতি দেওয়া হয়নি। আবার "রেকর্ড করুন" চাপুন, পপআপে "অনুমতি দিন (Allow)" চাপুন।' + tech;
  }
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'এই ফোনে মাইক্রোফোন পাওয়া যায়নি।' + tech;
  if (n === 'NotReadableError') return 'মাইক্রোফোন অন্য অ্যাপ ব্যবহার করছে। সেটি বন্ধ করে আবার চেষ্টা করুন।' + tech;
  return 'রেকর্ড শুরু হয়নি। নিচের "অন্য উপায়" ব্যবহার করুন।' + tech;
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
    <div id="wkPrev">${tmp.photo ? `<img class="avatar" src="${tmp.photo}" style="width:90px;height:90px;margin-bottom:8px">` : ''}</div>
    ${photoBtns('kPhoto')}
    <label>নাম</label><input type="text" id="kName" value="${esc(tmp.name)}">
    <div class="row" style="margin-top:16px">
      ${closeBtn()}
      <button class="btn primary" data-act="saveWorker" style="flex:2">সেভ করুন</button></div>`);
  bindPhoto('kPhoto', 240, 0.7, () => { $('#wkPrev').innerHTML = `<img class="avatar" src="${tmp.photo}" style="width:90px;height:90px;margin-bottom:8px">`; });
  $('#kName').oninput = e => { tmp.name = e.target.value; };
}

/* ---- টাকা দেওয়ার মডাল (আংশিকও দেওয়া যায়) ---- */
function payOne(id, amt) {
  const a = DB.data.atts[id], before = paidOf(a);
  const np = Math.min(num(a.amount), before + amt);
  const pays = (a.pays || []).concat([{ amt: np - before, at: Date.now() }]);
  DB.set('atts', id, { paidAmt: np, paid: np >= num(a.amount), pays, paidAt: Date.now() });
}

function payModal(id) {
  const a = DB.data.atts[id]; if (!a) return;
  const w = DB.data.works[a.workId], k = DB.data.workers[a.workerId];
  const p = paidOf(a), due = dueOf(a);
  tmp = { payId: id };
  const hist = (a.pays || []).map(x => `<div class="ent"><span>${fmtDate(ymd(x.at))}</span><b>${bn(x.amt)}</b></div>`).join('');
  openModal(`<h3>টাকা দেওয়া</h3>
    <div class="hint">${esc(k.name)} · ${LABEL[a.status]} · ${fmtDate(attDate(a))} · ${esc(workName(w))}</div>
    <div class="sum">মোট ${bn(a.amount)} · দেওয়া ${bn(p)} · বাকি <b style="color:var(--red)">${bn(due)}</b></div>
    ${due > 0 ? `<label>এখন কত টাকা দিচ্ছেন?</label>
      <input type="number" inputmode="numeric" id="payAmt" value="${due}" min="1" max="${due}">
      <div class="row wrap" style="margin-top:8px">
        <button class="btn sm" data-act="payQuick" data-t="${due}">পুরো ${bn(due)}</button>
        ${due >= 2 ? `<button class="btn sm" data-act="payQuick" data-t="${Math.floor(due / 2)}">অর্ধেক ${bn(Math.floor(due / 2))}</button>` : ''}</div>
      <div id="payLeft" class="hint" style="margin-top:10px"></div>` : '<div class="ok" style="font-weight:700;margin:10px 0">✓ সব টাকা দেওয়া হয়েছে</div>'}
    ${hist ? `<label>আগে যা দেওয়া হয়েছে</label>${hist}` : ''}
    <div class="row" style="margin-top:16px">${closeBtn('বন্ধ')}${due > 0 ? '<button class="btn primary" data-act="payDo" style="flex:2">✔ টাকা দিলাম</button>' : ''}</div>
    ${p > 0 ? '<div style="text-align:center;margin-top:12px"><button class="undo" data-act="payUndo">দেওয়া টাকা বাতিল করুন</button></div>' : ''}`);
  if (due > 0) {
    const upd = () => {
      const v = num($('#payAmt').value);
      $('#payLeft').textContent = v > due ? 'বাকির চেয়ে বেশি দেওয়া যাবে না' : v <= 0 ? '' : v === due ? 'সব মিটে যাবে ✓' : `বাকি থাকবে ${bn(due - v)} টাকা (পরে দেবেন)`;
    };
    $('#payAmt').oninput = upd; upd();
  }
}

function workerPayModal(kid) {
  const k = DB.data.workers[kid], list = dueList(kid), total = list.reduce((s, x) => s + dueOf(x.a), 0);
  if (!k || !total) return;
  tmp = { payK: kid, total };
  openModal(`<h3>${esc(k.name)}-কে টাকা দিন</h3>
    <div class="sum">মোট বাকি: <b style="color:var(--red)">${bn(total)}</b> টাকা</div>
    <label>এখন কত টাকা দিচ্ছেন?</label>
    <input type="number" inputmode="numeric" id="wpAmt" value="${total}" min="1" max="${total}">
    <div class="row wrap" style="margin-top:8px"><button class="btn sm" data-act="wpQuick" data-t="${total}">সব ${bn(total)}</button></div>
    <div id="wpPrev"></div>
    <div class="row" style="margin-top:16px">${closeBtn()}<button class="btn primary" data-act="wpDo" style="flex:2">✔ টাকা দিলাম</button></div>`);
  const upd = () => {
    const raw = num($('#wpAmt').value), v = Math.min(raw, total), al = allocate(list, v);
    $('#wpPrev').innerHTML = raw <= 0 ? '' :
      (raw > total ? '<div class="err">বাকির চেয়ে বেশি দেওয়া যাবে না</div>' : '') +
      '<label>পুরনো বাকি আগে মেটানো হবে</label>' +
      al.map(({ x, p }) => `<div class="ent"><span>${fmtDate(x.d)} · ${esc(workName(x.w))}</span><b>${bn(p)}${p < dueOf(x.a) ? ` <small>(বাকি ${bn(dueOf(x.a) - p)})</small>` : ' ✓'}</b></div>`).join('');
  };
  $('#wpAmt').oninput = upd; upd();
}

/* ---- কাজের হিসাবের মডাল ---- */
function priceModal(wid) {
  const w = DB.data.works[wid];
  tmp = { pw: wid };
  openModal(`<h3>কাজের দাম</h3>
    <div class="hint">${esc(workName(w))}</div>
    <label>কত টাকায় কাজটা ধরেছেন?</label>
    <input type="number" inputmode="numeric" id="prAmt" value="${num(w.price) || ''}" placeholder="যেমন: ২০০০০">
    <div class="row" style="margin-top:16px">${closeBtn()}<button class="btn primary" data-act="priceSave" style="flex:2">সেভ করুন</button></div>`);
}
function entryModal(wid, type) {
  const w = DB.data.works[wid];
  tmp = { ew: wid, et: type };
  openModal(`<h3>${type === 'exp' ? 'খরচ যোগ করুন' : 'কাস্টমারের থেকে টাকা পেলাম'}</h3>
    <div class="hint">${esc(workName(w))}</div>
    ${type === 'exp' ? `<label>কীসের খরচ</label><select id="eCat">${CATS.map(c => `<option value="${c.k}">${c.i} ${c.l}</option>`).join('')}</select>` : ''}
    <label>কত টাকা</label><input type="number" inputmode="numeric" id="eAmt">
    <label>বিবরণ (ইচ্ছা হলে)</label><input type="text" id="eNote" placeholder="${type === 'exp' ? 'যেমন: ৩০ ফুট পাইপ, ফিল্টার' : 'যেমন: অগ্রিম / শেষ পেমেন্ট'}">
    <div class="row" style="margin-top:16px">${closeBtn()}<button class="btn primary" data-act="entrySave" style="flex:2">সেভ করুন</button></div>`);
}

/* ---------- ক্লিক হ্যান্ডলার ---------- */
document.addEventListener('click', e => {
  const tb = e.target.closest('[data-tab]');
  if (tb) { tab = tb.dataset.tab; userAct = true; render(); userAct = false; window.scrollTo(0, 0); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  userAct = true;
  try { handle(b); } finally { userAct = false; }
});

function handle(b) {
  const { act, w, k, t, n, id, e: eid } = b.dataset;
  const N = Number(n);
  const key = (w && n && k) ? aKey(w, n, k) : null;
  const A = key ? DB.data.atts[key] : null;

  if (act === 'addWork') { tmp = {}; workModal(); }
  else if (act === 'closeModal') closeModal();
  else if (act === 'pickFile') { const el = $('#' + t); if (el) el.click(); }
  else if (act === 'saveWork') {
    if (tmp.recording) { toast('আগে রেকর্ড থামান'); return; }
    if (!tmp.photo && !tmp.text && !tmp.voice) { toast('ছবি, লেখা বা ভয়েস নোট দিন'); return; }
    if ((tmp.photo || '').length + (tmp.voice || '').length + (tmp.text || '').length > 900000) { toast('ছবি + ভয়েস মিলিয়ে বেশি বড়। ছোট ভয়েস দিন।'); return; }
    DB.set('works', uid(), { date, dates: [date], photo: tmp.photo || null, text: (tmp.text || '').trim(), voice: tmp.voice || null, created: Date.now() });
    closeModal(); toast('কাজ যোগ হয়েছে');
  }
  else if (act === 'delWork') {
    if (!confirm('এই কাজ ও এর সব দিনের হাজিরি ও হিসাব মুছবেন?')) return;
    Object.keys(DB.data.atts).filter(i => i.startsWith(w + '_d')).forEach(i => DB.del('atts', i));
    DB.del('works', w);
  }
  else if (act === 'openWork') {
    const wk = DB.data.works[w]; if (!wk) return;
    const ds = workDates(wk);
    tab = 'hajiri'; date = ds[N - 1] || ds[0];
    dayOpen[w + '_' + N] = true;
    if (b.dataset.acc) accOpen[w] = true;
    render(); focusWork(w);
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
  else if (act === 'toggleAcc') { accOpen[w] = !accOpen[w]; render(); }
  else if (act === 'pres') DB.set('atts', key, { workId: w, day: N, workerId: k, status: 'present', amount: 0, paid: false, paidAmt: 0 });
  else if (act === 'abs') DB.set('atts', key, { workId: w, day: N, workerId: k, status: 'absent', amount: 0, paid: false, paidAmt: 0 });
  else if (act === 'pick') {
    // একই তারিখে একই লেবার আরেক কাজে ধরা থাকলে সতর্ক করে (ডাবল হিসাব আটকাতে)
    const wk = DB.data.works[w], who = DB.data.workers[k], dd = workDates(wk)[N - 1];
    const other = Object.values(DB.data.atts).find(a => a.workerId === k && !(a.workId === w && (a.day || 1) === N) && a.amount > 0 && attDate(a) === dd);
    if (other && !confirm(`${who.name} এই তারিখে আরেকটি কাজে ${LABEL[other.status]} (${bn(other.amount)} টাকা) ধরা আছে। এখানেও যোগ করবেন?`)) return;
    DB.set('atts', key, { status: t, amount: Number(S()[t]) || 0, paid: false, paidAmt: 0, pays: [] });
  }
  else if (act === 'reset') { if (!A || paidOf(A) === 0) DB.del('atts', key); }
  else if (act === 'payModal') payModal(id);
  else if (act === 'payQuick') { $('#payAmt').value = t; $('#payAmt').dispatchEvent(new Event('input')); }
  else if (act === 'payDo') {
    const a = DB.data.atts[tmp.payId], v = num($('#payAmt').value);
    if (!a || v <= 0 || v > dueOf(a)) { toast('সঠিক টাকা লিখুন (বাকির বেশি নয়)'); return; }
    payOne(tmp.payId, v); closeModal(); toast(`${bn(v)} টাকা দেওয়া হয়েছে`);
  }
  else if (act === 'payUndo') {
    if (!confirm('এই এন্ট্রিতে আগে দেওয়া সব টাকা বাতিল করবেন?')) return;
    DB.set('atts', tmp.payId, { paidAmt: 0, paid: false, pays: [], paidAt: null }); closeModal();
  }
  else if (act === 'workerPay') workerPayModal(k);
  else if (act === 'wpQuick') { $('#wpAmt').value = t; $('#wpAmt').dispatchEvent(new Event('input')); }
  else if (act === 'wpDo') {
    const v = num($('#wpAmt').value);
    if (v <= 0 || v > tmp.total) { toast('সঠিক টাকা লিখুন (বাকির বেশি নয়)'); return; }
    allocate(dueList(tmp.payK), v).forEach(({ x, p }) => payOne(x.id, p));
    closeModal(); toast(`${bn(v)} টাকা দেওয়া হয়েছে`);
  }
  else if (act === 'priceModal') priceModal(w);
  else if (act === 'priceSave') {
    DB.set('works', tmp.pw, { price: num($('#prAmt').value) });
    accOpen[tmp.pw] = true; closeModal(); toast('দাম সেভ হয়েছে');
  }
  else if (act === 'entryModal') entryModal(w, t);
  else if (act === 'entrySave') {
    const amt = num($('#eAmt').value);
    if (amt <= 0) { toast('টাকার অঙ্ক লিখুন'); return; }
    const wk = DB.data.works[tmp.ew], type = tmp.et;
    const item = { id: uid(), amt, note: $('#eNote').value.trim(), at: Date.now() };
    if (type === 'exp') item.cat = $('#eCat').value;
    const arr = (wk[type] || []).concat([item]);
    DB.set('works', tmp.ew, type === 'exp' ? { exp: arr } : { recv: arr });
    accOpen[tmp.ew] = true; closeModal(); toast('সেভ হয়েছে');
  }
  else if (act === 'delEntry') {
    if (!confirm('এই এন্ট্রি মুছবেন?')) return;
    const wk = DB.data.works[w], arr = (wk[t] || []).filter(x => x.id !== eid);
    DB.set('works', w, t === 'exp' ? { exp: arr } : { recv: arr });
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
    const wid = tmp.id || uid();
    DB.set('workers', wid, { name, photo: tmp.photo || null, created: (DB.data.workers[wid] || {}).created || Date.now() });
    closeModal();
  }
  else if (act === 'delWorker') {
    if (!confirm('এই লেবার মুছবেন? তার পুরনো হাজিরির হিসাবও বাদ যাবে।')) return;
    Object.entries(DB.data.atts).filter(([, a]) => a.workerId === k).forEach(([i]) => DB.del('atts', i));
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
