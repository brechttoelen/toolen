// Eén nette PDF van een bouwer (tent of stelling): blad 1 met de 3D-weergave en het grondplan, blad 2 met de vier
// aanzichten. Alles komt uit dezelfde 3D-scène als in de bouwer: orthografische zichten met maatlijnen die uit de
// staanders (palen, spanten, stellingstaanders) volgen, plus de belangrijkste hoogtes.
import { jsPDF } from 'jspdf';
import { wereld, omkader, standpunt } from './StellingDrieGL';

const MM_PX = 6; // pixels per mm in de beelden (± 150 dpi)
const fmt = (v, eenheid) => (eenheid === 'mm' ? String(Math.round(v * 1000)) : (Math.round(v * 100) / 100).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// Staanders (verticale buizen) uit de scène: Mesh of InstancedMesh met een cilinder.
function staanders(T, groep) {
  const uit = []; const m4 = new T.Matrix4(); const p = new T.Vector3(); const q = new T.Quaternion(); const s = new T.Vector3(); const as = new T.Vector3();
  const neem = (mat) => { mat.decompose(p, q, s); as.set(0, 1, 0).applyQuaternion(q); if (Math.abs(as.y) < 0.985 || s.y < 0.6) return; uit.push({ x: p.x, z: p.z, top: p.y + s.y / 2 }); };
  groep.updateMatrixWorld(true);
  groep.traverse((o) => {
    if (o.geometry?.type !== 'CylinderGeometry') return;
    if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); neem(m4); } } else if (o.isMesh) neem(o.matrixWorld);
  });
  return uit;
}
const uniek = (lijst, tol = 0.03) => { const s = [...lijst].sort((a, b) => a - b); const u = []; for (const v of s) if (!u.length || v - u[u.length - 1] > tol) u.push(v); return u; };

// Doorsnede: waar de vlakken (wanden, panelen) het horizontale vlak op hoogte z snijden, als lijnstukken (three x, z).
function snedeLijnen(T, groep, z) {
  const uit = []; const a = new T.Vector3(); const b = new T.Vector3(); const c = new T.Vector3();
  groep.updateMatrixWorld(true);
  groep.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.geometry?.type === 'CylinderGeometry' || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position; const idx = o.geometry.index; const n = idx ? idx.count : pos.count;
    const kl = o.material?.color ? `#${o.material.color.getHexString()}` : '#374151'; const op = o.material?.opacity ?? 1;
    for (let i = 0; i < n; i += 3) {
      const ia = idx ? idx.getX(i) : i; const ib = idx ? idx.getX(i + 1) : i + 1; const ic = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, ia).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pos, ib).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pos, ic).applyMatrix4(o.matrixWorld);
      const pts = []; for (const [p, q] of [[a, b], [b, c], [c, a]]) { if ((p.y - z) * (q.y - z) < 0) { const f = (z - p.y) / (q.y - p.y); pts.push([p.x + (q.x - p.x) * f, p.z + (q.z - p.z) * f]); } }
      if (pts.length === 2 && Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) > 0.005) uit.push({ a: pts[0], b: pts[1], kl, op });
    }
  });
  return uit;
}

// Zichten. richting = waar de camera staat (three-coördinaten), op = boven in het beeld.
const ZICHTEN = {
  boven: { dir: [0, 1, 0], op: [0, 0, -1] },
  voor: { dir: [0, 0, 1], op: [0, 1, 0] }, // vanaf y < 0 (plan), kijkt naar +y
  achter: { dir: [0, 0, -1], op: [0, 1, 0] },
  links: { dir: [-1, 0, 0], op: [0, 1, 0] },
  rechts: { dir: [1, 0, 0], op: [0, 1, 0] },
};

// Een orthografisch beeld van de groep, passend in w × h mm, met de omzetting wereld → mm op het blad.
function ortho(T, rend, scene, groep, zicht, w, h, snede = null) {
  const z = ZICHTEN[zicht]; const box = new T.Box3().setFromObject(groep); const c = box.getCenter(new T.Vector3()); const r = box.getSize(new T.Vector3()).length();
  const dir = new T.Vector3(...z.dir); const op = new T.Vector3(...z.op); const rechts = new T.Vector3().crossVectors(op, dir).normalize();
  // Omvang in de richting van het beeld.
  const hoeken = []; for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const zz of [box.min.z, box.max.z]) hoeken.push(new T.Vector3(x, y, zz));
  const hs = hoeken.map((v) => v.clone().sub(c).dot(rechts)); const vs = hoeken.map((v) => v.clone().sub(c).dot(op));
  const bw = Math.max(...hs) - Math.min(...hs); const bh = Math.max(...vs) - Math.min(...vs);
  const schaal = Math.min(w / (bw * 1.04 || 1), h / (bh * 1.04 || 1)); // mm per meter
  const pw = bw * 1.04 * schaal; const ph = bh * 1.04 * schaal; // beeld in mm
  const cam = new T.OrthographicCamera(-pw / schaal / 2, pw / schaal / 2, ph / schaal / 2, -ph / schaal / 2, 0.01, r * 10);
  const mid = c.clone().add(rechts.clone().multiplyScalar((Math.max(...hs) + Math.min(...hs)) / 2)).add(op.clone().multiplyScalar((Math.max(...vs) + Math.min(...vs)) / 2));
  cam.position.copy(mid).add(dir.clone().multiplyScalar(r * 3)); cam.up.copy(op); cam.lookAt(mid); cam.updateProjectionMatrix();
  rend.setSize(Math.round(pw * MM_PX), Math.round(ph * MM_PX), false);
  // Grondplan = doorsnede op 1,2 m: vloer, wanden en staanders, zonder het dak erboven.
  rend.localClippingEnabled = true; rend.clippingPlanes = zicht === 'boven' && snede != null ? [new T.Plane(new T.Vector3(0, -1, 0), snede)] : [];
  rend.render(scene, cam); rend.clippingPlanes = [];
  const beeld = rend.domElement.toDataURL('image/png');
  // wereld (three) → mm binnen het beeld (0,0 = linksboven)
  const naar = (v) => [(v.clone().sub(mid).dot(rechts) * schaal) + pw / 2, ph / 2 - (v.clone().sub(mid).dot(op) * schaal)];
  return { beeld, pw, ph, schaal, rechts, op, mid, naar };
}

// Maatlijn van a naar b (mm op het blad), tekst in het midden; vert = staand.
function maatlijn(doc, a, b, tekst, vert = false) {
  doc.setDrawColor(40, 48, 60); doc.setLineWidth(0.18); doc.line(a[0], a[1], b[0], b[1]);
  const t = 1.4; if (vert) { doc.line(a[0] - t, a[1] + t, a[0] + t, a[1] - t); doc.line(b[0] - t, b[1] + t, b[0] + t, b[1] - t); } else { doc.line(a[0] - t, a[1] + t, a[0] + t, a[1] - t); doc.line(b[0] - t, b[1] + t, b[0] + t, b[1] - t); }
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]); doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 26, 40);
  const fs = Math.max(5, Math.min(8, len / Math.max(3, tekst.length) * 2.2)); doc.setFontSize(fs);
  if (doc.getTextWidth(tekst) > len - 1 && len < 6) return; // past niet
  if (vert) doc.text(tekst, a[0] - 1.6, (a[1] + b[1]) / 2, { angle: 90, align: 'center' }); else doc.text(tekst, (a[0] + b[0]) / 2, a[1] - 1.2, { align: 'center' });
}
// Keten van maten langs een rand: posities in meter (oplopend), naar = meter → mm op de as.
function keten(doc, pos, naar, vast, vert, eenheid, totaal = true) {
  if (pos.length < 2) return;
  const P = (v, off) => (vert ? [vast - off, naar(v)] : [naar(v), vast + off]);
  doc.setDrawColor(150, 158, 170); doc.setLineWidth(0.1);
  for (const v of pos) { const a = P(v, 0); const b = P(v, totaal ? 10 : 5); doc.line(a[0], a[1], b[0], b[1]); }
  if (pos.length > 2) for (let i = 0; i < pos.length - 1; i++) maatlijn(doc, P(pos[i], 4), P(pos[i + 1], 4), fmt(pos[i + 1] - pos[i], eenheid), vert);
  if (totaal) maatlijn(doc, P(pos[0], pos.length > 2 ? 9 : 4), P(pos[pos.length - 1], pos.length > 2 ? 9 : 4), fmt(pos[pos.length - 1] - pos[0], eenheid), vert);
}

// Eén zicht met maatlijnen in een vak (x, y, w, h in mm).
function zichtMetMaten(doc, T, rend, scene, groep, zicht, vak, { eenheid, hoogtes, titel, snede = null }) {
  const marge = 16; const o = ortho(T, rend, scene, groep, zicht, vak.w - marge - 4, vak.h - marge - 10, snede);
  const x0 = vak.x + marge + (vak.w - marge - 4 - o.pw) / 2; const y0 = vak.y + 8 + (vak.h - marge - 10 - o.ph) / 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(14, 26, 51); doc.text(titel, vak.x, vak.y + 4);
  doc.addImage(o.beeld, 'PNG', x0, y0, o.pw, o.ph, undefined, 'FAST');
  if (zicht === 'boven' && snede != null) {
    // Gesneden wanden als dikke lijnen, in hun eigen kleur (lichte, transparante wanden donkerder).
    for (const l of snedeLijnen(T, groep, snede)) {
      const p = o.naar(new T.Vector3(l.a[0], snede, l.a[1])); const q = o.naar(new T.Vector3(l.b[0], snede, l.b[1]));
      const k = l.kl.slice(1); let [r, g, bl] = [0, 2, 4].map((i) => parseInt(k.slice(i, i + 2), 16)); const lum = 0.3 * r + 0.59 * g + 0.11 * bl;
      if (lum > 170) { r = Math.round(r * 0.45); g = Math.round(g * 0.45); bl = Math.round(bl * 0.45); }
      doc.setDrawColor(r, g, bl); doc.setLineWidth(l.op < 0.6 ? 0.35 : 0.7); doc.line(x0 + p[0], y0 + p[1], x0 + q[0], y0 + q[1]);
    }
  }
  const st = staanders(T, groep);
  const as = (v3, a) => v3.clone().sub(o.mid).dot(a);
  const hPos = uniek(st.map((s) => as(new T.Vector3(s.x, 0, s.z), o.rechts)));
  // horizontale maten onder het beeld (meter langs 'rechts' → mm)
  const naarH = (v) => x0 + o.pw / 2 + v * o.schaal;
  if (hPos.length >= 2) keten(doc, hPos, naarH, y0 + o.ph + 1, false, eenheid);
  if (zicht === 'boven') {
    const vPos = uniek(st.map((s) => as(new T.Vector3(s.x, 0, s.z), o.op)));
    const naarV = (v) => y0 + o.ph / 2 - v * o.schaal;
    if (vPos.length >= 2) keten(doc, vPos, naarV, x0 - 1, true, eenheid);
  } else {
    // hoogtes links: grond, de opgegeven hoogtes en de top
    const box = new T.Box3().setFromObject(groep); const grondV = as(new T.Vector3(0, 0, 0), o.op);
    const zs = uniek([0, ...(hoogtes || []), box.max.y].filter((z) => z >= 0 && z <= box.max.y + 0.001), 0.05);
    const naarV = (z) => y0 + o.ph / 2 - (grondV + z) * o.schaal;
    if (zs.length >= 2) {
      doc.setDrawColor(150, 158, 170); doc.setLineWidth(0.1);
      for (const z of zs) doc.line(x0 - 1, naarV(z), x0 - 11, naarV(z));
      for (let i = 0; i < zs.length - 1; i++) maatlijn(doc, [x0 - 5, naarV(zs[i])], [x0 - 5, naarV(zs[i + 1])], fmt(zs[i + 1] - zs[i], eenheid), true);
      if (zs.length > 2) maatlijn(doc, [x0 - 10, naarV(zs[0])], [x0 - 10, naarV(zs[zs.length - 1])], fmt(zs[zs.length - 1], eenheid), true);
    }
  }
  return o;
}

// soort: 'tent' | 'stelling'. maakGroep(T) → Promise<THREE.Group>. kenmerken: [[label, waarde]] voor het titelblok.
export async function bouwerPdf({ titel, sub = '', soort = 'tent', maakGroep, hoogtes = [], kenmerken = [], eenheid = soort === 'stelling' ? 'mm' : 'm', namen = {}, snede = null, bestand }) {
  const T = await import('three');
  const rend = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); rend.setPixelRatio(1); rend.outputColorSpace = T.SRGBColorSpace; rend.shadowMap.enabled = true; rend.shadowMap.type = T.PCFSoftShadowMap;
  try {
    const groep = await maakGroep(T);
    // 3D: met grond en schaduw.
    const w3 = wereld(T); w3.scene.add(groep); const { c, r } = omkader(T, w3, groep);
    const cam = new T.PerspectiveCamera(32, 1.5, 0.1, 2000); standpunt(cam, c, r, 32, 24, 0.66);
    rend.setSize(1800, 1200, false); rend.render(w3.scene, cam); const drie = rend.domElement.toDataURL('image/jpeg', 0.9);
    // Zichten: witte achtergrond, zacht licht, zonder grond.
    w3.scene.remove(w3.grond); w3.scene.background = new T.Color('#ffffff'); rend.shadowMap.enabled = false;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
    const W = 420; const H = 297; const M = 12;
    const kop = (blad) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(14, 26, 51); doc.text(titel, M, M + 6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(74, 90, 117); doc.text(sub, M, M + 12);
      doc.text(`Blad ${blad}/2`, W - M, M + 6, { align: 'right' });
      doc.setDrawColor(227, 232, 239); doc.setLineWidth(0.3); doc.line(M, M + 16, W - M, M + 16);
      doc.setFontSize(7.5); doc.setTextColor(132, 146, 168);
      doc.text(`Indicatieve maattekening · maten in ${eenheid === 'mm' ? 'mm' : 'm'} · de plannen van de ${soort === 'stelling' ? 'stellingbouwer' : 'tentbouwer'} zijn bindend · ${new Date().toLocaleDateString('nl-BE')}`, M, H - 7);
      doc.text('Toolen Maps', W - M, H - 7, { align: 'right' });
    };
    // Blad 1: 3D links, grondplan rechts, kenmerken onder de 3D.
    kop(1);
    const top = M + 22; const hoog = H - top - 18; const links = 200;
    doc.addImage(drie, 'JPEG', M, top, links, (links * 2) / 3, undefined, 'FAST');
    let ky = top + (links * 2) / 3 + 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(14, 26, 51); doc.text('Kenmerken', M, ky); ky += 5;
    doc.setFontSize(8.5);
    kenmerken.forEach(([k, v], i) => { const kx = M + (i % 2) * (links / 2); const yy = ky + Math.floor(i / 2) * 5; doc.setFont('helvetica', 'normal'); doc.setTextColor(74, 90, 117); doc.text(String(k), kx, yy); doc.setFont('helvetica', 'bold'); doc.setTextColor(14, 26, 51); doc.text(String(v), kx + 40, yy); });
    zichtMetMaten(doc, T, rend, w3.scene, groep, 'boven', { x: M + links + 10, y: top, w: W - 2 * M - links - 10, h: hoog }, { eenheid, titel: snede != null ? `Grondplan (doorsnede op ${fmt(snede, 'm')} m)` : 'Grondplan', snede });
    // Blad 2: vier aanzichten.
    doc.addPage('a3', 'landscape'); kop(2);
    const cw = (W - 2 * M - 10) / 2; const ch = (H - top - 18 - 8) / 2;
    const vakken = [['voor', 0, 0], ['achter', 1, 0], ['links', 0, 1], ['rechts', 1, 1]];
    for (const [z, i, j] of vakken) zichtMetMaten(doc, T, rend, w3.scene, groep, z, { x: M + i * (cw + 10), y: top + j * (ch + 8), w: cw, h: ch }, { eenheid, hoogtes, titel: namen[z] || { voor: 'Vooraanzicht', achter: 'Achteraanzicht', links: 'Linkerzijde', rechts: 'Rechterzijde' }[z] });
    w3.scene.traverse((o) => { o.geometry?.dispose?.(); });
    doc.save(bestand || `${titel.replace(/[^\w\- ]+/g, '').trim() || 'bouwer'}.pdf`);
  } finally { rend.dispose(); }
}
