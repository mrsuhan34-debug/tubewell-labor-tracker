// ছোট ডেটাবেস লেয়ার: Firebase থাকলে Firestore, না থাকলে localStorage (ডেমো)
// গুরুত্বপূর্ণ: প্রতিটি রেকর্ডে নিজের `id` ফিল্ড বসে (আগে বসত না, তাই সবার হাজিরি একসাথে মিশে যেত)
const DB = (() => {
  const cfg = window.FIREBASE_CONFIG;
  const online = !!(cfg && cfg.apiKey && window.firebase);
  const cols = ['workers', 'works', 'atts', 'settings'];
  const data = { workers: {}, works: {}, atts: {}, settings: {} };
  const listeners = [];
  const emit = () => listeners.forEach(f => f());
  // আগের বাগের সময় তৈরি হওয়া ভুল রেকর্ড (key-তে "undefined") বাদ দেওয়ার জন্য
  const junk = id => String(id).indexOf('undefined') !== -1;
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
        snap.forEach(d => {
          if (junk(d.id)) return;
          data[c][d.id] = Object.assign({}, d.data(), { id: d.id });
        });
        emit();
      }, err => console.error(err));
    });
  } else {
    try {
      const s = JSON.parse(localStorage.getItem('tw_data') || 'null');
      if (s) cols.forEach(c => {
        Object.keys(s[c] || {}).forEach(id => {
          if (junk(id)) return;
          data[c][id] = Object.assign({}, s[c][id], { id });
        });
      });
    } catch (e) {}
  }

  return {
    version: 5,
    online,
    data,
    onChange(f) { listeners.push(f); if (!online) setTimeout(emit, 0); },
    set(col, id, obj) {
      data[col][id] = Object.assign({}, data[col][id] || {}, obj, { id });
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
