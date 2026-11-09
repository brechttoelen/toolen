'use client';

// Stelling in echte 3D (three.js): staanders van Ø 48 mm met rozetten om de 0,5 m, liggers, diagonalen,
// voetplaten met spindel en onderlegplank (of zwenkwielen), platen, leuningen, kantplanken en doeken.
// Alles komt uit dezelfde scène als het kleine SVG-voorbeeld (bouwScene). Elke soort onderdeel wordt één keer
// gemaakt en honderden keren herhaald (InstancedMesh), zodat het ook op een laptop zonder grafische kaart vlot draait.
// three.js wordt pas geladen als deze weergave opent.
import { useEffect, useMemo, useRef, useState } from 'react';
import { bouwScene } from './stelling/scene';
import { delenVan, stellingAfgeleid } from './stellingbouw';

const BUIS = 0.0242; // straal van een stellingbuis (Ø 48,3 mm)
// Stellingbuizen, liggers en leuningen: in het SVG-voorbeeld elk een eigen grijs, in 3D allemaal verzinkt staal.
const VERZINKT = new Set(['#5F6B78', '#7B8591', '#9AA3AD', '#4B5563', '#6B7280', '#8FA9C4', '#B45309']); // #B45309 = lage leuning vooraan een camerastelling
const NAAD = new Set(['#5B3A1A', '#8A6A45', '#59616A']); // #59616A = naad tussen stalen vloerdelen // naad tussen platen, treden van een tribune: lijnen op het dek
const DEK = 0; // het loopvlak ligt al ± 0,2 m boven de rozet van zijn ligger (DEK_ROZET)
const ANNOTATIE = new Set(['#16A34A', '#15803D', '#DC2626']); // doorgangen: hulplijnen, geen buizen
// Wereld (x oost, y noord, z omhoog) naar three.js (y omhoog).
const V = (T, p) => new T.Vector3(p[0], p[2], -p[1]);

// Alle onderdelen verzamelen in wereldcoördinaten.
function verzamel(st, doekMap) {
  const geenDoppen = !!(st?.camera || st?.soort === 'camera' || Object.values(st?.leuning || {}).includes('laag') || (st?.delen || []).some((d) => Object.values(d.leuning || {}).includes('laag')));
  const delen = delenVan(st);
  const afs = delen.map((dl) => stellingAfgeleid(dl.d, { verbonden: dl.verbonden }));
  const sc = { personen: [], quads: [], lijnen: [], voeten: [], rozetten: [], beelden: [], labels: [], ladders: [], vloerliggers: [], pennen: [], naden: [], doelen: [] };
  bouwScene({ st, delen, afs, mini: false, doekMap }, {
    // Platen liggen bovenop de liggers en rozetten: in 3D 6 cm hoger dan het rozetniveau, zodat er niets door het
    // dek steekt (ook niet in een helling). Naden van platen liggen mee op het dek.
    quad: (pts, vul, rand, extra = {}) => {
      if (!extra.dek) { sc.quads.push({ pts, vul, rand, op: extra.fillOpacity ?? 1 }); return; }
      const boven = pts.map((p) => [p[0], p[1], p[2] + DEK]); const onder = pts.map((p) => [p[0], p[1], p[2] + DEK - (extra.metaal ? 0.045 : 0.04)]);
      sc.quads.push({ pts: boven, vul, rand, op: 1, metaal: !!extra.metaal });
      // Dikte van de plaat (4 cm): zijkanten in een iets donkerder hout (of staal).
      for (let k = 0; k < boven.length; k++) { const n = (k + 1) % boven.length; sc.quads.push({ pts: [boven[k], boven[n], onder[n], onder[k]], vul: extra.metaal ? '#7D868F' : '#8B6A45', rand: null, op: 1 }); }
    },
    lijn: (a, b, kl, w = 1) => (NAAD.has(kl) ? sc.naden.push({ a: [a[0], a[1], a[2] + DEK], b: [b[0], b[1], b[2] + DEK], kl }) : sc.lijnen.push({ a, b, kl, w })),
    voet: (p, o) => sc.voeten.push({ p, ...o }),
    rozet: (p) => sc.rozetten.push(p),
    beeld: (b) => sc.beelden.push(b),
    label: (l) => sc.labels.push(l),
    ladder: (l) => sc.ladders.push(l),
    vloerligger: (a, b, o = {}) => sc.vloerliggers.push({ a, b, helling: !!o.helling, metaal: !!o.metaal, laag: !!o.laag }),
    // Camerastellingen krijgen geen veiligheidsdoppen (lage leuning vooraan, of een camera op het dek).
    pen: (p) => { if (!geenDoppen) sc.pennen.push(p); },
    doel: (d) => sc.doelen.push(d),
    persoon: (x) => sc.personen.push(x),
  });
  return sc;
}

// Cameraman (± 1,78 m): benen, romp, armen en hoofd uit capsules, gekeerd in de kijkrichting van de camera.
// houding 'statief': handen naar de panbar achter de camera; 'schouder': camera op de rechterschouder.
function cameraman(T, { p, d, houding }, materiaal) {
  const g = new T.Group();
  const broek = materiaal('#25324A'); const jas = materiaal('#3F4D61'); const huid = materiaal('#D9A988'); const haar = materiaal('#3B2A20'); const zwart = materiaal('#15171B');
  const seg = (a, b, r, m) => {
    const A = new T.Vector3(...a); const B = new T.Vector3(...b); const L = A.distanceTo(B);
    const mesh = new T.Mesh(new T.CapsuleGeometry(r, Math.max(0.001, L), 4, 10), m);
    mesh.position.copy(A).add(B).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    mesh.castShadow = true; g.add(mesh);
  };
  // Lokaal: y omhoog, z vooruit (naar de camera), x naar links.
  for (const sx of [-1, 1]) {
    seg([sx * 0.1, 0.1, 0], [sx * 0.1, 0.86, 0], 0.068, broek);
    const schoen = new T.Mesh(new T.BoxGeometry(0.11, 0.07, 0.27), zwart); schoen.position.set(sx * 0.1, 0.035, 0.05); schoen.castShadow = true; g.add(schoen);
  }
  const romp = new T.Mesh(new T.CapsuleGeometry(0.17, 0.36, 4, 12), jas); romp.scale.set(1.15, 1, 0.75); romp.position.set(0, 1.18, 0); romp.castShadow = true; g.add(romp);
  seg([0, 1.46, 0], [0, 1.56, 0.01], 0.05, huid);
  const hoofd = new T.Mesh(new T.SphereGeometry(0.105, 18, 14), huid); hoofd.scale.set(0.92, 1.08, 1); hoofd.position.set(0, 1.67, 0.01); hoofd.castShadow = true; g.add(hoofd);
  const kap = new T.Mesh(new T.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), haar); kap.scale.set(0.93, 1.05, 1.02); kap.position.set(0, 1.69, -0.01); g.add(kap);
  const arm = (pts) => { for (let k = 0; k < pts.length - 1; k++) seg(pts[k], pts[k + 1], k ? 0.04 : 0.048, jas); const h = new T.Mesh(new T.SphereGeometry(0.042, 10, 8), huid); h.position.set(...pts[pts.length - 1]); g.add(h); };
  if (houding === 'schouder') {
    // Let op: met y omhoog en z vooruit ligt lokaal +x links; rechts is dus -x.
    arm([[-0.21, 1.42, 0], [-0.32, 1.2, 0.12], [-0.23, 1.47, 0.2]]); // rechterhand aan het handvat onder de camera
    arm([[0.21, 1.42, 0], [0.2, 1.22, 0.24], [-0.08, 1.52, 0.42]]); // linkerhand aan de lens
  } else {
    arm([[0.21, 1.42, 0], [0.24, 1.18, 0.14], [0.14, 1.2, 0.36]]);
    arm([[-0.21, 1.42, 0], [-0.24, 1.18, 0.14], [-0.14, 1.2, 0.36]]);
  }
  g.position.copy(V(T, p)); g.rotation.y = Math.atan2(d[0], -d[1]);
  return g;
}

function bouw(T, sc) {
  const groep = new T.Group();
  const mat = new Map();
  const materiaal = (kleur, op = 1, extra = {}) => {
    const k = `${kleur}|${op}|${JSON.stringify(extra)}`;
    if (!mat.has(k)) mat.set(k, new T.MeshStandardMaterial({ color: kleur, roughness: extra.ruw ?? 0.75, metalness: extra.metaal ?? 0, transparent: op < 1, opacity: op, side: T.DoubleSide, depthWrite: op >= 1 }));
    return mat.get(k);
  };
  // Verzinkt staal: licht en mat glanzend (zonder omgevingskaart wordt metaal anders bijna zwart).
  const staal = (kleur) => materiaal(kleur, 1, { ruw: 0.5, metaal: 0.25 });
  const Y = new T.Vector3(0, 1, 0);
  const m4 = new T.Matrix4(); const q = new T.Quaternion(); const sch = new T.Vector3(); const pos = new T.Vector3();

  // Buizen per kleur en dikte als één InstancedMesh.
  const buizen = new Map(); const hulplijnen = [];
  for (const l of sc.lijnen) {
    if (ANNOTATIE.has(l.kl)) { hulplijnen.push(l); continue; }
    const r = l.w >= 0.9 ? BUIS : 0.009; // buis · spijl van een hekje (ladders tekent ladder() apart)
    const k = `${l.kl}|${r}`; if (!buizen.has(k)) buizen.set(k, { kl: l.kl, r, lijst: [] }); buizen.get(k).lijst.push(l);
  }
  // Waar staan de staanders (verticale buizen)? Een ligger, kruis of leuningbuis die daar eindigt, stopt aan de
  // buitenkant van de staander met een wigkop op de rozet; de staander krijgt bovenaan een insteekpen.
  const staanders = []; for (const l of sc.lijnen) if (!ANNOTATIE.has(l.kl) && Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) < 0.005 && Math.abs(l.b[2] - l.a[2]) > 0.2) staanders.push(l);
  const opStaander = (p) => staanders.some((st) => Math.hypot(st.a[0] - p[0], st.a[1] - p[1]) < 0.01 && p[2] >= Math.min(st.a[2], st.b[2]) - 0.05 && p[2] <= Math.max(st.a[2], st.b[2]) + 0.05);
  const koppen = []; const pennen = sc.pennen;
  const KOP = BUIS + 0.045; // van het midden van de staander tot het einde van de buis
  for (const b of buizen.values()) {
    if (b.r !== BUIS) continue;
    b.lijst = b.lijst.map((l) => {
      if (staanders.includes(l)) return l;
      const d = [l.b[0] - l.a[0], l.b[1] - l.a[1], l.b[2] - l.a[2]]; const L = Math.hypot(...d); if (L < 0.2) return l;
      const u = d.map((c) => c / L); let a = l.a; let e = l.b;
      if (opStaander(l.a)) { koppen.push({ p: l.a, u }); a = l.a.map((c, k) => c + u[k] * KOP); }
      if (opStaander(l.b)) { koppen.push({ p: l.b, u: u.map((c) => -c) }); e = l.b.map((c, k) => c - u[k] * KOP); }
      return { ...l, a, b: e };
    });
  }
  for (const { kl, r, lijst } of buizen.values()) {
    const geo = new T.CylinderGeometry(r, r, 1, r > 0.02 ? 12 : 6, 1);
    const im = new T.InstancedMesh(geo, staal(VERZINKT.has(kl) ? '#BFC6CD' : kl), lijst.length);
    lijst.forEach((l, n) => {
      const a = V(T, l.a); const b = V(T, l.b); const d = b.clone().sub(a); const L = d.length() || 0.001;
      q.setFromUnitVectors(Y, d.normalize()); pos.copy(a).add(b).multiplyScalar(0.5); sch.set(1, L, 1);
      im.setMatrixAt(n, m4.compose(pos, q, sch));
    });
    im.castShadow = true; im.receiveShadow = true; groep.add(im);
  }
  if (hulplijnen.length) {
    const g = new T.BufferGeometry(); const pts = []; const kl = [];
    for (const l of hulplijnen) { pts.push(...V(T, l.a).toArray(), ...V(T, l.b).toArray()); const c = new T.Color(l.kl); kl.push(c.r, c.g, c.b, c.r, c.g, c.b); }
    g.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); g.setAttribute('color', new T.Float32BufferAttribute(kl, 3));
    groep.add(new T.LineSegments(g, new T.LineBasicMaterial({ vertexColors: true })));
  }
  // Wigkoppen: het blokje aan het einde van een ligger of kruis dat over de rozet klemt (met de wig erin).
  if (koppen.length) {
    const im = new T.InstancedMesh(new T.BoxGeometry(0.05, 0.075, 0.06), staal('#AEB6BE'), koppen.length);
    const wig = new T.InstancedMesh(new T.BoxGeometry(0.012, 0.08, 0.03), staal('#8D969F'), koppen.length);
    koppen.forEach((k, n) => {
      const h = Math.hypot(k.u[0], k.u[1]) || 1; const rich = [k.u[0] / h, k.u[1] / h, 0]; // de kop ligt horizontaal tegen de staander
      const p = V(T, k.p.map((c, j) => c + rich[j] * (BUIS + 0.028))); const dir = V(T, rich).normalize();
      q.setFromUnitVectors(new T.Vector3(1, 0, 0), dir); sch.set(1, 1, 1);
      im.setMatrixAt(n, m4.compose(p, q, sch));
      const pw = V(T, k.p.map((c, j) => c + rich[j] * (BUIS + 0.03))); pw.y += 0.005; wig.setMatrixAt(n, m4.compose(pw, q, sch));
    });
    im.castShadow = true; wig.castShadow = true; groep.add(im); groep.add(wig);
  }
  // Veiligheidsdop (Layher) op de top van elke staander die boven het dek uitkomt: een bruinoranje kunststof
  // kap die over de insteekpen schuift, met een bolle bovenkant.
  if (pennen.length) {
    const dop = new T.MeshStandardMaterial({ color: '#A4532B', roughness: 0.75, metalness: 0 });
    const huls = new T.InstancedMesh(new T.CylinderGeometry(0.034, 0.036, 0.075, 16), dop, pennen.length);
    const kop = new T.InstancedMesh(new T.SphereGeometry(0.036, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), dop, pennen.length);
    pennen.forEach((p, n) => {
      huls.setMatrixAt(n, m4.makeTranslation(...V(T, [p[0], p[1], p[2] + 0.03]).toArray()));
      kop.setMatrixAt(n, m4.makeTranslation(...V(T, [p[0], p[1], p[2] + 0.067]).toArray()));
    });
    for (const im of [huls, kop]) { im.castShadow = true; groep.add(im); }
  }
  // U-liggers (vloerdragers) onder de platen: oranjebruin profiel met uitsparingen, van staander tot staander.
  if (sc.vloerliggers.length) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#B5652F'; x.fillRect(0, 0, 512, 64); x.fillStyle = '#5A2E12';
    for (let k = 0; k < 8; k++) { const x0 = 18 + k * 62; x.beginPath(); x.roundRect(x0, 12, 40, 36, 8); x.fill(); }
    x.fillStyle = '#8E4A1F'; x.fillRect(0, 0, 512, 7); x.fillRect(0, 57, 512, 7);
    const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.wrapS = T.RepeatWrapping;
    const zij = new T.MeshStandardMaterial({ map: tx, roughness: 0.6, metalness: 0.15 }); const rest = materiaal('#9C5426', 1, { ruw: 0.6 });
    // Hellingligger: grijs aluminium profiel met een open raster (zoals onder de helling op de Gigant-plannen).
    const c2 = document.createElement('canvas'); c2.width = 512; c2.height = 64; const x2 = c2.getContext('2d');
    x2.fillStyle = '#B9C1C9'; x2.fillRect(0, 0, 512, 64); x2.strokeStyle = '#7E8891'; x2.lineWidth = 3;
    for (let k = 0; k < 32; k++) { x2.beginPath(); x2.moveTo(k * 16, 10); x2.lineTo(k * 16 + 16, 54); x2.stroke(); }
    x2.fillStyle = '#9AA3AD'; x2.fillRect(0, 0, 512, 9); x2.fillRect(0, 55, 512, 9);
    const txH = new T.CanvasTexture(c2); txH.colorSpace = T.SRGBColorSpace; txH.wrapS = T.RepeatWrapping;
    const zijH = new T.MeshStandardMaterial({ map: txH, roughness: 0.5, metalness: 0.25 }); const restH = staal('#AEB6BE');
    for (const l of sc.vloerliggers) {
      const d = [l.b[0] - l.a[0], l.b[1] - l.a[1], l.b[2] - l.a[2]]; const L = Math.hypot(...d); if (L < 0.2) continue;
      const u = d.map((v) => v / L); const a = l.a.map((v, k) => v + u[k] * KOP); const b = l.b.map((v, k) => v - u[k] * KOP); const Lb = L - 2 * KOP;
      if (l.metaal) {
        // Verzinkte U-ligger voor stalen vloerdelen: tot het loopvlak (de haken van de delen liggen erin).
        const m = new T.Mesh(new T.BoxGeometry(Lb, 0.11, 0.05), staal('#B3BAC1'));
        m.position.copy(V(T, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + (l.laag ? 0.005 : 0.145)])); m.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), V(T, b).sub(V(T, a)).normalize());
        m.castShadow = true; m.receiveShadow = true; groep.add(m);
        for (const [p, s0] of [[l.a, 1], [l.b, -1]]) { const k = new T.Mesh(new T.BoxGeometry(0.05, 0.075, 0.06), staal('#AEB6BE')); const h = Math.hypot(u[0], u[1]) || 1; const rich = [s0 * u[0] / h, s0 * u[1] / h, 0]; k.position.copy(V(T, p.map((c3, j) => c3 + rich[j] * (BUIS + 0.028)))); k.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), V(T, rich).normalize()); groep.add(k); }
        continue;
      }
      const t2 = (l.helling ? txH : tx).clone(); t2.repeat.set(Math.max(1, Math.round(Lb / 2)), 1); t2.needsUpdate = true;
      const zm = (l.helling ? zijH : zij).clone(); zm.map = t2;
      const geo = new T.BoxGeometry(Lb, 0.14, 0.05); // lengte · hoogte · breedte: van de rozet tot onder de plaat
      const m = new T.Mesh(geo, l.helling ? [restH, restH, restH, restH, zm, zm] : [rest, rest, rest, rest, zm, zm]);
      const mid = V(T, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + 0.09]);
      const dir = V(T, b).sub(V(T, a)).normalize(); m.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), dir); m.position.copy(mid);
      m.castShadow = true; m.receiveShadow = true; groep.add(m);
      for (const [p, s0] of [[l.a, 1], [l.b, -1]]) { const k = new T.Mesh(new T.BoxGeometry(0.05, 0.075, 0.06), staal('#AEB6BE')); const h = Math.hypot(u[0], u[1]) || 1; const rich = [s0 * u[0] / h, s0 * u[1] / h, 0]; k.position.copy(V(T, p.map((c2, j) => c2 + rich[j] * (BUIS + 0.028)))); k.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), V(T, rich).normalize()); groep.add(k); }
    }
  }
  // Rozetten (± Ø 12 cm) op de staanders. Waar een ligger, kruis of leuningbuis vastzit, hoort altijd een rozet:
  // ontbreekt die (bv. een leuningbuis bovenaan de staander), dan komt er een bij.
  const rozet = [...sc.rozetten];
  const heeftRozet = (p) => rozet.some((r) => Math.abs(r[0] - p[0]) < 0.01 && Math.abs(r[1] - p[1]) < 0.01 && Math.abs(r[2] - p[2]) < 0.04);
  for (const k of koppen) if (!heeftRozet(k.p)) rozet.push(k.p);
  for (const l of sc.vloerliggers) for (const p of [l.a, l.b]) if (opStaander(p) && !heeftRozet(p)) rozet.push(p);
  // De bovenste rozet van een staander onder het dek zit net onder de plaat (niet erdoorheen).
  const heeftPen = (p) => pennen.some((q) => Math.abs(q[0] - p[0]) < 0.01 && Math.abs(q[1] - p[1]) < 0.01);
  for (const r of rozet) if (!heeftPen(r) && staanders.some((st) => Math.hypot(st.a[0] - r[0], st.a[1] - r[1]) < 0.01 && Math.abs(Math.max(st.a[2], st.b[2]) - r[2]) < 0.03)) r[2] -= 0.014;
  sc.rozetten = rozet;
  if (sc.rozetten.length) {
    const im = new T.InstancedMesh(new T.CylinderGeometry(0.062, 0.062, 0.012, 16), staal('#B7C0C9'), sc.rozetten.length);
    sc.rozetten.forEach((p, n) => im.setMatrixAt(n, m4.makeTranslation(...V(T, p).toArray())));
    im.castShadow = true; groep.add(im);
  }
  // Voeten: voetplaat met spindel op een onderlegplank, of een zwenkwiel van 200 mm met spindel en rem.
  const plaatsen = (geo, materiaal0, lijst, f) => { if (!lijst.length) return; const im = new T.InstancedMesh(geo, materiaal0, lijst.length); lijst.forEach((v, n) => im.setMatrixAt(n, f(v))); im.castShadow = true; im.receiveShadow = true; groep.add(im); };
  const blokken = sc.voeten.filter((v) => v.blok);
  const vast = sc.voeten.filter((v) => !v.wiel && !v.blok); const wiel = sc.voeten.filter((v) => v.wiel && !v.blok);
  // Einde van een helling: gestapelde planken (kalvoeten) tot net onder de plaat.
  for (const v of blokken) {
    const hoog = Math.max(0.04, v.h - v.p[2] + DEK - 0.04); const n = Math.max(1, Math.round(hoog / 0.05)); const d = hoog / n;
    for (let k = 0; k < n; k++) { const m = new T.Mesh(new T.BoxGeometry(0.22, d * 0.94, 0.6), materiaal(k % 2 ? '#A9824F' : '#9C7646', 1, { ruw: 0.9 })); const pp = V(T, v.p); pp.y += d * (k + 0.5); m.position.copy(pp); m.rotation.y = (k % 2) * Math.PI / 2; m.castShadow = true; m.receiveShadow = true; groep.add(m); }
  }
  const op = (p, dz) => { const v = V(T, p); v.y += dz; return v; };
  plaatsen(new T.BoxGeometry(0.22, 0.04, 0.5), materiaal('#9C7A4E', 1, { ruw: 0.9 }), vast, (v) => m4.makeTranslation(...op(v.p, 0.02).toArray()));
  plaatsen(new T.BoxGeometry(0.15, 0.008, 0.15), staal('#8E979F'), vast, (v) => m4.makeTranslation(...op(v.p, 0.045).toArray()));
  plaatsen(new T.CylinderGeometry(0.019, 0.019, 0.3, 10), staal('#C4CBD2'), vast, (v) => m4.makeTranslation(...op(v.p, 0.2).toArray()));
  plaatsen(new T.BoxGeometry(0.11, 0.035, 0.05), staal('#7D868F'), vast, (v) => m4.makeTranslation(...op(v.p, 0.2).toArray())); // spindelmoer
  const wielGeo = new T.CylinderGeometry(0.1, 0.1, 0.05, 24); wielGeo.rotateZ(Math.PI / 2);
  plaatsen(wielGeo, materiaal('#EDE8DA', 1, { ruw: 0.6 }), wiel, (v) => m4.makeTranslation(...op(v.p, 0.1).toArray()));
  plaatsen(new T.BoxGeometry(0.08, 0.13, 0.11), staal('#B3BAC1'), wiel, (v) => m4.makeTranslation(...op(v.p, 0.15).toArray())); // vork
  plaatsen(new T.BoxGeometry(0.05, 0.025, 0.09), materiaal('#C2412D', 1, { ruw: 0.5 }), wiel, (v) => m4.makeTranslation(...op(v.p, 0.13).add(new T.Vector3(0, 0, 0.1)).toArray())); // rem
  plaatsen(new T.CylinderGeometry(0.019, 0.019, 0.32, 10), staal('#C4CBD2'), wiel, (v) => m4.makeTranslation(...op(v.p, 0.37).toArray()));
  plaatsen(new T.BoxGeometry(0.1, 0.035, 0.05), staal('#9AA3AD'), wiel, (v) => m4.makeTranslation(...op(v.p, 0.33).toArray()));

  // Ladders (aluminium): twee stijlen in een rechthoekig profiel en ronde sporten om de 28 cm.
  if (sc.ladders.length) {
    const alu = materiaal('#D3D8DD', 1, { ruw: 0.4, metaal: 0.3 });
    const stijlen = []; const sporten = [];
    for (const l of sc.ladders) {
      for (const sl of [l.s0, l.s1]) stijlen.push({ a: V(T, sl[0]), b: V(T, sl[1]), n: l.n });
      const L = Math.hypot(l.s0[1][0] - l.s0[0][0], l.s0[1][1] - l.s0[0][1], l.s0[1][2] - l.s0[0][2]);
      for (let d = 0.25; d < L - 0.05; d += 0.28) { const t = d / L; const m = (sl) => V(T, [0, 1, 2].map((c) => sl[0][c] + (sl[1][c] - sl[0][c]) * t)); sporten.push({ a: m(l.s0), b: m(l.s1) }); }
    }
    const zet = (geo, lijst, profiel) => { const im = new T.InstancedMesh(geo, alu, lijst.length); lijst.forEach((x, k) => { const d = x.b.clone().sub(x.a); const L = d.length() || 0.001; q.setFromUnitVectors(Y, d.normalize()); if (profiel) { /* het brede vlak van het profiel naar de stelling */ const rond = new T.Quaternion().setFromAxisAngle(Y, Math.atan2(x.n[0], -x.n[1])); q.multiply(rond); } pos.copy(x.a).add(x.b).multiplyScalar(0.5); sch.set(1, L, 1); im.setMatrixAt(k, m4.compose(pos, q, sch)); }); im.castShadow = true; groep.add(im); };
    zet(new T.BoxGeometry(0.07, 1, 0.028), stijlen, true);
    zet(new T.CylinderGeometry(0.014, 0.014, 1, 8), sporten, false);
  }
  for (const metaal of [false, true]) {
    const lijst = sc.naden.filter((l) => (l.kl === '#59616A') === metaal); if (!lijst.length) continue;
    const g = new T.BufferGeometry(); const pts = []; for (const l of lijst) pts.push(...V(T, l.a).toArray(), ...V(T, l.b).toArray());
    g.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); groep.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: metaal ? '#3E454C' : '#4A3018' })));
  }
  // Stalen vloerdelen: geperforeerd (gaatjes om de 8 cm, verspringend), als herhaalde textuur over het dek.
  const metaalVlak = sc.quads.filter((v) => v.metaal);
  if (metaalVlak.length) {
    // Eén tegel = de hele breedte van een vloerdeel × 6 cm lengte: twee banen schuine sleufgaten, gladde randen en middenstrook.
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32; const cx = cv.getContext('2d');
    cx.fillStyle = '#BCC3CA'; cx.fillRect(0, 0, 128, 32); cx.fillStyle = '#C9CFD5'; cx.fillRect(0, 0, 12, 32); cx.fillRect(116, 0, 12, 32); cx.fillRect(60, 0, 8, 32);
    cx.strokeStyle = '#3F464D'; cx.lineWidth = 6; cx.lineCap = 'round';
    for (const x0 of [18, 70]) for (const y of [8, 24]) { cx.beginPath(); cx.moveTo(x0, y + 3); cx.lineTo(x0 + 38, y - 3); cx.stroke(); }
    const tx = new T.CanvasTexture(cv); tx.wrapS = T.RepeatWrapping; tx.wrapT = T.RepeatWrapping; tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
    const pos = []; const uv = [];
    for (const v of metaalVlak) {
      // UV: over de breedte van het deel één tegel, in de lengte om de 6 cm.
      const P = v.pts; const L = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const u1 = 1; const w1 = Math.max(1, Math.round(L(P[0], P[3]) / 0.06)); const UV = [[0, 0], [u1, 0], [u1, w1], [0, w1]];
      for (const t of [[0, 1, 2], [0, 2, 3]]) for (const q of t) { pos.push(...V(T, [P[q][0], P[q][1], P[q][2] + 0.001]).toArray()); uv.push(...UV[q]); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ map: tx, roughness: 0.5, metalness: 0.25, side: T.DoubleSide })); m.castShadow = true; m.receiveShadow = true; groep.add(m);
  }
  // Vlakken (platen, kantplanken, ballast, grondblokken): per kleur samengevoegd tot één mesh, met dunne randen.
  const vlakken = new Map(); const randen = new Map();
  for (const v of sc.quads) {
    if (v.metaal) continue;
    const k = `${v.vul}|${v.op}`; if (!vlakken.has(k)) vlakken.set(k, { vul: v.vul, op: v.op, pos: [] });
    const P = v.pts.map((p) => V(T, p));
    for (let t = 1; t < P.length - 1; t++) vlakken.get(k).pos.push(...P[0].toArray(), ...P[t].toArray(), ...P[t + 1].toArray());
    if (v.rand && v.op >= 0.8) { if (!randen.has(v.rand)) randen.set(v.rand, []); const r = randen.get(v.rand); for (let t = 0; t < P.length; t++) r.push(...P[t].toArray(), ...P[(t + 1) % P.length].toArray()); }
  }
  for (const { vul, op: o, pos: p } of vlakken.values()) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, materiaal(vul, o, { ruw: 0.85 })); m.castShadow = o >= 0.8; m.receiveShadow = true; groep.add(m);
  }
  for (const [kl, p] of randen) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    groep.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: kl, transparent: true, opacity: 0.45 })));
  }
  // Doeken met hun ontwerp: een strook langs de rand, het beeld uitgerekt over de hele lengte.
  const laden = new T.TextureLoader(); laden.setCrossOrigin('anonymous'); groep.userData.laadt = [];
  for (const b of sc.beelden) {
    const top = b.top; const bot = b.bot; if (top.length < 2 || bot.length !== top.length) continue;
    const zMax = Math.max(...top.map((p) => p[2]), ...bot.map((p) => p[2])); const zMin = Math.min(...top.map((p) => p[2]), ...bot.map((p) => p[2])); const hz = zMax - zMin || 1;
    const lang = [0]; for (let k = 1; k < top.length; k++) lang.push(lang[k - 1] + Math.hypot(top[k][0] - top[k - 1][0], top[k][1] - top[k - 1][1])); const L = lang[lang.length - 1] || 1;
    const pos0 = []; const uv = []; const idx = [];
    top.forEach((p, k) => { pos0.push(...V(T, p).toArray(), ...V(T, bot[k]).toArray()); uv.push(lang[k] / L, (p[2] - zMin) / hz, lang[k] / L, (bot[k][2] - zMin) / hz); if (k) { const a = 2 * (k - 1); idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos0, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    // Bedrukt aan de kant waar het doek hangt (b.n); de achterkant is wit (geen spiegelbeeld van het ontwerp).
    let enkel = false;
    if (b.n && idx.length >= 3) {
      const P = (q) => new T.Vector3(pos0[3 * q], pos0[3 * q + 1], pos0[3 * q + 2]); const [i0, i1, i2] = idx; const nf = P(i1).sub(P(i0)).cross(P(i2).sub(P(i0)));
      if (nf.dot(V(T, [b.n[0], b.n[1], 0])) < 0) { for (let q = 0; q < idx.length; q += 3) { const t = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
      enkel = true;
    }
    const m = new T.MeshStandardMaterial({ color: '#ffffff', side: enkel ? T.FrontSide : T.DoubleSide, roughness: 0.9 });
    if (enkel) groep.add(new T.Mesh(g, new T.MeshStandardMaterial({ color: '#F4F4F2', side: T.BackSide, roughness: 0.95 })));
    groep.userData.laadt.push(new Promise((klaar) => laden.load(b.src, (tx) => { tx.colorSpace = T.SRGBColorSpace; m.map = tx; m.needsUpdate = true; groep.userData.herteken?.(); klaar(); }, undefined, () => { m.color.set(b.kl); m.needsUpdate = true; groep.userData.herteken?.(); klaar(); })));
    groep.add(new T.Mesh(g, m));
  }
  for (const x of sc.personen) groep.add(cameraman(T, x, materiaal));
  // Maat van elke doorgang als zwevend label.
  for (const l of sc.labels) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
    x.font = '600 44px system-ui, sans-serif'; x.textAlign = 'center'; x.lineWidth = 10; x.strokeStyle = '#fff'; x.fillStyle = l.kl;
    x.strokeText(l.tekst, 256, 60); x.fillText(l.tekst, 256, 60); x.font = '700 60px system-ui, sans-serif'; x.strokeText(l.maat, 256, 130); x.fillText(l.maat, 256, 130);
    const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: false, transparent: true }));
    const m = [(l.midden[0][0] + l.midden[1][0]) / 2, (l.midden[0][1] + l.midden[1][1]) / 2, (l.midden[0][2] + l.midden[1][2]) / 2];
    sp.position.copy(V(T, m)); const s = Math.max(1.6, Math.min(4, l.B * 0.6)); sp.scale.set(s, s * 160 / 512, 1); sp.renderOrder = 10; groep.add(sp);
  }
  return groep;
}

// Gedeeld door de bewegende weergave en de foto: scène met licht en grond, en het standpunt rond de stelling.
function wereld(T) {
  const scene = new T.Scene(); scene.background = new T.Color('#EEF1F4');
  scene.add(new T.HemisphereLight('#ffffff', '#8B9096', 1.25));
  const zon = new T.DirectionalLight('#ffffff', 1.5); zon.castShadow = true; zon.shadow.mapSize.set(2048, 2048); zon.shadow.bias = -0.0008; zon.shadow.normalBias = 0.04; scene.add(zon); scene.add(zon.target);
  const grond = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshStandardMaterial({ color: '#C9CDD2', roughness: 1 })); grond.rotation.x = -Math.PI / 2; grond.receiveShadow = true; scene.add(grond);
  return { scene, zon, grond };
}
function omkader(T, w, g) {
  const box = new T.Box3().setFromObject(g); if (box.isEmpty()) box.set(new T.Vector3(0, 0, -6), new T.Vector3(8, 2, 0));
  const c = box.getCenter(new T.Vector3()); const r = Math.max(4, box.getSize(new T.Vector3()).length() / 2);
  w.grond.scale.set(r * 4, r * 4, 1); w.grond.position.set(c.x, 0, c.z);
  w.zon.position.set(c.x + r * 0.8, r * 2.2, c.z + r * 1.1); w.zon.target.position.copy(c);
  const sh = w.zon.shadow.camera; sh.left = -r * 1.4; sh.right = r * 1.4; sh.top = r * 1.4; sh.bottom = -r * 1.4; sh.near = 0.5; sh.far = r * 6; sh.updateProjectionMatrix();
  return { c, r };
}
function standpunt(cam, c, r, hoek, kantel, f = 0.72) {
  const t = (hoek * Math.PI) / 180; const k = (kantel * Math.PI) / 180; const as = cam.aspect || 1; const d = (r / (Math.tan((cam.fov * Math.PI) / 360) * Math.min(1, as))) * (as < 1.2 ? Math.max(f, 0.95) : f);
  cam.position.set(c.x + d * Math.cos(k) * Math.sin(t), c.y + d * Math.sin(k), c.z + d * Math.cos(k) * Math.cos(t)); cam.near = d / 100; cam.far = d * 20; cam.lookAt(c); cam.updateProjectionMatrix();
}

// Foto van de stelling (voor het paneel en de bibliotheek): één verborgen renderer voor alle foto's, na elkaar,
// en per stelling onthouden. Geeft een data-URL (jpg).
const fotoCache = new Map(); let fotoRij = Promise.resolve(); let fotoRend = null;
export function fotoVan(st, doekMap = new Map(), { b = 640, h = 360, hoek = 35, kantel = 26 } = {}) {
  const sleutel = `${b}x${h}|${hoek}|${kantel}|${JSON.stringify(st)}`;
  if (fotoCache.has(sleutel)) return fotoCache.get(sleutel);
  const p = (fotoRij = fotoRij.then(async () => {
    const T = await import('three');
    if (!fotoRend) { fotoRend = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); fotoRend.shadowMap.enabled = true; fotoRend.shadowMap.type = T.PCFSoftShadowMap; fotoRend.outputColorSpace = T.SRGBColorSpace; }
    fotoRend.setPixelRatio(2); fotoRend.setSize(b, h, false);
    const w = wereld(T); const g = bouw(T, verzamel(st, doekMap)); w.scene.add(g);
    await Promise.race([Promise.all(g.userData.laadt || []), new Promise((r) => setTimeout(r, 4000))]);
    const { c, r } = omkader(T, w, g); const cam = new T.PerspectiveCamera(32, b / h, 0.1, 2000); standpunt(cam, c, r, hoek, kantel, 0.62);
    fotoRend.render(w.scene, cam); const url = fotoRend.domElement.toDataURL('image/jpeg', 0.86);
    w.scene.traverse((o) => { o.geometry?.dispose?.(); });
    return url;
  }).catch(() => null));
  fotoCache.set(sleutel, p); if (fotoCache.size > 40) fotoCache.delete(fotoCache.keys().next().value);
  return p;
}

// Doelen oplichten: een vlak (vak, tussenvloer, cel), een bol (hoek, uiteinde, camera) of een buis (ligger, schoor, rand).
function markeer(T, lijst, kleur, op) {
  const g = new T.Group(); const mat = new T.MeshBasicMaterial({ color: kleur, transparent: true, opacity: op, depthTest: false });
  const vlak = new T.MeshBasicMaterial({ color: kleur, transparent: true, opacity: op * 0.65, depthTest: false, side: T.DoubleSide });
  for (const t of lijst) {
    if (t.p) { const m = new T.Mesh(new T.SphereGeometry(t.soort === 'camera' ? 0.34 : 0.16, 16, 12), mat); m.position.copy(V(T, t.p)); g.add(m); }
    else if (t.c) { const P = t.c.map((p) => V(T, [p[0], p[1], p[2] + 0.03])); const pos = []; for (let k = 1; k < P.length - 1; k++) pos.push(...P[0].toArray(), ...P[k].toArray(), ...P[k + 1].toArray()); const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.add(new T.Mesh(geo, vlak)); }
    else { const dz = t.soort === 'rand' ? 0.05 : 0; const A0 = V(T, [t.a[0], t.a[1], t.a[2] + dz]); const B0 = V(T, [t.b[0], t.b[1], t.b[2] + dz]); const d = B0.clone().sub(A0); const m = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, d.length(), 10), mat); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); m.position.copy(A0).add(B0).multiplyScalar(0.5); g.add(m); }
  }
  g.renderOrder = 20; g.traverse((o) => { o.renderOrder = 20; });
  return g;
}
// Rasterlijn van een rand 'i,j,k': richting (v = langs y, h = langs x), plaats van de lijn en positie erlangs.
// Een wand kan halverwege van het ene vak naar het buurvak overgaan (andere k), maar ligt op dezelfde lijn.
const RI = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function celLijn(rs) { const [i, j, k] = rs.split(',').map(Number); const [dx, dy] = RI[k]; return dx ? { o: 'v', c: i + (dx > 0 ? 1 : 0), p: j } : { o: 'h', c: j + (dy > 0 ? 1 : 0), p: i }; }
// celKiezen: doek tekenen in 3D — een klik kiest enkel een cel (een vak van een wand tussen twee liggers).
export default function StellingDrieGL({ st, doekMap = new Map(), hoek = 35, kantel = 26, onKies = null, gekozen = null, celKiezen = false, onSleep = null, onDubbel = null, doekGekozen = null, zweef = null }) {
  const celRef = useRef(celKiezen); celRef.current = celKiezen;
  const ref = useRef(null); const api = useRef(null); const [klaar, setKlaar] = useState(false); const [fout, setFout] = useState('');
  const sc = useMemo(() => verzamel(st, doekMap), [st, doekMap]);
  // Eén keer: renderer, camera, licht en besturing.
  useEffect(() => {
    let weg = false; let rend = null; let ro = null; let ctl = null;
    (async () => {
      try {
        const T = await import('three'); const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        if (weg || !ref.current) return;
        const el = ref.current; const w = el.clientWidth || 600; const h = el.clientHeight || 400;
        rend = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); rend.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); rend.setSize(w, h);
        rend.shadowMap.enabled = true; rend.shadowMap.type = T.PCFSoftShadowMap; rend.outputColorSpace = T.SRGBColorSpace; rend.toneMapping = T.NoToneMapping;
        el.appendChild(rend.domElement); rend.domElement.style.display = 'block';
        const { scene, zon, grond } = wereld(T);
        const cam = new T.PerspectiveCamera(32, w / h, 0.1, 2000);
        ctl = new OrbitControls(cam, rend.domElement); ctl.enableDamping = true; ctl.dampingFactor = 0.12; ctl.maxPolarAngle = Math.PI / 2 - 0.03; ctl.screenSpacePanning = true;
        let raf = 0; const teken = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (ctl.update()) teken(); rend.render(scene, cam); }); };
        ctl.addEventListener('change', teken);
        ro = new ResizeObserver(() => { const W = el.clientWidth || 600; const H = el.clientHeight || 400; const oud = cam.aspect; rend.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); if (Math.abs(Math.log(cam.aspect / oud)) > 0.15) api.current?.thuis?.(); teken(); }); ro.observe(el);
        api.current = { T, scene, cam, ctl, zon, grond, teken, groep: null, rend }; el.__fm3d = api.current;
        setKlaar(true);
      } catch (e) { setFout(String(e?.message || e)); }
    })();
    return () => { weg = true; ro?.disconnect(); ctl?.dispose(); if (rend) { rend.dispose(); rend.domElement.remove(); } api.current = null; };
  }, []);
  // De stelling (opnieuw) opbouwen als ze verandert; het standpunt blijft staan, behalve de eerste keer.
  const eerste = useRef(true);
  useEffect(() => {
    const a = api.current; if (!klaar || !a) return;
    const { T, scene, cam, ctl } = a;
    if (a.groep) { scene.remove(a.groep); a.groep.traverse((o) => { o.geometry?.dispose?.(); }); }
    const g = bouw(T, sc); g.userData.herteken = a.teken; scene.add(g); a.groep = g; a.sc = sc;
    const { c, r } = omkader(T, a, g);
    // Terug naar het geheel volgt altijd de huidige stelling; vanzelf enkel de eerste keer of als ze veel groter of
    // kleiner werd (bv. een ander type opgezet), anders blijft het standpunt staan terwijl je bouwt.
    a.thuis = () => { standpunt(cam, c, r, hoek, kantel); ctl.target.copy(c); ctl.update(); a.teken(); };
    if (eerste.current || (a.vorigeR && (r > a.vorigeR * 1.6 || r < a.vorigeR / 1.6))) { eerste.current = false; a.thuis(); }
    a.vorigeR = r;
    a.teken();
  }, [klaar, sc, hoek, kantel]);
  // Een andere zijde kiezen (hoek/kantel veranderen): meteen naar dat standpunt.
  const vorigStand = useRef(`${hoek}|${kantel}`);
  useEffect(() => { const k = `${hoek}|${kantel}`; if (k === vorigStand.current) return; vorigStand.current = k; api.current?.thuis?.(); }, [hoek, kantel, klaar]);
  // ---------- Interactie: oplichten onder de muis, kiezen, slepen ----------
  // Elk onderdeel dat de scène als doel meldt (vak, ligger, schoor, rand, hoek, tussenvloer, helling-uiteinde, camera)
  // licht op onder de muis. Klik = kiezen. Een ligger, vak, tussenvloer of helling-uiteinde verslepen = omhoog of omlaag
  // (onSleep, de bouwer klikt vast op de rozetten). Dubbelklik op een wandvak = onDubbel (bv. een ligger erbij).
  const kiesRef = useRef(onKies); kiesRef.current = onKies;
  const sleepRef = useRef(onSleep); sleepRef.current = onSleep;
  const dubbelRef = useRef(onDubbel); dubbelRef.current = onDubbel;
  // Sleepstaat buiten het effect: tijdens het slepen wordt de scène opnieuw opgebouwd (voorbeeld), het slepen loopt door.
  const staatRef = useRef({ cel: null, deel: null });
  const gekozenRef = useRef(gekozen); gekozenRef.current = gekozen;
  // Grepen op de hoeken van het gekozen doek (branding): slepen = de rechthoek vanaf de overstaande hoek opnieuw spannen.
  const dGrepen = useMemo(() => {
    const d = doekGekozen; if (!d || d.soort === 'dak') return [];
    const cel = sc.doelen.filter((t) => t.soort === 'cel' && (d.randen || []).includes(t.rs) && (t.doekSoort ? t.doekSoort === d.soort : d.soort === 'vlak' && t.z0 >= Number(d.van) - 0.01 && t.z1 <= Number(d.tot) + 0.01));
    if (!cel.length) return [];
    const k0 = Number(cel[0].rs.split(',')[2]); const ix = (t) => { const [i, j] = t.rs.split(',').map(Number); return k0 % 2 ? i : j; };
    const lo = Math.min(...cel.map(ix)); const hi = Math.max(...cel.map(ix)); const zl = Math.min(...cel.map((t) => t.z0)); const zh = Math.max(...cel.map((t) => t.z1));
    const bij = (n, z) => cel.find((t) => ix(t) === n && (z === 'l' ? t.z0 === zl : t.z1 === zh)) || cel.find((t) => ix(t) === n);
    const mid = [0, 1, 2].map((q) => cel.reduce((s0, t) => s0 + t.c.reduce((u, p) => u + p[q], 0) / t.c.length, 0) / cel.length);
    const uit = []; const hoek = (t) => t.c.reduce((b, p) => (Math.hypot(p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]) > Math.hypot(b[0] - mid[0], b[1] - mid[1], b[2] - mid[2]) ? p : b), t.c[0]);
    for (const [n, z, n2, z2] of [[lo, 'l', hi, 'h'], [lo, 'h', hi, 'l'], [hi, 'l', lo, 'h'], [hi, 'h', lo, 'l']]) { const eigen = bij(n, z); const anker = bij(n2, z2); if (eigen && anker) uit.push({ soort: 'dgreep', s: `${n}${z}`, p: hoek(eigen), eigen, anker }); }
    return uit;
  }, [doekGekozen, sc]);
  const dGrepenRef = useRef(dGrepen); dGrepenRef.current = dGrepen;
  // Grepen (uiteinden van een helling) zijn er enkel als hun vak gekozen is.
  const greepZichtbaar = (t) => { const g = Array.isArray(gekozenRef.current) ? gekozenRef.current : gekozenRef.current ? [gekozenRef.current] : []; return g.some((k) => (k.soort === 'vak' && k.s === t.vak) || (k.soort === 'eind' && k.s === t.s)); };
  useEffect(() => {
    const a = api.current; if (!klaar || !a) return undefined;
    const el = a.rend.domElement; let neer = null;
    const scrVan = () => { const r = el.getBoundingClientRect(); return { r, scr: (p) => { const v = V(a.T, p).project(a.cam); return [(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height, v.z]; } }; };
    const binnen = (pt, pts) => { let ok = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i]; const [xj, yj] = pts[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi || 1e-9) + xi) ok = !ok; } return ok; };
    // Wat ligt er onder de muis: eerst een punt (hoek, uiteinde, camera), dan een buis (ligger, schoor, rand), anders
    // het vlak dat het dichtst bij de kijker ligt. alleen = enkel deze soorten (bv. ['cel'] bij doeken tekenen).
    const greepBij = (e) => { const { r, scr } = scrVan(); const mx = e.clientX - r.left; const my = e.clientY - r.top; let b = null; for (const g of dGrepenRef.current) { const q = scr(g.p); if (q[2] > 1) continue; const d = Math.hypot(q[0] - mx, q[1] - my); if (d < 12 && (!b || d < b.d)) b = { d, g }; } return b?.g || null; };
    const pick = (e, alleen = null, filt = null) => {
      const { r, scr } = scrVan(); const mx = e.clientX - r.left; const my = e.clientY - r.top;
      let punt = null; let buis = null; let vlak = null; let roz = null;
      for (const t of sc.doelen) {
        if (alleen ? !alleen.includes(t.soort) : t.soort === 'cel') continue;
        if (filt && !filt(t)) continue;
        if (t.soort === 'eind' && !greepZichtbaar(t)) continue;
        if (t.p) { const q = scr(t.p); if (q[2] > 1) continue; if (t.soort === 'rozet') { const dr = Math.hypot(q[0] - mx, q[1] - my); if (dr > 9) continue; const q2 = scr([t.p[0], t.p[1], t.p[2] + 0.09]); const rad = Math.max(2.5, Math.min(8, Math.hypot(q2[0] - q[0], q2[1] - q[1]))); if (dr < rad && (!roz || dr < roz.d)) roz = { d: dr, z: q[2], t }; continue; } const dd = Math.hypot(q[0] - mx, q[1] - my) - (t.soort === 'camera' ? 10 : 4); if (dd < 7 && (!punt || dd < punt.d)) punt = { d: dd, raw: dd + (t.soort === 'camera' ? 10 : 4), t }; continue; }
        if (t.c) { const ps = t.c.map(scr); if (ps.some((q) => q[2] > 1)) continue; const diep = ps.reduce((s0, q) => s0 + q[2], 0) / ps.length; if (binnen([mx, my], ps) && (!vlak || diep < vlak.d)) vlak = { d: diep, max: Math.max(...ps.map((q) => q[2])), t }; continue; }
        const p = scr(t.a); const q = scr(t.b); if (p[2] > 1 || q[2] > 1) continue;
        const dx = q[0] - p[0]; const dy = q[1] - p[1]; const l2 = dx * dx + dy * dy || 1; const f = Math.max(0, Math.min(1, ((mx - p[0]) * dx + (my - p[1]) * dy) / l2));
        const dd = Math.hypot(p[0] + f * dx - mx, p[1] + f * dy - my); const diep = p[2] + (q[2] - p[2]) * f;
        // Bij twee buizen even dicht bij de muis wint de voorste.
        if (dd < 9 && (!buis || dd < buis.d - 2 || (Math.abs(dd - buis.d) <= 2 && diep < buis.z))) buis = { d: dd, z: diep, t };
      }
      // Een rand zonder leuning midden op een dek is onzichtbaar: daar wint het dek, tenzij je er echt op zit.
      if (buis && vlak && buis.t.soort === 'rand' && !buis.t.leuning && buis.d > 3) buis = null;
      if (buis && vlak && vlak.t.soort === 'vak' && buis.t.dek && buis.d > 3) buis = null; // de ligger onder het dek: enkel als je er echt op zit
      // Een (onzichtbare) staander onder een overspanning wint niet van het dek waar je op klikt.
      if (buis && vlak && buis.t.soort === 'staander' && (buis.t.weg || buis.d > 3)) buis = null;
      // Een buis achter het dek (onder de vloer) is niet te zien: dan wint het dek.
      if (buis && vlak && vlak.t.soort === 'vak' && buis.z > vlak.max + 0.0001) buis = null;
      // Een rozet: enkel als je er echt op klikt (binnen ± 9 cm, op het scherm 2,5 tot 8 px) en hij niet achter het dek zit.
      if (roz && vlak && vlak.t.soort === 'vak' && roz.z > vlak.max + 0.0001) roz = null;
      // Een hoek en een rozet op dezelfde staander: de dichtste wint.
      if (punt && roz && punt.t.soort === 'hoek' && roz.d < punt.raw - 2) punt = null;
      return (punt || roz || buis || vlak)?.t || null;
    };
    const SLEEPBAAR = (t) => !!t && !!sleepRef.current && ((t.soort === 'ligger' && !t.vast) || t.soort === 'vak' || t.soort === 'tvloer' || t.soort === 'eind');
    // Hoogte onder de muis in het verticale vlak door het onderdeel (loodrecht op de kijkrichting).
    const hoogteBij = (e, t) => {
      const { r } = scrVan(); const T = a.T;
      const ndc = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new T.Raycaster(); ray.setFromCamera(ndc, a.cam);
      const m = t.p || (t.c ? [t.c.reduce((s0, q) => s0 + q[0], 0) / t.c.length, t.c.reduce((s0, q) => s0 + q[1], 0) / t.c.length, t.c.reduce((s0, q) => s0 + q[2], 0) / t.c.length] : [(t.a[0] + t.b[0]) / 2, (t.a[1] + t.b[1]) / 2, (t.a[2] + t.b[2]) / 2]);
      const dir = new T.Vector3(); a.cam.getWorldDirection(dir); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); dir.normalize();
      const vlak = new T.Plane().setFromNormalAndCoplanarPoint(dir, V(T, m)); const pt = new T.Vector3();
      return ray.ray.intersectPlane(vlak, pt) ? pt.y : null;
    };
    // Oplichten onder de muis (zacht, enkel als er niet gesleept wordt).
    let hover = null; let raf = 0;
    const toonHover = (t) => {
      if (t === hover) return; hover = t; a.hoverDoel = t;
      if (a.gloed) { a.scene.remove(a.gloed); a.gloed = null; }
      if (t) { a.gloed = markeer(a.T, [t], '#60A5FA', 0.32); a.scene.add(a.gloed); }
      el.style.cursor = !t ? '' : SLEEPBAAR(t) && !celRef.current ? 'ns-resize' : 'pointer';
      a.teken();
    };
    // Doek tekenen: cellen tussen twee cellen op dezelfde wandlijn, over alle hoogtes ertussen.
    const reeks = (c0, c1) => {
      if (!c0 || !c1) return c0 ? [c0] : [];
      const lijnVan = celLijn;
      const L0 = lijnVan(c0.rs); const L1 = lijnVan(c1.rs);
      const lijn = c0.deel === c1.deel && L0.o === L1.o && L0.c === L1.c;
      const lo = Math.min(c0.z0, c1.z0); const hi = Math.max(c0.z1, c1.z1);
      return sc.doelen.filter((t) => { if (t.soort !== 'cel' || t.deel !== c0.deel) return false; const Lt = lijnVan(t.rs);
        const opLijn = lijn ? Lt.o === L0.o && Lt.c === L0.c && Lt.p >= Math.min(L0.p, L1.p) && Lt.p <= Math.max(L0.p, L1.p) : t.rs === c0.rs;
        if (!opLijn) return false; if (t.doekSoort) return t.doekSoort === c0.doekSoort || t.doekSoort === c1.doekSoort || (t.doekSoort === 'zijkant' && !c0.doekSoort && lo <= t.z0 + 0.001 && hi >= t.z1 - 0.3);
        return t.z0 >= lo - 0.001 && t.z1 <= hi + 0.001; });
    };
    const toonReeks = (lijst) => { if (a.markCel) { a.scene.remove(a.markCel); a.markCel = null; } if (lijst.length) { a.markCel = markeer(a.T, lijst, '#2563EB', 0.35); a.scene.add(a.markCel); } a.teken(); };
    const staat = staatRef.current;
    const opNeerC = (e) => {
      if (e.button !== 0) return;
      if (celRef.current) {
        const g = greepBij(e); if (g) { staat.cel = { start: g.anker, cur: g.eigen }; a.ctl.enabled = false; toonReeks(reeks(g.anker, g.eigen)); return; }
        const c = pick(e, ['cel']); if (!c) return; staat.cel = { start: c, cur: c }; a.ctl.enabled = false; toonReeks([c]); return; }
      const t = pick(e); if (!SLEEPBAAR(t)) return;
      staat.deel = { t, x: e.clientX, y: e.clientY, bezig: false }; a.ctl.enabled = false;
    };
    const opBeweeg = (e) => {
      if (staat.cel) {
        // Eerst een cel op dezelfde wandlijn als waar je begon (ook als er een andere wand voor staat), anders gewoon de voorste.
        const L0 = celLijn(staat.cel.start.rs); const opLijn = (t) => t.deel === staat.cel.start.deel && (({ o, c: cc }) => o === L0.o && cc === L0.c)(celLijn(t.rs));
        const c = pick(e, ['cel'], opLijn) || pick(e, ['cel']); if (c && c !== staat.cel.cur) { staat.cel.cur = c; toonReeks(reeks(staat.cel.start, c)); } return; }
      if (staat.deel) {
        if (!staat.deel.bezig && Math.hypot(e.clientX - staat.deel.x, e.clientY - staat.deel.y) < 4) return;
        if (!staat.deel.bezig) { staat.deel.bezig = true; toonHover(null); }
        const z = hoogteBij(e, staat.deel.t); if (z != null) sleepRef.current?.({ doel: staat.deel.t, z, klaar: false });
        return;
      }
      if (e.buttons) return;
      cancelAnimationFrame(raf); const ev = { clientX: e.clientX, clientY: e.clientY };
      if (!kiesRef.current && !sleepRef.current) return; // enkel bekijken (deellink, paneel): geen gloed
      raf = requestAnimationFrame(() => { if (celRef.current && greepBij(ev)) { toonHover(null); el.style.cursor = 'nwse-resize'; return; } toonHover(pick(ev, celRef.current ? ['cel'] : null)); if (!hover) el.style.cursor = ''; });
    };
    const opLosC = (e) => {
      if (staat.cel) {
        const { start, cur } = staat.cel; staat.cel = null; a.ctl.enabled = true; neer = null; toonReeks([]); e.stopImmediatePropagation();
        // Kant van het doek = de kant waar je naar kijkt: camera tegenover de buitennormaal van de rand (weg van zijn vak).
        const kantVan = (c) => {
          const [i, j] = c.rs.split(',').map(Number); const vk = sc.doelen.find((t) => t.soort === 'vak' && t.s === `${i},${j}` && (t.deel ?? null) === (c.deel ?? null)) || sc.doelen.find((t) => t.soort === 'vak' && t.s === `${i},${j}`);
          if (!vk?.c) return null;
          const m = [0, 1].map((q) => c.c.reduce((s0, p) => s0 + p[q], 0) / c.c.length); const v = [0, 1].map((q) => vk.c.reduce((s0, p) => s0 + p[q], 0) / vk.c.length);
          const cp = [a.cam.position.x, -a.cam.position.z];
          return (m[0] - v[0]) * (cp[0] - m[0]) + (m[1] - v[1]) * (cp[1] - m[1]) >= 0 ? 'buiten' : 'binnen';
        };
        const lijst = reeks(start, cur); const kant = kantVan(start);
        kiesRef.current?.(lijst.length > 1 ? { soort: 'celreeks', cellen: lijst, kant, start } : { ...start, kant }, { shift: e.shiftKey }); return;
      }
      if (staat.deel) {
        const g = staat.deel; staat.deel = null; a.ctl.enabled = true;
        if (g.bezig) { neer = null; e.stopImmediatePropagation(); const z = hoogteBij(e, g.t); sleepRef.current?.({ doel: g.t, z, klaar: true }); }
      }
    };
    const opNeer = (e) => { neer = [e.clientX, e.clientY]; };
    const opLos = (e) => {
      if (!neer || !kiesRef.current) return; const d = Math.hypot(e.clientX - neer[0], e.clientY - neer[1]); neer = null; if (d > 5) return;
      kiesRef.current(pick(e), { shift: e.shiftKey });
    };
    const opDubbel = (e) => { if (celRef.current || !dubbelRef.current) return; const c = pick(e, ['cel']); if (c) dubbelRef.current(c, hoogteBij(e, c)); };
    const opWeg = () => { cancelAnimationFrame(raf); toonHover(null); };
    el.addEventListener('pointerdown', opNeerC, true); el.addEventListener('pointermove', opBeweeg); el.addEventListener('pointerup', opLosC, true);
    el.addEventListener('pointerdown', opNeer); el.addEventListener('pointerup', opLos); el.addEventListener('dblclick', opDubbel); el.addEventListener('pointerleave', opWeg);
    return () => {
      cancelAnimationFrame(raf); if (a.gloed) { a.scene.remove(a.gloed); a.gloed = null; }
      el.removeEventListener('pointerdown', opNeerC, true); el.removeEventListener('pointermove', opBeweeg); el.removeEventListener('pointerup', opLosC, true);
      el.removeEventListener('pointerdown', opNeer); el.removeEventListener('pointerup', opLos); el.removeEventListener('dblclick', opDubbel); el.removeEventListener('pointerleave', opWeg);
    };
  }, [klaar, sc]);
  // De gekozen doelen oplichten (blauw). `gekozen` is één doel of een lijst.
  useEffect(() => {
    const a = api.current; if (!klaar || !a) return;
    if (a.mark) { a.scene.remove(a.mark); a.mark = null; }
    const lijst = (Array.isArray(gekozen) ? gekozen : gekozen ? [gekozen] : []).flatMap((k) => sc.doelen.filter((x) => x.soort === k.soort && x.s === k.s && x.deel === k.deel));
    // Bij een gekozen helling ook de grepen op de uiteinden (wit met blauwe rand).
    const grepen = sc.doelen.filter((x) => x.soort === 'eind' && greepZichtbaar(x) && !lijst.includes(x));
    if (lijst.length || grepen.length || dGrepen.length) { a.mark = markeer(a.T, lijst, '#2563EB', 0.55); if (grepen.length) a.mark.add(markeer(a.T, grepen, '#1D4ED8', 0.85)); if (dGrepen.length) a.mark.add(markeer(a.T, dGrepen, '#1D4ED8', 0.95)); a.scene.add(a.mark); }
    a.teken();
  }, [klaar, sc, gekozen, dGrepen]);
  // Hover in het raster: hetzelfde onderdeel licht op in 3D.
  useEffect(() => {
    const a = api.current; if (!klaar || !a) return undefined;
    if (a.zweef) { a.scene.remove(a.zweef); a.zweef = null; }
    const t = zweef ? sc.doelen.find((x) => x.soort === zweef.soort && x.s === zweef.s && (x.deel ?? '0') === (zweef.deel ?? '0')) : null;
    if (t) { a.zweef = markeer(a.T, [t], '#60A5FA', 0.32); a.scene.add(a.zweef); }
    a.teken(); return undefined;
  }, [klaar, sc, zweef]);
  const zoom = (f) => { const a = api.current; if (!a) return; const { cam, ctl } = a; const d = cam.position.clone().sub(ctl.target).multiplyScalar(f); cam.position.copy(ctl.target).add(d); ctl.update(); a.teken(); };
  return (
    <div ref={ref} className="fm-wz fm-wz-gl" data-klaar={klaar ? '1' : '0'}>
      {fout && <div className="fm-sub" style={{ padding: 12 }}>3D kon niet starten: {fout}</div>}
      <div className="fm-wz-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Inzoomen" onClick={() => zoom(0.75)}>+</button>
        <button type="button" aria-label="Uitzoomen" onClick={() => zoom(1 / 0.75)}>−</button>
        <button type="button" aria-label="Terug naar het geheel" title="Terug naar het geheel" onClick={() => api.current?.thuis?.()}>⟲</button>
      </div>
      <div className="fm-wz-hulp">Slepen = draaien · rechts slepen of Shift = verschuiven · scrollen = zoomen</div>
    </div>
  );
}
