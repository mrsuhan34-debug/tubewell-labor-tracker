# টিউবওয়েল হাজিরি অ্যাপ

## ফাইল
- `index.html`, `style.css`, `app.js`, `db.js` — মূল অ্যাপ
- `scene3d.js` + `three.min.js` — থ্রিডি টিউবওয়েল/অগার মডেল (Three.js, লোকাল কপি, ইন্টারনেট ছাড়াই চলে)
- `firebase-config.js` — **আপনার Firebase কী এখানে থাকে। নতুন জিপ থেকে কপি করার সময় এই ফাইলটি ওভাররাইট করবেন না।**
- `vercel.json` — মাইক/ক্যামেরার অনুমতির হেডার

## ফোনে/কম্পিউটারে টেস্ট
`index.html` ব্রাউজারে খুলুন (বা `npx serve`)। Firebase না দিলে ডেমো মোডে চলবে।
ডিফল্ট পিন: কর্মচারী `1234`, অ্যাডমিন `9999` (অ্যাডমিন প্যানেল থেকে বদলান)।

## সবার ফোনে একই ডেটা (Firebase, ফ্রি)
1. console.firebase.google.com → নতুন প্রজেক্ট → Build → **Firestore Database** → Create (production mode)।
2. Project settings → Your apps → Web (`</>`) → config কপি করে `firebase-config.js`-এ বসান।
3. Firestore → Rules-এ এটি দিয়ে Publish করুন:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}
```
> সতর্কতা: এই নিয়মে লিংক জানলে যে কেউ ডেটা পড়তে পারে, পিন শুধু ইন্টারফেস আটকায়। লিংক গোপন রাখুন। পরে চাইলে Firebase Authentication যোগ করে শক্ত করা যাবে।

## Vercel-এ লাইভ
1. ফোল্ডারটি GitHub রিপোতে আপলোড করুন।
2. vercel.com → Add New Project → রিপো সিলেক্ট → Framework: **Other**, Build command ফাঁকা → Deploy।

## ভয়েস নোট / মাইক
- লিংকটি **Chrome অ্যাপে** খুলুন (অন্য অ্যাপের ভেতরের ব্রাউজারে মাইকের অনুমতি আসে না)।
- মাইক না চললে "মাইক চলছে না? অন্য উপায়" থেকে ফোনের রেকর্ডার ব্যবহার করা যায়।
- ভয়েস সর্বোচ্চ ৪০ সেকেন্ড।
