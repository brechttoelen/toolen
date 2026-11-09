'use client';

// Binnenplan als eigen scherm: het grondplan en de zalen liggen vast als achtergrond (in de
// eigen maten van het plan), je richt enkel in met elementen uit de bibliotheek.
// Alles wordt in het assenstelsel van het grondplan bewaard (velden.binnen.lokaal) en daaruit
// op de kaart gezet, zodat ruimtes en inrichting altijd op het plan blijven liggen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { metTekening } from './tekeningen';
import { laadDxf, planTransform } from './onderlegger';
import BibliotheekPaneel from './BibliotheekPaneel';
import { vraagTekst, useSluitBuiten } from './dialoog';
import { FotoStrook } from './fotos';
import { PUNT_TYPES, PUNT, PuntSymbool } from './binnenPunten';
import { isFrame, isDrape, zijdenVan, segN, pasTekeningAan } from './stijl';
import { tekeningFeatures } from './tekening';
import { ontwerpDrager } from './branding';
import OntwerpDuimen from './OntwerpDuimen';
import { Tekenaar, vormPunten, verschuif as schuifVorm } from './ElementEditor';
import WandBouwer, { telAlleWanden } from './WandBouwer';
import { WandZicht } from './WandStudio';
import { TrussZicht } from './TrussStudio';
import { CameraVenster, bouwScene, isCamera, cameraVan, brandpunt, kijkhoek } from './camerabeeld';
import { isWand, wandFrames, wandStukken, isVrij } from './framewand';
import { isTrussBouw, trussStukken, trussKnopen, knoopRichting } from './trussbouw';
import { binnenVorm } from './binnenvorm';
import { isTentBouw, tentOpeningen } from './tentbouw';
import { TrussBlok } from './TrussBlok';
import { binnenTekst, vertaalNaam } from './binnenTaal';
import { MEUBEL_GROEPEN, tegelMeubel, meubelTekening, maatMeubel, naamMeubel, zitMeubel, autoStoelen, naarMuur } from './meubel';
import StroomDetail from './StroomDetail';
import { stroomVan, kabelDoelen, kabelTypeVoor, koppelVoeding, KABEL_KLEUR, kabelSpanning } from './stroom';
import { elKast, elStekkerdoos, elVerwarming, elVerbruiker } from './werkruimtes';

const r3 = (v) => Math.round(v * 1000) / 1000;
const getal = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('nl-BE');
// Met de klok mee draaien (graden), y naar boven.
const middenVan = (ring) => { const r = ring.slice(0, -1); return [r.reduce((a, c) => a + c[0], 0) / r.length, r.reduce((a, c) => a + c[1], 0) / r.length]; };
const draai = ([x, y], g) => { const a = (g * Math.PI) / 180; return [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)]; };
const rechthoek = ([mx, my], b, d, rot) => { const r = [[-b / 2, -d / 2], [b / 2, -d / 2], [b / 2, d / 2], [-b / 2, d / 2]].map((p) => draai(p, rot)).map(([x, y]) => [r3(mx + x), r3(my + y)]); return [...r, r[0]]; };
const puntenVan = (g) => (!g ? [] : g.type === 'Point' ? [g.coordinates] : g.type === 'LineString' ? g.coordinates : g.coordinates[0]);
const mapG = (g, f) => (g.type === 'Point' ? { type: 'Point', coordinates: f(g.coordinates) } : g.type === 'LineString' ? { type: 'LineString', coordinates: g.coordinates.map(f) } : { type: 'Polygon', coordinates: g.coordinates.map((r) => r.map(f)) });
const binnenVeelhoek = (p, ring) => { let b = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i]; const [xj, yj] = ring[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) b = !b; } return b; };
const oppervlakte = (ring) => { let s = 0; for (let i = 0; i < ring.length - 1; i++) s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]; return Math.abs(s / 2); };
const kaderVan = (lijst) => { let k = null; for (const c of lijst) for (const [x, y] of c) k = k ? [Math.min(k[0], x), Math.min(k[1], y), Math.max(k[2], x), Math.max(k[3], y)] : [x, y, x, y]; return k; };
const ZAAL_LAAG = /^(zalen|ruimtes?|zones?)$/i;
// Pad in meter (de wereldgroep schaalt en spiegelt; lijndiktes met non-scaling-stroke).
const padW = (pts, dicht) => pts.map((q, i) => `${i ? 'L' : 'M'}${q[0]} ${q[1]}`).join('') + (dicht ? 'Z' : '');
const NS = 'non-scaling-stroke';
// Zitplaatsen van een element: opgegeven, of uit de naam ("met 8 stoelen", "stoel").
export const zitVan = (el) => { if (!el) return 0; const z = Number(el.eigenschappen?.zitplaatsen); if (z >= 0 && el.eigenschappen?.zitplaatsen != null) return z; const m = /met (\d+) stoelen/i.exec(el.naam || ''); if (m) return Number(m[1]); return /stoel/i.test(el.naam || '') ? 1 : 0; };
export const slugVan = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Eenvoudige tekening voor huismateriaal: rond of rechthoekig.
// Met zitplaatsen komen er stoelen rond (rond) of langs de lange zijden (rechthoek); de maat is dan inclusief stoelen.
const vierkant = ([x, y], z, a = 0) => { const c = [[-z, -z], [z, -z], [z, z], [-z, z], [-z, -z]]; const k = Math.cos(a); const n = Math.sin(a); return c.map(([u, v]) => [r3(x + u * k - v * n), r3(y + u * n + v * k)]); };
export const vormTekening = (vorm, b, h, zit = 0) => {
  const tafel = vorm === 'rond' ? Array.from({ length: 33 }, (_, i) => { const a = (i / 32) * Math.PI * 2; return [r3((Math.cos(a) * b) / 2), r3((Math.sin(a) * h) / 2)]; })
    : [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, h / 2], [-b / 2, h / 2], [-b / 2, -h / 2]];
  const stoelen = [];
  if (zit > 0 && vorm === 'rond') for (let i = 0; i < zit; i++) { const a = (i / zit) * Math.PI * 2 + Math.PI / 2; const R = b / 2 + 0.28; stoelen.push(vierkant([Math.cos(a) * R, Math.sin(a) * R], 0.21, a)); }
  if (zit > 0 && vorm === 'rechthoek') {
    const lang = b >= h; const L = lang ? b : h; const per = [Math.ceil(zit / 2), Math.floor(zit / 2)];
    per.forEach((n, z) => { for (let i = 0; i < n; i++) { const t = -L / 2 + (L * (i + 0.5)) / n; const o = ((lang ? h : b) / 2 + 0.28) * (z ? -1 : 1); stoelen.push(vierkant(lang ? [t, o] : [o, t], 0.21)); } });
  }
  const extra = stoelen.length ? 1.0 : 0;
  const B2 = vorm === 'rond' || b >= h ? b + (vorm === 'rond' ? extra : 0) : b + extra;
  const H2 = vorm === 'rond' || b < h ? h + (vorm === 'rond' ? extra : 0) : h + extra;
  return { b: r3(B2), h: r3(H2), vlakken: [...stoelen.map((r) => ({ r: [r], vul: '#D6CFC4', lijn: '#78716C', d: 0.01 })), { r: [tafel], vul: '#F5F5F4', lijn: '#57534E', d: 0.02 }], lijnen: [], teksten: [] };
};
// Beste plek voor een label in een (onregelmatige) zaal: het punt het verst van de randen
// (benadering van polylabel op een raster), met de horizontale ruimte die er beschikbaar is.
const afstRand = (p, ring) => { let d = Infinity; for (let i = 0; i < ring.length - 1; i++) { const [ax, ay] = ring[i]; const [bx, by] = ring[i + 1]; const dx = bx - ax; const dy = by - ay; const l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)); d = Math.min(d, Math.hypot(ax + t * dx - p[0], ay + t * dy - p[1])); } return d; };
const binnenR = (p, ring) => { let b = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i]; const [xj, yj] = ring[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) b = !b; } return b; };
export function labelPlek(ring) {
  if (!ring?.length) return null;
  let k = null; for (const [x, y] of ring) k = k ? [Math.min(k[0], x), Math.min(k[1], y), Math.max(k[2], x), Math.max(k[3], y)] : [x, y, x, y];
  let best = null; const N = 16;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const p = [k[0] + ((k[2] - k[0]) * i) / N, k[1] + ((k[3] - k[1]) * j) / N];
    if (!binnenR(p, ring)) continue;
    // voorkeur voor brede plekken: afstand tot de rand, plus een beetje horizontale ruimte
    const d = afstRand(p, ring); if (!best || d > best.d) best = { p, d };
  }
  if (!best) return null;
  // horizontale ruimte door dat punt
  const y = best.p[1]; const xs = [];
  for (let i = 0; i < ring.length - 1; i++) { const [ax, ay] = ring[i]; const [bx, by] = ring[i + 1]; if ((ay > y) !== (by > y)) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay)); }
  xs.sort((a, b) => a - b);
  let xa = k[0]; let xb = k[2];
  for (let i = 0; i < xs.length - 1; i += 2) if (xs[i] <= best.p[0] && best.p[0] <= xs[i + 1]) { xa = xs[i]; xb = xs[i + 1]; }
  return { p: [(xa + xb) / 2, y], b: xb - xa, h: best.d * 2 };
}
let meetCtx = null;
const tekstBreedte = (t, font) => { if (typeof document === 'undefined') return t.length * 7; if (!meetCtx) meetCtx = document.createElement('canvas').getContext('2d'); meetCtx.font = font; return meetCtx.measureText(t).width; };
// Tekst inkorten met … tot hij past (of niets als er geen plaats is voor 3 tekens).
export const pasIn = (t, max, font) => { if (!t) return ''; if (tekstBreedte(t, font) <= max) return t; let s = t; while (s.length > 1 && tekstBreedte(`${s}…`, font) > max) s = s.slice(0, -1); return s.length >= 3 ? `${s.trimEnd()}…` : ''; };
// Pipe & drape: secties van e meter langs een lijn (lokaal, in meter): [[a, b], ...].
const sectiesVan = (pts, e) => {
  const uit = []; if (!(e > 0)) return uit;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]; const [bx, by] = pts[i + 1]; const L = Math.hypot(bx - ax, by - ay); if (L < 0.01) continue;
    const n = Math.max(1, Math.round(L / e));
    for (let k = 0; k < n; k++) uit.push([[ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n], [ax + ((bx - ax) * (k + 1)) / n, ay + ((by - ay) * (k + 1)) / n]]);
  }
  return uit;
};
const zaalNaam = (t) => String(t || '').replace(/\s*\([^)]*m²\)\s*$/, '').trim();

export default function BinnenScherm({ host, verdiepingen, verd, onVerd, onNieuweVerdieping, onderlegger, items, elementen, elementenMap, schrijven,
  onMaak, onWijzig, onVerwijder, onGrondplan, onPassen, onOnderlegger, onSluit, onMaakElement, onWijzigElement, onHost, fasen = [], actieveFase = null, onFase, onOngedaan, doeken = [], taal = 'nl', fotosVast = null, merk = null, autoPdf = false, onPdfKlaar, beginCamera = null, beginCameraBeeld = null, onDeelCamera = null,
  stroom = null, vast = [], onKabelBuiten = null }) {
  const tx = binnenTekst(taal); const vn = (n) => vertaalNaam(n, taal);
  const [d, setD] = useState(null); // DXF-gegevens van het grondplan (lijnen in meter)
  const [laden, setLaden] = useState(false);
  const svgRef = useRef(null);
  const [maat, setMaat] = useState({ w: 900, h: 600 });
  const [beeld, setBeeld] = useState(null); // { cx, cy, s } s = px per meter
  const [sel, setSel] = useState([]);
  const [kiesEl, setKiesEl] = useState(null);
  const [elRot, setElRot] = useState(0);
  const [muis, setMuis] = useState(null);
  const [lijn, setLijn] = useState(null); // lijnelement tekenen: punten
  const [ruimteKlik, setRuimteKlik] = useState(false);
  const [melding, setMelding] = useState('');
  const sleep = useRef(null);
  const [voorlopig, setVoorlopig] = useState(null); // { id → lokaal } tijdens slepen
  const bestandRef = useRef(null);
  const [modus, setModus] = useState(null); // null | 'meet' | 'zaal' | 'schaal'
  const [tekenvel, setTekenvel] = useState(false); // de tekenaar (zelfde als de elementeditor) over dit plan
  const tekenRef = useRef(null);
  const [tekenSel, setTekenSel] = useState([]);
  const [tekenTool, setTekenTool] = useState('selecteer');
  const [punten, setPunten] = useState([]); // klikken voor meten, zaal tekenen of schaal
  const [meting, setMeting] = useState(null); // laatste meting [a, b]
  const [tab, setTab] = useState('inrichten');
  const [actieveRuimte, setActieveRuimte] = useState(null);
  const [rijVorm, setRijVorm] = useState(null); // { kol, rij, tussen }
  const [menu, setMenu] = useState(false);
  const [gebouwKaart, setGebouwKaart] = useState(false);
  const [lijstOpen, setLijstOpen] = useState(false); // gsm: onderblad met zalen en lijst open
  const aanraak = useRef(null); const beeldRef = useRef(null); const maatRef = useRef(null); const tikRef = useRef(null);
  const [puntMenu, setPuntMenu] = useState(false);
  useSluitBuiten(puntMenu, () => setPuntMenu(false));
  const [zweefIt, setZweefIt] = useState(null); // { id, x, y } ballon bij zweven
  const [kaderSel, setKaderSel] = useState(null);
  const [afst, setAfst] = useState([]); // afstanden tot muren en items tijdens verplaatsen
  const [tekenMenu, setTekenMenu] = useState(false);
  const [stroomMenu, setStroomMenu] = useState(false); // false | true | { naam, lijst } (tweede niveau: elementen)
  useSluitBuiten(!!stroomMenu, () => setStroomMenu(false));
  const [kabelVan, setKabelVan] = useState(null); // kabel tekenen: gekozen bron of kast (item)
  const stroomRef = useRef(null); stroomRef.current = stroom;
  const itemsRef = useRef(items); itemsRef.current = items; // voor werk dat even later loopt (na een wijziging)
  const [verleng, setVerleng] = useState(null); // { id, eind: true|false } een lijn verder tekenen vanaf een uiteinde (het plusje)
  useSluitBuiten(tekenMenu, () => setTekenMenu(false));
  const [hulp, setHulp] = useState([]); // hulplijnen bij kleven // [a, b] rechthoek-selectie met Shift
  const [draaiHoek, setDraaiHoek] = useState(null);
  const [vormZaal, setVormZaal] = useState(null); // zaal waarvan de vorm bewerkt wordt (enkel via de knop)
  const [dag, setDag] = useState(null); // gekozen dag (JJJJ-MM-DD) voor functies
  const [zonder, setZonder] = useState(false); // verder zonder grondplan
  const [huisForm, setHuisForm] = useState(null); // { naam, aantal, vorm, b, d, zit, basis }
  useSluitBuiten(menu, () => setMenu(false));

  const isDxf = onderlegger?.soort === 'dxf' && onderlegger.url;
  useEffect(() => {
    let weg = false; setD(null);
    if (!isDxf) return undefined;
    setLaden(true);
    laadDxf(onderlegger.url).then((x) => { if (!weg) setD(x); }).catch(() => setMelding('Grondplan niet te lezen.')).finally(() => !weg && setLaden(false));
    return () => { weg = true; };
  }, [onderlegger?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Een DXF heeft echte maten: de schaal ligt vast (passen op de kaart = enkel verschuiven en draaien).
  // Was het grondplan eerder verschaald, dan zetten we het terug op ware grootte.
  useEffect(() => {
    if (!d || d.vast || d.pdf || !onderlegger || !schrijven) return;
    const nat = Number(d.breedte) || 0;
    if (nat && (Number(onderlegger.natuur) !== nat || Math.abs((Number(onderlegger.breedte) || nat) / nat - 1) > 0.002)) {
      onOnderlegger({ natuur: nat, breedte: nat });
    }
  }, [d, onderlegger?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Host als vlak (tent, getekende zone): de omtrek is het startplan. Midden en richting van de host,
  // zodat een schuin geplaatste tent hier recht staat. Bestaande binnenplannen houden hun stelsel.
  // Element met een eigen tekening (truck met uitschuifdelen, unit): de echte binnenruimte, niet het omhullende kader.
  const hostVlak = useMemo(() => {
    if (host?.geometrie?.type !== 'Polygon') return null;
    const hel = host.element_id ? elementenMap?.get(host.element_id) : null;
    return (hel && binnenVorm(host, hel)) || host.geometrie;
  }, [host?.geometrie, host?.parameters, host?.element_id, elementenMap]); // eslint-disable-line react-hooks/exhaustive-deps
  // Wat de 'host' is, in woorden: tent, truck, unit, gebouw of zone (voor de knoppen en meldingen).
  const hostEl = host?.element_id ? elementenMap?.get(host.element_id) : null;
  const hostTekst = `${hostEl?.naam || ''} ${hostEl?.categorie || ''} ${hostEl?.eigenschappen?.subgroep || ''}`.toLowerCase();
  const hostWoord = host?.soort !== 'element' ? 'zone' : isTentBouw(hostEl) || /tent|pagode/.test(hostTekst) ? 'tent' : /truck|trailer|oplegger|vrachtwagen|portix/.test(hostTekst) ? 'truck' : /unit|container|cabine|kantoor/.test(hostTekst) ? 'unit' : 'gebouw';
  const heeftBinnen = items.some((x) => x.velden?.binnen?.host === host?.id && !x.velden?.ruimte); // ingericht (ruimtes alleen tellen niet)
  const terugMidden = host?.geometrie?.type === 'Point' ? host.geometrie.coordinates : host?.parameters?.midden || host?.velden?.binnenplan?.midden || (hostVlak && !heeftBinnen ? middenVan(hostVlak.coordinates[0]) : null);
  const terugRot = host?.velden?.binnenplan?.rot ?? (hostVlak && !heeftBinnen ? Number(host.parameters?.rot) || 0 : 0);
  const T = useMemo(() => planTransform(onderlegger, d, terugMidden, terugRot), [onderlegger?.midden?.[0], onderlegger?.midden?.[1], onderlegger?.rot, onderlegger?.breedte, onderlegger?.natuur, d, terugRot, terugMidden?.[0], terugMidden?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const hostRing = useMemo(() => (hostVlak && !onderlegger ? hostVlak.coordinates[0].map((c) => T.naarPlan(c).map(r3)) : null), [hostVlak, onderlegger, T]);
  const wachtOpPlan = isDxf && !d;

  // Lijnen, teksten en zalen van het grondplan in het lokale stelsel.
  const plan = useMemo(() => {
    if (!d) return { lijnen: [], teksten: [], zalen: [] };
    const sch = Number(onderlegger?.schaal) || 1;
    const naarL = d.vast ? (c) => T.naarPlan(c) : sch !== 1 ? ([x, y]) => [x * sch, y * sch] : (c) => c;
    const lijnen = (d.lijnen || []).map((l) => ({ laag: l.laag, c: l.c.map(naarL) }));
    const teksten = (d.teksten || []).map((t) => ({ ...t, p: naarL(t.p) }));
    const zalen = lijnen.filter((l) => ZAAL_LAAG.test(l.laag || '') && l.c.length >= 4).map((l) => {
      const c = [...l.c]; if (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1]) c.push(c[0]);
      const t = teksten.find((x) => binnenVeelhoek(x.p, c));
      return { ring: c, naam: t ? zaalNaam(t.t) : null };
    });
    return { lijnen, teksten, zalen };
  }, [d, T, onderlegger?.schaal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Items van deze verdieping, met hun lokale vorm.
  // Ruimtes gelden altijd; de inrichting volgt het gekozen moment (fase), zoals op de kaart.
  const vanVerd = useMemo(() => items.filter((x) => x.velden?.binnen?.host === host.id && (x.velden.binnen.verd || 'g') === verd && x.geometrie
    && (x.velden?.ruimte || !x.fase_ids?.length || (actieveFase ? x.fase_ids.includes(actieveFase) : !dag || x.fase_ids.some((id) => { const fz = fasen.find((f) => f.id === id); const a = fz?.van ? String(fz.van).slice(0, 10) : null; const b = fz?.tot ? String(fz.tot).slice(0, 10) : a; return !a || (dag >= a && dag <= b); })))), [items, host.id, verd, actieveFase, dag, fasen]);
  const lokaalVan = (it) => {
    if (voorlopig?.[it.id]) return voorlopig[it.id];
    const l = it.velden?.binnen?.lokaal;
    if (l?.geometrie) return l;
    const p = it.parameters || {};
    return {
      geometrie: mapG(it.geometrie, (c) => T.naarPlan(c).map(r3)),
      midden: p.midden ? T.naarPlan(p.midden).map(r3) : null,
      rot: p.rot != null ? ((((Number(p.rot) || 0) - T.rot) % 360) + 360) % 360 : null,
    };
  };
  const ruimtes = useMemo(() => vanVerd.filter((x) => x.velden?.ruimte), [vanVerd]);
  const inrichting = useMemo(() => vanVerd.filter((x) => !x.velden?.ruimte), [vanVerd]);

  // Lokale vorm → item op de kaart (geometrie en parameters in lng/lat, plus de lokale vorm).
  const naarItem = (lok, extra = {}) => {
    const g = mapG(lok.geometrie, (c) => T.naarGeo(c));
    const par = { ...(extra.parameters || {}) };
    if (lok.midden) par.midden = T.naarGeo(lok.midden);
    if (lok.rot != null) par.rot = r3((((lok.rot + T.rot) % 360) + 360) % 360);
    return { geometrie: g, parameters: par, lokaal: { geometrie: lok.geometrie, midden: lok.midden || null, rot: lok.rot ?? null } };
  };
  const bewaarLokaal = (it, lok) => {
    const n = naarItem(lok, { parameters: it.parameters });
    onWijzig(it.id, { geometrie: n.geometrie, parameters: n.parameters, velden: { ...(it.velden || {}), binnen: { ...it.velden.binnen, lokaal: n.lokaal } } });
  };

  // Eenmalig: ruimtes uit de zalen van het grondplan op hun juiste plek leggen (op naam), en
  // de lokale vorm van alle items vastleggen. Daarna kan het plan op de kaart verschuiven zonder dat iets loskomt.
  const gedaan = useRef('');
  useEffect(() => {
    if (!schrijven || wachtOpPlan) return;
    const sleutel = `${host.id}|${verd}|${onderlegger?.id || ''}|${d ? 1 : 0}`;
    if (gedaan.current === sleutel) return;
    if (d && !d.vast && !d.pdf && Math.abs((Number(onderlegger?.breedte) || d.breedte) / (d.breedte || 1) - 1) > 0.002) return; // eerst de schaal terugzetten
    gedaan.current = sleutel;
    const vrij = [...plan.zalen];
    for (const it of vanVerd) {
      if (it.velden?.binnen?.lokaal?.geometrie) continue;
      let lok = null;
      if (it.velden?.ruimte && it.naam) {
        const i = vrij.findIndex((z) => z.naam && z.naam.toLowerCase() === String(it.naam).toLowerCase());
        if (i >= 0) { lok = { geometrie: { type: 'Polygon', coordinates: [vrij[i].ring] }, midden: null, rot: null }; vrij.splice(i, 1); }
      }
      bewaarLokaal(it, lok || lokaalVan(it));
    }
    // Nog geen ruimtes op deze verdieping: de zalen van het grondplan meteen overnemen.
    if (!ruimtes.length && plan.zalen.length) zalenOvernemen();
    // Tent of zone zonder grondplan en nog niets ingericht: de omtrek wordt de ruimte (echte maten).
    // Ook een eerder met de hand getekende ruimte (vóór deze tent recht stond) krijgt eenmalig de tentvorm.
    if (hostRing && !onderlegger && !heeftBinnen && host.velden?.binnenplan?.rot == null && ruimtes.length <= 1) tentOvernemen();
    // Eerder overgenomen met het omhullende kader van een element (bv. truck met uitschuifdelen): nu de echte binnenruimte.
    else if (hostRing && !onderlegger && !heeftBinnen && ruimtes.length === 1 && hostVlak !== host.geometrie) {
      const a0 = oppervlakte(puntenVan(lokaalVan(ruimtes[0]).geometrie)); const a1 = oppervlakte(hostRing);
      const aK = oppervlakte(host.geometrie.coordinates[0].map((c) => T.naarPlan(c)));
      if (a1 < aK * 0.97 && Math.abs(a0 - aK) < aK * 0.02) tentOvernemen();
    }
  }, [d, plan, verd, onderlegger?.breedte, wachtOpPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Beeld ----------
  useEffect(() => {
    const el = svgRef.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setMaat({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setMaat({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const passend = () => {
    const delen = [...plan.lijnen.map((l) => l.c), ...(hostRing ? [hostRing] : []), ...vanVerd.map((it) => puntenVan(lokaalVan(it).geometrie))];
    const k = kaderVan(delen) || [-15, -10, 15, 10];
    const b = Math.max(6, k[2] - k[0]) * 1.08; const h = Math.max(4, k[3] - k[1]) * 1.08;
    setBeeld({ cx: (k[0] + k[2]) / 2, cy: (k[1] + k[3]) / 2, s: Math.min(maat.w / b, maat.h / h) });
  };
  useEffect(() => { if (!wachtOpPlan && maat.w > 0) passend(); }, [wachtOpPlan, verd, maat.w > 0, d]); // eslint-disable-line react-hooks/exhaustive-deps
  const B = beeld || { cx: 0, cy: 0, s: 20 };
  const naarScherm = ([x, y]) => [(x - B.cx) * B.s + maat.w / 2, (B.cy - y) * B.s + maat.h / 2];
  const naarWereld = (e) => { const r = svgRef.current.getBoundingClientRect(); return [B.cx + (e.clientX - r.left - maat.w / 2) / B.s, B.cy - (e.clientY - r.top - maat.h / 2) / B.s]; };
  const snap = ([x, y]) => [r3(Math.round(x / 0.05) * 0.05), r3(Math.round(y / 0.05) * 0.05)];
  const pad = (pts, dicht) => padW(pts, dicht); // tekenen gebeurt in meter, in de wereldgroep
  const wereldTf = `matrix(${B.s} 0 0 ${-B.s} ${maat.w / 2 - B.cx * B.s} ${maat.h / 2 + B.cy * B.s})`;
  useEffect(() => {
    const el = svgRef.current; if (!el) return undefined;
    const h = (e) => {
      e.preventDefault();
      const w = naarWereld(e); const f = Math.exp(-Math.max(-300, Math.min(300, e.deltaMode ? e.deltaY * 30 : e.deltaY)) * 0.0018);
      setBeeld((b) => { const bb = b || B; const s = Math.min(600, Math.max(0.5, bb.s * f)); return { s, cx: w[0] - (w[0] - bb.cx) * (bb.s / s), cy: w[1] - (w[1] - bb.cy) * (bb.s / s) }; });
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  });
  beeldRef.current = B; maatRef.current = maat;
  // Aanraken (deel-link op gsm/tablet): één vinger = verschuiven, twee vingers = zoomen, tikken = info.
  useEffect(() => {
    const el = svgRef.current; if (!el || schrijven) return undefined;
    const punt = (t) => { const r = el.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
    const wereld = (b, [x, y]) => { const m = maatRef.current; return [b.cx + (x - m.w / 2) / b.s, b.cy - (y - m.h / 2) / b.s]; };
    const twee = (l) => ({ m: [(l[0][0] + l[1][0]) / 2, (l[0][1] + l[1][1]) / 2], d: Math.hypot(l[0][0] - l[1][0], l[0][1] - l[1][1]) || 1 });
    const start = (e) => {
      e.preventDefault(); setZweefIt(null);
      const l = [...e.touches].map(punt); const b = beeldRef.current;
      if (l.length >= 2) { const { m, d } = twee(l); aanraak.current = { pinch: true, d0: d, w0: wereld(b, m), b0: b }; } else aanraak.current = { p0: l[0], b0: b, t0: Date.now(), bewogen: false };
    };
    const beweegT = (e) => {
      const a = aanraak.current; if (!a) return; e.preventDefault();
      const l = [...e.touches].map(punt); const m0 = maatRef.current;
      if (a.pinch && l.length >= 2) { const { m, d } = twee(l); const sc = Math.min(600, Math.max(0.5, (a.b0.s * d) / a.d0)); setBeeld({ s: sc, cx: a.w0[0] - (m[0] - m0.w / 2) / sc, cy: a.w0[1] + (m[1] - m0.h / 2) / sc }); return; }
      if (!a.pinch && l.length === 1) { const dx = l[0][0] - a.p0[0]; const dy = l[0][1] - a.p0[1]; if (Math.hypot(dx, dy) > 8) a.bewogen = true; if (a.bewogen) setBeeld({ ...a.b0, cx: a.b0.cx - dx / a.b0.s, cy: a.b0.cy + dy / a.b0.s }); }
    };
    const eind = (e) => {
      const a = aanraak.current; if (!a) return; e.preventDefault();
      if (e.touches.length) { const l = [...e.touches].map(punt); aanraak.current = { p0: l[0], b0: beeldRef.current, bewogen: true }; return; }
      aanraak.current = null;
      if (!a.pinch && !a.bewogen && Date.now() - a.t0 < 600) tikRef.current?.(wereld(a.b0, a.p0));
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchmove', beweegT, { passive: false });
    el.addEventListener('touchend', eind, { passive: false });
    el.addEventListener('touchcancel', eind, { passive: false });
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', beweegT); el.removeEventListener('touchend', eind); el.removeEventListener('touchcancel', eind); };
  }, [schrijven]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Raken en plaatsen ----------
  const raak = (w) => {
    let beste = null;
    for (const it of inrichting) {
      const g = lokaalVan(it).geometrie; const elw = elementenMap.get(it.element_id);
      // Vrij gebouwde frame-wand: raken op de frames zelf, niet op de ankerlijn.
      const wandSeg = elw && isWand(elw) && isVrij(it) && g.type === 'LineString' ? wandStukken(g.coordinates, it, elw).flatMap((f) => [f.a, f.e])
        : elw && isTrussBouw(it) && g.type === 'LineString' ? trussStukken(g.coordinates, it).flatMap((f) => (f.op ? [[f.a[0] - 0.15, f.a[1]], [f.a[0] + 0.15, f.a[1]]] : [f.a.slice(0, 2), f.e.slice(0, 2)])) : null;
      const c = wandSeg || puntenVan(g);
      let d2 = Infinity;
      if (g.type === 'Polygon' && binnenVeelhoek(w, c)) d2 = 0;
      else for (let i = 0; i < c.length - 1; i += wandSeg ? 2 : 1) {
        const [ax, ay] = c[i]; const [bx, by] = c[i + 1]; const dx = bx - ax; const dy = by - ay; const l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((w[0] - ax) * dx + (w[1] - ay) * dy) / l2));
        d2 = Math.min(d2, Math.hypot(ax + t * dx - w[0], ay + t * dy - w[1]));
      }
      if (g.type === 'Point') d2 = Math.hypot(c[0][0] - w[0], c[0][1] - w[1]);
      // Tekst: raken op het hele tekstvak (de tekst staat gecentreerd rond zijn punt, in schermpixels).
      if (it.soort === 'tekst' && g.type === 'Point') {
        const fs = Number(it.stijl?.tekstgrootte) || 13; const bw = ((it.naam || '').length * fs * 0.58 + 10) / 2 / B.s; const bh = (fs * 0.8) / B.s;
        if (Math.abs(w[0] - c[0][0]) <= bw && Math.abs(w[1] - c[0][1]) <= bh) d2 = 0;
      }
      if (d2 > 8 / B.s) continue;
      const k = kaderVan([c]); const opp = (k[2] - k[0]) * (k[3] - k[1]);
      if (!beste || opp < beste.opp) beste = { it, opp };
    }
    return beste?.it || null;
  };
  // Omtrek van een meubel (met stoelen) rond zijn midden.
  const voetMeubel = (mb, mid, rot) => { const mt = maatMeubel(mb); const o = draai([mt.dx, mt.dy], rot || 0); return rechthoek([mid[0] + o[0], mid[1] + o[1]], mt.b, mt.h, rot || 0); };
  // Deuren en ramen klikken in de dichtste muur (lijn van het grondplan of een getekende muur),
  // midden tussen de twee lijnen van een dubbele muur.
  const muren = useMemo(() => {
    const seg = [];
    for (const l of plan.lijnen) { if (ZAAL_LAAG.test(l.laag || '')) continue; for (let i = 0; i < l.c.length - 1; i++) seg.push([l.c[i], l.c[i + 1]]); }
    if (hostRing) for (let i = 0; i < hostRing.length - 1; i++) seg.push([hostRing[i], hostRing[i + 1]]);
    for (const it of inrichting) { const g = lokaalVan(it).geometrie; if (g.type === 'LineString') for (let i = 0; i < g.coordinates.length - 1; i++) seg.push([g.coordinates[i], g.coordinates[i + 1], Number(elementenMap.get(it.element_id)?.diepte_m) || 0.1]); }
    return seg.filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.3);
  }, [plan, inrichting, hostRing]); // eslint-disable-line react-hooks/exhaustive-deps
  const opMuur = (p, mb) => {
    let best = null;
    const max = Math.max(0.6, 24 / B.s);
    for (const sg of muren) {
      const [a, b] = sg; const dx = b[0] - a[0]; const dy = b[1] - a[1]; const L2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
      const q = [a[0] + t * dx, a[1] + t * dy]; const dd = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (dd < max && (!best || dd < best.dd)) best = { dd, q, a: Math.atan2(dy, dx), sg };
    }
    if (!best) return null;
    let mid = best.q; let dikte = best.sg[2] || null;
    if (!dikte) {
      // tweede lijn van dezelfde muur: evenwijdig, 5 tot 60 cm verder
      const nx = -Math.sin(best.a); const ny = Math.cos(best.a); let par = null;
      for (const sg of muren) {
        if (sg === best.sg) continue;
        const [a, b] = sg; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const df = Math.abs(((ang - best.a) % Math.PI + Math.PI) % Math.PI); if (Math.min(df, Math.PI - df) > 0.05) continue;
        const afst = (a[0] - best.q[0]) * nx + (a[1] - best.q[1]) * ny; if (Math.abs(afst) < 0.05 || Math.abs(afst) > 0.6) continue;
        const dx = b[0] - a[0]; const dy = b[1] - a[1]; const t = ((best.q[0] - a[0]) * dx + (best.q[1] - a[1]) * dy) / (dx * dx + dy * dy); if (t < -0.02 || t > 1.02) continue;
        if (!par || Math.abs(afst) < Math.abs(par)) par = afst;
      }
      if (par) { dikte = Math.abs(par); mid = [best.q[0] + (nx * par) / 2, best.q[1] + (ny * par) / 2]; }
    }
    return { midden: [r3(mid[0]), r3(mid[1])], rot: r3((-best.a * 180) / Math.PI), t: r3(dikte || Number(mb.t) || 0.2) };
  };
  const plaatsMeubel = (el, p) => {
    let mb = { ...el.meubel }; let mid = p; let rot = elRot;
    if (naarMuur(mb)) { const m = opMuur(p, mb); if (m) { mid = m.midden; rot = m.rot; mb = { ...mb, t: m.t }; } }
    const lok = { geometrie: { type: 'Polygon', coordinates: [voetMeubel(mb, mid, rot)] }, midden: mid, rot };
    const n = naarItem(lok);
    const huisEl = el.huisEl ? elementenMap.get(el.huisEl) : null;
    const it = onMaak({ soort: huisEl ? 'element' : 'vlak', element_id: huisEl?.id || null, naam: naamMeubel(mb), geometrie: n.geometrie, parameters: n.parameters, stijl: { kleur: '#57534E', vuldekking: 0.15 },
      velden: { meubel: mb, binnen: { host: host.id, verd, lokaal: n.lokaal, ...(huisEl ? { huis: true } : {}) } } });
    if (it) setSel([it.id]);
  };
  const bewaarMeubel = (it, mb, extra = {}) => {
    const l = lokaalVan(it);
    const lok = { geometrie: { type: 'Polygon', coordinates: [voetMeubel(mb, l.midden, l.rot)] }, midden: l.midden, rot: l.rot };
    const n = naarItem(lok, { parameters: it.parameters });
    const { binnen: bx, ...rest } = extra;
    onWijzig(it.id, { naam: naamMeubel(mb), geometrie: n.geometrie, parameters: n.parameters, ...rest, velden: { ...(it.velden || {}), meubel: mb, binnen: { ...it.velden.binnen, lokaal: n.lokaal, ...(bx || {}) } } });
  };
  // Andere tafel van het huis kiezen: vorm en maat volgen die tafel, de stoelen blijven.
  const kiesHuisTafel = (it, elId) => {
    const mb = it.velden.meubel; const e = elId ? elementenMap.get(elId) : null;
    const tpl = e?.eigenschappen?.meubel || (e?.eigenschappen?.tafel ? { type: 'tafel', ...e.eigenschappen.tafel } : null);
    const nieuw = tpl && tpl.type === 'tafel' ? { ...mb, statafel: tpl.statafel || undefined, vorm: tpl.vorm, b: Number(tpl.b) || mb.b, d: tpl.vorm === 'rond' ? Number(tpl.b) || mb.b : Number(tpl.d) || mb.d, ...((tpl.vorm === 'rechthoek') !== (mb.vorm === 'rechthoek') ? { stoelen: tpl.stoelen || autoStoelen({ ...mb, vorm: tpl.vorm, b: tpl.b, d: tpl.d }) } : {}) } : mb;
    bewaarMeubel(it, nieuw, { soort: e ? 'element' : 'vlak', element_id: e?.id || null, binnen: { huis: !!e } });
  };
  // Maat van een gewoon element aanpassen (breedte × diepte).
  const bewaarMaat = (it, b, dd) => {
    const l = lokaalVan(it); if (!l.midden || !(b > 0) || !(dd > 0)) return;
    const lok = { geometrie: { type: 'Polygon', coordinates: [rechthoek(l.midden, b, dd, l.rot || 0)] }, midden: l.midden, rot: l.rot };
    const n = naarItem(lok, { parameters: { ...(it.parameters || {}), breedte: b, diepte: dd } });
    onWijzig(it.id, { geometrie: n.geometrie, parameters: n.parameters, velden: { ...(it.velden || {}), binnen: { ...it.velden.binnen, lokaal: n.lokaal } } });
  };
  const plaats = (el, m) => {
    if (el.meubel) { plaatsMeubel(el, m); return; }
    const b = Number(el.breedte_m) || 1; const dd = Number(el.diepte_m) || 1;
    const lok = el.tekenwijze === 'punt' ? { geometrie: { type: 'Point', coordinates: m }, midden: m, rot: null } : { geometrie: { type: 'Polygon', coordinates: [rechthoek(m, b, dd, elRot)] }, midden: m, rot: elRot };
    const n = naarItem(lok, { parameters: el.tekenwijze === 'punt' ? {} : { breedte: b, diepte: dd } });
    const it = onMaak({ soort: 'element', element_id: el.id, geometrie: n.geometrie, parameters: n.parameters, velden: { binnen: { host: host.id, verd, lokaal: n.lokaal, ...(el.eigenschappen?.huis ? { huis: true } : {}) } } });
    if (it) setSel([it.id]);
  };
  const plaatsLijn = (el, pts0) => {
    const pts = pts0.filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.005); if (pts.length < 2) return; // dubbelklik = geen extra punt
    const lok = { geometrie: { type: 'LineString', coordinates: pts }, midden: null, rot: null };
    const n = naarItem(lok);
    const x = onMaak({ soort: 'element', element_id: el.id, geometrie: n.geometrie, parameters: {}, velden: { binnen: { host: host.id, verd, lokaal: n.lokaal } } });
    if (x) setSel([x.id]); // meteen de eigenschappen (bv. de frames van een frame-wand)
  };
  const verschuif = (lok, dx, dy) => ({ geometrie: mapG(lok.geometrie, ([x, y]) => [r3(x + dx), r3(y + dy)]), midden: lok.midden ? [r3(lok.midden[0] + dx), r3(lok.midden[1] + dy)] : null, rot: lok.rot });
  const gedraaid = (lok, g) => {
    const c = lok.midden || (() => { const k = kaderVan([puntenVan(lok.geometrie)]); return [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2]; })();
    return { geometrie: mapG(lok.geometrie, ([x, y]) => { const q = draai([x - c[0], y - c[1]], g); return [r3(c[0] + q[0]), r3(c[1] + q[1])]; }), midden: lok.midden, rot: lok.rot != null ? ((((lok.rot + g) % 360) + 360) % 360) : null };
  };
  const draaiSel = (g) => {
    if (kiesEl && !sel.length) { setElRot((r) => (((r + g) % 360) + 360) % 360); return; }
    for (const it of inrichting.filter((x) => sel.includes(x.id))) bewaarLokaal(it, gedraaid(lokaalVan(it), g));
  };
  // Ruimte aanklikken: de kleinste gesloten lijn van het grondplan rond de klik.
  const ruimteOp = (w) => {
    let beste = null;
    for (const l of plan.lijnen) {
      const c = l.c; if (c.length < 4) continue;
      const dicht = Math.hypot(c[0][0] - c[c.length - 1][0], c[0][1] - c[c.length - 1][1]) < 0.05;
      if (!dicht || !binnenVeelhoek(w, c)) continue;
      const a = oppervlakte(c); if (a < 2) continue;
      if (!beste || a < beste.a) beste = { c, a };
    }
    if (!beste) { setMelding('Hier ligt geen gesloten vorm in het grondplan.'); return; }
    const t = plan.teksten.find((x) => binnenVeelhoek(x.p, beste.c));
    const naam = window.prompt('Naam van de ruimte', t ? zaalNaam(t.t) : `Ruimte ${ruimtes.length + 1}`);
    if (naam == null) return;
    const n = naarItem({ geometrie: { type: 'Polygon', coordinates: [beste.c] }, midden: null, rot: null });
    onMaak({ soort: 'vlak', naam: naam || null, geometrie: n.geometrie, parameters: {}, stijl: { kleur: '#2563EB', vuldekking: 0.06, label: true }, velden: { ruimte: true, binnen: { host: host.id, verd, lokaal: n.lokaal } } });
  };
  // Tent of zone: de omtrek (echte maten) als ruimte; een bestaande ruimte krijgt die vorm.
  const tentOvernemen = () => {
    if (!hostRing) return;
    const g = naarItem({ geometrie: { type: 'Polygon', coordinates: [hostRing] }, midden: null, rot: null });
    const r = ruimtes[0];
    if (r) onWijzig(r.id, { geometrie: g.geometrie, velden: { ...(r.velden || {}), binnen: { ...r.velden.binnen, lokaal: g.lokaal } } });
    else onMaak({ soort: 'vlak', naam: host.naam || elementenMap.get(host.element_id)?.naam || 'Ruimte', geometrie: g.geometrie, parameters: {}, stijl: { kleur: '#2563EB', vuldekking: 0.06, label: true }, velden: { ruimte: true, binnen: { host: host.id, verd, lokaal: g.lokaal } } });
    if (host.velden?.binnenplan?.rot == null) onWijzig(host.id, { velden: { ...(host.velden || {}), binnenplan: { ...(host.velden?.binnenplan || {}), rot: terugRot, ...(host.parameters?.midden ? {} : { midden: terugMidden }) } } });
    setMelding(`Maten van de ${hostWoord} overgenomen.`);
  };
  const zalenOvernemen = () => {
    const bestaand = new Set(ruimtes.map((r) => String(r.naam || '').toLowerCase()));
    let n = 0;
    plan.zalen.forEach((z, i) => {
      const naam = z.naam || `Ruimte ${i + 1}`;
      if (bestaand.has(naam.toLowerCase())) return;
      const g = naarItem({ geometrie: { type: 'Polygon', coordinates: [z.ring] }, midden: null, rot: null });
      onMaak({ soort: 'vlak', naam, geometrie: g.geometrie, parameters: {}, stijl: { kleur: '#2563EB', vuldekking: 0.06, label: true }, velden: { ruimte: true, binnen: { host: host.id, verd, lokaal: g.lokaal } } });
      n += 1;
    });
    setMelding(n ? `${n} ${n === 1 ? 'ruimte' : 'ruimtes'} overgenomen.` : 'Alle ruimtes staan er al.');
  };

  // Meten, zaal tekenen (twee hoeken) en schaal zetten (twee punten + afstand).
  // Vrij tekenen: lijn en vlak (punten, dubbelklik of Enter = klaar), rechthoek (twee hoeken),
  // punt (met soort) en tekst. Daarna terug naar Selecteren met het nieuwe item geselecteerd.
  const TEKEN = { lijn: 'Lijn', pijl: 'Pijl', maat: 'Maatlijn', vlak: 'Vlak', rechthoek: 'Rechthoek', cirkel: 'Cirkel', tekst: 'Tekst' };
  const isTeken = (m) => !!m && (m in TEKEN || m.startsWith('punt:'));
  // Een stekkerblok is de stekkerdoos uit de bibliotheek: zo telt hij mee in de stroomplanning.
  const stekkerEl = elementen.find((e) => e.eigenschappen?.stekkerdoos) || null;
  const maakTeken = (soort, lok, extra = {}) => {
    const n = naarItem(lok);
    const metEl = soort === 'punt' && extra.velden?.punt?.type === 'stekker' && stekkerEl;
    // Stroominvoer = kast met één doorlus (stekker kies je in het paneel); vaste stroomaansluiting van het gebouw = bron.
    const pt = soort === 'punt' ? extra.velden?.punt?.type : null;
    const stroomV = pt === 'invoer' ? { stroom: { rol: 'kast', invoer: true } } : pt === 'stroom' ? { stroom: { rol: 'bron', cosphi: 1 } } : {};
    const x = onMaak({ soort: metEl ? 'element' : soort, ...(metEl ? { element_id: stekkerEl.id } : {}), naam: extra.naam || (pt === 'invoer' ? 'Stroominvoer' : pt === 'stroom' ? 'Stroomaansluiting gebouw' : null), geometrie: n.geometrie, parameters: n.parameters, stijl: { kleur: extra.kleur || '#1d1d1b', dikte: 2, vuldekking: 0.15, ...(extra.stijl || {}) }, velden: { ...(extra.velden || {}), ...stroomV, binnen: { host: host.id, verd, lokaal: n.lokaal, ...(extra.huis ? { huis: true } : {}) } } });
    setModus(null); setPunten([]); setGetypt('');
    if (x) setSel([x.id]);
  };
  // ---------- Stroom binnen ----------
  // Dezelfde boom als op de kaart (velden.stroom); een kabel binnen is een gewone lijn in dit plan.
  const sVan = (it) => stroomVan(it, it?.element_id ? elementenMap.get(it.element_id) : null);
  const isStroomItem = (it) => !!it && (!!sVan(it).rol || ['invoer', 'stroom'].includes(it.velden?.punt?.type));
  const middenLok = (it) => { const l = lokaalVan(it); if (l.midden) return l.midden; const c = puntenVan(l.geometrie); if (!c.length) return null; const k = kaderVan([c]); return [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2]; };
  const hierBinnen = (it) => it?.velden?.binnen?.host === host.id && (it.velden.binnen.verd || 'g') === verd;
  // Kabel van de voeding naar dit item: binnen als de voeding ook in dit plan staat, anders op de kaart
  // (van de generator buiten tot aan dit punt). alleenVoeding: enkel de kabel naar die voeding.
  const tekenKabelBinnen = (id, alleenVoeding = null) => {
    const alle = itemsRef.current;
    const it = alle.find((x) => x.id === id); if (!it) return;
    const sIt = sVan(it);
    const doelen = kabelDoelen(it, sIt).filter((d) => !alleenVoeding || d.voeding === alleenVoeding);
    let binnenN = 0; let buitenN = 0; let laatste = null;
    for (const d of doelen) {
      const bron = alle.find((x) => x.id === d.voeding);
      if (!bron || !hierBinnen(bron)) { buitenN += 1; onKabelBuiten?.(it.id, (x) => x.voeding === d.voeding); continue; }
      const a = middenLok(bron); const b = middenLok(it); if (!a || !b) continue;
      const type = kabelTypeVoor(it, sIt, d, stroomRef.current?.knopen?.get(d.voeding));
      const n = naarItem({ geometrie: { type: 'LineString', coordinates: [a, b] }, midden: null, rot: null });
      const x = onMaak({ soort: 'lijn', naam: `Kabel ${bron.naam || elementenMap.get(bron.element_id)?.naam || 'voeding'} → ${it.naam || elementenMap.get(it.element_id)?.naam || 'verbruiker'}${d.label ? ` (${d.label})` : ''}`.slice(0, 80),
        geometrie: n.geometrie, parameters: {}, stijl: { kleur: KABEL_KLEUR[kabelSpanning(type, { s: { fase: d.fase } })], dikte: 3, streep: 'streep' },
        velden: { stroom: { rol: 'kabel', van: bron.id, naar: d.naar, kabeltype: type }, binnen: { host: host.id, verd, lokaal: n.lokaal } } });
      if (x) { laatste = x; binnenN += 1; }
    }
    if (laatste) setSel([laatste.id]);
    setMelding([binnenN ? `${binnenN === 1 ? 'Kabel' : `${binnenN} kabels`} getekend: versleep de hoekpunten langs de juiste weg.` : null, buitenN ? `${buitenN === 1 ? 'De kabel van buiten staat' : `${buitenN} kabels van buiten staan`} op de kaart (werkruimte Stroom).` : null].filter(Boolean).join(' ') || 'Geen voeding gekozen.');
  };
  // Kabelgereedschap: klik de bron, kast of stekkerdoos, dan de verbruiker of kast.
  const kabelKlik = (w) => {
    const it = raak(w);
    const sv = it ? sVan(it) : null;
    if (!it || !sv?.rol || sv.rol === 'kabel') { setMelding(kabelVan ? 'Klik een kast, stekkerdoos of verbruiker om de kabel te eindigen.' : 'Klik een bron, kast, stekkerdoos of de stroominvoer om de kabel te starten.'); return; }
    const naam = it.naam || elementenMap.get(it.element_id)?.naam || PUNT[it.velden?.punt?.type]?.naam || 'item';
    if (!kabelVan) {
      if (!['bron', 'kast'].includes(sv.rol)) { setMelding('Begin bij een bron, kast, stekkerdoos of de stroominvoer.'); return; }
      setKabelVan(it); setMelding(`Kabel vanaf ${naam}: klik nu de verbruiker, kast of stekkerdoos.`); return;
    }
    if (it.id === kabelVan.id) return;
    if (!['kast', 'verbruiker'].includes(sv.rol)) { setMelding('Eindig bij een kast, stekkerdoos of verbruiker.'); return; }
    const { stroom: sNieuw, welke } = koppelVoeding(it, sv, kabelVan.id);
    onWijzig(it.id, { velden: { ...(it.velden || {}), stroom: sNieuw } });
    const vanId = kabelVan.id; const vanNaam = kabelVan.naam || elementenMap.get(kabelVan.element_id)?.naam || PUNT[kabelVan.velden?.punt?.type]?.naam || 'de voeding';
    // Even wachten tot de berekening de uitgang heeft toegewezen, dan de kabel in het juiste type.
    setTimeout(() => { tekenKabelBinnen(it.id, vanId); setMelding((m) => `${naam}${welke} aangesloten op ${vanNaam}. ${m || ''}`.trim()); }, 80);
    setKabelVan(null); setModus(null);
  };
  useEffect(() => { if (modus !== 'kabel' && kabelVan) setKabelVan(null); }, [modus]); // eslint-disable-line react-hooks/exhaustive-deps

  const tekenKlik = async (p, dubbel) => {
    if (modus.startsWith('punt:')) { const t = PUNT[modus.slice(5)] || PUNT.punt; maakTeken('punt', { geometrie: { type: 'Point', coordinates: p }, midden: p, rot: null }, { kleur: t.kleur, velden: { punt: { type: t.k } }, huis: t.vast }); return; }
    if (modus === 'tekst') { const t = await vraagTekst('Tekst', ''); if (t) maakTeken('tekst', { geometrie: { type: 'Point', coordinates: p }, midden: p, rot: null }, { naam: t }); else setModus(null); return; }
    if (modus === 'cirkel') {
      if (!punten.length) { setPunten([p]); return; }
      const a = punten[0]; const r = Math.hypot(p[0] - a[0], p[1] - a[1]); if (r < 0.05) return;
      const ring = Array.from({ length: 37 }, (_, i) => { const t = (i / 36) * 2 * Math.PI; return [r3(a[0] + Math.cos(t) * r), r3(a[1] + Math.sin(t) * r)]; });
      maakTeken('vlak', { geometrie: { type: 'Polygon', coordinates: [ring] }, midden: null, rot: null }, { kleur: '#2563EB', stijl: { cirkel: { m: a, r: r3(r) } } }); return;
    }
    if (modus === 'maat') {
      if (!punten.length) { setPunten([p]); return; }
      const a = punten[0]; if (Math.hypot(p[0] - a[0], p[1] - a[1]) < 0.05) return;
      maakTeken('lijn', { geometrie: { type: 'LineString', coordinates: [a, p] }, midden: null, rot: null }, { kleur: '#1d1d1b', stijl: { dikte: 1, maat: true, pijl: 'beide' } }); return;
    }
    if (modus === 'rechthoek') {
      if (!punten.length) { setPunten([p]); return; }
      const a = punten[0]; if (Math.abs(a[0] - p[0]) < 0.05 || Math.abs(a[1] - p[1]) < 0.05) return;
      maakTeken('vlak', { geometrie: { type: 'Polygon', coordinates: [[[a[0], a[1]], [p[0], a[1]], [p[0], p[1]], [a[0], p[1]], [a[0], a[1]]]] }, midden: null, rot: null }, { kleur: '#2563EB' }); return;
    }
    const n = dubbel ? punten : [...punten, p];
    if (!dubbel) { setPunten(n); return; }
    afmaken(n);
  };
  const afmaken = (n) => {
    if ((modus === 'lijn' || modus === 'pijl') && n.length >= 2) maakTeken('lijn', { geometrie: { type: 'LineString', coordinates: n }, midden: null, rot: null }, modus === 'pijl' ? { stijl: { pijl: 'eind', dikte: 3 } } : {});
    else if (modus === 'vlak' && n.length >= 3) maakTeken('vlak', { geometrie: { type: 'Polygon', coordinates: [[...n, n[0]]] }, midden: null, rot: null }, { kleur: '#2563EB' });
    else { setModus(null); setPunten([]); }
  };
  const klikModus = async (p) => {
    const n = [...punten, p];
    if (n.length < 2) { setPunten(n); if (modus === 'meet') setMeting(null); return; }
    setPunten([]);
    const [a, b] = n;
    if (modus === 'meet') { setMeting([a, b]); return; }
    if (modus === 'zaal') {
      setModus(null);
      if (Math.abs(a[0] - b[0]) < 0.5 || Math.abs(a[1] - b[1]) < 0.5) { setMelding('Te klein voor een ruimte.'); return; }
      const naam = await vraagTekst('Naam van de ruimte', `Ruimte ${ruimtes.length + 1}`); if (naam == null) return;
      const ring = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]];
      const g = naarItem({ geometrie: { type: 'Polygon', coordinates: [ring] }, midden: null, rot: null });
      onMaak({ soort: 'vlak', naam: naam || null, geometrie: g.geometrie, parameters: {}, stijl: { kleur: '#2563EB', vuldekking: 0.06, label: true }, velden: { ruimte: true, binnen: { host: host.id, verd, lokaal: g.lokaal } } });
      return;
    }
    if (modus === 'schaal') {
      setModus(null);
      const gemeten = Math.hypot(b[0] - a[0], b[1] - a[1]); if (gemeten < 0.01) return;
      const t = await vraagTekst(`Hoeveel meter is dit in werkelijkheid? (nu ${getal(gemeten, 2)} m)`, ''); if (!t) return;
      const echt = Number(String(t).replace(',', '.')); if (!(echt > 0)) { setMelding('Geef een afstand in meter.'); return; }
      const f = echt / gemeten;
      if (d?.pdf) onOnderlegger({ schaal: r3((Number(onderlegger.schaal) || 1) * f * 1000) / 1000, breedte: (Number(onderlegger.breedte) || 1) * f, geschaald: true });
      else onOnderlegger({ breedte: (Number(onderlegger.breedte) || 50) * f, geschaald: true });
      // Ruimtes schalen mee; ingerichte items schuiven mee maar houden hun maat.
      for (const r of ruimtes) { const l = lokaalVan(r); bewaarLokaal(r, { ...l, geometrie: mapG(l.geometrie, ([x, y]) => [r3(x * f), r3(y * f)]) }); }
      for (const it of inrichting) { const l = lokaalVan(it); const c = l.midden || puntenVan(l.geometrie)[0]; bewaarLokaal(it, verschuif(l, c[0] * (f - 1), c[1] * (f - 1))); }
      setMelding(`Schaal aangepast (× ${getal(f, 3)}).`);
      setTimeout(passend, 50);
    }
  };
  useEffect(() => { if (vormZaal && vormZaal !== actieveRuimte && !sel.includes(vormZaal)) setVormZaal(null); }, [actieveRuimte, sel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (kiesEl) setVormZaal(null); else setAfst([]); }, [kiesEl]);
  useEffect(() => { if (verleng && !sel.includes(verleng.id)) setVerleng(null); }, [sel.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  // Eén lijn gekozen (nadar, paaltje met trekband, getekende lijn …): de hoekpunten meteen verslepen, zonder extra knop.
  // Meer gekozen: geen hoekpunten, wel de draaigreep van de hele selectie.
  useEffect(() => {
    if (sel.length > 1 && vormZaal && !ruimtes.some((r) => r.id === vormZaal)) { setVormZaal(null); return; }
    if (sel.length !== 1 || kiesEl || modus) return;
    const it = inrichting.find((x) => x.id === sel[0]); if (!it) return;
    const el = it.element_id ? elementenMap.get(it.element_id) : null;
    const gt = lokaalVan(it).geometrie?.type;
    if ((gt !== 'LineString' && !(gt === 'Polygon' && getekend(it))) || isTrussBouw(it) || (el && isWand(el) && isVrij(it))) return;
    if (el && el.tekenwijze !== 'lijn') return;
    setVormZaal(it.id);
  }, [sel.join(','), kiesEl, modus]); // eslint-disable-line react-hooks/exhaustive-deps
  const startModus = (m) => { setGetypt(''); setMelding(''); setModus((x) => (x === m ? null : m)); setPunten([]); setMeting(null); setKiesEl(null); setRuimteKlik(false); setSel([]); };
  // Rij maken: raster uit het geselecteerde item (kolommen langs de breedte, rijen langs de diepte).
  const rijMaken = ({ kol, rij, tussen }) => {
    const it = inrichting.find((x) => x.id === sel[0]); if (!it) return;
    const el = elementenMap.get(it.element_id); const l = lokaalVan(it); if (!l.midden) return;
    const mt = it.velden?.meubel ? maatMeubel(it.velden.meubel) : null;
    const b = mt?.b || Number(it.parameters?.breedte) || Number(el?.breedte_m) || 1; const dd = mt?.h || Number(it.parameters?.diepte) || Number(el?.diepte_m) || 1;
    const { id, created_at, updated_at, rev, ...rest } = it;
    for (let j = 0; j < rij; j++) for (let i = 0; i < kol; i++) {
      if (!i && !j) continue;
      const o = draai([i * (b + tussen), -j * (dd + tussen)], Number(l.rot) || 0);
      const n = naarItem(verschuif(l, o[0], o[1]), { parameters: it.parameters });
      onMaak({ ...rest, geometrie: n.geometrie, parameters: n.parameters, velden: { ...it.velden, binnen: { ...it.velden.binnen, lokaal: n.lokaal } } });
    }
    setRijVorm(null);
    setMelding(`${kol * rij - 1} items bijgezet.`);
  };
  // Kopie van items met een verschuiving (lokaal); geeft de nieuwe ids terug.
  const klembord = useRef(null);
  const maakKopie = (lijst, dx, dy) => {
    const nieuw = [];
    for (const { it, lok } of lijst) {
      const n = naarItem(verschuif(lok, dx, dy), { parameters: it.parameters });
      const { id, created_at, updated_at, rev, ...rest } = it;
      const x = onMaak({ ...rest, geometrie: n.geometrie, parameters: n.parameters, velden: { ...it.velden, binnen: { ...it.velden.binnen, verd, lokaal: n.lokaal } } });
      if (x) nieuw.push(x.id);
    }
    return nieuw;
  };
  const kopieer = (knip = false) => {
    const lijst = inrichting.filter((x) => sel.includes(x.id)).map((it) => ({ it, lok: lokaalVan(it) }));
    if (!lijst.length) return;
    const k = kaderVan(lijst.map((x) => puntenVan(x.lok.geometrie)));
    klembord.current = { lijst, midden: [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2], keer: 0 };
    if (knip) { onVerwijder(sel); setSel([]); }
    setMelding(`${lijst.length} ${lijst.length === 1 ? 'item' : 'items'} ${knip ? 'geknipt' : 'gekopieerd'} · Ctrl V om te plakken`);
  };
  const plak = () => {
    const kb = klembord.current; if (!kb) return;
    kb.keer += 1;
    const doel = muis || [kb.midden[0] + 0.5 * kb.keer, kb.midden[1] - 0.5 * kb.keer];
    const ids = maakKopie(kb.lijst, r3(doel[0] - kb.midden[0]), r3(doel[1] - kb.midden[1]));
    setSel(ids); setMelding('');
  };
  const draaiOm = (lok, c, g) => ({
    geometrie: mapG(lok.geometrie, ([x, y]) => { const q = draai([x - c[0], y - c[1]], g); return [r3(c[0] + q[0]), r3(c[1] + q[1])]; }),
    midden: lok.midden ? (() => { const q = draai([lok.midden[0] - c[0], lok.midden[1] - c[1]], g); return [r3(c[0] + q[0]), r3(c[1] + q[1])]; })() : null,
    rot: lok.rot != null ? ((((lok.rot + g) % 360) + 360) % 360) : lok.rot,
  });
  // Draaigreep boven de selectie (zoals op de kaart): midden en schermpositie van de greep.
  const draaiGreep = () => {
    if (!schrijven || kiesEl || modus || !sel.length || (vormZaal && sel.length === 1)) return null;
    const lijst = inrichting.filter((x) => sel.includes(x.id)); if (!lijst.length) return null;
    const loks = lijst.map((x) => (voorlopig?.[x.id] || lokaalVan(x)));
    if (lijst.length === 1 && loks[0].geometrie.type === 'Point') return null; // een punt of tekst alleen: niets te draaien
    if (lijst.length === 1 && loks[0].midden) {
      const l = loks[0]; const ring = puntenVan(l.geometrie);
      const hh = Math.max(...ring.map(([x, y]) => -((x - l.midden[0]) * Math.sin((-(l.rot || 0) * Math.PI) / 180)) + (y - l.midden[1]) * Math.cos((-(l.rot || 0) * Math.PI) / 180)));
      const op = draai([0, hh], l.rot || 0); const [sx, sy] = naarScherm([l.midden[0] + op[0], l.midden[1] + op[1]]); const [cx, cy] = naarScherm(l.midden);
      const d = Math.hypot(sx - cx, sy - cy) || 1; const ux = (sx - cx) / d; const uy = (sy - cy) / d;
      return { c: l.midden, rand: [sx, sy], greep: [sx + ux * 22, sy + uy * 22], rot: l.rot || 0 };
    }
    const k = kaderVan(loks.map((l) => puntenVan(l.geometrie))); const c = [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2];
    const [sx, sy0] = naarScherm([c[0], k[3]]); const sy = sy0 - 6;
    return { c, rand: [sx, sy], greep: [sx, sy - 24], rot: 0, kader: [naarScherm([k[0], k[3]]), naarScherm([k[2], k[1]])] };
  };
  const dupliceer = () => {
    for (const it of inrichting.filter((x) => sel.includes(x.id))) {
      const n = naarItem(verschuif(lokaalVan(it), 0.5, -0.5), { parameters: it.parameters });
      const { id, created_at, updated_at, rev, ...rest } = it;
      onMaak({ ...rest, geometrie: n.geometrie, parameters: n.parameters, velden: { ...it.velden, binnen: { ...it.velden.binnen, lokaal: n.lokaal } } });
    }
  };
  // Functie van een zaal op het gekozen moment: per fase, per datum of altijd.
  const faseNu = actieveFase ? fasen.find((f) => f.id === actieveFase) : null;
  // Een dag (JJJJ-MM-DD) of een fase valt binnen een functie?
  const dagVan = (v) => (v ? String(v).slice(0, 10) : null);
  const inBereik = (f, a, b) => { const fa = dagVan(f.van) || '0000'; const fb = dagVan(f.tot) || dagVan(f.van) || '9999'; return fa <= (b || a) && a <= fb; };
  const faseOp = (fz) => [dagVan(fz?.van), dagVan(fz?.tot) || dagVan(fz?.van)];
  // Functies van een zaal op het gekozen moment (fase of dag); zonder moment: alle.
  const functiesNu = (r) => {
    const lijst = (r.velden?.functies || []).filter((f) => f.naam);
    if (!faseNu && !dag) return lijst;
    const altijd = lijst.filter((f) => !f.fase_id && !f.van && !f.tot);
    const nu = lijst.filter((f) => {
      if (f.fase_id) { if (faseNu) return f.fase_id === faseNu.id; const fz = fasen.find((x) => x.id === f.fase_id); const [a, b] = faseOp(fz); return a && dag >= a && dag <= b; }
      if (!f.van && !f.tot) return false;
      if (dag) return inBereik(f, dag);
      const [a, b] = faseOp(faseNu); return a && inBereik(f, a, b);
    });
    return nu.length ? nu : altijd;
  };
  const functieNu = (r) => functiesNu(r)[0] || null;
  const functieTekst = (r) => { const l = functiesNu(r); return l.length > 2 ? `${l[0].naam} +${l.length - 1}` : l.map((f) => f.naam).join(' / '); };
  // Dagen waarop een functie wijzigt (voor de momentkeuze).
  const dagen = useMemo(() => {
    const set = new Set();
    for (const r of items) if (r.velden?.ruimte && r.velden?.binnen?.host === host.id) for (const f of r.velden.functies || []) {
      const a = dagVan(f.van); const b = dagVan(f.tot) || a; if (!a) continue;
      for (let d = new Date(`${a}T12:00`), n = 0; d <= new Date(`${b}T12:00`) && n < 31; d.setDate(d.getDate() + 1), n++) set.add(d.toISOString().slice(0, 10));
    }
    return [...set].sort();
  }, [items, host.id]);
  // Kleven: randen en middens van een kader vangen op die van andere items (binnen 8 px),
  // zodat tafels netjes tegen elkaar of op één lijn komen. Ctrl = vrij.
  const kaderLok = (ring) => kaderVan([ring]);
  const kleef = (k, uit) => {
    const tol = 8 / B.s; let bx = null; let by = null;
    const xs = [k[0], (k[0] + k[2]) / 2, k[2]]; const ys = [k[1], (k[1] + k[3]) / 2, k[3]];
    for (const it of inrichting) {
      if (uit.has(it.id)) continue;
      const g = (voorlopig?.[it.id] || lokaalVan(it)).geometrie; if (g.type === 'Point') continue;
      const o = kaderLok(puntenVan(g)); if (!o) continue;
      // enkel buren in de buurt (anders kleeft alles aan alles)
      if (o[0] > k[2] + 3 || o[2] < k[0] - 3 || o[1] > k[3] + 3 || o[3] < k[1] - 3) continue;
      const ox = [o[0], (o[0] + o[2]) / 2, o[2]]; const oy = [o[1], (o[1] + o[3]) / 2, o[3]];
      for (const a of xs) for (const b of ox) { const d = b - a; if (Math.abs(d) < tol && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, x: b }; }
      for (const a of ys) for (const b of oy) { const d = b - a; if (Math.abs(d) < tol && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, y: b }; }
    }
    return { dx: bx?.d || 0, dy: by?.d || 0, hulp: [...(bx ? [{ x: bx.x }] : []), ...(by ? [{ y: by.y }] : [])] };
  };
  // Kader van wat je gaat plaatsen (voorbeeld onder de muis).
  const plaatsKader = (el, m) => {
    if (el.meubel) { if (naarMuur(el.meubel)) return null; return kaderLok(voetMeubel(el.meubel, m, elRot)); }
    if (el.tekenwijze === 'punt' || el.tekenwijze === 'lijn') return null;
    return kaderLok(rechthoek(m, Number(el.breedte_m) || 1, Number(el.diepte_m) || 1, elRot));
  };
  const plaatsPunt = useRef(null);
  // Kleinste zaal rond een punt.
  tikRef.current = (w) => { const it = raak(w); setGebouwKaart(false); setLijstOpen(false); if (it) { setSel([it.id]); setActieveRuimte(null); return; } setSel([]); setActieveRuimte(ruimteBij(w)?.id || null); };
  const ruimteBij = (w) => { let best = null; for (const r of ruimtes) { const ring = puntenVan(lokaalVan(r).geometrie); if (!binnenVeelhoek(w, ring)) continue; const a = oppervlakte(ring); if (!best || a < best.a) best = { r, a }; } return best?.r || null; };
  // Hoekpunt vangen op een hoekpunt van het grondplan (binnen 10 px), anders het raster.
  const vangPunt = (w, p) => {
    const max = 10 / B.s; let best = null;
    for (const l of plan.lijnen) for (const c of l.c) { const d0 = Math.abs(c[0] - w[0]) + Math.abs(c[1] - w[1]); if (d0 < max * 1.5 && (!best || d0 < best.d)) best = { d: d0, c }; }
    return best ? [r3(best.c[0]), r3(best.c[1])] : p;
  };
  // Vangen bij tekenen en meten: hoekpunten (grondplan, tent, zalen, items) binnen 10 px, anders een rand
  // (tentwand, zaal, muur) binnen 7 px, anders het raster van 5 cm.
  const [vangAan, setVangAan] = useState(null);
  const vangTeken = (w) => {
    const max = 10 / B.s; let best = null;
    const hoek = (c) => { const d0 = Math.hypot(c[0] - w[0], c[1] - w[1]); if (d0 < max && (!best || d0 < best.d)) best = { d: d0, c }; };
    for (const l of plan.lijnen) for (const c of l.c) hoek(c);
    if (hostRing) for (const c of hostRing) hoek(c);
    for (const rz of ruimtes) for (const c of puntenVan(lokaalVan(rz).geometrie)) hoek(c);
    for (const it of inrichting) { const g = lokaalVan(it).geometrie; if (g.type !== 'Point') for (const c of puntenVan(g)) hoek(c); }
    if (best) return { p: [r3(best.c[0]), r3(best.c[1])], soort: 'hoek' };
    const randen = [...(hostRing ? [hostRing] : []), ...ruimtes.map((rz) => puntenVan(lokaalVan(rz).geometrie)), ...plan.lijnen.map((l) => l.c)];
    let rb = null; const max2 = 7 / B.s;
    for (const c of randen) for (let i = 0; i < c.length - 1; i++) {
      const [ax, ay] = c[i]; const [bx, by] = c[i + 1]; const dx = bx - ax; const dy = by - ay; const l2 = dx * dx + dy * dy; if (l2 < 1e-9) continue;
      const t = Math.max(0, Math.min(1, ((w[0] - ax) * dx + (w[1] - ay) * dy) / l2)); const q = [ax + t * dx, ay + t * dy]; const d0 = Math.hypot(q[0] - w[0], q[1] - w[1]);
      if (d0 < max2 && (!rb || d0 < rb.d)) rb = { d: d0, q };
    }
    if (rb) return { p: [r3(rb.q[0]), r3(rb.q[1])], soort: 'rand' };
    return { p: snap(w), soort: null };
  };
  const tekenVangt = () => isTeken(modus) || modus === 'meet' || modus === 'zaal';
  // Getypte lengte tijdens het tekenen: het volgende punt op die afstand, in de richting van de muis.
  const [getypt, setGetypt] = useState('');
  const getyptPunt = () => {
    const L = parseFloat(String(getypt).replace(',', '.')); if (!(L > 0) || !punten.length) return null;
    const a = punten[punten.length - 1]; const m = muis || [a[0] + 1, a[1]]; let dx = m[0] - a[0]; let dy = m[1] - a[1]; const d0 = Math.hypot(dx, dy);
    if (d0 < 1e-6) { dx = 1; dy = 0; } else { dx /= d0; dy /= d0; }
    return [r3(a[0] + dx * L), r3(a[1] + dy * L)];
  };

  // Plusjes aan de uiteinden van de gekozen lijn: klik = de lijn verder tekenen vanaf dat einde.
  const plusjes = () => {
    if (!schrijven || !vormIt || kiesEl || modus || verleng) return [];
    const g0 = lokaalVan(vormIt).geometrie; if (g0.type !== 'LineString' || g0.coordinates.length < 2) return [];
    const c = g0.coordinates; const n = c.length;
    const plek = (a, b) => { const [x1, y1] = naarScherm(b); const [x0, y0] = naarScherm(a); const d = Math.hypot(x1 - x0, y1 - y0) || 1; return [x1 + ((x1 - x0) / d) * 18, y1 + ((y1 - y0) / d) * 18]; };
    return [{ eind: true, p: plek(c[n - 2], c[n - 1]), van: naarScherm(c[n - 1]) }, { eind: false, p: plek(c[1], c[0]), van: naarScherm(c[0]) }];
  };
  const verlengKlik = (p, dubbel) => {
    const it = inrichting.find((x) => x.id === verleng.id); if (!it) { setVerleng(null); return; }
    if (dubbel) { setVerleng(null); return; }
    const l = lokaalVan(it); const c = l.geometrie.coordinates; const laatste = verleng.eind ? c[c.length - 1] : c[0];
    if (Math.hypot(p[0] - laatste[0], p[1] - laatste[1]) < 0.02) return;
    const nc = verleng.eind ? [...c, p] : [p, ...c];
    bewaarLokaal(it, { ...l, geometrie: { type: 'LineString', coordinates: nc } });
  };
  const omlaag = (e) => {
    if (e.button === 1 || e.button === 2) { sleep.current = { pan: true, x: e.clientX, y: e.clientY, b: B }; return; }
    if (e.button !== 0) return;
    const w = naarWereld(e); const vg = tekenVangt() ? vangTeken(w) : null; const p = hoekVang(vg ? vg.p : snap(w), e);
    if (verleng) { verlengKlik(p, e.detail >= 2); return; }
    { const [mx, my] = naarScherm(w); const pl = plusjes().find((x) => Math.hypot(x.p[0] - mx, x.p[1] - my) < 10); if (pl) { setVerleng({ id: vormIt.id, eind: pl.eind }); return; } }
    if (ruimteKlik) { ruimteOp(w); return; }
    if (isTeken(modus) && schrijven) { tekenKlik(p, e.detail >= 2 && (modus === 'lijn' || modus === 'vlak' || modus === 'pijl')); return; }
    if (modus === 'kabel' && schrijven) { kabelKlik(w); return; }
    if (modus) { klikModus(modus === 'meet' ? w : p); return; }
    if (kiesEl && schrijven) {
      if (kiesEl.tekenwijze === 'lijn') { if (e.detail >= 2) { if (lijn?.length >= 2) plaatsLijn(kiesEl, lijn); setLijn(null); if (!e.shiftKey) setKiesEl(null); return; } setLijn((l) => [...(l || []), p]); return; }
      // Eén keer plaatsen en terug naar selecteren (het nieuwe item is geselecteerd); Shift = nog eens.
      plaats(kiesEl, plaatsPunt.current || p); plaatsPunt.current = null; setHulp([]); if (!e.shiftKey) setKiesEl(null); return;
    }
    // Hoekpunt of middenpunt van de gekozen zaal vastnemen.
    if (schrijven && vormIt) {
      // Hoekpunten van een zaal of een getekende lijn/vlak: slepen, middenpunt = punt erbij, dubbelklik = weg.
      const g0 = lokaalVan(vormIt).geometrie; const open = g0.type === 'LineString'; const ring = puntenVan(g0); const [mx, my] = naarScherm(w);
      const geo2 = (r) => (open ? { type: 'LineString', coordinates: r } : { type: 'Polygon', coordinates: [r] });
      const nHoek = open ? ring.length : ring.length - 1;
      for (let i = 0; i < nHoek; i++) { const [x, y] = naarScherm(ring[i]); if (Math.hypot(x - mx, y - my) < 8) { if (e.detail >= 2 && nHoek > (open ? 2 : 3)) { const r = (open ? ring : ring.slice(0, -1)).filter((_, j) => j !== i); bewaarLokaal(vormIt, { ...lokaalVan(vormIt), geometrie: geo2(open ? r : [...r, r[0]]) }); return; } sleep.current = { hoek: i, ring, open }; return; } }
      for (let i = 0; i < ring.length - 1; i++) { const m = [(ring[i][0] + ring[i + 1][0]) / 2, (ring[i][1] + ring[i + 1][1]) / 2]; const [x, y] = naarScherm(m); if (Math.hypot(x - mx, y - my) < 7) { const r = [...ring.slice(0, i + 1), m, ...ring.slice(i + 1)]; sleep.current = { hoek: i + 1, ring: r, open }; setVoorlopig({ [vormIt.id]: { ...lokaalVan(vormIt), geometrie: geo2(r) } }); return; } }
    }
    const dg = draaiGreep();
    if (dg) { const [mx, my] = naarScherm(w); if (Math.hypot(dg.greep[0] - mx, dg.greep[1] - my) < 10) { sleep.current = { draai: true, c: dg.c, a0: Math.atan2(w[1] - dg.c[1], w[0] - dg.c[0]), ids: sel, orig: Object.fromEntries(inrichting.filter((x) => sel.includes(x.id)).map((x) => [x.id, lokaalVan(x)])), bewogen: false }; return; } }
    const it = raak(w);
    if (it && !schrijven) { setSel([it.id]); setActieveRuimte(null); return; } // alleen bekijken: aanklikken toont de info
    if (!it) {
      if (e.shiftKey && schrijven) { sleep.current = { kader: w, tot: w, bij: sel }; return; }
      setSel([]); sleep.current = { pan: true, x: e.clientX, y: e.clientY, b: B, klik: w }; return;
    }
    let ids = e.shiftKey ? (sel.includes(it.id) ? sel.filter((x) => x !== it.id) : [...sel, it.id]) : (sel.includes(it.id) ? sel : [it.id]);
    const orig0 = Object.fromEntries(inrichting.filter((x) => ids.includes(x.id)).map((x) => [x.id, lokaalVan(x)]));
    let orig = orig0;
    // Alt + slepen = kopie slepen (zoals op de kaart).
    if (e.altKey && !e.shiftKey) {
      const lijst = inrichting.filter((x) => ids.includes(x.id)).map((x) => ({ it: x, lok: orig0[x.id] }));
      const nieuw = maakKopie(lijst, 0, 0);
      orig = Object.fromEntries(nieuw.map((id, i) => [id, lijst[i].lok])); ids = nieuw;
    }
    setSel(ids);
    sleep.current = { ids, van: p, orig, bewogen: false, kopie: e.altKey };
  };
  // Tekenen: Shift = per 45° vanaf het vorige punt.
  const hoekVang = (p, e) => {
    if (e?.shiftKey && verleng) { const it = inrichting.find((x) => x.id === verleng.id); const c = it ? lokaalVan(it).geometrie.coordinates : null; if (c) { const a = verleng.eind ? c[c.length - 1] : c[0]; const L = Math.hypot(p[0] - a[0], p[1] - a[1]); const g = Math.round(Math.atan2(p[1] - a[1], p[0] - a[0]) / (Math.PI / 4)) * (Math.PI / 4); return [r3(a[0] + Math.cos(g) * L), r3(a[1] + Math.sin(g) * L)]; } }
    if (!e?.shiftKey || !(modus === 'lijn' || modus === 'vlak' || modus === 'pijl' || modus === 'maat') || !punten.length) return p;
    const a = punten[punten.length - 1]; const L = Math.hypot(p[0] - a[0], p[1] - a[1]); const g = Math.round(Math.atan2(p[1] - a[1], p[0] - a[0]) / (Math.PI / 4)) * (Math.PI / 4);
    return [r3(a[0] + Math.cos(g) * L), r3(a[1] + Math.sin(g) * L)];
  };
  // Afstanden van een kader [x0, y0, x1, y1] tot de dichtste muur, zaalrand of ander item in elke richting.
  const afstandenVan = (K, zonder) => {
    const seg = [...muren.map(([a, b]) => [a, b])];
    for (const r of ruimtes) { const c = puntenVan(lokaalVan(r).geometrie); for (let i = 0; i < c.length - 1; i++) seg.push([c[i], c[i + 1]]); }
    for (const it of inrichting) {
      if (zonder.has(it.id)) continue; const k = kaderVan([puntenVan(lokaalVan(it).geometrie)]); if (!k) continue;
      seg.push([[k[0], k[1]], [k[2], k[1]]], [[k[2], k[1]], [k[2], k[3]]], [[k[2], k[3]], [k[0], k[3]]], [[k[0], k[3]], [k[0], k[1]]]);
    }
    // Stuk van een segment binnen een band (as 0 = x, 1 = y) van lo tot hi.
    const inBand = ([a, b], as, lo, hi) => {
      const d = b[as] - a[as]; let t0 = 0; let t1 = 1;
      if (Math.abs(d) < 1e-9) { if (a[as] < lo || a[as] > hi) return null; } else { let u0 = (lo - a[as]) / d; let u1 = (hi - a[as]) / d; if (u0 > u1) [u0, u1] = [u1, u0]; t0 = Math.max(0, u0); t1 = Math.min(1, u1); if (t0 > t1) return null; }
      const P = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; return [P(t0), P(t1)];
    };
    const uit = [];
    for (const [as, rand, teken] of [[0, K[2], 1], [0, K[0], -1], [1, K[3], 1], [1, K[1], -1]]) {
      const an = 1 - as; const lo = K[an === 0 ? 0 : 1]; const hi = K[an === 0 ? 2 : 3];
      let best = null;
      for (const sg of seg) {
        const q = inBand(sg, an, lo, hi); if (!q) continue;
        for (const pt of q) { const dd = (pt[as] - rand) * teken; if (dd > -0.005 && dd < 20 && (!best || dd < best.d)) best = { d: Math.max(0, dd), w: pt[an] }; }
      }
      if (!best || best.d < 0.01) continue;
      const m = best.w != null ? Math.min(hi, Math.max(lo, (lo + hi) / 2)) : (lo + hi) / 2;
      const a = as === 0 ? [rand, m] : [m, rand]; const b = as === 0 ? [rand + teken * best.d, m] : [m, rand + teken * best.d];
      uit.push({ a, b, d: best.d });
    }
    return uit;
  };
  const beweeg = (e) => {
    const s = sleep.current;
    const w = naarWereld(e); const vg = tekenVangt() && !e.altKey ? vangTeken(w) : null; const p = hoekVang(vg ? vg.p : snap(w), e);
    if (vg?.soort) { if (!vangAan || vangAan.p[0] !== vg.p[0] || vangAan.p[1] !== vg.p[1]) setVangAan(vg); } else if (vangAan) setVangAan(null);
    if (!s?.pan) setMuis(p);
    if (!s && kiesEl && !e.ctrlKey && !e.metaKey) {
      const k0 = plaatsKader(kiesEl, p);
      if (k0) { const kl = kleef(k0, new Set()); plaatsPunt.current = [r3(p[0] + kl.dx), r3(p[1] + kl.dy)]; setHulp(kl.hulp); setAfst(afstandenVan([k0[0] + kl.dx, k0[1] + kl.dy, k0[2] + kl.dx, k0[3] + kl.dy], new Set())); } else { plaatsPunt.current = null; if (hulp.length) setHulp([]); if (afst.length) setAfst([]); }
    } else if (!s && kiesEl) { plaatsPunt.current = null; if (hulp.length) setHulp([]); }
    if (!s && !kiesEl && !modus) { const h = raak(w); const r = svgRef.current?.getBoundingClientRect(); setZweefIt(h && r ? { id: h.id, x: e.clientX - r.left, y: e.clientY - r.top } : null); } else if (zweefIt) setZweefIt(null);
    if (!s) { const dg = draaiGreep(); const [mx, my] = naarScherm(w); const op = dg && Math.hypot(dg.greep[0] - mx, dg.greep[1] - my) < 10; if (svgRef.current) svgRef.current.style.cursor = op ? 'grab' : kiesEl || ruimteKlik || modus ? 'crosshair' : 'default'; }
    if (s?.pan) { if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 3) s.bewogen = true; setBeeld({ ...s.b, cx: s.b.cx - (e.clientX - s.x) / s.b.s, cy: s.b.cy + (e.clientY - s.y) / s.b.s }); return; }
    if (s?.hoek != null && vormIt) {
      const q = e.altKey ? p : vangPunt(w, p);
      const r = s.ring.map((c, i) => (i === s.hoek || (!s.open && s.hoek === 0 && i === s.ring.length - 1) ? q : c));
      s.nieuw = r; s.bewogen = true;
      setVoorlopig({ [vormIt.id]: { ...lokaalVan(vormIt), geometrie: s.open ? { type: 'LineString', coordinates: r } : { type: 'Polygon', coordinates: [r] } } });
      return;
    }
    if (s?.kader) { s.tot = w; setKaderSel([s.kader, w]); return; }
    if (s?.draai) {
      let g = ((s.a0 - Math.atan2(w[1] - s.c[1], w[0] - s.c[0])) * 180) / Math.PI;
      const basis = s.ids.length === 1 ? Number(s.orig[s.ids[0]]?.rot) || 0 : 0;
      let doel = basis + g;
      if (e.shiftKey) doel = Math.round(doel / 15) * 15; else if (!e.altKey) { const m = Math.round(doel / 45) * 45; if (Math.abs(doel - m) < 4) doel = m; else doel = Math.round(doel); }
      g = doel - basis; s.bewogen = true;
      setVoorlopig(Object.fromEntries(Object.entries(s.orig).map(([id, l]) => [id, draaiOm(l, s.c, g)])));
      setDraaiHoek(((Math.round(doel) % 360) + 360) % 360);
      return;
    }
    if (s?.ids) {
      let dx = p[0] - s.van[0]; let dy = p[1] - s.van[1];
      if (!s.bewogen && !dx && !dy) return;
      s.bewogen = true;
      const muurDeur = s.ids.length === 1 && naarMuur(inrichting.find((x) => x.id === s.ids[0])?.velden?.meubel || {});
      if (!e.ctrlKey && !e.metaKey && !muurDeur) {
        const k0 = kaderVan(Object.values(s.orig).map((l) => puntenVan(l.geometrie)));
        if (k0) { const kl = kleef([k0[0] + dx, k0[1] + dy, k0[2] + dx, k0[3] + dy], new Set(s.ids)); dx = r3(dx + kl.dx); dy = r3(dy + kl.dy); setHulp(kl.hulp); }
      } else if (hulp.length) setHulp([]);
      { const k1 = kaderVan(Object.values(s.orig).map((l) => puntenVan(l.geometrie))); if (k1) setAfst(afstandenVan([k1[0] + dx, k1[1] + dy, k1[2] + dx, k1[3] + dy], new Set(s.ids))); }
      setVoorlopig(Object.fromEntries(Object.entries(s.orig).map(([id, l]) => {
        const it = s.ids.length === 1 ? inrichting.find((x) => x.id === id) : null; const mb = it?.velden?.meubel;
        if (mb && naarMuur(mb) && l.midden) { const m = opMuur([l.midden[0] + dx, l.midden[1] + dy], mb); if (m) return [id, { geometrie: { type: 'Polygon', coordinates: [voetMeubel(mb, m.midden, m.rot)] }, midden: m.midden, rot: m.rot }]; }
        return [id, verschuif(l, dx, dy)];
      })));
    }
  };
  const omhoog = () => {
    const s = sleep.current; sleep.current = null;
    if (hulp.length) setHulp([]); if (afst.length && !kiesEl) setAfst([]);
    if (s?.pan && !s.bewogen && s.klik) { const r = ruimteBij(s.klik); setActieveRuimte(r?.id || null); return; }
    if (s?.hoek != null) { if (s.nieuw && vormIt) { const l = lokaalVan(vormIt); bewaarLokaal(vormIt, { ...l, geometrie: s.open ? { type: 'LineString', coordinates: s.nieuw } : { type: 'Polygon', coordinates: [s.nieuw] } }); } setTimeout(() => setVoorlopig(null), 0); return; }
    if (s?.kader) {
      setKaderSel(null);
      const [a, b] = [s.kader, s.tot]; const x0 = Math.min(a[0], b[0]); const x1 = Math.max(a[0], b[0]); const y0 = Math.min(a[1], b[1]); const y1 = Math.max(a[1], b[1]);
      const binnenK = inrichting.filter((it) => { const l = lokaalVan(it); const c = l.midden || puntenVan(l.geometrie)[0]; return c && c[0] >= x0 && c[0] <= x1 && c[1] >= y0 && c[1] <= y1; }).map((x) => x.id);
      setSel([...new Set([...(s.bij || []), ...binnenK])]);
      return;
    }
    if (s?.draai) setDraaiHoek(null);
    if (s?.ids && s.bewogen && voorlopig) {
      for (const it of inrichting.filter((x) => voorlopig[x.id])) bewaarLokaal(it, voorlopig[it.id]);
      setTimeout(() => setVoorlopig(null), 0);
    }
  };
  useEffect(() => {
    const t = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '') || e.target?.closest?.('.fm-dialoog, [role=dialog]:not(.fm-binnenscherm)') || document.querySelector('.fm-fotogroot, .fm-dialoog-achter, .fm-editor.ingebed, .fm-ws, .fm-3d-groot, .fm-cam')) return;
      e.stopPropagation(); // het plan erachter krijgt geen toetsen
      const k = e.key.toLowerCase(); const mod = e.ctrlKey || e.metaKey;
      if ((e.key === 'Escape' || e.key === 'Enter') && verleng) { e.preventDefault(); setVerleng(null); return; }
      if (e.key === 'Escape') { e.preventDefault(); if (vormZaal) { setVormZaal(null); return; } if (modus) { setModus(null); setPunten([]); setMeting(null); } else if (lijn) setLijn(null); else if (ruimteKlik) setRuimteKlik(false); else if (kiesEl) setKiesEl(null); else if (sel.length) setSel([]); else onSluit?.(); return; }
      if (['lijn', 'vlak', 'pijl', 'maat'].includes(modus) && punten.length && !mod) {
        if (/^[0-9.,]$/.test(e.key)) { e.preventDefault(); setGetypt((x) => (x + e.key).slice(0, 8)); return; }
        if (e.key === 'Backspace' && getypt) { e.preventDefault(); setGetypt((x) => x.slice(0, -1)); return; }
        if (e.key === 'Enter' && getypt) { e.preventDefault(); const q = getyptPunt(); setGetypt(''); if (q) tekenKlik(q, false); return; }
      }
      if (e.key === 'Enter' && (modus === 'lijn' || modus === 'vlak' || modus === 'pijl')) { e.preventDefault(); afmaken(punten); return; }
      if (e.key === 'Enter' && lijn) { if (lijn.length >= 2) plaatsLijn(kiesEl, lijn); setLijn(null); setKiesEl(null); return; }
      if (!schrijven) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); onVerwijder(sel); setSel([]); return; }
      if (mod && k === 'd' && sel.length) { e.preventDefault(); dupliceer(); return; }
      if (mod && k === 'c' && sel.length) { e.preventDefault(); kopieer(false); return; }
      if (mod && k === 'x' && sel.length) { e.preventDefault(); kopieer(true); return; }
      if (mod && k === 'v') { e.preventDefault(); plak(); return; }
      if (mod && k === 'a') { e.preventDefault(); setSel(inrichting.map((x) => x.id)); return; }
      if (mod && (k === 'z' || k === 'y')) { e.preventDefault(); onOngedaan?.(k === 'y' || e.shiftKey); return; }
      if (k === 'r' && !mod) { draaiSel(e.shiftKey ? -15 : 15); return; }
      if ((k === 'q' || k === 'w') && !mod) { draaiSel(k === 'w' ? 90 : -90); return; }
      if (e.key.startsWith('Arrow') && sel.length) {
        e.preventDefault(); const st = e.shiftKey ? 0.5 : 0.05;
        const [dx, dy] = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
        for (const it of inrichting.filter((x) => sel.includes(x.id))) bewaarLokaal(it, verschuif(lokaalVan(it), dx, dy));
      }
    };
    window.addEventListener('keydown', t, true);
    return () => window.removeEventListener('keydown', t, true);
  });

  // ---------- Zichtveld van camera's ----------
  // Een vlak met zicht: true in de tekening (kijkhoek) stopt waar het eerst iets raakt: muren van het grondplan,
  // de tentwand en hoge items (wanden, frames, drapes, alles vanaf 1,7 m; een open bouwhek niet).
  const zichtSeg = useMemo(() => {
    const seg = [];
    const voeg = (c, dicht) => { for (let i = 0; i < c.length - 1; i++) seg.push([c[i][0], c[i][1], c[i + 1][0], c[i + 1][1]]); if (dicht && c.length > 2) seg.push([c[c.length - 1][0], c[c.length - 1][1], c[0][0], c[0][1]]); };
    for (const l of plan.lijnen) { if (!ZAAL_LAAG.test(l.laag || '')) voeg(l.c, false); }
    if (hostRing) voeg(hostRing, false);
    for (const it of inrichting) {
      const el = it.element_id ? elementenMap.get(it.element_id) : null; if (!el) continue;
      if (el.eigenschappen?.tekening?.vlakken?.some((v) => v.zicht)) continue;
      const hoog = isWand(el) || isFrame(el) || isDrape(el) || Number(el.hoogte_m) >= 1.7;
      if (!hoog || (/bouwhek/i.test(el.naam || '') && !/gezeild|doek/i.test(el.naam || ''))) continue;
      const g = lokaalVan(it).geometrie;
      if (isWand(el) && isVrij(it) && g.type === 'LineString') { for (const f of wandStukken(g.coordinates, it, el)) seg.push([f.a[0], f.a[1], f.e[0], f.e[1]]); continue; }
      if (g.type === 'LineString') voeg(g.coordinates, false); else if (g.type === 'Polygon') voeg(g.coordinates[0], false);
    }
    return seg;
  }, [plan, hostRing, inrichting, elementenMap]); // eslint-disable-line react-hooks/exhaustive-deps
  // Kijkhoek van een camera volgens de ingestelde zoom (camerabeeld): waaier vanuit de lens, zelfde reikwijdte.
  const kijkWaaier = (ring, item) => {
    if (!item?.velden?.camera) return ring;
    const A = ring[0]; let R = 0; for (const q of ring) R = Math.max(R, Math.hypot(q[0] - A[0], q[1] - A[1]));
    const h = kijkhoek(brandpunt(cameraVan(item))).h; const n = 24; const uit = [A];
    for (let i = 0; i <= n; i++) { const a = -h / 2 + (h * i) / n; uit.push([A[0] + Math.sin(a) * R, A[1] - Math.cos(a) * R]); }
    uit.push(A); return uit;
  };
  const zichtVeld = (ring) => {
    // ring = [apex, rand…, apex] in plancoördinaten; elke straal van de apex naar de rand stopt bij het eerste obstakel.
    const A = ring[0]; const rand0 = ring.slice(1, -1); if (rand0.length < 2) return ring;
    const rand = [];
    for (let i = 0; i < rand0.length - 1; i++) for (let k = 0; k < 4; k++) { const t = k / 4; rand.push([rand0[i][0] + (rand0[i + 1][0] - rand0[i][0]) * t, rand0[i][1] + (rand0[i + 1][1] - rand0[i][1]) * t]); }
    rand.push(rand0[rand0.length - 1]);
    let R = 0; for (const q of rand) R = Math.max(R, Math.hypot(q[0] - A[0], q[1] - A[1]));
    const kand = zichtSeg.filter(([ax, ay, bx, by]) => Math.min(ax, bx) <= A[0] + R && Math.max(ax, bx) >= A[0] - R && Math.min(ay, by) <= A[1] + R && Math.max(ay, by) >= A[1] - R);
    if (!kand.length) return ring;
    const uit = [A];
    for (const q of rand) {
      const dx = q[0] - A[0]; const dy = q[1] - A[1]; let tMin = 1;
      for (const [ax, ay, bx, by] of kand) {
        const ex = bx - ax; const ey = by - ay; const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue;
        const t = ((ax - A[0]) * ey - (ay - A[1]) * ex) / den; const u = ((ax - A[0]) * dy - (ay - A[1]) * dx) / den;
        if (t > 0.03 && t < tMin && u >= 0 && u <= 1) tMin = t;
      }
      uit.push([A[0] + dx * tMin, A[1] + dy * tMin]);
    }
    uit.push(A);
    return uit;
  };

  // ---------- Tekenen ----------
  const tekening = (el, lok, opp = 1, eigen = null, maat = null, item = null) => {
    const tk = eigen || (el ? metTekening(el).eigenschappen?.tekening : null);
    if (!tk || !lok.midden) return null;
    const b = eigen && !el ? tk.b : Number(maat?.breedte) || Number(el.breedte_m) || tk.b; const h = eigen && !el ? tk.h : Number(maat?.diepte) || Number(el.diepte_m) || tk.h;
    const sx = b / tk.b; const sy = h / tk.h; const rot = Number(lok.rot) || 0;
    const w = ([x, y]) => { const q = draai([x * sx, y * sy], rot); return [lok.midden[0] + q[0], lok.midden[1] + q[1]]; };
    return (
      <g pointerEvents="none" opacity={opp}>
        {(tk.vlakken || []).map((v, i) => <path key={`v${i}`} d={pad(v.zicht ? zichtVeld(kijkWaaier(v.r[0], item).map(w)) : v.r[0].map(w), true)} fill={v.vul || 'none'} fillOpacity={v.vul ? (v.op ?? 1) : 0} stroke={v.lijn || 'none'} strokeWidth={1} vectorEffect={NS} />)}
        {(tk.lijnen || []).map((l, i) => <path key={`l${i}`} d={pad(l.c.map(w))} fill="none" stroke={l.k || '#1d1d1b'} strokeWidth={1} vectorEffect={NS} strokeDasharray={l.s === 'streep' ? '4 3' : undefined} />)}
      </g>
    );
  };
  const tekenItem = (it) => {
    const lok = lokaalVan(it); const el = it.element_id ? elementenMap.get(it.element_id) : null; const aan = sel.includes(it.id);
    const g = lok.geometrie;
    if (g.type === 'Point') return null; // punten staan in de schermlaag (vaste grootte)
    if (el && isWand(el) && g.type === 'LineString') {
      // B-matrix frame-wand: per frame de voor- (rechts van de richting, zoals op de kaart) en achterkant in de kleur van het doek.
      const c = g.coordinates; const vrij = isVrij(it);
      const fr = wandStukken(c, it, el).sort((x, y) => x.z0 - y.z0); const kl = (id) => (id ? elementenMap.get(id)?.eigenschappen?.kleur || '#EA580C' : null);
      return (
        <g key={it.id}>
          {aan && <path d={pad(vrij ? fr.flatMap((f) => [f.a, f.e]) : c)} fill="none" stroke="#2563EB" strokeWidth={8} strokeOpacity={0.25} vectorEffect={NS} />}
          {vrij && <path d={pad(c)} fill="none" stroke="transparent" strokeWidth={0.3} />}
          {fr.map((f) => {
            const ux = Math.cos(f.r); const uy = Math.sin(f.r);
            const p = (d, o) => [f.a[0] + ux * d + uy * o, f.a[1] + uy * d - ux * o]; // o > 0 = rechts
            const v = Math.min(f.b, 0.015); const t = Math.max(v, f.b - 0.015);
            return (
              <g key={f.i}>
                <path d={padW([p(v, 0.06), p(t, 0.06)])} stroke={kl(f.voor) || '#D1D5DB'} strokeWidth={0.06} />
                <path d={padW([p(v, -0.06), p(t, -0.06)])} stroke={kl(f.achter) || '#E5E7EB'} strokeWidth={0.06} />
                <path d={padW([p(v, 0), p(t, 0)])} stroke="#1d1d1b" strokeWidth={0.062} />
              </g>
            );
          })}
        </g>
      );
    }
    if (el && g.type === 'LineString' && /truss/i.test(`${el.categorie || ''} ${el.naam || ''}`)) {
      // Truss van bovenaf: twee buizen met de diagonalen ertussen.
      const c = g.coordinates;
      if (isTrussBouw(it)) {
        const st = trussStukken(c, it); const kl0 = /zwart/i.test(el.naam) ? '#1f2937' : '#6B7280';
        return (
          <g key={it.id}>
            {aan && <path d={pad(st.flatMap((x) => [x.a, x.e]))} fill="none" stroke="#2563EB" strokeWidth={8} strokeOpacity={0.25} vectorEffect={NS} />}
            {trussKnopen(st).filter((k) => k.voet).map((k, i) => <rect key={`v${i}`} transform={`rotate(${(knoopRichting(k, st) * 180) / Math.PI} ${k.p[0]} ${k.p[1]})`} x={k.p[0] - 0.3} y={k.p[1] - 0.3} width={0.6} height={0.6} fill="#E5E7EB" stroke={kl0} strokeWidth={0.01} />)}
            {st.map((x) => (x.op ? <rect key={x.i} transform={`rotate(${(x.r * 180) / Math.PI} ${x.a[0]} ${x.a[1]})`} x={x.a[0] - 0.145} y={x.a[1] - 0.145} width={0.29} height={0.29} fill="#D1D5DB" stroke={kl0} strokeWidth={0.02} /> : <path key={x.i} d={padW([x.a, x.e])} stroke={kl0} strokeWidth={0.29} strokeOpacity={0.35} />))}
            {trussKnopen(st).filter((k) => k.hoek).map((k, i) => <rect key={`h${i}`} transform={`rotate(${(knoopRichting(k, st) * 180) / Math.PI} ${k.p[0]} ${k.p[1]})`} x={k.p[0] - 0.16} y={k.p[1] - 0.16} width={0.32} height={0.32} fill={kl0} />)}
          </g>
        );
      } const B = (Number(el.diepte_m) || 0.29) / 2; const kl = el.stijl?.kleur || (/zwart/i.test(el.naam) ? '#1f2937' : '#6B7280');
      return (
        <g key={it.id}>
          {aan && <path d={pad(c)} fill="none" stroke="#2563EB" strokeWidth={8} strokeOpacity={0.25} vectorEffect={NS} />}
          {c.slice(1).map((q, k) => {
            const [ax, ay] = c[k]; const Lz = Math.hypot(q[0] - ax, q[1] - ay) || 1; const ux = (q[0] - ax) / Lz; const uy = (q[1] - ay) / Lz;
            const p = (d, o) => [ax + ux * d - uy * o, ay + uy * d + ux * o];
            const n = Math.max(1, Math.round(Lz / 0.5)); const st = Lz / n; const zz = [];
            for (let j = 0; j <= n; j++) zz.push(p(j * st, j % 2 ? B : -B));
            return (
              <g key={k}>
                <path d={padW([p(0, B), p(Lz, B), p(Lz, -B), p(0, -B)], true)} fill="#F3F4F6" fillOpacity={0.6} stroke="none" />
                <path d={padW(zz)} fill="none" stroke={kl} strokeWidth={0.025} />
                <path d={padW([p(0, B), p(Lz, B)])} stroke={kl} strokeWidth={0.05} />
                <path d={padW([p(0, -B), p(Lz, -B)])} stroke={kl} strokeWidth={0.05} />
              </g>
            );
          })}
        </g>
      );
    }
    const lijnTek = el && g.type === 'LineString' && el.tekenwijze === 'lijn' && !isWand(el) && !isDrape(el) && Number(el.eenheid_m) > 0 ? metTekening(el).eigenschappen?.tekening : null;
    if (lijnTek && lijnTek.b > 0) {
      // Lijnelement met een tekening (nadar, paaltje met trekband, paal en net …): de tekening per stuk langs de lijn,
      // met de palen/naden ertussen, net zoals op de kaart.
      const c = g.coordinates.filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 0.005); const e0 = Number(el.eenheid_m);
      const stukken = []; const naden = [];
      for (let k = 0; k < c.length - 1; k++) {
        const [ax, ay] = c[k]; const Ls = Math.hypot(c[k + 1][0] - ax, c[k + 1][1] - ay); if (Ls < 0.01) continue;
        const ux = (c[k + 1][0] - ax) / Ls; const uy = (c[k + 1][1] - ay) / Ls; const n0 = segN(Ls, e0); const st = Ls / n0;
        for (let j = 0; j < n0 && stukken.length < 800; j++) stukken.push({ m: [ax + ux * (j + 0.5) * st, ay + uy * (j + 0.5) * st], ux, uy, sx: st / lijnTek.b });
        for (let j = 0; j <= n0; j++) naden.push({ p: [ax + ux * j * st, ay + uy * j * st], ux, uy, eind: (k === 0 && j === 0) || (k === c.length - 2 && j === n0) });
      }
      // tekening-coördinaten: x langs de lijn, y dwars (y omlaag in de tekening = links in het plan)
      const T = (q, x) => (pt) => [q.m[0] + q.ux * pt[0] * (x ?? q.sx) + q.uy * pt[1], q.m[1] + q.uy * pt[0] * (x ?? q.sx) - q.ux * pt[1]];
      const tekenDeel = (tek, q, x, key) => (
        <g key={key}>
          {(tek.vlakken || []).map((v, i) => <path key={`v${i}`} d={(v.r || []).map((ring) => padW(ring.map(T(q, x)), true)).join(' ')} fill={v.vul || 'none'} fillOpacity={v.op ?? 1} stroke={v.lijn || 'none'} strokeWidth={Number(v.d) || 0.01} />)}
          {(tek.lijnen || []).map((l, i) => <path key={`l${i}`} d={padW(l.c.map(T(q, x)))} fill="none" stroke={l.k || '#1d1d1b'} strokeWidth={Number(l.d) || 0.01} strokeDasharray={l.s === 'streep' ? '0.1 0.06' : undefined} />)}
        </g>
      );
      return (
        <g key={it.id}>
          {aan && <path d={pad(c)} fill="none" stroke="#2563EB" strokeWidth={8} strokeOpacity={0.25} vectorEffect={NS} />}
          <path d={pad(c)} fill="none" stroke="transparent" strokeWidth={0.4} />
          {stukken.map((q, i) => tekenDeel(lijnTek, q, null, `s${i}`))}
          {naden.map((q, i) => { const t2 = (q.eind ? lijnTek.einde : lijnTek.naad) || null; return t2 ? tekenDeel(t2, { m: q.p, ux: q.ux, uy: q.uy, sx: 1 }, 1, `n${i}`) : null; })}
        </g>
      );
    }
    if (el && isDrape(el) && g.type === 'LineString') {
      const sec = sectiesVan(g.coordinates, Number(el.eenheid_m) || 3); const dk = it.velden?.doeken || [];
      return (
        <g key={it.id}>
          {aan && <path d={pad(g.coordinates)} fill="none" stroke="#2563EB" strokeWidth={8} strokeOpacity={0.25} vectorEffect={NS} />}
          {sec.map(([a, b], k) => { const d = dk[k] ? elementenMap.get(dk[k]) : null; return <path key={k} d={padW([a, b])} stroke={d ? d.eigenschappen?.kleur || '#0F766E' : '#1d1d1b'} strokeWidth={d ? 0.12 : 0.08} fill="none" />; })}
          {[sec[0]?.[0], ...sec.map((x) => x[1])].filter(Boolean).map(([x, y], k) => <rect key={`v${k}`} x={x - 0.225} y={y - 0.225} width={0.45} height={0.45} fill="none" stroke="#6B7280" strokeWidth={1} vectorEffect={NS} />)}
        </g>
      );
    }
    const mb = it.velden?.meubel;
    const tk = g.type === 'Polygon' ? (mb ? tekening(null, lok, 1, meubelTekening(mb)) : (el && metTekening(el).eigenschappen?.tekening ? tekening(el, lok, 1, pasTekeningAan(metTekening(el).eigenschappen.tekening, it, el), it.parameters, it) : tekening(el, lok, 1, null, it.parameters))) : null;
    // Textielframe: voor- (onder) en achterkant (boven) in de kleur van het doek.
    const zijKleur = el && isFrame(el) && lok.midden ? [1, 2].map((k) => { const id = it.velden?.[`paneel_${k}`]; return id ? elementenMap.get(id)?.eigenschappen?.kleur || '#EA580C' : null; }) : null;
    return (
      <g key={it.id}>
        {tk}
        {zijKleur && zijKleur.map((kl, k) => { if (!kl) return null; const b = (Number(it.parameters?.breedte) || Number(el.breedte_m) || 1) / 2; const y = k ? 0.05 : -0.05; const p1 = draai([-b, y], lok.rot || 0); const p2 = draai([b, y], lok.rot || 0); return <path key={`z${k}`} d={padW([[lok.midden[0] + p1[0], lok.midden[1] + p1[1]], [lok.midden[0] + p2[0], lok.midden[1] + p2[1]]])} stroke={kl} strokeWidth={0.06} />; })}
        {!el && !mb ? (
          <path d={pad(puntenVan(g), g.type === 'Polygon')} fill={g.type === 'Polygon' ? (it.stijl?.vulkleur || it.stijl?.kleur || '#2563EB') : 'none'} fillOpacity={g.type === 'Polygon' ? (it.stijl?.vuldekking ?? 0.15) : 0} stroke={aan ? '#2563EB' : (it.stijl?.kleur || '#1d1d1b')} strokeWidth={aan ? 3 : Number(it.stijl?.dikte) || 2} vectorEffect={NS} strokeDasharray={it.stijl?.streep === 'streep' ? '6 4' : it.stijl?.streep === 'stip' ? '0.1 4' : undefined} strokeLinecap={it.stijl?.streep === 'stip' ? 'round' : undefined} />
        ) : (
          <path d={pad(puntenVan(g), g.type === 'Polygon')} fill={g.type === 'Polygon' && !tk ? '#E2E8F0' : 'none'} stroke={aan ? '#2563EB' : tk ? 'none' : (el?.stijl?.kleur || '#334155')} fillOpacity={mb ? 0 : undefined} strokeWidth={g.type === 'LineString' && !aan ? (Number(el?.diepte_m) || 0.1) : aan ? 2.5 : 1} vectorEffect={g.type === 'LineString' && !aan ? undefined : NS} strokeDasharray={aan && tk ? '4 3' : undefined} />
        )}
      </g>
    );
  };
  // Telling per soort; vanHuis = enkel wat het huis levert (tafel en stoelen apart: eigen stoelen aan een huistafel kan).
  const tellen = (lijst, vanHuis) => {
    const m = new Map(); const tel = (n, c = 1) => n && c && m.set(n, (m.get(n) || 0) + c);
    for (const it of lijst) {
      const mb = it.velden?.meubel; const hu = !!(it.velden?.binnen?.huis || elementenMap.get(it.element_id)?.eigenschappen?.huis);
      if (!mb) { if (hu === vanHuis) tel(elementenMap.get(it.element_id)?.naam); continue; }
      const z = zitMeubel(mb); const stoelNaam = mb.stoel_huis ? elementenMap.get(mb.stoel_huis)?.naam || 'Stoel' : 'Stoel';
      if (!!mb.stoel_huis === vanHuis && (mb.type === 'tafel' || mb.type === 'stoel' || mb.type === 'rijen')) tel(stoelNaam, z);
      if (mb.type === 'stoel') continue;
      if (hu !== vanHuis) continue;
      if (mb.type === 'tafel') tel(elementenMap.get(it.element_id)?.naam || naamMeubel({ ...mb, stoelen: {} }));
      else if (mb.type === 'rijen') { if (mb.tafels) tel('Klastafel', mb.rijen * Math.max(1, Math.ceil(mb.per_rij / (mb.gang_na || mb.per_rij)))); }
      else tel(elementenMap.get(it.element_id)?.naam || naamMeubel(mb));
    }
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const inRuimte = (r) => { const ring = puntenVan(lokaalVan(r).geometrie); return inrichting.filter((it) => { const l = lokaalVan(it); const p = l.midden || puntenVan(l.geometrie)[0]; return p && binnenVeelhoek(p, ring); }); };
  const zoomOp = (r) => {
    const k = kaderVan([puntenVan(lokaalVan(r).geometrie)]); if (!k) return; const b = Math.max(3, k[2] - k[0]) * 1.4; const h = Math.max(3, k[3] - k[1]) * 1.4;
    // Gsm (deel-link): het onderblad bedekt de onderkant, dus de zaal in het bovenste deel tonen.
    const blad = !schrijven && typeof window !== 'undefined' && window.innerWidth <= 760;
    const zicht = blad ? maat.h * 0.36 : maat.h; const sc = Math.min(maat.w / b, zicht / h);
    setBeeld({ cx: (k[0] + k[2]) / 2, cy: (k[1] + k[3]) / 2 - (blad ? (maat.h / 2 - zicht / 2 - 8) / sc : 0), s: sc });
  };
  const een = sel.length === 1 ? inrichting.find((x) => x.id === sel[0]) : null;
  const naamHost = host.naam || 'Binnenplan';
  const nogZalen = (() => { const b = new Set(ruimtes.map((r) => String(r.naam || '').toLowerCase())); return plan.zalen.filter((z, i) => !b.has(String(z.naam || `Ruimte ${i + 1}`).toLowerCase())).length; })();
  const geenPlan = !onderlegger;

  // Zware lagen één keer opbouwen: bij zoomen en schuiven verandert enkel de transform van de wereldgroep.
  const grondEl = useMemo(() => {
    let foto = null;
    if (onderlegger && !isDxf && onderlegger.url) {
      const b = Number(onderlegger.breedte) || 50; const h = b * (Number(onderlegger.verhouding) || 1);
      foto = <g transform="scale(1 -1)"><image href={onderlegger.url} x={-b / 2} y={-h / 2} width={b} height={h} preserveAspectRatio="none" opacity={0.9} /></g>;
    }
    let gewoon = ''; let zaal = '';
    for (const l of plan.lijnen) { const dd = padW(l.c); if (ZAAL_LAAG.test(l.laag || '')) zaal += dd; else gewoon += dd; }
    return (
      <g pointerEvents="none">
        {foto}
        {zaal && <path d={zaal} fill="none" stroke="#CBD5E1" strokeWidth={0.8} vectorEffect={NS} />}
        {gewoon && <path d={gewoon} fill="none" stroke="#3F3F46" strokeWidth={0.9} vectorEffect={NS} strokeLinejoin="round" />}
      </g>
    );
  }, [plan, isDxf, onderlegger?.url, onderlegger?.breedte, onderlegger?.verhouding]); // eslint-disable-line react-hooks/exhaustive-deps
  // Tent uit de tentbouwer: deuren (oranje), nooduitgangen (groen), ramen (blauw) en open zijden in de tentwand.
  const tentGaten = useMemo(() => { const hel = host?.element_id ? elementenMap?.get(host.element_id) : null; return !onderlegger && hostRing && isTentBouw(hel) && host.velden?.tent ? tentOpeningen(host, hel) : []; }, [host, elementenMap, onderlegger, hostRing]);
  // De rest van het element (trekker, trappen, cabine …) gedempt rond de binnenruimte, als oriëntatie.
  const hostTek = useMemo(() => {
    if (!hostRing || hostVlak === host?.geometrie) return null;
    const hel = host?.element_id ? elementenMap?.get(host.element_id) : null; const tk0 = hel?.eigenschappen?.tekening;
    if (!tk0) return null;
    const { vormen } = tekeningFeatures(pasTekeningAan(tk0, host, hel) || tk0, host, hel, {});
    return vormen.map((f, i) => {
      const pr = f.properties || {}; const c = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates;
      const pts = c.map((q) => T.naarPlan(q));
      return f.geometry.type === 'Polygon'
        ? <path key={`ht${i}`} d={padW(pts, true)} fill={pr.vulkleur || '#fff'} fillOpacity={(pr.vuldekking ?? 1) * 0.55} stroke={pr.kleur || '#6B7280'} strokeOpacity={pr.dekking ? 0.5 : 0} strokeWidth={0.8} strokeDasharray={pr.streep === 'streep' ? '4 3' : undefined} vectorEffect={NS} />
        : <path key={`ht${i}`} d={padW(pts)} fill="none" stroke={pr.kleur || '#6B7280'} strokeOpacity={0.45} strokeWidth={0.7} vectorEffect={NS} />;
    });
  }, [hostRing, hostVlak, host, elementenMap, T]); // eslint-disable-line react-hooks/exhaustive-deps
  const ruimteEl = useMemo(() => (
    <g pointerEvents="none">
      {hostTek}
      {hostRing && <path d={padW(hostRing, true)} fill="#FFFFFF" fillOpacity={0.5} stroke="#3F3F46" strokeWidth={2} vectorEffect={NS} strokeLinejoin="round" />}
      {tentGaten.map((o, k) => { const a = T.naarPlan(o.a); const b = T.naarPlan(o.b); const kl = o.soort === 'raam' ? '#3B82F6' : o.soort === 'nood' ? '#16A34A' : o.soort === 'deur' ? '#D97706' : '#FFFFFF';
        return <g key={`tg${k}`}><path d={padW([a, b])} stroke={kl} strokeWidth={o.soort === 'raam' ? 3 : 5} vectorEffect={NS} strokeLinecap="butt" />{(o.soort === 'open' || o.soort === 'koppeling') && <path d={padW([a, b])} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="4 3" vectorEffect={NS} />}</g>; })}
      {ruimtes.map((r) => { const k = functieNu(r)?.kleur || r.stijl?.kleur || '#2563EB'; return <path key={r.id} d={padW(puntenVan(lokaalVan(r).geometrie), true)} fill={k} fillOpacity={0.09} stroke={k} strokeOpacity={0.55} strokeWidth={1.2} vectorEffect={NS} />; })}
    </g>
  ), [ruimtes, T, voorlopig, actieveFase, dag, hostRing, hostTek, tentGaten]); // eslint-disable-line react-hooks/exhaustive-deps
  const itemsEl = useMemo(() => <g>{inrichting.map(tekenItem)}</g>, [inrichting, sel, voorlopig, elementenMap, T]); // eslint-disable-line react-hooks/exhaustive-deps
  // Per ruimte: aantal items en zitplaatsen.
  const perRuimte = useMemo(() => new Map(ruimtes.map((r) => { const l = inRuimte(r); return [r.id, { n: l.length, zit: l.reduce((a, it) => a + (it.velden?.meubel ? zitMeubel(it.velden.meubel) : zitVan(elementenMap.get(it.element_id))), 0) }]; })), [ruimtes, inrichting, elementenMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const isHuis = (it) => !!(it.velden?.binnen?.huis || elementenMap.get(it.element_id)?.eigenschappen?.huis);
  const telEigen = useMemo(() => tellen(inrichting, false), [inrichting, elementenMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const telHuis = useMemo(() => tellen(inrichting, true), [inrichting, elementenMap]); // eslint-disable-line react-hooks/exhaustive-deps
  // Huismateriaal van deze locatie (herbruikbaar over plannen: gekoppeld via de naam van de locatie).
  const locatie = host.velden?.binnenplan?.locatie || slugVan(host.naam || 'locatie');
  const huis = useMemo(() => elementen.filter((e) => e.eigenschappen?.huis?.locatie === locatie).sort((a, b) => a.naam.localeCompare(b.naam, 'nl')), [elementen, locatie]);
  const huisGebruikt = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      if (it.velden?.binnen?.host !== host.id) continue;
      if (it.element_id) m.set(it.element_id, (m.get(it.element_id) || 0) + 1);
      const sh = it.velden?.meubel?.stoel_huis; if (sh) m.set(sh, (m.get(sh) || 0) + zitMeubel(it.velden.meubel));
    }
    return m;
  }, [items, host.id]);
  const bib = useMemo(() => elementen.filter((e) => !e.eigenschappen?.huis), [elementen]);
  // Stroomelementen uit de bibliotheek, per groep in het menu Stroom.
  const stroomGroepen = useMemo(() => [
    ['Kast', bib.filter(elKast)], ['Stekkerdoos', bib.filter(elStekkerdoos)], ['Verwarming', bib.filter(elVerwarming)], ['Verbruiker', bib.filter(elVerbruiker)],
  ].filter(([, l]) => l.length), [bib]); // eslint-disable-line react-hooks/exhaustive-deps
  const stroomAan = modus === 'kabel' || modus === 'punt:invoer' || (kiesEl && (elKast(kiesEl) || elStekkerdoos(kiesEl) || elVerwarming(kiesEl) || elVerbruiker(kiesEl)));
  const bewaarHuis = async () => {
    const f = huisForm; if (!f?.naam?.trim()) return;
    const basis = f.basis ? elementenMap.get(f.basis) : null;
    const b = Number(String(f.b).replace(',', '.')) || Number(basis?.breedte_m) || 1; const dd = f.vorm === 'rond' ? b : (Number(String(f.d).replace(',', '.')) || Number(basis?.diepte_m) || 1);
    const eig = { ...(basis ? metTekening(basis).eigenschappen || {} : {}), huis: { locatie, aantal: Number(f.aantal) || 0 }, zitplaatsen: f.zit === '' ? undefined : Number(f.zit) || 0 };
    delete eig.familie; delete eig.variant; delete eig.set; delete eig.tekening_ref;
    let bb = b; let hh = dd;
    if (f.vorm === 'punt') delete eig.tekening;
    else if (f.vorm !== 'basis') { const tk = vormTekening(f.vorm, b, dd, Number(f.zit) || 0); eig.tekening = tk; eig.tafel = { vorm: f.vorm, b, d: dd }; { const z = Number(f.zit) || 0; eig.meubel = { type: 'tafel', vorm: f.vorm, b, d: dd, stoelen: f.vorm === 'rechthoek' ? { boven: Math.ceil(z / 2), onder: Math.floor(z / 2), links: 0, rechts: 0 } : { n: z, kant: 'rondom' } }; } bb = tk.b; hh = tk.h; }
    const rij = { naam: f.naam.trim(), categorie: 'Huismateriaal', leverancier: naamHost, tekenwijze: f.vorm === 'punt' ? 'punt' : 'schaal', breedte_m: f.vorm === 'punt' ? null : bb, diepte_m: f.vorm === 'punt' ? null : hh, stijl: basis?.stijl || { kleur: '#57534E' }, eigenschappen: eig };
    if (f.id) await onWijzigElement?.(f.id, rij);
    else {
      const el = await onMaakElement?.(rij);
      if (el && !host.velden?.binnenplan?.locatie) onHost?.({ velden: { ...(host.velden || {}), binnenplan: { ...(host.velden?.binnenplan || {}), locatie } } });
    }
    setHuisForm(null);
  };
  const zaalLabels = useMemo(() => ruimtes.map((r) => { const k = kaderVan([puntenVan(lokaalVan(r).geometrie)]); const lp = labelPlek(puntenVan(lokaalVan(r).geometrie)); return k && lp ? { id: r.id, naam: r.naam, functie: functieTekst(r), kleur: functieNu(r)?.kleur, ...lp } : null; }).filter(Boolean), [ruimtes, T, voorlopig, actieveFase, fasen, dag]); // eslint-disable-line react-hooks/exhaustive-deps

  const actR = actieveRuimte ? ruimtes.find((r) => r.id === actieveRuimte) : null;
  const vormIt = vormZaal ? ruimtes.find((r) => r.id === vormZaal) || inrichting.find((r) => r.id === vormZaal) || null : null;
  const selItems = inrichting.filter((x) => sel.includes(x.id));
  const verdNaam = tx[verdiepingen.find((v) => v.id === verd)?.naam] || verdiepingen.find((v) => v.id === verd)?.naam || 'deze verdieping';
  const schaalbaar = onderlegger && (!isDxf || d?.pdf);
  const hint = melding ? null
    : ruimteKlik ? 'Klik in een ruimte van het grondplan'
      : verleng ? 'Klik de volgende punten · Shift = 45° · dubbelklik, Enter of Esc = klaar'
      : modus === 'maat' ? (punten.length ? 'Klik het eindpunt van de maatlijn' : 'Klik het beginpunt van de maatlijn')
      : modus === 'cirkel' ? (punten.length ? 'Klik op de rand (straal)' : 'Klik het middelpunt')
      : getypt ? `${getypt} m · Enter = punt op deze afstand`
      : modus === 'lijn' || modus === 'vlak' || modus === 'pijl' ? (punten.length ? 'Klik volgende punten · typ een lengte + Enter · dubbelklik of Enter = klaar · Esc = stoppen' : 'Klik het eerste punt · vangt op hoeken en randen')
      : modus === 'rechthoek' ? (punten.length ? 'Klik de andere hoek' : 'Klik een hoek')
      : modus === 'kabel' ? (kabelVan ? 'Klik de verbruiker, kast of stekkerdoos · Esc = stoppen' : 'Klik de bron, kast, stekkerdoos of stroominvoer waar de kabel vertrekt')
      : modus?.startsWith('punt:') ? `Klik om ${(PUNT[modus.slice(5)]?.naam || 'een punt').toLowerCase()} te zetten`
      : modus === 'tekst' ? 'Klik waar de tekst moet komen'
      : modus === 'meet' ? (punten.length ? tx.tweede : meting ? `${getal(Math.hypot(meting[1][0] - meting[0][0], meting[1][1] - meting[0][1]), 2)} m · ${tx.opnieuw}` : tx.eerste)
        : modus === 'zaal' ? (punten.length ? 'Klik de andere hoek' : 'Klik een hoek van de ruimte')
          : modus === 'schaal' ? (punten.length ? 'Klik het tweede punt' : 'Klik twee punten waarvan je de afstand kent')
            : kiesEl ? `${kiesEl.naam} · klik om te plaatsen${kiesEl.tekenwijze === 'lijn' ? ' · dubbelklik = klaar' : ' · Shift + klik = meer plaatsen'}`
              : vormIt && sel.includes(vormIt.id) ? 'Hoekjes slepen · rondje op een zijde = punt erbij · dubbelklik op een hoek = weg · Esc = klaar'
              : sel.length && schrijven ? 'Slepen = verschuiven · Alt = kopie · bolletje = draaien (Shift 15°) · Ctrl C/V' : vormIt ? 'Hoekjes slepen · rondje op een zijde = hoek erbij · dubbelklik op een hoek = weg' : '';
  const toonSetup = !onderlegger && !zonder && !laden && !ruimtes.length && !inrichting.length;
  // Een tafel van het huis wordt een instelbare tafel (vorm, stoelen) die naar het huiselement verwijst.
  const num = (v) => { const x = Number(String(v).replace(',', '.')); return x > 0 ? x : null; };
  const enterBlur = (e) => { if (e.key === 'Enter') e.currentTarget.blur(); };
  const teller = (label, waarde, zet, max = 60) => (
    <div className="fm-bs-teller"><span>{label}</span>
      <button type="button" onClick={() => zet(Math.max(0, waarde - 1))} aria-label={`${label} min`}>−</button>
      <b>{waarde}</b>
      <button type="button" onClick={() => zet(Math.min(max, waarde + 1))} aria-label={`${label} plus`}>+</button>
    </div>
  );
  const maatVeld = (label, waarde, zet, key) => <label className="fm-bs-veld">{label}<input key={`${key}${waarde}`} defaultValue={getal(waarde, 2)} onBlur={(e) => { const v = num(e.target.value); if (v && v !== waarde) zet(v); }} onKeyDown={enterBlur} /></label>;
  // Instellingen van een meubel: vorm, maat, stoelen per zijde, deurrichting…
  const meubelKaart = (it) => {
    const mb = it.velden.meubel; const zet = (patch) => bewaarMeubel(it, { ...mb, ...patch });
    const huisTafels = huis.filter((e) => e.eigenschappen?.meubel?.type === 'tafel' || (e.eigenschappen?.tafel && e.eigenschappen.tafel.vorm !== 'punt'));
    const huisStoelen = huis.filter((e) => e.eigenschappen?.meubel?.type === 'stoel' || /stoel/i.test(e.naam));
    if (mb.type === 'tafel') {
      const s0 = mb.stoelen || {}; const rh = mb.vorm === 'rechthoek';
      const zetStoel = (patch) => zet({ stoelen: { ...s0, ...patch } });
      return (
        <>
          <div className="fm-segment fm-bs-vorm">
            {[['rond', 'Rond'], ['ovaal', 'Ovaal'], ['rechthoek', 'Rechthoek'], ['halfrond', 'Halfrond']].map(([k, t]) => (
              <button key={k} className={mb.vorm === k ? 'aan' : ''} onClick={() => { if (k === mb.vorm) return; const n = { ...mb, vorm: k, d: k === 'rond' ? mb.b : mb.vorm === 'rond' ? (k === 'rechthoek' ? 0.8 : mb.b * 0.6) : mb.d }; n.stoelen = (k === 'rechthoek') === rh ? mb.stoelen : autoStoelen(n); bewaarMeubel(it, n); }}>{t}</button>
            ))}
          </div>
          <label className="fm-vink"><input type="checkbox" checked={!!mb.statafel} onChange={(e) => zet({ statafel: e.target.checked || undefined })} />Statafel (hoog)</label>
          <div className="fm-rij">
            {maatVeld(mb.vorm === 'rond' ? 'Diameter (m)' : mb.vorm === 'halfrond' ? 'Breedte (m)' : 'Lengte (m)', mb.b, (v) => zet({ b: v, ...(mb.vorm === 'rond' ? { d: v } : {}) }), `b${it.id}`)}
            {mb.vorm !== 'rond' && maatVeld(mb.vorm === 'halfrond' ? 'Diepte × 2 (m)' : 'Breedte (m)', mb.d, (v) => zet({ d: v }), `d${it.id}`)}
          </div>
          <div className="fm-bs-subkop" style={{ padding: '2px 0 0' }}>Stoelen · {zitMeubel(mb)}</div>
          {rh ? (
            <div className="fm-bs-zijden">
              {teller('Boven', s0.boven || 0, (v) => zetStoel({ boven: v }))}
              {teller('Onder', s0.onder || 0, (v) => zetStoel({ onder: v }))}
              {teller('Links', s0.links || 0, (v) => zetStoel({ links: v }))}
              {teller('Rechts', s0.rechts || 0, (v) => zetStoel({ rechts: v }))}
            </div>
          ) : (
            <div className="fm-rij">
              {teller('Aantal', s0.n || 0, (v) => zetStoel({ n: v }))}
              {mb.vorm !== 'halfrond' && <div className="fm-segment fm-bs-klein">{[['rondom', 'Rondom'], ['een', 'Eén kant']].map(([k, t]) => <button key={k} className={(s0.kant || 'rondom') === k ? 'aan' : ''} onClick={() => zetStoel({ kant: k })}>{t}</button>)}</div>}
            </div>
          )}
          <div className="fm-rij">
            <button className="fm-knop klein" onClick={() => zet({ stoelen: autoStoelen(mb) })}>Automatisch</button>
            {rh && <button className="fm-knop klein" onClick={() => { const a = autoStoelen(mb); zet({ stoelen: { boven: 0, onder: mb.b >= mb.d ? a.onder : 0, links: 0, rechts: mb.b >= mb.d ? 0 : a.rechts } }); }}>Eén kant</button>}
            <button className="fm-knop klein" onClick={() => zet({ stoelen: rh ? { boven: 0, onder: 0, links: 0, rechts: 0 } : { ...s0, n: 0 } })}>Geen</button>
          </div>
          {(huisTafels.length > 0 || huisStoelen.length > 0) && (
            <div className="fm-rij">
              {huisTafels.length > 0 && <label className="fm-bs-veld">Tafel van het huis<select value={it.element_id || ''} onChange={(e) => kiesHuisTafel(it, e.target.value || null)}><option value="">Eigen / gehuurd</option>{huisTafels.map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}</select></label>}
              {huisStoelen.length > 0 && <label className="fm-bs-veld">Stoelen van het huis<select value={mb.stoel_huis || ''} onChange={(e) => zet({ stoel_huis: e.target.value || null })}><option value="">Eigen / gehuurd</option>{huisStoelen.map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}</select></label>}
            </div>
          )}
        </>
      );
    }
    if (mb.type === 'rijen') return (
      <>
        <div className="fm-bs-zijden">
          {teller('Rijen', mb.rijen, (v) => zet({ rijen: Math.max(1, v) }), 80)}
          {teller('Per rij', mb.per_rij, (v) => zet({ per_rij: Math.max(1, v) }), 80)}
          {teller('Gang na', mb.gang_na || 0, (v) => zet({ gang_na: v }), 40)}
        </div>
        <div className="fm-rij">
          {maatVeld('Rijafstand (m)', mb.rijafstand || 0.9, (v) => zet({ rijafstand: v }), `ra${it.id}`)}
          {maatVeld('Stoelbreedte (m)', mb.stoelb || 0.5, (v) => zet({ stoelb: v }), `sb${it.id}`)}
          {maatVeld('Gang (m)', mb.gang || 1.2, (v) => zet({ gang: v }), `g${it.id}`)}
        </div>
        <label className="fm-vink"><input type="checkbox" checked={!!mb.tafels} onChange={(e) => zet({ tafels: e.target.checked, rijafstand: e.target.checked ? Math.max(mb.rijafstand || 0.9, 1.2) : mb.rijafstand })} /> Met tafels</label>
        {huisStoelen.length > 0 && <label className="fm-bs-veld">Stoelen van het huis<select value={mb.stoel_huis || ''} onChange={(e) => zet({ stoel_huis: e.target.value || null })}><option value="">Eigen / gehuurd</option>{huisStoelen.map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}</select></label>}
      </>
    );
    if (mb.type === 'deur' || mb.type === 'raam') return (
      <>
        <div className="fm-rij">
          {maatVeld('Breedte (m)', mb.b, (v) => zet({ b: v }), `b${it.id}`)}
          {maatVeld('Muurdikte (m)', mb.t || 0.2, (v) => zet({ t: v }), `t${it.id}`)}
        </div>
        {mb.type === 'deur' && (
          <div className="fm-rij">
            {!mb.dubbel && <button className="fm-knop klein" onClick={() => zet({ scharnier: mb.scharnier === 'r' ? 'l' : 'r' })}>Scharnier andere kant</button>}
            <button className="fm-knop klein" onClick={() => zet({ open: mb.open === 'uit' ? 'in' : 'uit' })}>Draait naar andere kant</button>
            <button className={`fm-knop klein${mb.dubbel ? ' zwart' : ''}`} onClick={() => zet({ dubbel: !mb.dubbel, b: !mb.dubbel && mb.b < 1.4 ? 1.8 : mb.b })}>Dubbel</button>
          </div>
        )}
      </>
    );
    if (mb.type === 'stoel') return huisStoelen.length > 0 ? <label className="fm-bs-veld">Stoel van het huis<select value={mb.stoel_huis || ''} onChange={(e) => zet({ stoel_huis: e.target.value || null })}><option value="">Eigen / gehuurd</option>{huisStoelen.map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}</select></label> : null;
    return <div className="fm-rij">{maatVeld('Breedte (m)', mb.b, (v) => zet({ b: v }), `b${it.id}`)}{maatVeld('Diepte (m)', mb.d, (v) => zet({ d: v }), `d${it.id}`)}</div>;
  };
  // Functies van een zaal: altijd, per fase of op data (bv. registratie 's ochtends, diner 's avonds).
  const FUNCTIES = ['Registratie', 'Plenaire zaal', 'Break-out', 'Catering', 'Diner', 'Receptie', 'Persruimte', 'Vestiaire', 'Backstage', 'Opslag', 'VIP'];
  const KLEUREN_F = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#4B5563'];
  const functieKaart = (r) => {
    const lijst = r.velden?.functies || []; const nuIds = (faseNu || dag) ? new Set(functiesNu(r).map((f) => f.id)) : new Set();
    const zet = (nl) => onWijzig(r.id, { velden: { ...(r.velden || {}), functies: nl } });
    const wijzig = (id, patch) => zet(lijst.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    return (
      <div className="fm-bs-functies">
        <div className="fm-bs-subkop" style={{ padding: 0 }}>Functie</div>
        {!lijst.length && <div className="fm-sub">Nog geen functie.</div>}
        {lijst.map((f) => (
          <div key={f.id} className={`fm-bs-functie-rij${nuIds.has(f.id) ? ' nu' : ''}`}>
            <div className="fm-rij">
              <span className="fm-bs-bol" style={{ background: f.kleur || '#2563EB' }} />
              <input list="fm-functies" disabled={!schrijven} defaultValue={f.naam} key={`fn${f.id}`} onBlur={(e) => { const v = e.target.value.trim(); if (v !== f.naam) wijzig(f.id, { naam: v }); }} onKeyDown={enterBlur} />
              {schrijven && <button className="fm-x" aria-label="Functie weg" onClick={() => zet(lijst.filter((x) => x.id !== f.id))}>×</button>}
            </div>
            <div className="fm-rij">
              <select disabled={!schrijven} value={f.fase_id ? `f:${f.fase_id}` : f.van || f.tot ? 'datum' : 'altijd'} onChange={(e) => { const v = e.target.value; wijzig(f.id, v === 'altijd' ? { fase_id: null, van: null, tot: null } : v === 'datum' ? { fase_id: null, van: f.van || new Date().toISOString().slice(0, 10), tot: f.tot || null } : { fase_id: v.slice(2), van: null, tot: null }); }}>
                <option value="altijd">Altijd</option>
                {fasen.map((fz) => <option key={fz.id} value={`f:${fz.id}`}>{fz.naam}</option>)}
                <option value="datum">Op datum…</option>
              </select>
            </div>
            {!f.fase_id && (f.van || f.tot) && (
              <div className="fm-bs-datums">
                <input type="date" aria-label="Van" disabled={!schrijven} value={f.van || ''} onChange={(e) => wijzig(f.id, { van: e.target.value || null })} />
                <span className="fm-sub">tot</span>
                <input type="date" aria-label="Tot" disabled={!schrijven} value={f.tot || ''} onChange={(e) => wijzig(f.id, { tot: e.target.value || null })} />
              </div>
            )}
            {schrijven && <div className="fm-bs-kleuren">{KLEUREN_F.map((k) => <button key={k} aria-label={`Kleur ${k}`} className={(f.kleur || '#2563EB') === k ? 'aan' : ''} style={{ background: k }} onClick={() => wijzig(f.id, { kleur: k })} />)}</div>}
          </div>
        ))}
        {schrijven && <button className="fm-knop klein" onClick={() => zet([...lijst, { id: Math.random().toString(36).slice(2, 9), naam: '', kleur: KLEUREN_F[lijst.length % KLEUREN_F.length], fase_id: lijst.length && actieveFase ? actieveFase : null, van: null, tot: null }])}>Functie toevoegen</button>}
        <datalist id="fm-functies">{FUNCTIES.map((x) => <option key={x} value={x} />)}</datalist>
      </div>
    );
  };
  // Maat, lijndikte, vulling en vorm van een getekende lijn of vlak.
  // Opmaak van een getekend item (lijn, pijl, maatlijn, vlak, rechthoek, cirkel, tekst), zoals in de tekenaar.
  const KLEUR_OPMAAK = ['#1d1d1b', '#6B7280', '#FFFFFF', '#2563EB', '#0891B2', '#16A34A', '#D97706', '#DC2626', '#DB2777', '#7C3AED'];
  const opmaakKaart = (it) => {
    const st0 = it.stijl || {}; const zetSt = (patch) => onWijzig(it.id, { stijl: { ...st0, ...patch } });
    const g = lokaalVan(it).geometrie; const lijnIs = g.type === 'LineString'; const vlakIs = g.type === 'Polygon'; const tekstIs = it.soort === 'tekst';
    const seg = (label, waarde, opties, zet) => (
      <div className="fm-bs-veld"><span>{label}</span>
        <div className="fm-segment fm-bs-seg" role="group" aria-label={label}>{opties.map(([v, t, tip]) => <button key={String(v)} type="button" title={tip || t} className={waarde === v ? 'aan' : ''} onClick={() => zet(v)}>{t}</button>)}</div>
      </div>
    );
    const kleuren = (waarde, zet, geen) => (
      <div className="fm-bs-kleuren">
        {geen && <button type="button" aria-label="Geen" title="Geen" className={!waarde ? 'aan geen' : 'geen'} onClick={() => zet(null)} />}
        {KLEUR_OPMAAK.map((k) => <button key={k} type="button" aria-label={`Kleur ${k}`} className={(waarde || '').toLowerCase() === k.toLowerCase() ? 'aan' : ''} style={{ background: k }} onClick={() => zet(k)} />)}
        <input type="color" aria-label="Eigen kleur" value={/^#[0-9a-f]{6}$/i.test(waarde || '') ? waarde : '#1d1d1b'} onChange={(e) => zet(e.target.value)} />
      </div>
    );
    return (
      <div className="fm-bs-opmaak">
        <div className="fm-bs-subkop" style={{ padding: 0 }}>Opmaak</div>
        <div className="fm-bs-veld"><span>{tekstIs ? 'Kleur' : 'Lijn'}</span>{kleuren(st0.kleur || '#1d1d1b', (k) => zetSt({ kleur: k || '#1d1d1b' }))}</div>
        {!tekstIs && seg('Dikte', Number(st0.dikte) || 2, [[1, '1'], [2, '2'], [3, '3'], [5, '5'], [8, '8']], (v) => zetSt({ dikte: v }))}
        {!tekstIs && seg('Stijl', st0.streep || 'vol', [['vol', '———', 'Vol'], ['streep', '- - -', 'Streep'], ['stip', '· · ·', 'Stippel']], (v) => zetSt({ streep: v }))}
        {lijnIs && seg('Pijl', st0.pijl || 'geen', [['geen', 'Geen'], ['eind', '→', 'Pijl op het einde'], ['begin', '←', 'Pijl aan het begin'], ['beide', '↔', 'Pijl aan beide kanten']], (v) => zetSt({ pijl: v === 'geen' ? null : v }))}
        {lijnIs && <label className="fm-vink"><input type="checkbox" checked={!!st0.maat} onChange={(e) => zetSt({ maat: e.target.checked || null })} />Lengte tonen (maatlijn)</label>}
        {vlakIs && <div className="fm-bs-veld"><span>Vulling</span>{kleuren(st0.vulkleur || st0.kleur || '#2563EB', (k) => zetSt({ vulkleur: k, vuldekking: k ? (st0.vuldekking > 0 ? st0.vuldekking : 0.35) : 0 }), true)}</div>}
        {vlakIs && (st0.vuldekking ?? 0.15) > 0 && seg('Dekking', st0.vuldekking ?? 0.15, [[0.15, 'Licht'], [0.35, 'Half'], [0.7, 'Sterk'], [1, 'Vol']], (v) => zetSt({ vuldekking: v }))}
        {tekstIs && seg('Grootte', Number(st0.tekstgrootte) || 13, [[11, 'S'], [13, 'M'], [18, 'L'], [26, 'XL'], [40, 'XXL']], (v) => zetSt({ tekstgrootte: v }))}
        {tekstIs && (
          <div className="fm-rij">
            <label className="fm-vink"><input type="checkbox" checked={!!st0.vet} onChange={(e) => zetSt({ vet: e.target.checked || null })} />Vet</label>
            <label className="fm-vink"><input type="checkbox" checked={!!st0.kader} onChange={(e) => zetSt({ kader: e.target.checked || null })} />Witte achtergrond</label>
          </div>
        )}
      </div>
    );
  };
  const vormKaart = (it) => {
    const l = lokaalVan(it); const g = l.geometrie; const ring = puntenVan(g); const k = kaderVan([ring]);
    const st0 = it.stijl || {}; const zetSt = (patch) => onWijzig(it.id, { stijl: { ...st0, ...patch } });
    const schaal = (fx, fy) => { const c = [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2]; bewaarLokaal(it, { ...l, geometrie: mapG(g, ([x, y]) => [r3(c[0] + (x - c[0]) * fx), r3(c[1] + (y - c[1]) * fy)]) }); };
    const lengte = g.type === 'LineString' ? ring.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - ring[i - 1][0], p[1] - ring[i - 1][1]) : 0), 0) : 0;
    const b = k[2] - k[0]; const h = k[3] - k[1];
    return (
      <>
        {g.type === 'Polygon' ? (
          <div className="fm-rij">
            {maatVeld('Breedte (m)', r3(b), (v) => b > 0 && schaal(v / b, 1), `vb${it.id}`)}
            {maatVeld('Diepte (m)', r3(h), (v) => h > 0 && schaal(1, v / h), `vd${it.id}`)}
            <span className="fm-sub fm-bs-geenbreuk" style={{ alignSelf: 'flex-end', paddingBottom: 6 }}>{getal(oppervlakte(ring), 1)} m²</span>
          </div>
        ) : (
          <div className="fm-rij">{maatVeld('Lengte (m)', r3(lengte), (v) => { if (!(lengte > 0)) return; const f = v / lengte; const o = ring[0]; bewaarLokaal(it, { ...l, geometrie: { type: 'LineString', coordinates: ring.map(([x, y]) => [r3(o[0] + (x - o[0]) * f), r3(o[1] + (y - o[1]) * f)]) } }); }, `vl${it.id}`)}</div>
        )}
        <div className="fm-rij"><button className={`fm-knop klein${vormZaal === it.id ? ' zwart' : ''}`} onClick={() => setVormZaal(vormZaal === it.id ? null : it.id)}>{vormZaal === it.id ? 'Klaar' : 'Vorm aanpassen'}</button></div>
      </>
    );
  };
  // Branding op een frame (per zijde) of pipe & drape (per sectie).
  const brandingKaart = (it) => {
    const el = elementenMap.get(it.element_id);
    if (el && isWand(el)) {
      const c = lokaalVan(it).geometrie.coordinates || []; const L = c.slice(1).map((p, k) => Math.hypot(p[0] - c[k][0], p[1] - c[k][1]));
      return <WandBouwer it={it} el={el} lengtes={L} doeken={doeken.filter((d) => ontwerpDrager(d) === 'frame')} schrijven={schrijven} onZet={(wand, g, pts) => { if (pts) { const n = naarItem({ geometrie: { type: 'LineString', coordinates: pts }, midden: null, rot: null }); onWijzig(it.id, { geometrie: n.geometrie, velden: { ...(it.velden || {}), wand, binnen: { ...it.velden.binnen, lokaal: n.lokaal } } }); } else onWijzig(it.id, { velden: { ...(it.velden || {}), wand } }); }} totaalTelling={telAlleWanden(items, elementenMap)} elementenMap={elementenMap} />;
    }
    if (!el || (!isFrame(el) && !isDrape(el))) return null;
    const drager = isFrame(el) ? 'frame' : 'drape'; const lijst = doeken.filter((d) => ontwerpDrager(d) === drager);
    if (isFrame(el)) {
      const ZIJ = zijdenVan(el);
      return (
        <div className="fm-bs-functies">
          <div className="fm-bs-subkop" style={{ padding: 0 }}>Doeken</div>
          {ZIJ.map((n, k) => (
            <label key={k} className="fm-bs-veld">{n}
              <select value={it.velden?.[`paneel_${k + 1}`] || ''} disabled={!schrijven} onChange={(e) => onWijzig(it.id, { velden: { ...(it.velden || {}), [`paneel_${k + 1}`]: e.target.value || null } })}>
                <option value="">Geen doek</option>
                {lijst.map((d) => <option key={d.id} value={d.id}>{d.naam}</option>)}
              </select>
            </label>
          ))}
          {!lijst.length && <span className="fm-sub">Nog geen frame-doeken: voeg ze toe in de werkruimte Branding.</span>}
        </div>
      );
    }
    const n = sectiesVan(lokaalVan(it).geometrie.coordinates || [], Number(el.eenheid_m) || 3).length; const dk = Array.from({ length: n }, (_, k) => (it.velden?.doeken || [])[k] || null);
    const zet = (nl) => onWijzig(it.id, { velden: { ...(it.velden || {}), doeken: nl.some(Boolean) ? nl : null } });
    return (
      <div className="fm-bs-functies">
        <div className="fm-bs-subkop" style={{ padding: 0 }}>Doek per sectie · {n}</div>
        {dk.map((id, k) => (
          <label key={k} className="fm-bs-veld">Sectie {k + 1}
            <select value={id || ''} disabled={!schrijven} onChange={(e) => { const nl = [...dk]; nl[k] = e.target.value || null; zet(nl); }}>
              <option value="">Gordijn (geen print)</option>
              {lijst.map((d) => <option key={d.id} value={d.id}>{d.naam}</option>)}
            </select>
          </label>
        ))}
        {!lijst.length && <span className="fm-sub">Nog geen drape-doeken: voeg ze toe in de werkruimte Branding.</span>}
      </div>
    );
  };
  // Alleen bekijken (deel-link): nette infokaarten in plaats van invulvelden.
  const datum = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00`).toLocaleDateString(taal === 'fr' ? 'fr-BE' : taal === 'en' ? 'en-GB' : 'nl-BE', { day: 'numeric', month: 'short' }) : '');
  const wanneer = (f) => (f.fase_id ? fasen.find((x) => x.id === f.fase_id)?.naam || '' : f.van || f.tot ? `${datum(f.van)}${f.tot && f.tot !== f.van ? ` ${tx.tot} ${datum(f.tot)}` : ''}` : '');
  const zaalLeesKaart = (r) => {
    const t = perRuimte.get(r.id) || { zit: 0 }; const max = Number(r.velden?.max_personen) || 0;
    const fl = (r.velden?.functies || []).filter((f) => f.naam);
    return (
      <div className="fm-bs-lees">
        <div className="fm-bs-lees-kop"><strong>{r.naam || 'Ruimte'}</strong><button className="fm-x" aria-label={tx.sluiten} onClick={() => setActieveRuimte(null)}>×</button></div>
        <div className="fm-bs-lees-cijfers">
          <span><b>{Math.round(oppervlakte(puntenVan(lokaalVan(r).geometrie)))}</b> m²</span>
          {t.zit > 0 && <span><b>{t.zit}</b> {tx.zitplaatsen}</span>}
          {max > 0 && <span><b>{max}</b> {tx.maxPers}</span>}
        </div>
        {fl.length > 0 && (
          <div className="fm-bs-lees-blok">
            <div className="fm-bs-lees-label">{fl.length > 1 ? tx.functies : tx.functie}</div>
            {fl.map((f) => <div key={f.id} className="fm-bs-lees-functie"><i style={{ background: f.kleur || '#2563EB' }} /><span>{f.naam}</span>{wanneer(f) && <small>{wanneer(f)}</small>}</div>)}
          </div>
        )}
        <FotoStrook key={r.id} planId={host.plan_id} itemId={r.id} schrijven={false} titel={tx.fotos} vast={fotosVast ? fotosVast.get(r.id) || [] : null} kolommen={2} tekst={tx} />
      </div>
    );
  };
  // Naam, stoelen en herkomst van een item: welke tafel, welke stoelen, van het huis of eigen.
  const omschrijf = (it) => {
    const mb = it.velden?.meubel; const el = it.element_id ? elementenMap.get(it.element_id) : null; const pt = it.velden?.punt ? PUNT[it.velden.punt.type] : null;
    const huisEl = el?.eigenschappen?.huis ? el : null;
    const stoelEl = mb?.stoel_huis ? elementenMap.get(mb.stoel_huis) : null;
    const naam = huisEl?.naam || (mb?.type === 'stoel' && stoelEl?.naam) || (mb && naamMeubel(mb.type === 'tafel' ? { ...mb, stoelen: {} } : mb)) || it.naam || el?.naam || pt?.naam || 'Item';
    const z = mb && mb.type !== 'stoel' ? zitMeubel(mb) : 0;
    const stoelen = z ? `${z} × ${vn(stoelEl?.naam || 'Stoel')} · ${stoelEl ? tx.huis : tx.eigen}` : null;
    const herkomst = mb || huisEl ? ((huisEl || (mb?.type === 'stoel' && stoelEl)) ? tx.huis : tx.eigen) : null;
    return { naam: vn(naam), stoelen, herkomst };
  };
  const leesKaart = (it) => {
    const mb = it.velden?.meubel; const el = elementenMap.get(it.element_id); const pt = it.velden?.punt ? PUNT[it.velden.punt.type] : null;
    const om = omschrijf(it); const naam = om.naam;
    const mt = mb ? maatMeubel(mb) : null;
    const b = mt?.b || Number(it.parameters?.breedte) || Number(el?.breedte_m); const h = mt?.h || Number(it.parameters?.diepte) || Number(el?.diepte_m);
    const z = mb ? zitMeubel(mb) : zitVan(el);
    const r = ruimtes.find((x) => { const l = lokaalVan(it); const p = l.midden || puntenVan(l.geometrie)[0]; return p && binnenVeelhoek(p, puntenVan(lokaalVan(x).geometrie)); });
    return (
      <div className="fm-bs-lees">
        <div className="fm-bs-lees-kop"><strong>{it.velden?.functie || naam}</strong><button className="fm-x" aria-label={tx.sluiten} onClick={() => setSel([])}>×</button></div>
        <div className="fm-sub">{[it.velden?.functie ? naam : null, om.herkomst, r ? `${tx.in} ${r.naam}` : null].filter(Boolean).join(' · ')}</div>
        {om.stoelen && <div className="fm-sub">{om.stoelen}</div>}
        {el && isCamera(el) && <button type="button" className="fm-knop zwart klein" style={{ alignSelf: 'flex-start', margin: '6px 0' }} onClick={() => setCamBeeld(it.id)}>Camerabeeld bekijken</button>}
        {el && ((isWand(el) && isVrij(it)) || isTrussBouw(it)) && (
          <button type="button" className="fm-bs-lees-3d" title="In 3D bekijken over het hele scherm" onClick={() => setGroot3d(it.id)}>
            {isTrussBouw(it) ? <TrussZicht it={it} el={el} doeken={[...elementenMap.values()].filter((x) => x.tekenwijze === 'doek')} /> : <WandZicht it={it} el={el} elementenMap={elementenMap} />}
            <span className="fm-bs-lees-3d-tip">⤢ In 3D bekijken</span>
          </button>
        )}
        <div className="fm-bs-lees-cijfers">
          {b > 0 && h > 0 && lokaalVan(it).geometrie.type === 'Polygon' && <span><b>{getal(b, 2)} × {getal(h, 2)}</b> m</span>}
          {z > 1 && <span><b>{z}</b> {tx.zitplaatsen}</span>}
        </div>
        {el && (isFrame(el) || isDrape(el) || isWand(el) || el.eigenschappen?.totem) && (
          <div className="fm-bs-lees-blok"><div className="fm-bs-lees-label">{tx.doeken}</div><OntwerpDuimen it={it} el={el} elementenMap={elementenMap} zijNamen={tx} max={8} groot tekst={tx} /></div>
        )}
        {it.velden?.opmerking && <div className="fm-bs-lees-blok"><div className="fm-bs-lees-label">{tx.opmerking}</div><div>{it.velden.opmerking}</div></div>}
      </div>
    );
  };
  const huisKeuze = (e) => {
    const tpl = e.eigenschappen?.meubel;
    if (tpl) return tpl.type === 'stoel' ? { id: e.id, naam: e.naam, tekenwijze: 'schaal', meubel: { type: 'stoel', stoel_huis: e.id } } : { id: e.id, naam: e.naam, tekenwijze: 'schaal', meubel: { ...tpl }, huisEl: e.id };
    const tf = e.eigenschappen?.tafel; if (!tf || tf.vorm === 'punt') return e;
    const mb = { type: 'tafel', vorm: tf.vorm, b: tf.b, d: tf.vorm === 'rond' ? tf.b : tf.d };
    const z = Number(e.eigenschappen?.zitplaatsen) || 0;
    mb.stoelen = tf.vorm === 'rechthoek' ? { boven: Math.ceil(z / 2), onder: Math.floor(z / 2), links: 0, rechts: 0 } : { n: z, kant: 'rondom' };
    return { id: e.id, naam: e.naam, tekenwijze: 'schaal', meubel: mb, huisEl: e.id };
  };
  const huisRij = (e) => {
    const n = huisGebruikt.get(e.id) || 0; const max = Number(e.eigenschappen?.huis?.aantal) || 0;
    return (
      <div key={e.id} className={`fm-bs-huisrij${kiesEl?.id === e.id ? ' aan' : ''}${max && n >= max ? ' vol' : ''}`}>
        <button className="naam" title={e.naam} disabled={!schrijven} onClick={() => { setKiesEl(kiesEl?.id === e.id ? null : huisKeuze(e)); setModus(null); setRuimteKlik(false); setSel([]); }}>
          <span>{e.naam}</span>
          <small>{e.tekenwijze === 'punt' ? 'Punt' : e.eigenschappen?.tafel ? (e.eigenschappen.tafel.vorm === 'rond' ? `Ø ${getal(e.eigenschappen.tafel.b, 2)} m` : `${getal(e.eigenschappen.tafel.b, 2)} × ${getal(e.eigenschappen.tafel.d, 2)} m`) : `${getal(Number(e.breedte_m) || 0, 2)} × ${getal(Number(e.diepte_m) || 0, 2)} m`}{zitVan(e) ? ` · ${zitVan(e)} zitpl.` : ''}</small>
        </button>
        <span className="tel">{max ? (n >= max && n ? 'Alles geplaatst' : `${n} / ${max}`) : n || ''}{max && n > max ? ` (${n} / ${max})` : ''}</span>
        {schrijven && <button className="fm-bs-potlood" aria-label={`${e.naam} bewerken`} onClick={() => setHuisForm({ id: e.id, naam: e.naam, aantal: e.eigenschappen?.huis?.aantal ?? '', vorm: e.tekenwijze === 'punt' ? 'punt' : e.eigenschappen?.tafel?.vorm || 'basis', b: e.eigenschappen?.tafel?.b ?? e.breedte_m ?? '', d: e.eigenschappen?.tafel?.d ?? e.diepte_m ?? '', zit: e.eigenschappen?.zitplaatsen ?? '', basis: e.id })}>✎</button>}
      </div>
    );
  };

  // Export vanuit het algemene exportmenu: het binnenplan opent en maakt meteen de pdf.
  useEffect(() => {
    if (!autoPdf || wachtOpPlan || laden || !maat.w) return undefined;
    const t = setTimeout(() => { maakPdfBinnen().finally(() => onPdfKlaar?.()); }, 600);
    return () => clearTimeout(t);
  }, [autoPdf, wachtOpPlan, laden, maat.w]); // eslint-disable-line react-hooks/exhaustive-deps
  // ---------- Getekende lijn of vlak exact maken: lengte per zijde, straal van een cirkel ----------
  const zijdenKaart = (it) => {
    const g = lokaalVan(it).geometrie; const dicht = g.type === 'Polygon'; const cir = it.stijl?.cirkel;
    const pts = dicht ? g.coordinates[0].slice(0, -1) : g.coordinates;
    const geo = (q) => (dicht ? { type: 'Polygon', coordinates: [[...q, q[0]]] } : { type: 'LineString', coordinates: q });
    const zet = (q, stijl) => { const n = naarItem({ ...lokaalVan(it), geometrie: geo(q.map((c) => c.map(r3))) }, { parameters: it.parameters }); onWijzig(it.id, { geometrie: n.geometrie, parameters: n.parameters, ...(stijl ? { stijl: { ...(it.stijl || {}), ...stijl } } : {}), velden: { ...(it.velden || {}), binnen: { ...it.velden.binnen, lokaal: n.lokaal, vorm: null } } }); };
    if (cir) {
      const cm = [pts.reduce((x, q) => x + q[0], 0) / pts.length, pts.reduce((x, q) => x + q[1], 0) / pts.length]; // midden uit de vorm zelf (ook na verschuiven)
      const zetR = (v) => { if (!(v > 0.02)) return; const ring = Array.from({ length: 36 }, (_, i) => { const t = (i / 36) * 2 * Math.PI; return [cm[0] + Math.cos(t) * v, cm[1] + Math.sin(t) * v]; }); zet(ring, { cirkel: { m: cm.map(r3), r: r3(v) } }); };
      return <div className="fm-rij">{maatVeld('Straal (m)', r3(cir.r), zetR, `cr${it.id}${cir.r}`)}{maatVeld('Diameter (m)', r3(cir.r * 2), (v) => zetR(v / 2), `cd${it.id}${cir.r}`)}</div>;
    }
    const n = dicht ? pts.length : pts.length - 1; if (n < 1 || n > 24) return null;
    const lengte = (i) => { const a = pts[i]; const b = pts[(i + 1) % pts.length]; return Math.hypot(b[0] - a[0], b[1] - a[1]); };
    // Open lijn: alles na deze zijde schuift mee. Vlak: wat voorbij het midden van de zijde ligt schuift mee (blijft haaks).
    const zetZijde = (i, v) => {
      const L = lengte(i); if (!(v > 0.01) || L < 1e-6) return;
      const a = pts[i]; const b = pts[(i + 1) % pts.length]; const ux = (b[0] - a[0]) / L; const uy = (b[1] - a[1]) / L; const dlt = v - L;
      if (!dicht) { zet(pts.map((q, j) => (j > i ? [q[0] + ux * dlt, q[1] + uy * dlt] : q))); return; }
      const mid = ((a[0] + b[0]) / 2) * ux + ((a[1] + b[1]) / 2) * uy;
      zet(pts.map((q) => (q[0] * ux + q[1] * uy > mid + 1e-9 ? [q[0] + ux * dlt, q[1] + uy * dlt] : q)));
    };
    const tot = Array.from({ length: n }, (_, i) => lengte(i)).reduce((a, b) => a + b, 0);
    return (
      <div className="fm-bs-veld" style={{ gap: 4 }}>
        <span>{dicht ? `Zijden · omtrek ${getal(tot, 2)} m · ${getal(oppervlakte([...pts, pts[0]]), 2)} m²` : `Lengte ${getal(tot, 2)} m`}</span>
        <div className="fm-bs-zijden">
          {Array.from({ length: n }, (_, i) => <label key={i}><small>{i + 1}</small><input key={`z${it.id}${i}${r3(lengte(i))}`} type="number" step="0.05" min="0.01" defaultValue={r3(lengte(i))} onBlur={(e) => { const v = parseFloat(e.target.value); if (Math.abs(v - lengte(i)) > 0.0005) zetZijde(i, v); }} onKeyDown={enterBlur} /></label>)}
        </div>
      </div>
    );
  };

  // ---------- PDF van dit binnenplan ----------
  // Het plan zoals op het scherm (passend gezet), als beeld in hoge resolutie, met titel, schaalbalk,
  // zalen en een telling van wat er staat.
  const [pdfBezig, setPdfBezig] = useState(false);
  const [groot3d, setGroot3d] = useState(null); // wand of truss in 3D over het hele scherm
  const [camBeeld, setCamBeeld] = useState(null); // camerabeeld van deze camera (item-id)
  const inrichtingRef = useRef([]); inrichtingRef.current = inrichting;
  // Rechtstreekse link naar een camerabeeld: meteen openen zodra de camera er is.
  const beginCamGedaan = useRef(false);
  useEffect(() => { if (!beginCamera || beginCamGedaan.current) return; if (inrichting.some((x) => x.id === beginCamera)) { beginCamGedaan.current = true; setCamBeeld(beginCamera); } }, [beginCamera, inrichting]);
  useEffect(() => { if (!groot3d) return undefined; const t = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); setGroot3d(null); } }; window.addEventListener('keydown', t, true); return () => window.removeEventListener('keydown', t, true); }, [groot3d]);
  const maakPdfBinnen = async () => {
    if (pdfBezig) return;
    setPdfBezig(true); setSel([]); setActieveRuimte(null); passend();
    try {
      await new Promise((ok) => setTimeout(ok, 350));
      const bron = svgRef.current; if (!bron) return;
      const W0 = bron.clientWidth; const H0 = bron.clientHeight; const sPx = beeldRef.current?.s || 20;
      const kloon = bron.cloneNode(true);
      kloon.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); kloon.setAttribute('width', W0); kloon.setAttribute('height', H0); kloon.setAttribute('viewBox', `0 0 ${W0} ${H0}`);
      // Stijlen uit de css meegeven (een losse svg kent die niet).
      const EIG = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-size', 'font-weight', 'font-family', 'paint-order', 'text-anchor', 'dominant-baseline', 'display', 'visibility'];
      const o = bron.querySelectorAll('*'); const k = kloon.querySelectorAll('*');
      for (let i = 0; i < o.length; i++) {
        const cs = getComputedStyle(o[i]); const st = EIG.map((e) => `${e}:${cs.getPropertyValue(e)}`).join(';');
        k[i].setAttribute('style', `${st};${k[i].getAttribute('style') || ''}`);
      }
      // Beelden (grondplan, foto's) inbakken als data-URL.
      for (const im of kloon.querySelectorAll('image')) {
        const url = im.getAttribute('href') || im.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (!url || url.startsWith('data:')) continue;
        try { const bl = await (await fetch(url)).blob(); const du = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(bl); }); im.setAttribute('href', du); } catch { im.remove(); }
      }
      const tekst = new XMLSerializer().serializeToString(kloon);
      const url = URL.createObjectURL(new Blob([tekst], { type: 'image/svg+xml' }));
      const img = await new Promise((ok, nok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => nok(new Error('Plan kon niet omgezet worden.')); i.src = url; });
      const k2 = Math.min(4, 4200 / W0); const cv = document.createElement('canvas'); cv.width = Math.round(W0 * k2); cv.height = Math.round(H0 * k2);
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
      const PB = 420; const PH = 297; const M = 12; const ZIJ = 92;
      // Kop
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(29, 29, 27);
      doc.text(`${naamHost} · ${verdNaam}`, M, M + 6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(104, 109, 118);
      doc.text(`Binnenplan · ${new Date().toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}`, M, M + 12);
      // Plan
      const vx = M; const vy = M + 18; const vb = PB - 2 * M - ZIJ - 6; const vh = PH - vy - M;
      const sc = Math.min(vb / W0, vh / H0); const ib = W0 * sc; const ih = H0 * sc;
      doc.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', vx, vy, ib, ih);
      doc.setDrawColor(218, 221, 227); doc.setLineWidth(0.2); doc.rect(vx, vy, ib, ih);
      // Schaalbalk: mm op papier per meter
      const mmPerM = sc * sPx; const stappen = [0.5, 1, 2, 5, 10, 20, 50, 100]; const L = stappen.find((x) => x * mmPerM >= 25) || 100;
      const bx = vx + 6; const by = vy + ih - 8;
      doc.setFillColor(255, 255, 255); doc.rect(bx - 2, by - 6, L * mmPerM + 18, 10, 'F');
      doc.setFillColor(29, 29, 27); doc.rect(bx, by, (L * mmPerM) / 2, 1.6, 'F'); doc.setDrawColor(29, 29, 27); doc.rect(bx, by, L * mmPerM, 1.6);
      doc.setFontSize(8); doc.setTextColor(29, 29, 27); doc.text('0', bx, by - 1.5); doc.text(`${getal(L, 1)} m`, bx + L * mmPerM, by - 1.5, { align: 'center' });
      // Zijkolom: zalen en telling
      let y = vy + 2; const zx = PB - M - ZIJ;
      const kop = (t) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(29, 29, 27); doc.text(t, zx, y); y += 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); };
      const rij = (a, b2) => { if (y > PH - M - 4) return; doc.setTextColor(29, 29, 27); doc.text(doc.splitTextToSize(String(a), ZIJ - 14)[0], zx, y); doc.text(String(b2), zx + ZIJ, y, { align: 'right' }); y += 4.4; };
      if (ruimtes.length) { kop(tx.ruimtes); for (const rz of [...ruimtes].sort((a, b2) => String(a.naam || '').localeCompare(String(b2.naam || ''), 'nl', { numeric: true }))) rij(rz.naam || 'Ruimte', `${Math.round(oppervlakte(puntenVan(lokaalVan(rz).geometrie)))} m²`); y += 3; }
      if (telEigen.length) { kop(tx.eigen || 'Materiaal'); for (const [n, c] of telEigen) rij(vn(n), c); y += 3; }
      if (telHuis.length) { kop(tx.huis); for (const [n, c] of telHuis) rij(vn(n), c); }
      doc.save(`${naamHost} - ${verdNaam}.pdf`.replace(/[\\/:*?"<>|]+/g, '-'));
    } catch (e) { setMelding?.(e?.message || 'PDF maken lukte niet.'); } finally { setPdfBezig(false); }
  };

  // ---------- Tekenen met de tekenaar van de bibliotheek ----------
  // Lijnen, vlakken, rechthoeken, cirkels en teksten worden items van deze verdieping; de vorm zelf
  // (rechthoek, bogen, …) blijft bewaard in velden.binnen.vorm, zodat je ze later weer zo bewerkt.
  const getekend = (it) => !it.element_id && !it.velden?.meubel && !it.velden?.ruimte && !it.velden?.punt && ['lijn', 'vlak', 'tekst'].includes(it.soort);
  // Vorm ↔ item. De bewaarde vorm (rechthoek, cirkel, bogen) telt zolang de geometrie klopt; is het item
  // intussen verschoven, dan schuift de vorm mee; anders valt hij terug op de gewone lijn of het vlak.
  // De opmaak van het item (kleur, dikte, pijl, maat) gaat altijd voor.
  const tekenSchaal = useRef(26); // px per meter van het plan toen de tekenaar openging: tekst even groot als op het plan
  const D_PX = 0.015; // lijndikte: 1 px op het binnenplan = 1,5 cm in de tekenaar
  const opmaakNaarVorm = (it, v) => {
    const st0 = it.stijl || {}; const u = { ...v };
    const streep = st0.streep && st0.streep !== 'vol' ? st0.streep : undefined;
    if (v.soort === 'tekst') { u.tekst = it.naam || ''; u.kleur = st0.kleur || '#1d1d1b'; u.h = r3((Number(st0.tekstgrootte) || 13) / tekenSchaal.current); u.vet = !!st0.vet || undefined; return u; }
    u.lijn = st0.kleur || '#1d1d1b'; u.d = (Number(st0.dikte) || 2) * D_PX; u.streep = streep;
    if (v.soort === 'lijn') { u.pijl = st0.pijl || null; u.maat = st0.maat || null; } else u.vul = (st0.vuldekking ?? 0.15) > 0 ? (st0.vulkleur || st0.kleur || '#2563EB') : null;
    return u;
  };
  const naarVorm = (it) => {
    const g = lokaalVan(it).geometrie;
    const bewaard = it.velden?.binnen?.vorm;
    if (bewaard) {
      const echt = g.type === 'Point' ? [g.coordinates] : g.type === 'LineString' ? g.coordinates : g.coordinates[0].slice(0, -1);
      const vp = bewaard.soort === 'tekst' ? [[bewaard.x, bewaard.y]] : vormPunten(bewaard);
      if (vp.length === echt.length && vp.length) {
        const dx = echt[0][0] - vp[0][0]; const dy = echt[0][1] - vp[0][1];
        if (vp.every((q, i) => Math.abs(echt[i][0] - q[0] - dx) < 0.02 && Math.abs(echt[i][1] - q[1] - dy) < 0.02)) {
          const v = Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001 ? schuifVorm(bewaard, dx, dy) : bewaard;
          return opmaakNaarVorm(it, { ...v, id: it.id });
        }
      }
    }
    if (it.soort === 'tekst') { const c = g.coordinates; return opmaakNaarVorm(it, { id: it.id, soort: 'tekst', x: c[0], y: c[1], tekst: '', h: 0.5, rot: 0 }); }
    if (g.type === 'LineString') return opmaakNaarVorm(it, { id: it.id, soort: 'lijn', pts: g.coordinates });
    return opmaakNaarVorm(it, { id: it.id, soort: 'vlak', pts: g.coordinates[0].slice(0, -1) });
  };
  const vanVorm = (v) => {
    const streep = { streep: v.streep && v.streep !== 'vol' ? (v.streep === 'stip' ? 'stip' : 'streep') : null };
    const dikte = Math.max(1, Math.min(12, Math.round((Number(v.d) || 0.03) / D_PX)));
    if (v.soort === 'tekst') return { soort: 'tekst', naam: v.tekst || null, lok: { geometrie: { type: 'Point', coordinates: [r3(v.x), r3(v.y)] }, midden: [r3(v.x), r3(v.y)], rot: null }, stijl: { kleur: v.kleur || '#1d1d1b', tekstgrootte: Math.max(8, Math.min(80, Math.round((Number(v.h) || 0.5) * tekenSchaal.current))), vet: v.vet || null } };
    const pts = vormPunten(v).map((q) => q.map(r3));
    if (v.soort === 'lijn') return { soort: 'lijn', lok: { geometrie: { type: 'LineString', coordinates: pts }, midden: null, rot: null }, stijl: { kleur: v.lijn || '#1d1d1b', dikte, pijl: v.pijl || null, maat: v.maat || null, ...streep } };
    return { soort: 'vlak', lok: { geometrie: { type: 'Polygon', coordinates: [[...pts, pts[0]]] }, midden: null, rot: null }, stijl: { kleur: v.lijn || v.vul || '#1d1d1b', vulkleur: v.vul || null, vuldekking: v.vul ? 0.35 : 0, dikte, ...streep } };
  };
  // Live doorvoeren: elke afgeronde wijziging in de tekenaar gaat meteen naar het plan (en de ongedaan-historie).
  const tekenIds = useRef(new Map()); // vorm-id → item-id (nieuwe vormen)
  const tekenTimer = useRef(null);
  const pasVormenToe = (lijst) => {
    if (!lijst) return;
    const bestaand = new Map(inrichting.filter(getekend).map((it) => [it.id, it]));
    const gezien = new Set();
    for (const v of lijst) {
      const { id: vid, ...vorm } = v; const r = vanVorm(v);
      const iid = bestaand.has(vid) ? vid : tekenIds.current.get(vid); const it = iid ? bestaand.get(iid) : null;
      if (it) {
        gezien.add(it.id);
        if (JSON.stringify(naarVorm(it)) === JSON.stringify({ ...opmaakNaarVorm(it, v), id: it.id }) && JSON.stringify(it.velden?.binnen?.vorm || null) === JSON.stringify(vorm)) continue;
        const n = naarItem(r.lok, { parameters: it.parameters });
        onWijzig(it.id, { soort: r.soort, naam: r.soort === 'tekst' ? r.naam : it.naam, geometrie: n.geometrie, parameters: n.parameters, stijl: { ...(it.stijl || {}), ...r.stijl }, velden: { ...(it.velden || {}), binnen: { ...it.velden.binnen, lokaal: n.lokaal, vorm } } });
      } else if (!iid) {
        const n = naarItem(r.lok);
        const x = onMaak({ soort: r.soort, naam: r.soort === 'tekst' ? r.naam : null, geometrie: n.geometrie, parameters: n.parameters, stijl: r.stijl, velden: { binnen: { host: host.id, verd, lokaal: n.lokaal, vorm } } });
        if (x?.id) { tekenIds.current.set(vid, x.id); gezien.add(x.id); }
      } else gezien.add(iid);
    }
    const weg = [...bestaand.keys()].filter((x) => !gezien.has(x));
    if (weg.length) onVerwijder(weg);
  };
  const tekenWijzig = (lijst, info) => {
    tekenRef.current = lijst; clearTimeout(tekenTimer.current);
    if (info?.bezig) return;
    tekenTimer.current = setTimeout(() => pasVormenToe(tekenRef.current), 250);
  };
  const tekenKlaar = () => {
    clearTimeout(tekenTimer.current);
    if (tekenRef.current) pasVormenToe(tekenRef.current);
    tekenRef.current = null; tekenIds.current = new Map(); setTekenvel(false); setSel([]);
  };
  const openTekenaar = (ids = [], tool = 'selecteer') => { tekenSchaal.current = B.s || 26; startModus(null); setSel([]); setTekenSel(ids); setTekenTool(tool); tekenIds.current = new Map(); setTekenvel(true); };
  // Achtergrond in de tekenaar: grondplan, zalen en de rest van de inrichting (in meter, één keer opgebouwd).
  const tekenAchter = useMemo(() => {
    if (!tekenvel) return null;
    const dW = (pts, dicht) => pts.map((q, i) => `${i ? 'L' : 'M'}${q[0]} ${q[1]}`).join('') + (dicht ? 'Z' : '');
    const grond = plan.lijnen.map((l) => dW(l.c, false)).join('');
    const zalen = ruimtes.map((r) => dW(puntenVan(lokaalVan(r).geometrie), true)).join('');
    const rest = inrichting.filter((it) => !getekend(it)).map((it) => { const g = lokaalVan(it).geometrie; return g.type === 'Point' ? '' : dW(puntenVan(g), g.type === 'Polygon'); }).join('');
    return (
      <>
        {zalen && <path d={zalen} fill="#2563EB" fillOpacity={0.05} stroke="#93C5FD" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        {grond && <path d={grond} fill="none" stroke="#A8ABB2" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        {rest && <path d={rest} fill="#78716C" fillOpacity={0.08} stroke="#A8A29E" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </>
    );
  }, [tekenvel, plan, ruimtes, inrichting]); // eslint-disable-line react-hooks/exhaustive-deps
  const tekenVang = useMemo(() => {
    if (!tekenvel) return null;
    const uit = [];
    for (const l of plan.lijnen) { if (uit.length > 20000) break; uit.push(l.c[0], l.c[l.c.length - 1]); if (l.c.length < 12) uit.push(...l.c.slice(1, -1)); }
    for (const r of ruimtes) uit.push(...puntenVan(lokaalVan(r).geometrie));
    return uit;
  }, [tekenvel, plan, ruimtes]); // eslint-disable-line react-hooks/exhaustive-deps

  const inhoud = (
    <div className={`fm fm-binnenscherm${schrijven ? '' : ' lezen'}${!schrijven && (selItems.length === 1 || actR || gebouwKaart) ? ' met-detail' : ''}${lijstOpen ? ' lijst-open' : ''}`} role="dialog" aria-label={`Binnenplan ${naamHost}`}>
      {camBeeld && (() => {
        const it = inrichting.find((x) => x.id === camBeeld); if (!it) return null;
        const nu = (id) => inrichtingRef.current.find((y) => y.id === id); // altijd de laatste stand (bewaren gebeurt met vertraging)
        const el = elementenMap.get(it.element_id);
        const scene = bouwScene({ inrichting, elementenMap, lokaalVan, hostRing, cameraId: it.id });
        return (
          <CameraVenster key={it.id} it={it} beginBeeld={it.id === beginCamera ? beginCameraBeeld : null} naam={it.naam || vn(el?.naam || 'Camera')} scene={scene} lok={lokaalVan(it)} schrijven={schrijven} onSluit={() => setCamBeeld(null)}
            onDeel={onDeelCamera ? () => onDeelCamera(it.id, it.naam || vn(el?.naam || 'Camera')) : schrijven ? null : async () => { const u = new URL(window.location.href); u.searchParams.set('cam', it.id); return u.href; }}
            onCamera={(c) => { const x = nu(it.id); if (x) onWijzig(x.id, { velden: { ...(x.velden || {}), camera: c } }); }}
            onStand={(m, rot) => { const x = nu(it.id); if (!x) return; const l = lokaalVan(x); const m0 = l.midden || m; const v = verschuif(l, m[0] - m0[0], m[1] - m0[1]); const dr = rot - (Number(l.rot) || 0); bewaarLokaal(x, Math.abs(dr) > 1e-6 ? gedraaid(v, dr) : v); }}
            onRenner={(id, patch) => { const x = nu(id); if (x) onWijzig(id, { velden: { ...x.velden, punt: { ...x.velden.punt, ...patch } } }); }} />
        );
      })()}
      {groot3d && (() => {
        const it = inrichting.find((x) => x.id === groot3d); const el = it ? elementenMap.get(it.element_id) : null; if (!it || !el) return null;
        return (
          <div className="fm-3d-groot" role="dialog" aria-label="3D-weergave">
            <div className="fm-3d-kop"><strong>{it.naam || vn(el.naam)}</strong><span className="fm-sub">Slepen = draaien · rechts slepen of twee vingers = verschuiven · scrollen = zoomen</span><span style={{ flex: 1 }} /><button className="fm-knop" onClick={() => setGroot3d(null)}>Sluiten</button></div>
            <div className="fm-3d-zicht">{isTrussBouw(it) ? <TrussZicht groot it={it} el={el} doeken={[...elementenMap.values()].filter((x) => x.tekenwijze === 'doek')} /> : <WandZicht groot it={it} el={el} elementenMap={elementenMap} />}</div>
          </div>
        );
      })()}
      <div className="fm-bs-kop">
        {onSluit && <button className="fm-knop" onClick={onSluit}>‹ Terug naar de kaart</button>}
        {merk}
        <button className={`fm-bs-titel${gebouwKaart ? ' aan' : ''}`} title="Gebouw: foto's en info" onClick={() => { setGebouwKaart((x) => !x); setSel([]); setActieveRuimte(null); setLijstOpen(false); }}>{naamHost}<span className="fm-sub"> ▾</span></button>
        <div className="fm-segment fm-bs-verd">
          {verdiepingen.map((v) => <button key={v.id} className={v.id === verd ? 'aan' : ''} onClick={() => { setSel([]); setActieveRuimte(null); onVerd(v.id); }}>{tx[v.naam] || v.naam}</button>)}
          {schrijven && <button aria-label="Verdieping toevoegen" onClick={onNieuweVerdieping}>+</button>}
        </div>
        <span style={{ flex: 1 }} />
        <button className="fm-knop klein" disabled={pdfBezig} title="Dit binnenplan als pdf (A3)" onClick={maakPdfBinnen}>{pdfBezig ? 'PDF maken…' : 'PDF'}</button>
        {(fasen.length > 0 || dagen.length > 0) && (
          <label className="fm-bs-moment">{tx.moment}
            <select value={actieveFase ? `f:${actieveFase}` : dag ? `d:${dag}` : ''} onChange={(e) => { const v = e.target.value; setSel([]); if (v.startsWith('f:')) { setDag(null); onFase?.(v.slice(2)); } else { onFase?.(null); setDag(v.startsWith('d:') ? v.slice(2) : null); } }}>
              <option value="">{tx.alles}</option>
              {fasen.length > 0 && <optgroup label={tx.fasen}>{fasen.map((f) => <option key={f.id} value={`f:${f.id}`}>{f.naam}{f.van ? ` · ${new Date(f.van).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}` : ''}</option>)}</optgroup>}
              {dagen.length > 0 && <optgroup label={tx.dagen}>{dagen.map((d0) => <option key={d0} value={`d:${d0}`}>{new Date(`${d0}T12:00`).toLocaleDateString(taal === 'fr' ? 'fr-BE' : taal === 'en' ? 'en-GB' : 'nl-BE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</option>)}</optgroup>}
            </select>
          </label>
        )}
        {schrijven && (
          <span style={{ position: 'relative' }}>
            <button className={`fm-knop klein${menu ? ' zwart' : ''}`} data-menuknop onClick={() => setMenu((x) => !x)}>Grondplan ▾</button>
            {menu && (
              <div className="fm-menu" style={{ right: 0, top: 32, minWidth: 210 }} onClick={() => setMenu(false)}>
                <button onClick={() => bestandRef.current?.click()}>{geenPlan ? 'Grondplan laden' : 'Vervangen'}</button>
                {schaalbaar && <button onClick={() => startModus('schaal')}>Schaal opnieuw</button>}
                {hostRing && <button onClick={tentOvernemen}>Maten van de {hostWoord} overnemen</button>}
                {nogZalen > 0 && <button onClick={zalenOvernemen}>Ruimtes herkennen ({nogZalen})</button>}
                {plan.lijnen.length > 0 && <button onClick={() => { startModus(null); setRuimteKlik(true); }}>Ruimte aanklikken</button>}
                <button onClick={() => startModus('zaal')}>Ruimte tekenen</button>
                {!geenPlan && <button onClick={onPassen}>Op de kaart leggen</button>}
              </div>
            )}
          </span>
        )}
        <input ref={bestandRef} type="file" accept=".dxf,.pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setZonder(false); onGrondplan(f); } }} />
      </div>
      <div className="fm-bs-lijf">
        <aside className="fm-bs-links">
          {!schrijven && <button className="fm-bs-greep" aria-expanded={lijstOpen} onClick={() => setLijstOpen((x) => !x)}><span className="fm-bs-greep-streep" aria-hidden="true" /><span className="fm-bs-greep-tekst">{tx.ruimtes} · {ruimtes.length}<span className="fm-sub"> · {inrichting.length} {tx.items}</span></span><span aria-hidden="true">{lijstOpen ? '▾' : '▴'}</span></button>}
          <div className="fm-lijstkop fm-bs-lijstkop1">{tx.ruimtes} · {ruimtes.length}</div>
          {ruimtes.length ? [...ruimtes].sort((a, b) => String(a.naam || '').localeCompare(String(b.naam || ''), 'nl', { numeric: true })).map((r) => {
            const t = perRuimte.get(r.id) || { n: 0, zit: 0 }; const max = Number(r.velden?.max_personen) || 0;
            return (
              <button key={r.id} className={`fm-bs-ruimte${actieveRuimte === r.id ? ' aan' : ''}`} onClick={() => { zoomOp(r); setActieveRuimte(r.id); setSel([]); setLijstOpen(false); setGebouwKaart(false); }}>
                <span className="naam" title={r.naam || ''}>{r.naam || 'Ruimte'}</span>
                {functieTekst(r) ? <span className="fm-bs-functie-tag" style={{ color: functieNu(r)?.kleur || '#2563EB' }} title={functieTekst(r)}>{functieTekst(r)}</span> : null}
                <span className="fm-sub">{Math.round(oppervlakte(puntenVan(lokaalVan(r).geometrie)))} m²{t.zit || max ? <> · <span className={max && t.zit > max ? 'fm-bs-teveel' : ''}>{t.zit} {tx.zitpl}{max ? ` / ${max}` : ''}</span></> : t.n ? ` · ${t.n} ${tx.items}` : ''}</span>
              </button>
            );
          }) : schrijven ? <div className="fm-sub fm-bs-leegtekst">{plan.zalen.length ? 'Grondplan › Ruimtes herkennen' : 'Grondplan › Ruimte tekenen'}</div> : null}
          <div className="fm-lijstkop">{tx.op} {verdNaam}</div>
          {!inrichting.length && <div className="fm-sub fm-bs-leegtekst">{tx.leeg}</div>}
          {telEigen.length > 0 && <div className="fm-bs-subkop">{schrijven ? tx.eigen : ''}</div>}
          {telEigen.map(([n, c]) => <div key={n} className="fm-bs-tel"><span title={vn(n)}>{vn(n)}</span><strong>{c}</strong></div>)}
          {telHuis.length > 0 && <div className="fm-bs-subkop">{tx.huis}</div>}
          {telHuis.map(([n, c]) => <div key={n} className="fm-bs-tel"><span title={vn(n)}>{vn(n)}</span><strong>{c}</strong></div>)}
        </aside>
        <div className="fm-bs-doek-wrap">
          {tekenvel && (
            <Tekenaar ingebed pijlen beginTool={tekenTool} begin={inrichting.filter(getekend).map(naarVorm)} beginSel={tekenSel} beginZicht={{ cx: B.cx, cy: B.cy, z: B.s }} schrijven={schrijven}
              achtergrond={({ tf }) => <g transform={tf}>{tekenAchter}</g>} vangExtra={tekenVang} standaardVul="#DBEAFE" standaardLijn="#1d1d1b"
              onWijzig={tekenWijzig} onBewaar={tekenKlaar}
              kop={<div className="fm-titel"><small>Tekenen · {verdNaam}</small><strong style={{ fontSize: 13 }}>Lijnen, vlakken, pijlen en teksten</strong></div>}
              rechts={<button className="fm-knop zwart" onClick={tekenKlaar}>Klaar met tekenen</button>} />
          )}
          <svg ref={svgRef} className="fm-bs-doek" onMouseDown={omlaag} onMouseMove={beweeg} onMouseUp={omhoog} onMouseLeave={() => { omhoog(); setMuis(null); }} onContextMenu={(e) => e.preventDefault()}
            style={{ cursor: kiesEl || ruimteKlik || modus ? 'crosshair' : 'default' }}>
            <g transform={wereldTf}>
              {grondEl}
              {vangAan && tekenVangt() && (vangAan.soort === 'hoek'
                ? <rect x={vangAan.p[0] - 6 / B.s} y={vangAan.p[1] - 6 / B.s} width={12 / B.s} height={12 / B.s} fill="none" stroke="#E11D48" strokeWidth={1.5} vectorEffect={NS} pointerEvents="none" />
                : <circle cx={vangAan.p[0]} cy={vangAan.p[1]} r={5 / B.s} fill="none" stroke="#E11D48" strokeWidth={1.5} vectorEffect={NS} pointerEvents="none" />)}
              {ruimteEl}
              {actR && <path d={padW(puntenVan(lokaalVan(actR).geometrie), true)} fill="#2563EB" fillOpacity={0.08} stroke="#2563EB" strokeWidth={2} vectorEffect={NS} pointerEvents="none" />}
              {itemsEl}
              {/* Stroom: wie voedt wie (stippellijn) voor het gekozen stroomitem, en de kabel die je aan het trekken bent */}
              {een && isStroomItem(een) && (() => {
                const s0 = sVan(een); const lijnen = [];
                const voed = (k, ids) => { for (const vid of ids) { const v = items.find((x) => x.id === vid); if (v && hierBinnen(v)) { const a = middenLok(v); const b = middenLok(een); if (a && b) lijnen.push([a, b]); } } };
                voed(een, s0.aansluitingen?.length ? s0.aansluitingen.map((a) => a.voeding).filter(Boolean) : s0.voeding ? [s0.voeding] : []);
                for (const it of inrichting) { if (it.id === een.id) continue; const sx = sVan(it); const ids = sx.aansluitingen?.length ? sx.aansluitingen.map((a) => a.voeding) : [sx.voeding]; if (ids.includes(een.id)) { const a = middenLok(een); const b = middenLok(it); if (a && b) lijnen.push([a, b]); } }
                return lijnen.map(([a, b], i) => <path key={`vd${i}`} d={padW([a, b])} stroke="#5B21B6" strokeWidth={1.5} strokeDasharray="2 4" vectorEffect={NS} pointerEvents="none" />);
              })()}
              {modus === 'kabel' && kabelVan && muis && (() => { const a = middenLok(kabelVan); return a ? <path d={padW([a, muis])} stroke="#5B21B6" strokeWidth={2} strokeDasharray="6 4" vectorEffect={NS} pointerEvents="none" /> : null; })()}
              {kiesEl?.meubel && muis && (() => {
                let mb = kiesEl.meubel; let mid = plaatsPunt.current || muis; let rot = elRot; let vast = false;
                if (naarMuur(mb)) { const m = opMuur(muis, mb); if (m) { mid = m.midden; rot = m.rot; mb = { ...mb, t: m.t }; vast = true; } }
                const lok = { midden: mid, rot };
                return <g pointerEvents="none">{tekening(null, lok, 0.65, meubelTekening(mb))}<path d={pad(voetMeubel(mb, mid, rot), true)} fill="none" stroke={naarMuur(mb) && !vast ? '#DC2626' : '#2563EB'} strokeDasharray="4 3" vectorEffect={NS} /></g>;
              })()}
              {kiesEl && !kiesEl.meubel && muis && kiesEl.tekenwijze !== 'lijn' && kiesEl.tekenwijze !== 'punt' && (() => {
                const b = Number(kiesEl.breedte_m) || 1; const dd = Number(kiesEl.diepte_m) || 1; const mp = plaatsPunt.current || muis;
                const lok = { geometrie: { type: 'Polygon', coordinates: [rechthoek(mp, b, dd, elRot)] }, midden: mp, rot: elRot };
                return <g pointerEvents="none">{tekening(kiesEl, lok, 0.5)}<path d={pad(lok.geometrie.coordinates[0], true)} fill="#2563EB" fillOpacity={0.08} stroke="#2563EB" strokeDasharray="4 3" vectorEffect={NS} /></g>;
              })()}
              {(modus === 'maat' || modus === 'cirkel') && punten.length === 1 && muis && (modus === 'cirkel'
                ? <circle cx={punten[0][0]} cy={punten[0][1]} r={Math.hypot(muis[0] - punten[0][0], muis[1] - punten[0][1])} fill="#2563EB" fillOpacity={0.08} stroke="#2563EB" strokeDasharray="4 3" vectorEffect={NS} pointerEvents="none" />
                : <path d={padW([punten[0], muis])} stroke="#1d1d1b" strokeWidth={1.2} vectorEffect={NS} pointerEvents="none" />)}
              {modus === 'pijl' && punten.length > 0 && <path d={padW(muis ? [...punten, muis] : punten)} fill="none" stroke="#2563EB" strokeWidth={2} vectorEffect={NS} pointerEvents="none" />}
              {(modus === 'lijn' || modus === 'vlak') && punten.length > 0 && <path d={padW(muis ? [...punten, muis] : punten, modus === 'vlak')} fill={modus === 'vlak' ? '#2563EB' : 'none'} fillOpacity={0.1} stroke="#2563EB" strokeWidth={2} vectorEffect={NS} pointerEvents="none" />}
              {modus === 'rechthoek' && punten.length === 1 && muis && (() => { const [a] = punten; return <path d={padW([[a[0], a[1]], [muis[0], a[1]], [muis[0], muis[1]], [a[0], muis[1]]], true)} fill="#2563EB" fillOpacity={0.1} stroke="#2563EB" strokeDasharray="4 3" vectorEffect={NS} pointerEvents="none" />; })()}
              {lijn && <path d={pad(muis ? [...lijn, muis] : lijn)} fill="none" stroke="#2563EB" strokeWidth={2} vectorEffect={NS} pointerEvents="none" />}
              {modus === 'zaal' && punten.length === 1 && muis && (() => { const [a] = punten; return <path d={padW([[a[0], a[1]], [muis[0], a[1]], [muis[0], muis[1]], [a[0], muis[1]]], true)} fill="#2563EB" fillOpacity={0.08} stroke="#2563EB" strokeDasharray="4 3" vectorEffect={NS} pointerEvents="none" />; })()}
              {(modus === 'meet' || modus === 'schaal') && (punten.length === 1 && muis ? [punten[0], muis] : modus === 'meet' ? meting : null) && (() => { const [a, b] = punten.length === 1 ? [punten[0], muis] : meting; return <path d={padW([a, b])} stroke="#1d1d1b" strokeWidth={1.5} strokeDasharray="5 3" vectorEffect={NS} pointerEvents="none" />; })()}
            </g>
            {/* Schermlaag: zaalnamen, punten en maten op vaste grootte */}
            <g pointerEvents="none">
              {zaalLabels.map((z) => {
                const [x, y] = naarScherm(z.p); const w = z.b * B.s - 10; const h = z.h * B.s;
                if (w < 24 || h < 14) return null;
                const fam = svgRef.current ? getComputedStyle(svgRef.current).fontFamily : 'system-ui'; const F1 = `700 12px ${fam}`; const F2 = `500 11px ${fam}`;
                const n = pasIn(z.naam || '', w, F1); const f = h >= 32 ? pasIn(z.functie || '', w, F2) : '';
                if (!n) return null;
                return (
                  <text key={z.id} x={x} y={f ? y - 3 : y + 4} textAnchor="middle" className="fm-bs-zaalnaam">
                    <title>{[z.naam, z.functie].filter(Boolean).join(' · ')}</title>
                    {n}
                    {f && <tspan x={x} dy="14" className="fm-bs-functie" style={{ fill: z.kleur || undefined }}>{f}</tspan>}
                  </text>
                );
              })}
              {schrijven && vormIt && !kiesEl && !modus && (() => { const g0 = lokaalVan(vormIt).geometrie; const open = g0.type === 'LineString'; const ring = puntenVan(g0); const k = (vormIt.velden?.ruimte && functieNu(vormIt)?.kleur) || vormIt.stijl?.kleur || '#2563EB'; return (
                <g>
                  {ring.slice(0, -1).map((c, i) => { const m = [(c[0] + ring[i + 1][0]) / 2, (c[1] + ring[i + 1][1]) / 2]; const [x, y] = naarScherm(m); return <circle key={`m${i}`} cx={x} cy={y} r={3.5} fill="#fff" stroke={k} strokeWidth={1} opacity={0.8} />; })}
                  {(open ? ring : ring.slice(0, -1)).map((c, i) => { const [x, y] = naarScherm(c); return <rect key={`h${i}`} x={x - 4.5} y={y - 4.5} width={9} height={9} fill="#fff" stroke={k} strokeWidth={1.5} />; })}
                </g>
              ); })()}
              {plusjes().map((x) => (
                <g key={`pl${x.eind}`} className="fm-bs-plus">
                  <line x1={x.van[0]} y1={x.van[1]} x2={x.p[0]} y2={x.p[1]} stroke="#16A34A" strokeWidth={1} strokeDasharray="2 2" pointerEvents="none" />
                  <circle cx={x.p[0]} cy={x.p[1]} r={8} fill="#fff" stroke="#16A34A" strokeWidth={1.5}><title>Lijn verder tekenen vanaf dit einde</title></circle>
                  <path d={`M${x.p[0] - 4},${x.p[1]}H${x.p[0] + 4}M${x.p[0]},${x.p[1] - 4}V${x.p[1] + 4}`} stroke="#16A34A" strokeWidth={1.8} pointerEvents="none" />
                </g>
              ))}
              {verleng && muis && (() => { const it = inrichting.find((x) => x.id === verleng.id); if (!it) return null; const c = lokaalVan(it).geometrie.coordinates; const a = verleng.eind ? c[c.length - 1] : c[0]; const [x1, y1] = naarScherm(a); const [x2, y2] = naarScherm(muis); const t = `${getal(Math.hypot(muis[0] - a[0], muis[1] - a[1]), 2)} m`; return (
                <g pointerEvents="none">
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#16A34A" strokeWidth={2} strokeDasharray="5 3" />
                  <g className="fm-bs-afst teken"><rect x={x2 + 12} y={y2 + 10} width={t.length * 6.8 + 8} height={18} rx={3} /><text x={x2 + 16 + (t.length * 6.8) / 2} y={y2 + 23} textAnchor="middle">{t}</text></g>
                </g>
              ); })()}
              {inrichting.filter((it) => lokaalVan(it).geometrie.type === 'Point').map((it) => {
                const el = elementenMap.get(it.element_id); const aan = sel.includes(it.id); const [x, y] = naarScherm(lokaalVan(it).geometrie.coordinates);
                if (it.soort === 'tekst') { const fs = Number(it.stijl?.tekstgrootte) || 13; const t = it.naam || ''; const w = t.length * fs * 0.58 + 10; return (
                  <g key={it.id}>
                    {it.stijl?.kader && <rect x={x - w / 2} y={y - fs * 0.75} width={w} height={fs * 1.5} rx={3} fill="#fff" stroke={aan ? '#2563EB' : '#E5E7EB'} />}
                    <text x={x} y={y + fs * 0.33} textAnchor="middle" className="fm-bs-tekst" style={{ fill: it.stijl?.kleur || '#1d1d1b', fontSize: fs, fontWeight: it.stijl?.vet ? 700 : undefined }} stroke={it.stijl?.kader ? 'none' : aan ? '#BFDBFE' : '#fff'}>{t}</text>
                  </g>
                ); }
                if (it.velden?.punt) return <PuntSymbool key={it.id} type={it.velden.punt.type} x={x} y={y} aan={aan} />;
                return <circle key={it.id} cx={x} cy={y} r={aan ? 7 : 5} fill={el?.stijl?.kleur || it.stijl?.kleur || '#1d1d1b'} stroke={aan ? '#2563EB' : '#fff'} strokeWidth={2} />;
              })}
              {zweefIt && !sleep.current && (() => {
                const it = inrichting.find((x) => x.id === zweefIt.id); if (!it) return null;
                const mb = it.velden?.meubel; const el = elementenMap.get(it.element_id); const pt = it.velden?.punt ? PUNT[it.velden.punt.type] : null;
                const om = omschrijf(it); const soortNaam = om.naam;
                const titel = it.velden?.functie || soortNaam;
                const sub = [it.velden?.functie ? soortNaam : null, om.stoelen || om.herkomst, it.velden?.opmerking].filter(Boolean);
                const heeftOntwerp = el && (isFrame(el) || isDrape(el) || isWand(el) || el.eigenschappen?.totem);
                const x0 = zweefIt.x + 14 > maat.w - 280 ? zweefIt.x - 290 : zweefIt.x + 14; const y0 = zweefIt.y + 14 > maat.h - 200 ? zweefIt.y - 190 : zweefIt.y + 14;
                return (
                  <foreignObject x={x0} y={y0} width={280} height={220} style={{ overflow: 'visible', pointerEvents: 'none' }}>
                    <div className="fm-zweef fm-zweef-rijk" style={{ position: 'static', display: 'inline-flex' }}>
                      <strong>{titel}</strong>{sub.map((t) => <span key={t}>{t}</span>)}
                      {el && ((isWand(el) && isVrij(it)) || isTrussBouw(it))
                        ? <div className="fm-zweef-3d">{isTrussBouw(it) ? <TrussZicht it={it} el={el} doeken={[...elementenMap.values()].filter((x) => x.tekenwijze === 'doek')} /> : <WandZicht it={it} el={el} elementenMap={elementenMap} />}</div>
                        : heeftOntwerp && <OntwerpDuimen it={it} el={el} elementenMap={elementenMap} hoogte={72} zijNamen={tx} />}
                    </div>
                  </foreignObject>
                );
              })()}
              {(() => { const dg = draaiGreep(); if (!dg) return null; return (
                <g>
                  {dg.kader && sel.length > 1 && <rect x={dg.kader[0][0] - 6} y={dg.kader[0][1] - 6} width={dg.kader[1][0] - dg.kader[0][0] + 12} height={dg.kader[1][1] - dg.kader[0][1] + 12} fill="none" stroke="#2563EB" strokeDasharray="4 3" pointerEvents="none" />}
                  <line x1={dg.rand[0]} y1={dg.rand[1]} x2={dg.greep[0]} y2={dg.greep[1]} stroke="#2563EB" strokeWidth={1} />
                  <circle cx={dg.greep[0]} cy={dg.greep[1]} r={6} fill="#fff" stroke="#2563EB" strokeWidth={1.5} />
                  {draaiHoek != null && <text x={dg.greep[0] + 12} y={dg.greep[1] - 6} className="fm-bs-maat">{draaiHoek}°</text>}
                </g>
              ); })()}
              {hulp.map((h, i) => { if (h.x != null) { const [x] = naarScherm([h.x, 0]); return <line key={`h${i}`} x1={x} x2={x} y1={0} y2={maat.h} stroke="#E11D48" strokeWidth={1} strokeDasharray="4 3" />; } const [, y] = naarScherm([0, h.y]); return <line key={`h${i}`} x1={0} x2={maat.w} y1={y} y2={y} stroke="#E11D48" strokeWidth={1} strokeDasharray="4 3" />; })}
              {kaderSel && (() => { const [a, b] = kaderSel.map(naarScherm); return <rect x={Math.min(a[0], b[0])} y={Math.min(a[1], b[1])} width={Math.abs(a[0] - b[0])} height={Math.abs(a[1] - b[1])} fill="#2563EB" fillOpacity={0.06} stroke="#2563EB" strokeDasharray="4 3" />; })()}
              {een && !voorlopig && lokaalVan(een).geometrie.type === 'Polygon' && (() => {
                const ring = puntenVan(lokaalVan(een).geometrie); const k = kaderVan([ring.map(naarScherm)]); if (!k) return null;
                const mb = een.velden?.meubel; const mt = mb ? maatMeubel(mb) : null;
                const b = mt?.b || Number(een.parameters?.breedte) || Number(elementenMap.get(een.element_id)?.breedte_m); const h = mt?.h || Number(een.parameters?.diepte) || Number(elementenMap.get(een.element_id)?.diepte_m);
                if (!b || !h) return null;
                return <text x={(k[0] + k[2]) / 2} y={k[1] - 8} textAnchor="middle" className="fm-bs-maat">{getal(b, 2)} × {getal(h, 2)} m</text>;
              })()}
              {(modus === 'meet' || modus === 'schaal') && (() => { const ab = punten.length === 1 && muis ? [punten[0], muis] : modus === 'meet' ? meting : null; if (!ab) return null; const [x1, y1] = naarScherm(ab[0]); const [x2, y2] = naarScherm(ab[1]); return <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle" className="fm-bs-maat">{getal(Math.hypot(ab[1][0] - ab[0][0], ab[1][1] - ab[0][1]), 2)} m</text>; })()}
              {/* Pijlpunten en maatlijnen (vaste grootte op het scherm) */}
              {inrichting.filter((it) => !it.element_id && it.soort === 'lijn' && (it.stijl?.pijl || it.stijl?.maat)).map((it) => {
                const c = (voorlopig?.[it.id] || lokaalVan(it)).geometrie.coordinates; if (!c || c.length < 2) return null;
                const kl = it.stijl?.kleur || '#1d1d1b'; const dk = Math.max(1, Number(it.stijl?.dikte) || 2); const L = 8 + dk * 2.2; const B2 = 4 + dk * 1.2;
                const kop = (a, b) => { const [x1, y1] = naarScherm(a); const [x2, y2] = naarScherm(b); const d = Math.hypot(x2 - x1, y2 - y1) || 1; const ux = (x2 - x1) / d; const uy = (y2 - y1) / d; return `${x2},${y2} ${x2 - ux * L - uy * B2},${y2 - uy * L + ux * B2} ${x2 - ux * L + uy * B2},${y2 - uy * L - ux * B2}`; };
                const p = it.stijl?.pijl; const n = c.length;
                const maat = it.stijl?.maat ? (() => { const totaal = c.reduce((a, q, i) => (i ? a + Math.hypot(q[0] - c[i - 1][0], q[1] - c[i - 1][1]) : 0), 0); const [x1, y1] = naarScherm(c[0]); const [x2, y2] = naarScherm(c[n - 1]); const t = `${getal(totaal, 2)} m`; let hk = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI; if (hk > 90) hk -= 180; if (hk < -90) hk += 180; const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2; return <g transform={`rotate(${hk} ${mx} ${my})`}><rect x={mx - t.length * 3.4 - 4} y={my - 19} width={t.length * 6.8 + 8} height={16} rx={3} fill="#fff" fillOpacity={0.9} /><text x={mx} y={my - 7} textAnchor="middle" className="fm-bs-maat" style={{ fill: kl }}>{t}</text></g>; })() : null;
                return (
                  <g key={`pk${it.id}`} pointerEvents="none">
                    {(p === 'eind' || p === 'beide') && <polygon points={kop(c[n - 2], c[n - 1])} fill={kl} />}
                    {(p === 'begin' || p === 'beide') && <polygon points={kop(c[1], c[0])} fill={kl} />}
                    {maat}
                  </g>
                );
              })}
              {/* Afstanden tot muren en andere items tijdens verplaatsen of plaatsen */}
              {afst.map((x, k) => {
                const [x1, y1] = naarScherm(x.a); const [x2, y2] = naarScherm(x.b); const hor = Math.abs(y1 - y2) < 1;
                if (Math.hypot(x2 - x1, y2 - y1) < 14) return null;
                const tk = (px, py) => (hor ? <line x1={px} y1={py - 5} x2={px} y2={py + 5} /> : <line x1={px - 5} y1={py} x2={px + 5} y2={py} />);
                const t = `${getal(x.d, 2)} m`; const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
                return (
                  <g key={`af${k}`} className="fm-bs-afst" pointerEvents="none">
                    <line x1={x1} y1={y1} x2={x2} y2={y2} />{tk(x1, y1)}{tk(x2, y2)}
                    <rect x={mx - t.length * 3.4 - 4} y={my - 9} width={t.length * 6.8 + 8} height={18} rx={3} />
                    <text x={mx} y={my + 4} textAnchor="middle">{t}</text>
                  </g>
                );
              })}
              {/* Maat tijdens het tekenen */}
              {muis && punten.length > 0 && (modus === 'lijn' || modus === 'vlak' || modus === 'rechthoek' || modus === 'pijl' || modus === 'maat' || modus === 'cirkel') && (() => {
                const a = punten[punten.length - 1]; const [x2, y2] = naarScherm(muis);
                const t = modus === 'rechthoek' ? `${getal(Math.abs(muis[0] - a[0]), 2)} × ${getal(Math.abs(muis[1] - a[1]), 2)} m` : modus === 'cirkel' ? `Ø ${getal(2 * Math.hypot(muis[0] - a[0], muis[1] - a[1]), 2)} m` : `${getal(Math.hypot(muis[0] - a[0], muis[1] - a[1]), 2)} m`;
                return <g className="fm-bs-afst teken" pointerEvents="none"><rect x={x2 + 12} y={y2 + 10} width={t.length * 6.8 + 8} height={18} rx={3} /><text x={x2 + 16 + (t.length * 6.8) / 2} y={y2 + 23} textAnchor="middle">{t}</text></g>;
              })()}
            </g>
          </svg>
          {!toonSetup && !wachtOpPlan && (
            <>
              <div className="fm-bs-zweef links">
                <button className={!modus ? 'aan' : ''} onClick={() => startModus(null)}>{tx.selecteren}</button>
                <button className={modus === 'meet' ? 'aan' : ''} onClick={() => startModus('meet')}>{tx.meten}</button>
                {schrijven && (
                  <span style={{ position: 'relative', display: 'inline-flex' }}>
                    <button className={modus in TEKEN ? 'aan' : ''} data-menuknop onClick={() => setTekenMenu((x) => !x)}>{modus in TEKEN ? TEKEN[modus] : 'Tekenen'} ▾</button>
                  </span>
                )}
                {schrijven && (
                  <span style={{ position: 'relative', display: 'inline-flex' }}>
                    <button className={modus?.startsWith('punt:') && modus !== 'punt:invoer' ? 'aan' : ''} data-menuknop onClick={() => setPuntMenu((x) => !x)}>{modus?.startsWith('punt:') && modus !== 'punt:invoer' ? (PUNT[modus.slice(5)]?.kort || PUNT[modus.slice(5)]?.naam) : 'Punt'} ▾</button>
                  </span>
                )}
                {schrijven && (
                  <span style={{ position: 'relative', display: 'inline-flex' }}>
                    <button className={stroomAan ? 'aan' : ''} data-menuknop title="Stroom in dit gebouw: invoer, kasten, stekkerdozen, verbruikers en kabels" onClick={() => setStroomMenu((x) => (x ? false : true))}>{modus === 'kabel' ? 'Kabel' : modus === 'punt:invoer' ? 'Stroominvoer' : 'Stroom'} ▾</button>
                  </span>
                )}
              </div>
              {stroomMenu && (
                <div className="fm-menu fm-bs-puntmenu fm-bs-stroommenu">
                  {stroomMenu === true ? (
                    <>
                      <button onClick={() => { setStroomMenu(false); startModus('punt:invoer'); }}><svg width="22" height="22" aria-hidden="true"><PuntSymbool type="invoer" x={11} y={11} /></svg>Stroominvoer <small>waar de kabel van buiten binnenkomt</small></button>
                      {stroomGroepen.map(([naam, lijst]) => <button key={naam} onClick={() => setStroomMenu({ naam, lijst })}>{naam} <small>{lijst.length}</small><span style={{ marginLeft: 'auto' }}>›</span></button>)}
                      <button onClick={() => { setStroomMenu(false); startModus('kabel'); }}>Kabel <small>klik de voeding, dan de verbruiker</small></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setStroomMenu(true)}>‹ {stroomMenu.naam}</button>
                      {stroomMenu.lijst.map((e) => <button key={e.id} className={kiesEl?.id === e.id ? 'aan' : ''} onClick={() => { setStroomMenu(false); setKiesEl(e); setModus(null); setRuimteKlik(false); setSel([]); }}><span className="fm-afkap">{e.naam}</span></button>)}
                    </>
                  )}
                </div>
              )}
              {tekenMenu && (
                <div className="fm-menu fm-bs-puntmenu fm-bs-tekenmenu" onClick={() => setTekenMenu(false)}>
                  <button onClick={() => startModus('lijn')}>Lijn of muur <small>typ een lengte + Enter · Shift = 45°</small></button>
                  <button onClick={() => startModus('pijl')}>Pijl</button>
                  <button onClick={() => startModus('maat')}>Maatlijn <small>vangt op hoeken en randen</small></button>
                  <button onClick={() => startModus('rechthoek')}>Rechthoek <small>twee hoeken</small></button>
                  <button onClick={() => startModus('cirkel')}>Cirkel <small>midden en rand</small></button>
                  <button onClick={() => startModus('vlak')}>Vlak <small>klik punten</small></button>
                  <button onClick={() => startModus('tekst')}>Tekst</button>
                  <button onClick={() => startModus('zaal')}>Zaal</button>
                </div>
              )}
              {puntMenu && (
                <div className="fm-menu fm-bs-puntmenu" onClick={() => setPuntMenu(false)}>
                  {PUNT_TYPES.map((t) => <button key={t.k} onClick={() => startModus(`punt:${t.k}`)}><svg width="22" height="22" aria-hidden="true"><PuntSymbool type={t.k} x={11} y={11} /></svg>{t.naam}</button>)}
                </div>
              )}
              <div className="fm-bs-zweef rechts">
                <button aria-label="Inzoomen" onClick={() => setBeeld({ ...B, s: Math.min(600, B.s * 1.4) })}>+</button>
                <button aria-label="Uitzoomen" onClick={() => setBeeld({ ...B, s: Math.max(0.5, B.s / 1.4) })}>−</button>
                <button onClick={passend}>{tx.passend}</button>
              </div>
            </>
          )}
          {(toonSetup || laden) && (
            <div className="fm-bs-leeg">
              {laden ? <span>Grondplan laden…</span> : (
                <div className="fm-bs-setup">
                  <strong>{naamHost} · {verdNaam}</strong>
                  <ol>
                    <li className="nu"><b>Grondplan laden</b><span className="fm-sub">DXF of PDF uit een tekenprogramma komt op ware grootte binnen, met de zalen erbij. Een foto kan ook.</span></li>
                    <li><b>Schaal</b><span className="fm-sub">Enkel bij een foto: klik twee punten waarvan je de afstand kent.</span></li>
                    <li><b>Ruimtes</b><span className="fm-sub">Uit het grondplan, of zelf tekenen.</span></li>
                  </ol>
                  {schrijven && <div className="fm-rij"><button className="fm-knop zwart" onClick={() => bestandRef.current?.click()}>Grondplan laden</button><button className="fm-knop" onClick={() => { setZonder(true); startModus('zaal'); }}>Zonder grondplan verder</button></div>}
                </div>
              )}
            </div>
          )}
          {onderlegger && !isDxf && !onderlegger.geschaald && !laden && schrijven && modus !== 'schaal' && (
            <div className="fm-bs-balk">Stel eerst de schaal in van deze foto. <button className="fm-knop klein zwart" onClick={() => startModus('schaal')}>Schaal instellen</button></div>
          )}
          <div className="fm-bs-voet">
            {melding ? <span>{melding} <button className="fm-x" aria-label="Sluiten" onClick={() => setMelding('')}>×</button></span> : <span>{hint}</span>}
            {muis && <span className="fm-sub" style={{ marginLeft: 'auto' }}>{getal(muis[0], 2)} · {getal(muis[1], 2)} m</span>}
          </div>
        </div>
        <aside className="fm-bs-rechts" style={tekenvel ? { display: 'none' } : undefined}>
          {!schrijven && selItems.length === 1 && leesKaart(selItems[0])}
          {schrijven && selItems.length > 0 && (
            <div className="fm-bs-selectie">
              <div className="fm-bs-selkop"><strong className="fm-bs-afkap">{selItems.length === 1 ? (selItems[0].velden?.meubel || selItems[0].element_id || selItems[0].velden?.punt ? omschrijf(selItems[0]).naam : selItems[0].naam || ({ lijn: 'Lijn', vlak: 'Vlak', tekst: 'Tekst', punt: 'Punt' }[selItems[0].soort]) || 'Item') : `${selItems.length} items`}</strong>
                {selItems.length === 1 && (() => { const r = ruimtes.find((x) => { const l = lokaalVan(selItems[0]); const p = l.midden || puntenVan(l.geometrie)[0]; return p && binnenVeelhoek(p, puntenVan(lokaalVan(x).geometrie)); }); return r ? <span className="fm-sub"> · {r.naam}</span> : null; })()}
              </div>
              {schrijven && (
                <>
                  <div className="fm-rij">
                    <span className="fm-sub">Draaien</span>
                    <button className="fm-knop klein" onClick={() => draaiSel(-15)}>↺ 15°</button>
                    <button className="fm-knop klein" onClick={() => draaiSel(15)}>↻ 15°</button>
                    <button className="fm-knop klein" onClick={() => draaiSel(90)}>90°</button>
                  </div>
                  <div className="fm-rij">
                    <button className="fm-knop klein" onClick={dupliceer}>Dupliceren</button>
                    {een && lokaalVan(een).midden && <button className={`fm-knop klein${rijVorm ? ' zwart' : ''}`} onClick={() => setRijVorm(rijVorm ? null : { kol: 4, rij: 1, tussen: 0.5 })}>Rij maken</button>}
                    <span style={{ flex: 1 }} />
                    <button className="fm-knop klein" style={{ color: '#B4123A' }} onClick={() => { onVerwijder(sel); setSel([]); }}>Wissen</button>
                  </div>
                  {rijVorm && een && (
                    <div className="fm-bs-rijvorm">
                      <label>Aantal in de breedte<input type="number" min="1" value={rijVorm.kol} onChange={(e) => setRijVorm({ ...rijVorm, kol: Math.max(1, Number(e.target.value) || 1) })} /></label>
                      <label>Aantal in de diepte<input type="number" min="1" value={rijVorm.rij} onChange={(e) => setRijVorm({ ...rijVorm, rij: Math.max(1, Number(e.target.value) || 1) })} /></label>
                      <label>Tussenruimte (m)<input type="number" min="0" step="0.1" value={rijVorm.tussen} onChange={(e) => setRijVorm({ ...rijVorm, tussen: Math.max(0, Number(e.target.value) || 0) })} /></label>
                      <button className="fm-knop klein zwart" onClick={() => rijMaken(rijVorm)}>Plaatsen ({rijVorm.kol * rijVorm.rij})</button>
                    </div>
                  )}
                  {een?.velden?.meubel && meubelKaart(een)}
                  {een && schrijven && Array.isArray(elementenMap.get(een.element_id)?.eigenschappen?.montages) && (() => {
                    const m = elementenMap.get(een.element_id).eigenschappen.montages; const nu = een.velden?.montage || m[0][0];
                    return (
                      <div className="fm-bs-veld"><span>Montage</span>
                        <div className="fm-segment fm-bs-seg" role="group" aria-label="Montage">{m.map(([k, t]) => <button key={k} type="button" className={nu === k ? 'aan' : ''} onClick={() => onWijzig(een.id, { velden: { ...(een.velden || {}), montage: k } })}>{t}</button>)}</div>
                      </div>
                    );
                  })()}
                  {een && isCamera(elementenMap.get(een.element_id)) && <button className="fm-knop zwart klein" style={{ alignSelf: 'flex-start' }} onClick={() => setCamBeeld(een.id)}>Camerabeeld</button>}
                  {een && brandingKaart(een)}
                  {een && (() => {
                    // Lijnelement (truss, hek, pipe & drape, frame-wand …): lengte en hoekpunten aanpassen.
                    const el = elementenMap.get(een.element_id); const g = lokaalVan(een).geometrie;
                    if (!el || el.tekenwijze !== 'lijn' || g.type !== 'LineString' || isTrussBouw(een) || (isWand(el) && isVrij(een))) return null;
                    const ring = g.coordinates.filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.005); const lengte = ring.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - ring[i - 1][0], p[1] - ring[i - 1][1]) : 0), 0);
                    const zetLengte = (v) => {
                      if (!(lengte > 0) || !(v > 0)) return;
                      // Het laatste stuk langer of korter maken (de richting blijft).
                      const n = ring.length; const a = ring[n - 2]; const b = ring[n - 1]; const Ll = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const nieuw = Math.max(0.1, Ll + (v - lengte));
                      const c = [...ring.slice(0, -1), [r3(a[0] + ((b[0] - a[0]) / Ll) * nieuw), r3(a[1] + ((b[1] - a[1]) / Ll) * nieuw)]];
                      bewaarLokaal(een, { ...lokaalVan(een), geometrie: { type: 'LineString', coordinates: c } });
                    };
                    return (
                      <div className="fm-rij">
                        {maatVeld('Lengte (m)', r3(lengte), zetLengte, `el${een.id}${r3(lengte)}`)}
                        <button className={`fm-knop klein${vormZaal === een.id ? ' zwart' : ''}`} style={{ alignSelf: 'flex-end' }} title="Hoekpunten verslepen, bolletje in het midden = punt erbij, dubbelklik = punt weg" onClick={() => setVormZaal(vormZaal === een.id ? null : een.id)}>{vormZaal === een.id ? 'Klaar' : 'Punten aanpassen'}</button>
                      </div>
                    );
                  })()}
                  {een && (() => {
                    const el = elementenMap.get(een.element_id);
                    if (!el || el.tekenwijze !== 'lijn' || !/truss/i.test(el.categorie || '') || lokaalVan(een).geometrie.type !== 'LineString') return null;
                    return <TrussBlok it={een} el={el} doeken={doeken.filter((d) => ontwerpDrager(d) === 'truss')} schrijven={schrijven} onZet={(truss, g, pts) => { if (pts) { const n = naarItem({ geometrie: { type: 'LineString', coordinates: pts }, midden: null, rot: null }); onWijzig(een.id, { geometrie: n.geometrie, velden: { ...(een.velden || {}), truss, binnen: { ...een.velden.binnen, lokaal: n.lokaal } } }); } else onWijzig(een.id, { velden: { ...(een.velden || {}), truss } }); }} />;
                  })()}
                  {een && !een.velden?.meubel && lokaalVan(een).geometrie.type === 'Polygon' && lokaalVan(een).midden && (() => {
                    const el = elementenMap.get(een.element_id); const b = Number(een.parameters?.breedte) || Number(el?.breedte_m) || 1; const dd = Number(een.parameters?.diepte) || Number(el?.diepte_m) || 1;
                    return (
                      <div className="fm-rij">
                        <label className="fm-bs-veld">Breedte (m)<input key={`b${een.id}${b}`} defaultValue={getal(b, 2)} onBlur={(e) => { const v = num(e.target.value); if (v && v !== b) bewaarMaat(een, v, dd); }} onKeyDown={enterBlur} /></label>
                        <label className="fm-bs-veld">Diepte (m)<input key={`d${een.id}${dd}`} defaultValue={getal(dd, 2)} onBlur={(e) => { const v = num(e.target.value); if (v && v !== dd) bewaarMaat(een, b, v); }} onKeyDown={enterBlur} /></label>
                      </div>
                    );
                  })()}
                  {een && (!een.element_id || een.velden?.punt) && !een.velden?.meubel && (
                    <>
                      {een.velden?.punt && (
                        <label className="fm-bs-veld">Soort punt
                          <select value={een.velden.punt.type} onChange={(e) => { const t = PUNT[e.target.value]; const metEl = t.k === 'stekker' && stekkerEl; const sv = t.k === 'invoer' ? { stroom: { ...(een.velden.stroom || {}), rol: 'kast', invoer: true } } : t.k === 'stroom' ? { stroom: { ...(een.velden.stroom || {}), rol: 'bron', cosphi: een.velden.stroom?.cosphi ?? 1 } } : een.velden.stroom?.invoer ? { stroom: null } : {}; onWijzig(een.id, { soort: metEl ? 'element' : 'punt', element_id: metEl ? stekkerEl.id : null, stijl: { ...(een.stijl || {}), kleur: t.kleur }, velden: { ...een.velden, ...sv, punt: { type: t.k }, binnen: { ...een.velden.binnen, huis: !!t.vast } } }); }}>
                            {PUNT_TYPES.map((t) => <option key={t.k} value={t.k}>{t.naam}</option>)}
                          </select>
                        </label>
                      )}
                      {een.velden?.punt?.type === 'renner' && (
                        <div className="fm-bs-veld"><span>Figuur</span><div className="fm-segment fm-bs-seg">{[[false, 'Man'], [true, 'Vrouw']].map(([v, t]) => <button key={t} type="button" className={!!een.velden.punt.vrouw === v ? 'aan' : ''} onClick={() => onWijzig(een.id, { velden: { ...een.velden, punt: { ...een.velden.punt, vrouw: v || null } } })}>{t}</button>)}</div></div>
                      )}
                      {een.velden?.punt?.type === 'renner' && maatVeld('Lengte renner (m)', Number(een.velden.punt.lengte) || 1.87, (v) => onWijzig(een.id, { velden: { ...een.velden, punt: { ...een.velden.punt, lengte: v } } }), `rl${een.id}`)}
                      {(een.soort === 'tekst' || een.soort !== 'punt') && (
                        <label className="fm-bs-veld">{een.soort === 'tekst' ? 'Tekst' : 'Naam'}<input key={`nm${een.id}`} defaultValue={een.naam || ''} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (een.naam || '')) onWijzig(een.id, { naam: v || null }); }} onKeyDown={enterBlur} /></label>
                      )}
                      {!een.velden?.punt && opmaakKaart(een)}
                      {getekend(een) && een.soort !== 'tekst' && zijdenKaart(een)}
                      {een.soort !== 'tekst' && !een.velden?.punt && vormKaart(een)}
                    </>
                  )}
                  {een && een.element_id && !een.velden?.punt && (
                    <label className="fm-bs-veld">Naam
                      <input key={`nme${een.id}`} disabled={!schrijven} placeholder={elementenMap.get(een.element_id)?.naam || 'bv. Backdrop podium'} defaultValue={een.naam || ''} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (een.naam || '')) onWijzig(een.id, { naam: v || null }); }} onKeyDown={enterBlur} />
                    </label>
                  )}
                  {een && een.soort !== 'tekst' && (
                    <label className="fm-bs-veld">Functie
                      <input key={`fu${een.id}`} list="fm-objfuncties" placeholder="bv. vergadertafel, stekkerblok bar" defaultValue={een.velden?.functie || ''} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (een.velden?.functie || '')) onWijzig(een.id, { velden: { ...(een.velden || {}), functie: v || null } }); }} onKeyDown={enterBlur} />
                      <datalist id="fm-objfuncties">{['Vergadertafel', 'Registratie', 'Onthaal', 'Persplaats', 'Catering', 'Bar', 'Buffet', 'Spreker', 'Regie', 'Vertaling', 'Vestiaire', 'Opslag'].map((x) => <option key={x} value={x} />)}</datalist>
                    </label>
                  )}
                  {een && (
                    <label className="fm-bs-veld">Opmerking
                      <input key={een.id} defaultValue={een.velden?.opmerking || ''} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (een.velden?.opmerking || '')) onWijzig(een.id, { velden: { ...(een.velden || {}), opmerking: v || null } }); }} />
                    </label>
                  )}
                  {een && isStroomItem(een) && (
                    <div className="fm-bs-stroom">
                      <StroomDetail key={een.id} item={een} el={een.element_id ? elementenMap.get(een.element_id) : null} stroom={stroom} items={items} elementenMap={elementenMap} vast={vast} schrijven={schrijven}
                        onKiesItem={(id) => { const it = items.find((x) => x.id === id); if (it && hierBinnen(it)) setSel([id]); else setMelding('Dat item staat buiten dit binnenplan: zie de werkruimte Stroom op de kaart.'); }}
                        onKabel={(id) => tekenKabelBinnen(id)}
                        onZet={(patch) => onWijzig(een.id, { velden: { ...(een.velden || {}), stroom: { ...(een.velden?.stroom || {}), ...patch } } })} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {!selItems.length && !actR && gebouwKaart && (
            <div className="fm-bs-selectie">
              <div className="fm-bs-selkop"><strong className="fm-bs-afkap">{naamHost}</strong><span className="fm-sub fm-bs-geenbreuk"> · {ruimtes.length} {ruimtes.length === 1 ? tx.zaal : tx.zalen}</span><span style={{ flex: 1 }} /><button className="fm-x" aria-label="Sluiten" onClick={() => setGebouwKaart(false)}>×</button></div>
              {(host.plan_id || fotosVast) && <FotoStrook key={host.id} planId={host.plan_id} itemId={host.id} schrijven={schrijven} titel={tx.fotosGebouw} vast={fotosVast ? fotosVast.get(host.id) || [] : null} kolommen={schrijven ? 4 : 2} tekst={tx} />}
            </div>
          )}
          {!schrijven && !selItems.length && actR && zaalLeesKaart(actR)}
          {schrijven && !selItems.length && actR && (
            <div className="fm-bs-selectie">
              <div className="fm-bs-selkop"><strong className="fm-bs-afkap" title={actR.naam || ''}>{actR.naam || 'Ruimte'}</strong><span className="fm-sub fm-bs-geenbreuk"> · {Math.round(oppervlakte(puntenVan(lokaalVan(actR).geometrie)))} m²</span><span style={{ flex: 1 }} /><button className="fm-x" aria-label="Sluiten" onClick={() => setActieveRuimte(null)}>×</button></div>
              <div className="fm-rij"><span>{perRuimte.get(actR.id)?.zit || 0} zitplaatsen geplaatst</span></div>
              {schrijven && (
                <div className="fm-rij">
                  <label className="fm-bs-veld" style={{ flex: 1 }}>Naam<input key={`n${actR.id}`} defaultValue={actR.naam || ''} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== actR.naam) onWijzig(actR.id, { naam: v }); }} /></label>
                  <label className="fm-bs-veld" style={{ width: 110 }}>Max. personen<input key={`m${actR.id}`} type="number" min="0" defaultValue={actR.velden?.max_personen || ''} onBlur={(e) => { const v = Number(e.target.value) || null; if (v !== (actR.velden?.max_personen || null)) onWijzig(actR.id, { velden: { ...(actR.velden || {}), max_personen: v } }); }} /></label>
                </div>
              )}
              {functieKaart(actR)}
              {host.plan_id && <FotoStrook key={actR.id} planId={host.plan_id} itemId={actR.id} schrijven={schrijven} />}
              {schrijven && (
                <div className="fm-rij">
                  <button className={`fm-knop klein${vormZaal === actR.id ? ' zwart' : ''}`} onClick={() => { setVormZaal(vormZaal === actR.id ? null : actR.id); setKiesEl(null); setModus(null); }}>{vormZaal === actR.id ? 'Klaar' : 'Vorm aanpassen'}</button>
                  <span style={{ flex: 1 }} />
                  <button className="fm-knop klein" style={{ color: '#B4123A' }} onClick={() => { onVerwijder([actR.id]); setActieveRuimte(null); }}>Ruimte wissen</button>
                </div>
              )}
            </div>
          )}
          {!schrijven && !selItems.length && !actR && !gebouwKaart && <div className="fm-sub fm-bs-leegtekst" style={{ padding: 16 }}>{tx.detail}</div>}
          {schrijven && <div className="fm-segment fm-bs-tabs">
            <button className={tab === 'inrichten' ? 'aan' : ''} onClick={() => setTab('inrichten')}>Inrichten</button>
            <button className={tab === 'huis' ? 'aan' : ''} onClick={() => setTab('huis')}>Van het huis</button>
            <button className={tab === 'bib' ? 'aan' : ''} onClick={() => setTab('bib')}>Bibliotheek</button>
          </div>}
          {schrijven && tab === 'inrichten' && (
            <div className="fm-bs-inrichten">
              {(() => {
                const br = bib.filter((e) => isFrame(e) || isDrape(e) || isWand(e)); if (!br.length) return null;
                return (
                  <div>
                    <div className="fm-bs-subkop">Branding</div>
                    <div className="fm-bs-lijstknoppen">
                      {br.map((e) => <button key={e.id} className={`fm-bs-lijstknop${kiesEl?.id === e.id ? ' aan' : ''}`} disabled={!schrijven} title={e.naam} onClick={() => { setKiesEl(kiesEl?.id === e.id ? null : e); setModus(null); setRuimteKlik(false); setSel([]); }}><span className="fm-afkap">{e.naam}</span><small>{e.tekenwijze === 'lijn' ? 'lijn tekenen' : 'klik om te plaatsen'}</small></button>)}
                    </div>
                  </div>
                );
              })()}
              {(() => {
                const tr = bib.filter((e) => /truss/i.test(e.categorie || '') && ['lijn', 'schaal'].includes(e.tekenwijze)); if (!tr.length) return null;
                return (
                  <div>
                    <div className="fm-bs-subkop">Truss</div>
                    <div className="fm-bs-lijstknoppen">
                      {tr.map((e) => <button key={e.id} className={`fm-bs-lijstknop${kiesEl?.id === e.id ? ' aan' : ''}`} disabled={!schrijven} title={e.naam} onClick={() => { setKiesEl(kiesEl?.id === e.id ? null : e); setModus(null); setRuimteKlik(false); setSel([]); }}><span className="fm-afkap">{e.naam}</span><small>{e.tekenwijze === 'lijn' ? 'lijn tekenen' : 'klik om te plaatsen'}</small></button>)}
                    </div>
                  </div>
                );
              })()}
              {MEUBEL_GROEPEN.map((g) => (
                <div key={g.naam}>
                  <div className="fm-bs-subkop">{g.naam}</div>
                  <div className="fm-bs-tegels">
                    {g.items.map((mb, i) => {
                      const id = `m:${g.naam}:${i}`; const tk = meubelTekening(mb); const z = Math.max(tk.b, tk.h) || 1;
                      return (
                        <button key={id} className={`fm-bs-tegel${kiesEl?.id === id ? ' aan' : ''}`} disabled={!schrijven} title={naamMeubel(mb)}
                          onClick={() => { setKiesEl(kiesEl?.id === id ? null : { id, naam: naamMeubel(mb), tekenwijze: 'schaal', meubel: mb }); setModus(null); setRuimteKlik(false); setSel([]); }}>
                          <svg viewBox={`${-z / 2 - 0.05} ${-z / 2 - 0.05} ${z + 0.1} ${z + 0.1}`} width="44" height="44" aria-hidden="true"><g transform="scale(1 -1)">
                            {tk.vlakken.map((v, j) => <path key={j} d={padW(v.r[0], true)} fill={v.vul === '#FAFAF8' ? '#fff' : v.vul} stroke={v.lijn === 'none' ? 'none' : v.lijn} strokeWidth={z / 60} />)}
                            {tk.lijnen.map((l, j) => <path key={`l${j}`} d={padW(l.c)} fill="none" stroke={l.k} strokeWidth={z / 50} />)}
                          </g></svg>
                          <span className="titel">{tegelMeubel(mb)[0]}</span><small>{tegelMeubel(mb)[1]}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!schrijven ? null : tab === 'huis' ? (
            <div className="fm-bs-huis">
              {!huis.length && !huisForm && <div className="fm-sub fm-bs-leegtekst">Wat stelt {naamHost} zelf ter beschikking? Tafels, stoelen, podium… Het blijft bewaard voor volgende plannen en komt niet op onze laadlijst.</div>}
              {huis.map(huisRij)}
              {huisForm && (
                <div className="fm-bs-huisform">
                  <label className="fm-bs-veld">Naam<input autoFocus value={huisForm.naam} onChange={(e) => setHuisForm({ ...huisForm, naam: e.target.value })} placeholder="bv. Ronde tafel Ø 1,8 m" /></label>
                  <div className="fm-rij">
                    <label className="fm-bs-veld">Aantal<input type="number" min="0" value={huisForm.aantal} onChange={(e) => setHuisForm({ ...huisForm, aantal: e.target.value })} /></label>
                    <label className="fm-bs-veld">Zitplaatsen<input type="number" min="0" value={huisForm.zit} onChange={(e) => setHuisForm({ ...huisForm, zit: e.target.value })} /></label>
                  </div>
                  <label className="fm-bs-veld">Vorm
                    <select value={huisForm.vorm} onChange={(e) => setHuisForm({ ...huisForm, vorm: e.target.value })}>
                      {huisForm.basis && <option value="basis">Zoals {elementenMap.get(huisForm.basis)?.naam}</option>}
                      <option value="rond">Rond</option><option value="rechthoek">Rechthoek</option><option value="punt">Punt (bv. beamer)</option>
                    </select>
                  </label>
                  {huisForm.vorm !== 'punt' && huisForm.vorm !== 'basis' && (
                    <div className="fm-rij">
                      <label className="fm-bs-veld">{huisForm.vorm === 'rond' ? 'Diameter (m)' : 'Breedte (m)'}<input value={huisForm.b} onChange={(e) => setHuisForm({ ...huisForm, b: e.target.value })} /></label>
                      {huisForm.vorm === 'rechthoek' && <label className="fm-bs-veld">Diepte (m)<input value={huisForm.d} onChange={(e) => setHuisForm({ ...huisForm, d: e.target.value })} /></label>}
                    </div>
                  )}
                  {!huisForm.id && (
                    <label className="fm-bs-veld">Op basis van
                      <select value={huisForm.basis || ''} onChange={(e) => { const el = elementenMap.get(e.target.value); setHuisForm({ ...huisForm, basis: e.target.value || null, vorm: el ? 'basis' : 'rond', naam: huisForm.naam || el?.naam || '', zit: huisForm.zit === '' && el ? zitVan(el) || '' : huisForm.zit }); }}>
                        <option value="">Geen</option>
                        {bib.filter((e) => e.categorie === 'Binnenruimte' || /tafel|stoel|podium|bar|scherm|beamer|stand/i.test(e.naam)).map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}
                      </select>
                    </label>
                  )}
                  <div className="fm-rij"><button className="fm-knop klein zwart" disabled={!huisForm.naam.trim()} onClick={bewaarHuis}>Bewaren</button><button className="fm-knop klein" onClick={() => setHuisForm(null)}>Annuleren</button></div>
                </div>
              )}
              {schrijven && !huisForm && <div style={{ padding: 12 }}><button className="fm-knop vol" style={{ width: '100%' }} onClick={() => setHuisForm({ naam: '', aantal: '', vorm: 'rond', b: '1.8', d: '', zit: '', basis: null })}>Materiaal toevoegen</button></div>}
            </div>
          ) : tab === 'bib' && (
            <BibliotheekPaneel startCat="Binnenruimte" elementen={bib} gekozen={kiesEl} schrijven={schrijven} onKies={(el) => { setKiesEl(el); setRuimteKlik(false); setModus(null); setSel([]); }} />
          )}
        </aside>
      </div>
    </div>
  );
  // Boven alles, los van de kaart (een omhullende met transform zou 'fixed' anders inperken).
  return typeof document !== 'undefined' ? createPortal(inhoud, document.body) : inhoud;
}
