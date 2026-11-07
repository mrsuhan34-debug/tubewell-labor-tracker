/* থ্রিডি দৃশ্য: হ্যান্ড পাম্প (টিউবওয়েল) + বোরিং অগার। একটাই WebGL canvas, দরকারমতো লগইন/হিরো ব্যানারে সরে যায়। */
const Scene3D = (() => {
  let renderer, scene, camera, pivot, handle, stream, puddle, auger, clock;
  let host = null, mode = 'banner', visible = true, ready = false, failed = false;
  let userYaw = 0, drag = false, lastX = 0, io = null, ro = null;
  const FOV = 32, TAN = Math.tan(FOV * Math.PI / 360);

  function mat(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color, metalness: .2, roughness: .6 }, o || {})); }
  function add(parent, geo, m, x, y, z) { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); parent.add(me); return me; }

  function blobTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function build() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    clock = new THREE.Clock();

    scene.add(new THREE.HemisphereLight(0xfff1d0, 0x1a3b46, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(4, 8, 6); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7fd0e8, 0.4); rim.position.set(-5, 4, -5); scene.add(rim);
    const fill = new THREE.PointLight(0xffd9a0, 0.5, 25); fill.position.set(-4, 3, 4); scene.add(fill);

    const iron = mat(0x1f5666, { metalness: .3, roughness: .5 });
    const ironD = mat(0x143641, { metalness: .3, roughness: .55 });
    const brass = mat(0xc9a050, { metalness: .55, roughness: .35, emissive: 0x2a1d08 });
    const concrete = mat(0x8c8576, { metalness: 0, roughness: .95 });
    const rubber = mat(0x1b1b1b, { roughness: .8 });
    const waterM = mat(0x8fd3f0, { transparent: true, opacity: .75, emissive: 0x1a5a7a, roughness: .15 });

    pivot = new THREE.Group();            // ঘোরে এই গ্রুপের কেন্দ্র ধরে
    const world = new THREE.Group();      // মডেলের x=-0.9 কে কেন্দ্রে আনা হয়েছে
    world.position.x = 0.9; pivot.add(world); scene.add(pivot);

    // মঞ্চ: ছায়া + দুটো সরু ব্রাস রিং
    const shadow = add(world, new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }), -0.9, 0.005, 0);
    shadow.rotation.x = -Math.PI / 2;
    [[3.0, 3.05, .55], [3.55, 3.58, .28]].forEach(([a, b, o]) => {
      const r = add(world, new THREE.RingGeometry(a, b, 80), new THREE.MeshBasicMaterial({ color: 0xc9a050, transparent: true, opacity: o, side: THREE.DoubleSide }), -0.9, 0.02, 0);
      r.rotation.x = -Math.PI / 2;
    });

    // পাম্প
    add(world, new THREE.CylinderGeometry(1.6, 1.75, .25, 48), concrete, 0, .125, 0);       // কংক্রিটের বেদি
    add(world, new THREE.CylinderGeometry(.75, .85, .2, 40), ironD, 0, .35, 0);             // ফ্ল্যাঞ্জ
    add(world, new THREE.CylinderGeometry(.4, .5, 1.6, 40), iron, 0, 1.25, 0);              // কলাম
    add(world, new THREE.CylinderGeometry(.55, .55, .9, 40), iron, 0, 2.5, 0);              // হেড
    add(world, new THREE.CylinderGeometry(.62, .55, .12, 40), ironD, 0, 3.01, 0);           // ক্যাপ
    [.5, 2.05, 2.95].forEach((y, i) => {
      const t = add(world, new THREE.TorusGeometry(i ? .56 : .5, .035, 12, 48), brass, 0, y, 0); t.rotation.x = Math.PI / 2;
    });
    add(world, new THREE.BoxGeometry(.8, .3, .6), ironD, 0, 3.22, 0);
    [-.2, .2].forEach(z => add(world, new THREE.BoxGeometry(.7, .7, .1), iron, 0, 3.5, z * 1.1));

    // নল (স্পাউট)
    const sp = add(world, new THREE.CylinderGeometry(.14, .2, 1.0, 24), iron, .95, 2.5, 0);
    sp.rotation.z = -Math.PI / 2 - 0.2;
    const lip = add(world, new THREE.TorusGeometry(.15, .03, 10, 24), brass, 1.43, 2.4, 0);
    lip.rotation.y = Math.PI / 2; lip.rotation.x = 0; lip.rotation.z = .2;

    // হাতল (দুলবে)
    handle = new THREE.Group(); handle.position.set(0, 3.55, 0); world.add(handle);
    const lever = add(handle, new THREE.CylinderGeometry(.07, .09, 2.7, 16), ironD, -1.05, 0, 0); lever.rotation.z = Math.PI / 2;
    const grip = add(handle, new THREE.CylinderGeometry(.13, .13, .6, 20), rubber, -2.2, 0, 0); grip.rotation.z = Math.PI / 2;
    add(handle, new THREE.SphereGeometry(.14, 16, 12), brass, -2.52, 0, 0);
    add(handle, new THREE.SphereGeometry(.17, 16, 12), iron, .32, 0, 0);
    const pin = add(handle, new THREE.CylinderGeometry(.1, .1, .8, 16), brass, 0, 0, 0); pin.rotation.x = Math.PI / 2;

    // পানির ধারা + জমা পানি
    stream = add(world, new THREE.CylinderGeometry(.045, .06, 2.05, 12), waterM, 1.46, 1.33, 0);
    puddle = add(world, new THREE.CircleGeometry(.36, 40), waterM, 1.46, .265, 0);
    puddle.rotation.x = -Math.PI / 2;

    // বোরিং অগার (প্যাঁচানো ড্রিল)
    auger = new THREE.Group(); auger.position.set(-3.3, 0, -.5); world.add(auger);
    const tip = add(auger, new THREE.ConeGeometry(.32, .6, 28), ironD, 0, .3, 0); tip.rotation.x = Math.PI;
    add(auger, new THREE.CylinderGeometry(.09, .09, 2.5, 16), iron, 0, 1.55, 0);
    const pts = [];
    for (let i = 0; i <= 140; i++) {
      const u = i / 140, a = u * Math.PI * 2 * 5;
      pts.push(new THREE.Vector3(Math.cos(a) * .3, .55 + u * 2.0, Math.sin(a) * .3));
    }
    add(auger, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 300, .05, 8, false), brass, 0, 0, 0);
    add(auger, new THREE.CylinderGeometry(.22, .22, .35, 6), brass, 0, 2.95, 0);
    const bar = add(auger, new THREE.CylinderGeometry(.045, .045, 1.1, 10), ironD, 0, 3.2, 0); bar.rotation.z = Math.PI / 2;
  }

  function init() {
    if (ready || failed) return ready;
    if (!window.THREE) { failed = true; return false; }
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      build();
    } catch (e) { failed = true; console.warn('3D চালু হয়নি', e); return false; }
    const c = renderer.domElement;
    c.addEventListener('pointerdown', e => { drag = true; lastX = e.clientX; try { c.setPointerCapture(e.pointerId); } catch (_) {} });
    c.addEventListener('pointermove', e => { if (!drag) return; userYaw += (e.clientX - lastX) * 0.012; lastX = e.clientX; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => c.addEventListener(n, () => { drag = false; }));
    if ('IntersectionObserver' in window) io = new IntersectionObserver(es => { visible = es[0].isIntersecting; });
    if ('ResizeObserver' in window) ro = new ResizeObserver(resize);
    ready = true;
    (function loop() { requestAnimationFrame(loop); frame(); })();
    return true;
  }

  function resize() {
    if (!ready || !host) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    const W = 6.4, H = 5.2, cy = 2.1;
    const k = mode === 'banner' ? 1.33 : 1.0;
    const dist = Math.max((H / 2) / TAN, (W / 2) / (TAN * aspect)) * 1.08 * k;
    const el = 0.2;
    camera.position.set(0, cy + dist * Math.sin(el), dist * Math.cos(el));
    camera.lookAt(0, cy, 0);
    if (mode === 'banner') camera.setViewOffset(w, h, -w * 0.17, 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function frame() {
    if (!ready || !host || !visible) return;
    const t = clock.getElapsedTime();
    const ph = t * 2.4;
    handle.rotation.z = Math.sin(ph) * 0.3 + 0.02;
    const flow = Math.max(0, Math.cos(ph));
    stream.visible = flow > 0.04;
    stream.scale.x = stream.scale.z = 0.35 + flow * 0.9;
    puddle.scale.setScalar(0.75 + flow * 0.4);
    pivot.rotation.y = -0.55 + userYaw + Math.sin(t * 0.25) * 0.22;
    auger.rotation.y = t * 1.1;
    renderer.render(scene, camera);
  }

  return {
    version: 5,
    mount(el, m) {
      if (!el) return;
      if (!init()) { el.classList.add('no3d'); return; }
      if (io && host) io.unobserve(host);
      if (ro && host) ro.unobserve(host);
      host = el; mode = m || 'banner';
      el.insertBefore(renderer.domElement, el.firstChild);
      if (io) io.observe(el);
      if (ro) ro.observe(el);
      visible = true;
      resize();
    }
  };
})();
