'use client';

// Tent in echte 3D (three.js), zoals de stellingbouwer: licht, schaduw, bedrukte doeken, oplichten onder de muis,
// klikken op wanden, panelen en dakvlakken, slepen van een intergevel naar een ander spant en ontwerpen erop slepen.
// De tent zelf komt uit tentTeken() (TentStudio): dezelfde stukken als de 2D-weergave, in wereldcoördinaten.
import { useEffect, useMemo, useRef, useState } from 'react';
import { wereld, omkader, standpunt } from './StellingDrieGL';

const V = (T, p) => new T.Vector3(p[0], p[2], -p[1]);
// Aluminium van tentprofielen (naturel, wit, zwart): rechthoekig profiel en mat geborsteld metaal.
const ALU_KL = new Set(['#9CA3AF', '#E5E7EB', '#374151']);
const HOUT = new Set(['#A47148', '#8B5E34', '#7A4E2D']);

// Licht en omgeving voor een echtere weergave: zachte omgevingsreflecties (voor aluminium en PVC), filmische
// tooncurve, warm zonlicht en een gras-achtige grond. rend = de renderer die de omgevingskaart maakt.
// Lagere zon dan bij de stelling: meer licht-donker op het doek, zodat de vorm van het dak leest.
export function zonLaag(w, c, r) { if (!w.zon) return; w.zon.position.set(c.x + r * 1.5, r * 1.25, c.z + r * 1.1); w.zon.target.position.copy(c); const sh = w.zon.shadow.camera; sh.left = -r * 2; sh.right = r * 2; sh.top = r * 2; sh.bottom = -r * 2; sh.far = r * 8; sh.updateProjectionMatrix(); }
export async function sfeer(T, rend, w, { grond = '#8E9A7C' } = {}) {
  try {
    const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
    const pm = new T.PMREMGenerator(rend); w.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; w.scene.environmentIntensity = 0.45; pm.dispose();
  } catch { /* zonder omgevingskaart: gewoon licht */ }
  rend.toneMapping = T.ACESFilmicToneMapping; rend.toneMappingExposure = 0.92;
  w.scene.background = new T.Color('#E9EEF3');
  w.scene.traverse((o) => { if (o.isHemisphereLight) { o.intensity = 0.7; o.groundColor?.set('#6B7560'); } if (o.isDirectionalLight) { o.intensity = 2.6; o.color.set('#FFF4E2'); } });
  if (w.grond?.material) { w.grond.material.color.set(grond); w.grond.material.roughness = 1; }
}
const PX = 0.016; // lijndikte (px in de 2D-tekening) → straal in meter
const leeg = (d) => !d || !Object.keys(d).length;
const zelfde = (a, b) => !!a && !!b && a.seg === b.seg && a.dak === b.dak && a.lid === b.lid && a.frame === b.frame && (a.pan == null || b.pan == null || a.pan === b.pan);

// Alle stukken als meshes. Geeft de groep en de klikbare doelen (mesh → data).
function bouw(T, prims, laad) {
  const groep = new T.Group(); const mats = new Map(); const doelen = [];
  const mat = (kleur, op = 1, extra = {}) => {
    const k = `${kleur}|${op}|${extra.metaal ? 1 : 0}|${extra.alu ? 1 : 0}|${extra.hout ? 1 : 0}`;
    // PVC en doek: licht glanzend; transparant PVC en glas: glad; aluminium: geborsteld metaal; hout: mat.
    const ruw = extra.alu ? 0.34 : extra.metaal ? 0.45 : extra.hout ? 0.8 : op < 0.5 ? 0.12 : 0.62; const met = extra.alu ? 0.8 : extra.metaal ? 0.45 : 0;
    if (!mats.has(k)) mats.set(k, new T.MeshStandardMaterial({ color: kleur || '#ffffff', roughness: ruw, metalness: met, envMapIntensity: extra.alu ? 1.2 : op < 0.5 ? 1.2 : 0.35, transparent: op < 1, opacity: op, side: T.DoubleSide, depthWrite: op >= 0.6, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    return mats.get(k);
  };
  const lijnMats = new Map(); const lijnMat = (kl) => { if (!lijnMats.has(kl)) lijnMats.set(kl, new T.LineBasicMaterial({ color: kl })); return lijnMats.get(kl); };
  const veelhoek = (pts, uv = null) => {
    const g = new T.BufferGeometry(); const pos = []; const uvs = [];
    for (let i = 1; i < pts.length - 1; i++) for (const q of [pts[0], pts[i], pts[i + 1]]) { const v = V(T, q); pos.push(v.x, v.y, v.z); if (uv) uvs.push(...uv(q)); }
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); if (uv) g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals(); return g;
  };
  const Y = new T.Vector3(0, 1, 0); const buis = new T.CylinderGeometry(1, 1, 1, 12, 1); const doos = new T.BoxGeometry(1, 1, 1);
  for (const p of prims) {
    if (p.k === 'vlak') {
      if (!p.vul || p.w.length < 3) continue;
      const m = new T.Mesh(veelhoek(p.w), mat(p.vul, Math.max(0.12, p.op ?? 1)));
      m.castShadow = (p.op ?? 1) > 0.6; m.receiveShadow = true; groep.add(m);
      if (!leeg(p.data)) { m.userData.data = p.data; doelen.push(m); }
      // Randen van panelen, kaders en ramen (geen rand voor 'vul': dat zijn naadloze vlakken).
      if (p.rand && p.rand !== 'vul' && p.rand !== 'none') {
        const g = new T.BufferGeometry().setFromPoints([...p.w, p.w[0]].map((q) => V(T, q)));
        groep.add(new T.Line(g, lijnMat(p.rand)));
      }
    } else if (p.k === 'lijn') {
      const a = V(T, p.a); const b = V(T, p.b); const d = b.clone().sub(a); const L = d.length(); if (L < 0.005) continue;
      if (p.r || (p.w || 1) >= 1.2) {
        const r = p.r || Math.max(0.012, Math.min(0.07, (p.w || 1) * PX));
        const alu = ALU_KL.has(p.kl) && !p.r && r > 0.02; const hout = HOUT.has(p.kl);
        // Tentprofielen zijn rechthoekig (± 11 × 20 cm voor de staanders en spanten), de rest rond.
        const m = new T.Mesh(alu ? doos : buis, mat(p.kl, 1, { metaal: !hout, alu, hout }));
        m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(Y, d.normalize());
        if (alu) {
          // Het doek ligt op de profielen: liggers en spanten zakken een halve profielhoogte onder het doek,
          // staanders stoppen net onder het dak (anders steken ze erdoor).
          const k = Math.min(1.5, r / 0.042); const hp = 0.15 * k; const vert = Math.abs(d.y) > 0.98;
          if (vert) { const kort = Math.min(hp * 0.6, L * 0.2); m.position.y -= kort / 2; m.scale.set(0.1 * k, L - kort, hp); }
          else { m.position.y -= hp / 2 + 0.005; m.scale.set(0.1 * k, L, hp); }
        } else m.scale.set(r, L, r);
        m.userData.staaf = true;
        m.castShadow = true; m.receiveShadow = true; groep.add(m);
        if (!leeg(p.data)) { m.userData.data = p.data; doelen.push(m); }
      } else groep.add(new T.Line(new T.BufferGeometry().setFromPoints([a, b]), lijnMat(p.kl)));
    } else if (p.k === 'doos') {
      const m = new T.Mesh(new T.BoxGeometry(p.s[0], p.s[2], p.s[1]), mat(p.kl || '#6B7280', 1, { metaal: true })); m.position.copy(V(T, p.p)); m.castShadow = true; m.receiveShadow = true; groep.add(m);
    } else if (p.k === 'voet') {
      const m = new T.Mesh(new T.BoxGeometry(0.3, 0.02, 0.3), mat('#6B7280', 1, { metaal: true })); m.position.copy(V(T, p.p)).add(new T.Vector3(0, 0.01, 0)); m.receiveShadow = true; groep.add(m);
    } else if (p.k === 'beeld' && p.href) {
      // Affien: A = linksboven, B = rechtsboven, C = linksonder van het beeld.
      const e1 = p.B.map((v, i) => v - p.A[i]); const e2 = p.C.map((v, i) => v - p.A[i]);
      const d11 = e1.reduce((s, v) => s + v * v, 0); const d22 = e2.reduce((s, v) => s + v * v, 0); const d12 = e1.reduce((s, v, i) => s + v * e2[i], 0); const det = d11 * d22 - d12 * d12 || 1;
      const uv = (q) => { const r = q.map((v, i) => v - p.A[i]); const r1 = r.reduce((s, v, i) => s + v * e1[i], 0); const r2 = r.reduce((s, v, i) => s + v * e2[i], 0); const u = (r1 * d22 - r2 * d12) / det; const w = (r2 * d11 - r1 * d12) / det; return [u, 1 - w]; };
      const omtrek = p.omtrek || [p.A, p.B, p.B.map((v, i) => v + p.C[i] - p.A[i]), p.C];
      const m2 = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: T.DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      laad(p.href, (tx) => { m2.map = tx; m2.needsUpdate = true; });
      const m = new T.Mesh(veelhoek(omtrek, uv), m2); m.receiveShadow = true; groep.add(m);
    }
  }
  return { groep, doelen };
}

// De tent als three-groep met de beelden geladen (voor de PDF).
export async function tentGroep(T, prims) {
  const tl = new T.TextureLoader(); tl.setCrossOrigin('anonymous'); const laders = [];
  const { groep } = bouw(T, prims, (href, zet) => laders.push(new Promise((ok) => tl.load(href, (tx) => { tx.colorSpace = T.SRGBColorSpace; zet(tx); ok(); }, undefined, ok))));
  await Promise.race([Promise.all(laders), new Promise((r) => setTimeout(r, 5000))]);
  return groep;
}

// Een licht overlay over de meshes van één doel (gekozen of onder de muis).
function gloed(T, meshes, kleur, op) {
  const g = new T.Group(); // Met dieptetest (en net vóór het vlak): zo licht enkel het zichtbare deel op, niet ook de achterkant van het dak erdoor.
  const m = new T.MeshBasicMaterial({ color: kleur, transparent: true, opacity: op, depthTest: true, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  for (const x of meshes) { const c = new T.Mesh(x.geometry, m); c.position.copy(x.position); c.quaternion.copy(x.quaternion); c.scale.copy(x.scale).multiplyScalar(x.userData.staaf ? 1.6 : 1); c.renderOrder = 10; g.add(c); }
  return g;
}

// Foto van een tent (paneel, bibliotheek): één verborgen renderer voor alle foto's.
const fotoCache = new Map(); let rij = Promise.resolve(); let rend0 = null;
export function tentFoto(prims, sleutel, { b = 640, h = 360, hoek = 32, kantel = 24 } = {}) {
  const k = `${b}x${h}|${sleutel}`; if (fotoCache.has(k)) return fotoCache.get(k);
  const p = (rij = rij.then(async () => {
    const T = await import('three');
    if (!rend0) { rend0 = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); rend0.shadowMap.enabled = true; rend0.shadowMap.type = T.PCFSoftShadowMap; rend0.outputColorSpace = T.SRGBColorSpace; }
    rend0.setPixelRatio(2); rend0.setSize(b, h, false);
    const w = wereld(T); await sfeer(T, rend0, w); const laders = []; const tl = new T.TextureLoader(); tl.setCrossOrigin('anonymous');
    const { groep } = bouw(T, prims, (href, zet) => laders.push(new Promise((ok) => tl.load(href, (tx) => { tx.colorSpace = T.SRGBColorSpace; zet(tx); ok(); }, undefined, ok))));
    w.scene.add(groep); await Promise.race([Promise.all(laders), new Promise((r) => setTimeout(r, 4000))]);
    const { c, r } = omkader(T, w, groep); zonLaag(w, c, r); const cam = new T.PerspectiveCamera(32, b / h, 0.1, 2000); standpunt(cam, c, r, hoek, kantel, 0.62);
    rend0.render(w.scene, cam); const url = rend0.domElement.toDataURL('image/jpeg', 0.86);
    w.scene.traverse((o) => { o.geometry?.dispose?.(); }); return url;
  }).catch(() => null));
  fotoCache.set(k, p); if (fotoCache.size > 40) fotoCache.delete(fotoCache.keys().next().value);
  return p;
}

// kies(data) = klik op een wand, paneel, frame, dakvlak of gekoppelde tent (null = ernaast).
// drop(data, sleepdata) = iets uit het palet erop gesleept. sleepInter(seg, x) = intergevel naar positie x (m) gesleept.
export default function TentDrieGL({ prims, kies = null, drop = null, sleepInter = null, gekozen = null, hoek = 32, kantel = 24, onOver = null }) {
  const ref = useRef(null); const api = useRef(null); const [klaar, setKlaar] = useState(false); const [fout, setFout] = useState('');
  useEffect(() => {
    let weg = false; let rend = null; let ro = null; let ctl = null;
    (async () => {
      try {
        const T = await import('three'); const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        if (weg || !ref.current) return;
        const el = ref.current; const w = el.clientWidth || 600; const h = el.clientHeight || 400;
        rend = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); rend.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); rend.setSize(w, h);
        rend.shadowMap.enabled = true; rend.shadowMap.type = T.PCFSoftShadowMap; rend.outputColorSpace = T.SRGBColorSpace;
        el.appendChild(rend.domElement); rend.domElement.style.display = 'block';
        const wr = wereld(T); await sfeer(T, rend, wr); if (weg) return; const cam = new T.PerspectiveCamera(32, w / h, 0.1, 2000);
        ctl = new OrbitControls(cam, rend.domElement); ctl.enableDamping = true; ctl.dampingFactor = 0.12; ctl.maxPolarAngle = Math.PI / 2 - 0.03; ctl.screenSpacePanning = true;
        let raf = 0; const teken = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (ctl.update()) teken(); rend.render(wr.scene, cam); }); };
        ctl.addEventListener('change', teken);
        ro = new ResizeObserver(() => { const W = el.clientWidth || 600; const H = el.clientHeight || 400; rend.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); teken(); }); ro.observe(el);
        const tl = new T.TextureLoader(); tl.setCrossOrigin('anonymous'); const tex = new Map();
        const laad = (href, zet) => { if (tex.has(href)) { zet(tex.get(href)); return; } tl.load(href, (tx) => { tx.colorSpace = T.SRGBColorSpace; tex.set(href, tx); zet(tx); teken(); }); };
        api.current = { T, ...wr, cam, ctl, rend, teken, laad, groep: null, doelen: [] };
        setKlaar(true);
      } catch (e) { setFout(String(e?.message || e)); }
    })();
    return () => { weg = true; ro?.disconnect(); ctl?.dispose(); if (rend) { rend.dispose(); rend.domElement.remove(); } api.current = null; };
  }, []);
  // Tent (opnieuw) opbouwen; het standpunt blijft staan, behalve de eerste keer of bij een veel grotere/kleinere tent.
  const eerste = useRef(true);
  useEffect(() => {
    const a = api.current; if (!klaar || !a) return;
    if (a.groep) { a.scene.remove(a.groep); a.groep.traverse((o) => { if (o.geometry?.type === 'BufferGeometry') o.geometry.dispose(); }); }
    const { groep, doelen } = bouw(a.T, prims, a.laad); a.scene.add(groep); a.groep = groep; a.doelen = doelen;
    const { c, r } = omkader(a.T, a, groep); zonLaag(a, c, r);
    a.thuis = () => { standpunt(a.cam, c, r, hoek, kantel); a.ctl.target.copy(c); a.ctl.update(); a.teken(); };
    if (eerste.current || (a.vorigeR && (r > a.vorigeR * 1.6 || r < a.vorigeR / 1.6))) { eerste.current = false; a.thuis(); }
    a.vorigeR = r; a.teken();
  }, [klaar, prims]); // eslint-disable-line react-hooks/exhaustive-deps
  const vorigStand = useRef(`${hoek}|${kantel}`);
  useEffect(() => { const k = `${hoek}|${kantel}`; if (k === vorigStand.current) return; vorigStand.current = k; api.current?.thuis?.(); }, [hoek, kantel, klaar]);

  const kiesRef = useRef(kies); kiesRef.current = kies;
  const dropRef = useRef(drop); dropRef.current = drop;
  const interRef = useRef(sleepInter); interRef.current = sleepInter;
  const overRef = useRef(onOver); overRef.current = onOver;
  // Wat ligt er onder de muis: het dichtste klikbare stuk (constructie zonder doel houdt de klik niet tegen).
  const pick = (e) => {
    const a = api.current; if (!a) return null; const r = a.rend.domElement.getBoundingClientRect();
    const ray = new a.T.Raycaster(); ray.setFromCamera(new a.T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), a.cam);
    const hit = ray.intersectObjects(a.doelen, false)[0]; return hit ? { data: hit.object.userData.data, punt: hit.point } : null;
  };
  const grondX = (e) => {
    const a = api.current; const r = a.rend.domElement.getBoundingClientRect(); const ray = new a.T.Raycaster();
    ray.setFromCamera(new a.T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), a.cam);
    const pt = new a.T.Vector3(); return ray.ray.intersectPlane(new a.T.Plane(new a.T.Vector3(0, 1, 0), 0), pt) ? pt.x : null;
  };
  useEffect(() => {
    const a = api.current; if (!klaar || !a) return undefined;
    const el = a.rend.domElement; let neer = null; let hover = null; let sleep = null; let raf = 0;
    const toon = (d) => {
      if (zelfde(d, hover) || (!d && !hover)) return; hover = d;
      if (a.gloed) { a.scene.remove(a.gloed); a.gloed = null; }
      if (d) { a.gloed = gloed(a.T, a.doelen.filter((m) => zelfde(m.userData.data, d)), '#60A5FA', 0.28); a.scene.add(a.gloed); }
      el.style.cursor = !d ? '' : d.seg?.startsWith('I-') && interRef.current ? 'ew-resize' : 'pointer'; a.teken();
    };
    const opNeer = (e) => {
      if (e.button !== 0) return; neer = [e.clientX, e.clientY];
      const h = pick(e); if (h?.data?.seg?.startsWith('I-') && interRef.current) { sleep = { seg: h.data.seg, bezig: false }; a.ctl.enabled = false; }
    };
    const opBeweeg = (e) => {
      if (sleep) { if (!sleep.bezig && neer && Math.hypot(e.clientX - neer[0], e.clientY - neer[1]) > 4) sleep.bezig = true; if (sleep.bezig) { const x = grondX(e); if (x != null) overRef.current?.({ inter: x }); } return; }
      if (e.buttons || !kiesRef.current) return;
      cancelAnimationFrame(raf); const ev = { clientX: e.clientX, clientY: e.clientY }; raf = requestAnimationFrame(() => toon(pick(ev)?.data || null));
    };
    const opLos = (e) => {
      if (sleep) { const s = sleep; sleep = null; a.ctl.enabled = true; overRef.current?.(null); if (s.bezig) { neer = null; const x = grondX(e); if (x != null) interRef.current?.(s.seg, x); return; } }
      if (!neer || !kiesRef.current) return; const d = Math.hypot(e.clientX - neer[0], e.clientY - neer[1]); neer = null; if (d > 5) return;
      kiesRef.current(pick(e)?.data || null);
    };
    const opWeg = () => { cancelAnimationFrame(raf); toon(null); };
    el.addEventListener('pointerdown', opNeer); el.addEventListener('pointermove', opBeweeg); el.addEventListener('pointerup', opLos); el.addEventListener('pointerleave', opWeg);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('pointerdown', opNeer); el.removeEventListener('pointermove', opBeweeg); el.removeEventListener('pointerup', opLos); el.removeEventListener('pointerleave', opWeg); };
  }, [klaar, prims]);
  // Gekozen stuk(ken) blauw.
  useEffect(() => {
    const a = api.current; if (!klaar || !a) return;
    if (a.mark) { a.scene.remove(a.mark); a.mark = null; }
    const lijst = gekozen ? a.doelen.filter((m) => zelfde(m.userData.data, gekozen)) : [];
    if (lijst.length) { a.mark = gloed(a.T, lijst, '#2563EB', 0.4); a.scene.add(a.mark); }
    a.teken();
  }, [klaar, prims, gekozen]);
  const zoom = (f) => { const a = api.current; if (!a) return; const d = a.cam.position.clone().sub(a.ctl.target).multiplyScalar(f); a.cam.position.copy(a.ctl.target).add(d); a.ctl.update(); a.teken(); };
  return (
    <div ref={ref} className="fm-wz fm-wz-gl" data-klaar={klaar ? '1' : '0'}
      onDragOver={drop ? (e) => { e.preventDefault(); const h = pick(e); overRef.current?.(h?.data || null); } : undefined}
      onDragLeave={drop ? () => overRef.current?.(null) : undefined}
      onDrop={drop ? (e) => { e.preventDefault(); overRef.current?.(null); const h = pick(e); if (h?.data) dropRef.current?.({ seg: h.data.seg || null, pan: h.data.pan != null ? Number(h.data.pan) : null, dak: h.data.dak ?? null, frame: !!h.data.frame }, e.dataTransfer.getData('text/fm-tent')); } : undefined}>
      {fout && <div className="fm-sub" style={{ padding: 12 }}>3D kon niet starten: {fout}</div>}
      <div className="fm-wz-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Inzoomen" onClick={() => zoom(0.75)}>+</button>
        <button type="button" aria-label="Uitzoomen" onClick={() => zoom(1 / 0.75)}>−</button>
        <button type="button" aria-label="Terug naar het geheel" title="Terug naar het geheel" onClick={() => api.current?.thuis?.()}>⟲</button>
      </div>
      <div className="fm-wz-hulp">Slepen = draaien · rechts slepen of Shift = verschuiven · scrollen = zoomen{sleepInter ? ' · intergevel verslepen = ander spant' : ''}</div>
    </div>
  );
}

// Kleine 3D-foto van een tent; tot die klaar is (of zonder WebGL) de 2D-tekening.
export function TentFotoBeeld({ prims, sleutel, terugval = null, maat = null }) {
  const [url, setUrl] = useState(null);
  const k = useMemo(() => sleutel, [sleutel]);
  useEffect(() => { let weg = false; tentFoto(prims, k, maat ? { b: maat * 3, h: maat * 3 } : undefined).then((u) => { if (!weg) setUrl(u || null); }); return () => { weg = true; }; }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  // eslint-disable-next-line @next/next/no-img-element
  if (url && maat) return <img src={url} alt="" width={maat} height={maat} style={{ width: maat, height: maat, objectFit: 'cover', display: 'block' }} />;
  return url ? <div className="fm-wz mini fm-wz-foto"><img src={url} alt="3D-voorbeeld van de tent" /></div> : terugval;
}
