// ছোট ডেটাবেস লেয়ার: Firebase থাকলে Firestore, না থাকলে localStorage (ডেমো)
const DB = (() => {
  const cfg = window.FIREBASE_CONFIG;
  const online = !!(cfg && cfg.apiKey && window.firebase);
  const cols = ['workers', 'works', 'atts', 'settings'];
  const data = { workers: {}, works: {}, atts: {}, settings: {} };
  const listeners = [];
  const emit = () => listeners.forEach(f => f());
  let fs = null;

  function saveLocal() {
    try { localStorage.setItem('tw_data', JSON.stringify(data)); }
    catch (e) { alert('জায়গা শেষ! ব্রাউজারে আর ডেটা রাখা যাচ্ছে না।'); }
  }

  if (online) {
    firebase.initializeApp(cfg);
    fs = firebase.firestore();
    cols.forEach(c => {
      fs.collection(c).onSnapshot(snap => {
        data[c] = {};
        snap.forEach(d => { data[c][d.id] = d.data(); });
        emit();
      }, err => console.error(err));
    });
  } else {
    try {
      const s = JSON.parse(localStorage.getItem('tw_data') || 'null');
      if (s) cols.forEach(c => { data[c] = s[c] || {}; });
    } catch (e) {}
  }

  return {
    online,
    data,
    onChange(f) { listeners.push(f); if (!online) setTimeout(emit, 0); },
    set(col, id, obj) {
      data[col][id] = Object.assign({}, data[col][id] || {}, obj);
      if (online) fs.collection(col).doc(id).set(data[col][id]).catch(e => alert('সেভ হয়নি: ' + e.message));
      else saveLocal();
      emit();
    },
    del(col, id) {
      delete data[col][id];
      if (online) fs.collection(col).doc(id).delete().catch(e => alert('মোছা যায়নি: ' + e.message));
      else saveLocal();
      emit();
    }
  };
})();
