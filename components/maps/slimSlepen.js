// Slepen met slimme hulplijnen: uitlijnen op randen en middens, gelijke afstanden, maten tonen.
// Uit Editor.jsx gehaald: de body van een useEffect; Editor roept dit aan met zijn
// state, refs en callbacks. Geeft de opruimfunctie terug.

import { KNOOP_PX } from './gereedschap';
import { zetCursor } from './cursor';
import * as geo from './geo';
import { stelsel, geschaald } from './groepschaal';
import * as turf from '@turf/turf';
import { isSign } from './signalisatie';
import { draaiItem, maatVan, metMaat, lokaalNaarKaart, kaartNaarLokaal, draaiRond } from './itemgeo';
import { nieuwId } from './gereedschap';
import { hitOp } from './hit';

// Vast = het item zelf vergrendeld, of zijn laag (of de map met die laag) vergrendeld.
const vastLagen = { lagen: [] };
export const vastItem = (it) => !!it?.vergrendeld || (!!it?.laag_id && vastLagen.lagen.some((l) => l.id === it.laag_id && l.vergrendeld));
export const zetVasteLagen = (lagen) => { vastLagen.lagen = lagen || []; };

export default function slimSlepen(ctx) {
  // ctx is een functie: de waarden worden pas gelezen als het effect loopt (zoals de oorspronkelijke closure).
  const { greepRef, kaartKlaar, maakItem, mapRef, pasToe, schrijven, selectieRef, setExtra, setGeselecteerd, setGereedschap, setItems, setMelding, setVerleng, st, syncTd, tdFeature, tdRef, voorbeeldRef, volgMee, voorkeurRef } = ctx();
      const map = mapRef.current;
      if (!map || !kaartKlaar || !schrijven) return;
      let sleep = null;
      let raf = 0;
      const M_PER_GRAAD = 111320;
      const px = (c) => map.project(c);
      // Zelfde afstand als Terra Draw (pointerDistance): was die hier kleiner, dan greep Terra Draw het punt terwijl
      // wij de hele lijn begonnen te verslepen; de lijn volgde dan niet en sprong bij het loslaten.
      // Tijdens het verslepen van een knooppunt blijft de muis bij de kaart: ook boven een kaartje, greep of paneel
      // volgt het punt dan verder (anders bleef de lijn daar staan).
      const vangMuis = () => { try { if (map._fmPid != null) map.getCanvas().setPointerCapture(map._fmPid); } catch {} };
      const nabijHoekpunt = (it, p) => {
        const g = it.geometrie;
        const c = g.type === 'LineString' ? g.coordinates : g.coordinates[0];
        for (let i = 0; i < c.length; i++) {
          const a = px(c[i]);
          if (Math.hypot(a.x - p.x, a.y - p.y) < KNOOP_PX) return true;
        }
        return false;
      };
      // ---------- Spookpunt: een bolletje dat over de geselecteerde lijn meeschuift ----------
      // Klik op het bolletje: daar komt een punt bij (dat je daarna kan slepen om af te buigen).
      // Slepen vanaf een middenbolletje: punt erbij en meteen afbuigen.
      // Slepen vanaf de rest van de lijn verplaatst de hele lijn.
      const VORM_VAST = ['rechthoek', 'cirkel', 'veelhoek', 'ellips', 'sector', 'notitie', 'afstand'];
      const spookItem = () => {
        const s2 = st.current;
        if (s2.gereedschap !== 'selecteer' || !s2.geselecteerd || (selectieRef.current || []).length > 1) return null;
        const it = s2.items.find((x) => x.id === s2.geselecteerd);
        const g = it?.geometrie;
        if (!it || vastItem(it) || !g || (g.type !== 'LineString' && g.type !== 'Polygon')) return null;
        // Een stelling volgt zijn ankerlijn: geen extra punten of bochten.
        if (it.velden?.stelling) return null;
        if (VORM_VAST.includes(it.soort) || it.parameters?.route || it.parameters?.midden && g.type === 'Polygon') return null;
        if (it.groep_id && !s2.iso) return null;
        const c = g.type === 'LineString' ? g.coordinates : g.coordinates[0];
        if (c.length > 400) return null;
        return { it, c, vlak: g.type === 'Polygon', bogen: it.parameters?.bogen || null };
      };
      // Het stuk zoals het getekend is: recht, of de bocht als reeks punten.
      const stukPunten = (si, i) => { const h = Number(si.bogen?.[i]) || 0; return h ? geo.boogPunten(si.c[i], si.c[i + 1], h, 32) : [si.c[i], si.c[i + 1]]; };
      // Midden van elk stuk (dat lang genoeg is op het scherm): sleep daar om af te buigen.
      const middens = (si) => {
        const uit = [];
        for (let i = 0; i < si.c.length - 1; i++) {
          if (Number(si.bogen?.[i])) continue;
          const a = px(si.c[i]); const b = px(si.c[i + 1]);
          if (Math.hypot(b.x - a.x, b.y - a.y) < 40) continue;
          const x = (a.x + b.x) / 2; const y = (a.y + b.y) / 2; const q = map.unproject([x, y]);
          uit.push({ k: i, x, y, punt: [q.lng, q.lat] });
        }
        return uit;
      };
      const spookOp = (e) => {
        const si = spookItem();
        if (!si) return null;
        const { c } = si;
        let best = null;
        for (let i = 0; i < c.length - 1; i++) {
          // Op de lijn zoals ze getekend is (ook in een bocht), niet op de rechte tussen de twee punten.
          const pts = stukPunten(si, i).map(px); const n = pts.length - 1;
          for (let j = 0; j < n; j++) {
            const a = pts[j]; const b = pts[j + 1];
            const dx = b.x - a.x; const dy = b.y - a.y; const l2 = dx * dx + dy * dy;
            if (!l2) continue;
            const t = Math.max(0, Math.min(1, ((e.point.x - a.x) * dx + (e.point.y - a.y) * dy) / l2));
            const qx = a.x + t * dx; const qy = a.y + t * dy;
            const d = Math.hypot(qx - e.point.x, qy - e.point.y);
            if (d <= 10 && (!best || d < best.d)) best = { k: i, d, q: map.unproject([qx, qy]), t: (j + t) / n };
          }
        }
        // Bij een bestaand punt wint dat punt (Terra Draw sleept het).
        for (const q of c) { const a = px(q); if (Math.hypot(a.x - e.point.x, a.y - e.point.y) < KNOOP_PX) return null; }
        const mid = middens(si).find((m) => Math.hypot(m.x - e.point.x, m.y - e.point.y) < 10);
        if (mid) return { ...si, k: mid.k, punt: mid.punt, midden: true };
        if (!best) return null;
        const h = Number(si.bogen?.[best.k]) || 0;
        // In een bocht: het punt precies op de kromme (en de bocht blijft bij het toevoegen dezelfde vorm).
        const punt = h ? geo.splitsBoog(c[best.k], c[best.k + 1], h, best.t).punt : [best.q.lng, best.q.lat];
        return { ...si, k: best.k, punt, t: h ? best.t : null };
      };
      const toonSpook = (p, mids = []) => {
        const f = (c, m) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { m } });
        const data = { type: 'FeatureCollection', features: [...mids.map((m) => f(m.punt, 1)), ...(p ? [f(p, 0)] : [])] };
        if (map.getSource('fm-spook')) map.getSource('fm-spook').setData(data);
        else if (data.features.length) {
          map.addSource('fm-spook', { type: 'geojson', data });
          map.addLayer({ id: 'fm-spook', type: 'circle', source: 'fm-spook', paint: { 'circle-radius': ['case', ['==', ['get', 'm'], 1], 4, 5.5], 'circle-color': '#ffffff', 'circle-opacity': ['case', ['==', ['get', 'm'], 1], 0.75, 0.9], 'circle-stroke-color': '#1d1d1b', 'circle-stroke-opacity': ['case', ['==', ['get', 'm'], 1], 0.6, 1], 'circle-stroke-width': 1.4 } });
        }
      };
      let spookAan = false;
      const metPunt = (si, k, p) => {
        const it = si.it;
        const c = [...si.c];
        c.splice(k + 1, 0, p);
        const geometrie = si.vlak ? { type: 'Polygon', coordinates: [c, ...it.geometrie.coordinates.slice(1)] } : { type: 'LineString', coordinates: c };
        let parameters = it.parameters;
        const bg = it.parameters?.bogen;
        if (bg && Object.keys(bg).length) {
          // Bochten na het nieuwe punt schuiven één op. Het geknipte stuk: ligt het nieuwe punt op de bocht
          // (si.t), dan krijgen beide helften hun deel van de bocht en blijft de vorm gelijk; anders wordt het recht.
          const nb = {}; for (const [kk, h] of Object.entries(bg)) { const n = Number(kk); if (n < k) nb[n] = h; else if (n > k) nb[n + 1] = h; }
          const h0 = Number(bg[k]) || 0;
          if (h0 && si.t != null && p === si.punt) {
            const sp = geo.splitsBoog(si.c[k], si.c[k + 1], h0, si.t);
            if (Math.abs(sp.h1) > 0.01) nb[k] = Math.round(sp.h1 * 100) / 100;
            if (Math.abs(sp.h2) > 0.01) nb[k + 1] = Math.round(sp.h2 * 100) / 100;
          }
          parameters = { ...it.parameters, bogen: nb };
        }
        // Koord-vakken: het gesplitste vak blijft koord (beide helften), de rest schuift op.
        if (it.parameters?.koord?.length) parameters = { ...(parameters || {}), koord: it.parameters.koord.flatMap((n) => (n < k ? [n] : n === k ? [k, k + 1] : [n + 1])) };
        return { ...it, geometrie, parameters };
      };
      const raakt = (it, e) => {
        const g = it.geometrie;
        if (g.type === 'Point') { const a = px(g.coordinates); return Math.hypot(a.x - e.point.x, a.y - e.point.y) < 14; }
        if (g.type === 'Polygon') { try { if (turf.booleanPointInPolygon([e.lngLat.lng, e.lngLat.lat], g)) return true; } catch {} }
        // De vorm zoals ze getekend is (met bochten), niet de rechte tussen de punten.
        const gb = it.parameters?.bogen ? geo.buig(g, it.parameters.bogen) : g;
        const c = gb.type === 'LineString' ? gb.coordinates : gb.coordinates[0];
        if (g.type === 'Polygon' && gb !== g) { try { if (turf.booleanPointInPolygon([e.lngLat.lng, e.lngLat.lat], gb)) return true; } catch {} }
        for (let i = 0; i < c.length - 1; i++) {
          const a = px(c[i]); const b = px(c[i + 1]);
          const dx = b.x - a.x; const dy = b.y - a.y; const l2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((e.point.x - a.x) * dx + (e.point.y - a.y) * dy) / l2));
          if (Math.hypot(a.x + t * dx - e.point.x, a.y + t * dy - e.point.y) < 8) return true;
        }
        return false;
      };
      const kaderVan = (lijst) => geo.kader(lijst.map((x) => x.geometrie));
      const tekenGidsen = (f) => {
        const data = { type: 'FeatureCollection', features: f };
        if (map.getSource('fm-gids')) map.getSource('fm-gids').setData(data);
        else {
          map.addSource('fm-gids', { type: 'geojson', data });
          map.addLayer({ id: 'fm-gids-l', type: 'line', source: 'fm-gids', filter: ['==', ['get', 'soort'], 'lijn'], paint: { 'line-color': '#E11D48', 'line-width': 1, 'line-dasharray': [3, 2] } });
          map.addLayer({ id: 'fm-gids-a', type: 'line', source: 'fm-gids', filter: ['==', ['get', 'soort'], 'afstand'], paint: { 'line-color': ['case', ['get', 'gelijk'], '#DB2777', '#2563EB'], 'line-width': 1.5 } });
          map.addLayer({ id: 'fm-gids-t', type: 'symbol', source: 'fm-gids', filter: ['==', ['get', 'soort'], 'label'], layout: { 'text-field': ['get', 't'], 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': ['case', ['get', 'gelijk'], '#DB2777', '#2563EB'], 'text-halo-width': 3 } });
        }
      };
      const lijn = (a, b, props) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [a, b] }, properties: props });
      const label = (p, t, gelijk = false) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { soort: 'label', t, gelijk } });

      // Recht = de randen lopen noord-zuid/oost-west. Enkel dan heeft uitlijnen op
      // het omhullende kader zin; schuin gedraaide items snappen op randen en hoeken.
      const isRecht = (g) => {
        if (g.type === 'Point') return true;
        const c = g.type === 'LineString' ? g.coordinates : g.coordinates[0];
        const sx = Math.cos((c[0][1] * Math.PI) / 180);
        for (let i = 0; i < c.length - 1; i++) {
          const ddx = (c[i + 1][0] - c[i][0]) * sx; const ddy = c[i + 1][1] - c[i][1];
          const l = Math.hypot(ddx, ddy); if (!l) continue;
          if (Math.min(Math.abs(ddx), Math.abs(ddy)) / l > 0.02) return false;
        }
        return true;
      };
      const hoeken = (g) => {
        if (g.type === 'Point') return [g.coordinates];
        const c = g.type === 'LineString' ? g.coordinates : g.coordinates[0];
        return g.type === 'Polygon' ? c.slice(0, -1) : c;
      };
      const randen = (g) => {
        if (g.type === 'Point') return [];
        const c = g.type === 'LineString' ? g.coordinates : g.coordinates[0];
        const r = []; for (let i = 0; i < c.length - 1; i++) r.push([c[i], c[i + 1]]);
        return r;
      };
      // Hoek op hoek, hoek op rand en rand op hoek, in pixels. Eenmaal vast blijft
      // het vast (ruimere marge) en schuift het langs de rand, zodat het niet hapert.
      function randSnap(dx, dy) {
        const TOL = 10; const HOU = 20;
        const k = sleep.kader; const marge = Math.max(k[2] - k[0], k[3] - k[1]) * 0.6 + 1e-4;
        const kk = [k[0] + dx - marge, k[1] + dy - marge, k[2] + dx + marge, k[3] + dy + marge];
        const doelen = sleep.anderen.filter((c) => (!sleep.recht || !c.recht) && c.k[2] >= kk[0] && c.k[0] <= kk[2] && c.k[3] >= kk[1] && c.k[1] <= kk[3]);
        const sn = st.current.snap || {};
        if (!doelen.length || (!sn.punten && !sn.lijnen)) { sleep.vast = null; return null; }
        const mijnH = []; const mijnR = [];
        for (const x of sleep.orig) {
          if (x.velden?.tentStuk && sleep.orig.some((y) => y.id === x.velden.tentStuk.tent)) continue;
          for (const h of hoeken(x.geometrie)) mijnH.push(px([h[0] + dx, h[1] + dy]));
          for (const [a, b] of randen(x.geometrie)) mijnR.push([px([a[0] + dx, a[1] + dy]), px([b[0] + dx, b[1] + dy])]);
          if (mijnH.length > 400) break;
        }
        const opLijn = (p, a, b, vrij = 0.02) => {
          const ex = b.x - a.x; const ey = b.y - a.y; const l2 = ex * ex + ey * ey; if (!l2) return null;
          const t = ((p.x - a.x) * ex + (p.y - a.y) * ey) / l2;
          if (t < -vrij || t > 1 + vrij) return null;
          return { x: a.x + t * ex - p.x, y: a.y + t * ey - p.y };
        };
        const lengte = (v) => Math.hypot(v.x, v.y);
        // Kandidaat uitrekenen voor een vastgelegd doel (in kaartcoördinaten).
        const reken = (d) => {
          if (d.t === 'hh') { const p = mijnH[d.i]; const q = px(d.q); return p && { x: q.x - p.x, y: q.y - p.y }; }
          if (d.t === 'hr') { const p = mijnH[d.i]; return p && opLijn(p, px(d.a), px(d.b), 0.1); }
          if (d.t === 'rh') { const r = mijnR[d.j]; if (!r) return null; const v0 = opLijn(px(d.q), r[0], r[1], 0.1); return v0 && { x: -v0.x, y: -v0.y }; }
          return null;
        };
        let doel = null; let v = null;
        if (sleep.vast) { const v1 = reken(sleep.vast); if (v1 && lengte(v1) < HOU) { doel = sleep.vast; v = v1; } }
        if (!doel) {
          let best = null;
          for (const d of doelen) {
            const H = hoeken(d.g); const Hp = H.map(px); const R = randen(d.g);
            mijnH.forEach((p, i) => {
              Hp.forEach((q, j) => { const w = { x: q.x - p.x, y: q.y - p.y }; const l = lengte(w); if (l < TOL && (!best || l < best.l - 2)) best = { l, v: w, d: { t: 'hh', i, q: H[j] } }; });
              R.forEach(([a, b]) => { const w = opLijn(p, px(a), px(b)); if (!w) return; const l = lengte(w); if (l < TOL * 0.8 && (!best || l < best.l)) best = { l, v: w, d: { t: 'hr', i, a, b } }; });
            });
            Hp.forEach((q, n) => mijnR.forEach(([a, b], j) => { const w0 = opLijn(q, a, b); if (!w0) return; const w = { x: -w0.x, y: -w0.y }; const l = lengte(w); if (l < TOL * 0.8 && (!best || l < best.l)) best = { l, v: w, d: { t: 'rh', j, q: H[n] } }; }));
          }
          if (!best) { sleep.vast = null; return null; }
          doel = best.d; v = best.v;
        }
        sleep.vast = doel;
        const gidsen = [];
        // Tegen een rand: kijk of er langs die rand ook een hoek op een hoek kan vallen.
        if (doel.t === 'hr' || doel.t === 'rh') {
          const [A, B] = doel.t === 'hr' ? [px(doel.a), px(doel.b)] : mijnR[doel.j];
          const ex = B.x - A.x; const ey = B.y - A.y; const el = Math.hypot(ex, ey) || 1; const ux = ex / el; const uy = ey / el;
          let langsBest = null;
          for (const d of doelen) for (const q of hoeken(d.g).map(px)) for (const p0 of mijnH) {
            const w = { x: q.x - (p0.x + v.x), y: q.y - (p0.y + v.y) };
            const langs = w.x * ux + w.y * uy; const dwars = Math.abs(-w.x * uy + w.y * ux);
            if (dwars < 2 && Math.abs(langs) < TOL && (langsBest == null || Math.abs(langs) < Math.abs(langsBest))) langsBest = langs;
          }
          if (langsBest != null) v = { x: v.x + langsBest * ux, y: v.y + langsBest * uy };
          if (doel.t === 'hr') gidsen.push(lijn(doel.a, doel.b, { soort: 'lijn' }));
        }
        const p0 = mijnH[0];
        const a = map.unproject([p0.x, p0.y]); const b = map.unproject([p0.x + v.x, p0.y + v.y]);
        return { dx: dx + (b.lng - a.lng), dy: dy + (b.lat - a.lat), gidsen };
      }

      function slim(dx, dy, e) {
        if (!sleep.recht) {
          const r = randSnap(dx, dy);
          return r || { dx, dy, gidsen: [] };
        }
        const r = randSnap(dx, dy);
        if (r) return r;
        const k0 = sleep.kader;
        const k = [k0[0] + dx, k0[1] + dy, k0[2] + dx, k0[3] + dy];
        const o = map.unproject([0, 0]); const ox = map.unproject([6, 0]); const oy = map.unproject([0, 6]);
        const tolX = Math.abs(ox.lng - o.lng); const tolY = Math.abs(oy.lat - o.lat);
        const cos = Math.cos((k[1] * Math.PI) / 180);
        const mX = [k[0], (k[0] + k[2]) / 2, k[2]]; const mY = [k[1], (k[1] + k[3]) / 2, k[3]];
        let bx = null; let by = null;
        // Uitlijnen enkel op items in de buurt (binnen de halve eigen maat): in een vol plan klikt het anders voortdurend
        // vast aan iets ver weg en springt het in stappen.
        const nabij = Math.min(k[2] - k[0], k[3] - k[1]) * 0.5; // lng en lat apart te groot schatten mag niet: de kleinste maat
        for (const c of sleep.anderen) {
          if (!c.recht) continue;
          const vY = Math.max(0, c.k[1] - k[3], k[1] - c.k[3]); const vX = Math.max(0, c.k[0] - k[2], k[0] - c.k[2]);
          const tX = vY > nabij ? [] : [c.k[0], (c.k[0] + c.k[2]) / 2, c.k[2]]; const tY = vX > nabij ? [] : [c.k[1], (c.k[1] + c.k[3]) / 2, c.k[3]];
          for (const m of mX) for (const t of tX) { const d = Math.abs(t - m); if (d < tolX && (!bx || d < bx.d)) bx = { d, s: t - m, x: t, c }; }
          for (const m of mY) for (const t of tY) { const d = Math.abs(t - m); if (d < tolY && (!by || d < by.d)) by = { d, s: t - m, y: t, c }; }
        }
        const gidsen = [];
        // Gelijke tussenafstand tussen de buren links/rechts of onder/boven.
        const buren = (kk) => {
          const overlapY = (c) => c.k[1] < kk[3] && c.k[3] > kk[1];
          const overlapX = (c) => c.k[0] < kk[2] && c.k[2] > kk[0];
          let L = null; let R = null; let O = null; let B = null;
          for (const c of sleep.anderen) {
            if (!c.recht) continue;
            if (overlapY(c)) {
              if (c.k[2] <= kk[0] + tolX && (!L || c.k[2] > L.k[2])) L = c;
              if (c.k[0] >= kk[2] - tolX && (!R || c.k[0] < R.k[0])) R = c;
            }
            if (overlapX(c)) {
              if (c.k[3] <= kk[1] + tolY && (!O || c.k[3] > O.k[3])) O = c;
              if (c.k[1] >= kk[3] - tolY && (!B || c.k[1] < B.k[1])) B = c;
            }
          }
          return { L, R, O, B };
        };
        let nb = buren(k);
        let gelijkX = false; let gelijkY = false;
        if (!bx && nb.L && nb.R) { const s2 = ((nb.R.k[0] - k[2]) - (k[0] - nb.L.k[2])) / 2; if (Math.abs(s2) < tolX) { bx = { s: s2 }; gelijkX = true; } }
        if (!by && nb.O && nb.B) { const s2 = ((nb.B.k[1] - k[3]) - (k[1] - nb.O.k[3])) / 2; if (Math.abs(s2) < tolY) { by = { s: s2 }; gelijkY = true; } }
        if (e.originalEvent.shiftKey) { if (sleep.as === 'x') by = null; if (sleep.as === 'y') bx = null; }
        if (bx) dx += bx.s;
        if (by) dy += by.s;
        const kk = [k0[0] + dx, k0[1] + dy, k0[2] + dx, k0[3] + dy];
        if (bx?.c) { const c = bx.c; gidsen.push(lijn([bx.x, Math.min(kk[1], c.k[1])], [bx.x, Math.max(kk[3], c.k[3])], { soort: 'lijn' })); }
        if (by?.c) { const c = by.c; gidsen.push(lijn([Math.min(kk[0], c.k[0]), by.y], [Math.max(kk[2], c.k[2]), by.y], { soort: 'lijn' })); }
        // Afstanden tot de buren.
        nb = buren(kk);
        const midY = (kk[1] + kk[3]) / 2; const midX = (kk[0] + kk[2]) / 2;
        const afst = (a, b, m) => `${geo.getal(m, m < 10 ? 2 : 1)} m`;
        if (nb.L) { const a = [nb.L.k[2], midY]; const b = [kk[0], midY]; const m = (kk[0] - nb.L.k[2]) * M_PER_GRAAD * cos; if (m > 0.01) { gidsen.push(lijn(a, b, { soort: 'afstand', gelijk: gelijkX })); gidsen.push(label([(a[0] + b[0]) / 2, midY], afst(a, b, m), gelijkX)); } }
        if (nb.R) { const a = [kk[2], midY]; const b = [nb.R.k[0], midY]; const m = (nb.R.k[0] - kk[2]) * M_PER_GRAAD * cos; if (m > 0.01) { gidsen.push(lijn(a, b, { soort: 'afstand', gelijk: gelijkX })); gidsen.push(label([(a[0] + b[0]) / 2, midY], afst(a, b, m), gelijkX)); } }
        if (nb.O) { const a = [midX, nb.O.k[3]]; const b = [midX, kk[1]]; const m = (kk[1] - nb.O.k[3]) * M_PER_GRAAD; if (m > 0.01) { gidsen.push(lijn(a, b, { soort: 'afstand', gelijk: gelijkY })); gidsen.push(label([midX, (a[1] + b[1]) / 2], afst(a, b, m), gelijkY)); } }
        if (nb.B) { const a = [midX, kk[3]]; const b = [midX, nb.B.k[1]]; const m = (nb.B.k[1] - kk[3]) * M_PER_GRAAD; if (m > 0.01) { gidsen.push(lijn(a, b, { soort: 'afstand', gelijk: gelijkY })); gidsen.push(label([midX, (a[1] + b[1]) / 2], afst(a, b, m), gelijkY)); } }
        return { dx, dy, gidsen };
      }

      const verschoven = (x, dx, dy) => ({
        ...x,
        geometrie: geo.verschuifGraden(x.geometrie, dx, dy),
        parameters: x.parameters?.midden ? { ...x.parameters, midden: [x.parameters.midden[0] + dx, x.parameters.midden[1] + dy] } : x.parameters,
      });
      const ITEMLAGEN = ['fm-sign', 'fm-punt', 'fm-tekst', 'fm-lijn-vol', 'fm-lijn-streep', 'fm-lijn-stip', 'fm-lijn-streeppunt', 'fm-stuk-vulling', 'fm-stuk-lijn-vol', 'fm-vulling', 'fm-patroon', 'fm-vloer', 'fm-vloer-lijn'];
      const omlaag = (e) => {
        const s2 = st.current;
        if (s2.gereedschap !== 'selecteer' || e.originalEvent.button !== 0 || e.originalEvent.shiftKey || s2.doekPenseel || s2.brandPenseel) return;
        let ids = selectieRef.current;
        // Een groep beweegt altijd als geheel (buiten "Groep bewerken"), ook als maar een deel geselecteerd is.
        if (!s2.iso) { const gr = new Set(s2.items.filter((x) => ids.includes(x.id) && x.groep_id).map((x) => x.groep_id)); if (gr.size) ids = [...ids, ...s2.items.filter((x) => x.groep_id && gr.has(x.groep_id) && !ids.includes(x.id)).map((x) => x.id)]; }
        // Maatgrepen en draaigreep eerst: die liggen op of naast de rand.
        const greep = greepRef.current;
        // '+' voorbij een uiteinde: verder tekenen vanaf dat uiteinde.
        if (greep?.einden && greep.id === s2.geselecteerd) {
          // Het uiteinde zelf gaat voor: dichter bij het eindpunt dan bij de '+' = punt verslepen, niet verlengen.
          const selG = s2.items.find((x) => x.id === greep.id)?.geometrie;
          const eind = (kant) => (selG?.type === 'LineString' ? px(kant === 'begin' ? selG.coordinates[0] : selG.coordinates[selG.coordinates.length - 1]) : null);
          const v = greep.einden.find((m) => { const q = px(m.punt); const dPlus = Math.hypot(q.x - e.point.x, q.y - e.point.y); const ep = eind(m.kant); const dEind = ep ? Math.hypot(ep.x - e.point.x, ep.y - e.point.y) : Infinity; return dPlus < 9 && dPlus < dEind; });
          if (v) { e.preventDefault(); map._fmNegeerKlik = Date.now() + 400; setVerleng?.({ id: greep.id, kant: v.kant }); setGereedschap?.('verleng'); return; }
        }
        // Een knooppunt gaat voor op een bochtbolletje: bij een dichte lijn (bv. een ingelezen GPX/KMZ-parcours dat
        // heen en terug loopt) ligt het bolletje van een ander stuk anders net op het punt dat je wil verslepen.
        const selIt = s2.geselecteerd ? s2.items.find((x) => x.id === s2.geselecteerd) : null;
        const opKnoop = !!(selIt && selIt.geometrie && selIt.geometrie.type !== 'Point' && nabijHoekpunt(selIt, e.point));
        if (greep?.bochten && greep.id === s2.geselecteerd && !opKnoop) {
          const h = greep.bochten.find((m) => { const q = px(m.punt); return Math.hypot(q.x - e.point.x, q.y - e.point.y) < 9; });
          const it0 = h && s2.items.find((x) => x.id === greep.id);
          if (it0 && !vastItem(it0)) {
            e.preventDefault();
            if (e.originalEvent.detail >= 2) {
              // Dubbelklik: weer recht.
              const bogen = { ...(it0.parameters?.bogen || {}) }; delete bogen[h.k];
              pasToe(it0, { ...it0, parameters: { ...(it0.parameters || {}), bogen } });
              return;
            }
            sleep = { bocht: true, orig: [it0], h, bewogen: false };
            // De rechte selectielijn van Terra Draw en de andere grepen even weg: enkel de bocht en het bolletje.
            map._fmBochtSleep = true;
            try { tdRef.current?.updateFeatureProperties(it0.id, { gebogen: true }); } catch {}
            map.dragPan.disable();
            return;
          }
        }
        if (greep?.maat && greep.id === s2.geselecteerd) {
          const h = greep.maat.find((m) => { const q = px(m.punt); return Math.hypot(q.x - e.point.x, q.y - e.point.y) < 9; });
          const it0 = h && s2.items.find((x) => x.id === greep.id);
          if (it0 && !vastItem(it0)) {
            e.preventDefault();
            sleep = { maat: true, orig: [it0], h, bewogen: false };
            map.dragPan.disable();
            return;
          }
        }
        if (greep?.multi && greep.schaal) {
          const h = greep.schaal.grepen.find((m) => { const q = px(m.punt); return Math.hypot(q.x - e.point.x, q.y - e.point.y) < 9; });
          const orig = h ? s2.items.filter((x) => ids.includes(x.id) && !vastItem(x) && x.geometrie) : [];
          if (orig.length) {
            e.preventDefault();
            sleep = { schaalMulti: true, orig, h, g: greep.schaal, bewogen: false };
            map.dragPan.disable();
            return;
          }
        }
        if (greep && s2.geselecteerd && (greep.multi || greep.id === s2.geselecteerd)) {
          const q = px(greep.punt);
          if (Math.hypot(q.x - e.point.x, q.y - e.point.y) < 14) {
            const sel = s2.items.filter((x) => ids.includes(x.id) && !vastItem(x) && x.geometrie);
            const orig = greep.multi ? sel : sel.filter((x) => x.id === greep.id);
            if (orig.length) {
              e.preventDefault();
              // Randen van items in de buurt: draaien klikt vast op dezelfde richting.
              const eigen = [];
              for (const x of orig) for (const [a, b] of randen(x.geometrie)) { const l = turf.distance(a, b, { units: 'meters' }); if (l > 0.3) eigen.push({ r: turf.bearing(a, b), l }); }
              const kk = geo.kader(orig.map((x) => x.geometrie));
              const straal = Math.max(15, turf.distance([kk[0], kk[1]], [kk[2], kk[3]], { units: 'meters' }) * 1.5);
              const buren = [];
              for (const x of s2.items) {
                if (ids.includes(x.id) || x.verborgen || !x.geometrie || x.geometrie.type === 'Point') continue;
                for (const [a, b] of randen(x.geometrie)) {
                  const l = turf.distance(a, b, { units: 'meters' });
                  if (l < 0.5 || turf.distance(greep.centrum, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], { units: 'meters' }) > straal + l / 2) continue;
                  buren.push({ r: turf.bearing(a, b), a, b });
                  if (buren.length > 400) break;
                }
              }
              // De grepen en het kader draaien zichtbaar mee (de echte grepen komen terug bij het loslaten).
              let greepData = null; try { const d = map.getSource('fm-greep')?._data; greepData = d?.geojson || (d?.type === 'FeatureCollection' ? d : null); } catch {}
              sleep = { greepData, draai: true, orig, multi: !!greep.multi, rond: !!greep.rond, centrum: greep.centrum, start: turf.bearing(greep.centrum, [e.lngLat.lng, e.lngLat.lat]), hoek: 0, bewogen: false, eigen, buren };
              map.dragPan.disable();
              return;
            }
          }
        }
        // Meteen slepen zonder eerst te selecteren: het item onder de muis wordt de selectie.
        // Wat bovenaan ligt onder de muis wint (zoals bij het oplichten), niet de lijn
        // die er toevallig het dichtst bij ligt.
        // Dubbelklik op een punt van de geselecteerde lijn: punt weg.
        if (e.originalEvent.detail >= 2) {
          const si = spookItem();
          if (si) {
            const i = si.c.findIndex((q) => { const a = px(q); return Math.hypot(a.x - e.point.x, a.y - e.point.y) < 10; });
            const min = si.vlak ? 4 : 2;
            if (i >= 0 && si.c.length > min) {
              e.preventDefault();
              let c = si.c.filter((_, j) => j !== i);
              if (si.vlak) { if (i === 0) c = [...c.slice(0, -1), c[0]]; }
              const g2 = si.vlak ? { type: 'Polygon', coordinates: [c, ...si.it.geometrie.coordinates.slice(1)] } : { type: 'LineString', coordinates: c };
              const bg = si.it.parameters?.bogen;
              const nb = {}; if (bg) for (const [kk, h] of Object.entries(bg)) { const n = Number(kk); if (n < i - 1) nb[n] = h; else if (n > i) nb[n - 1] = h; }
              let par = bg ? { ...si.it.parameters, bogen: nb } : si.it.parameters;
              const ko = si.it.parameters?.koord;
              if (ko?.length) { const nk = [...new Set(ko.map(Number).filter((n) => n !== i).map((n) => (n > i ? n - 1 : n)))]; par = { ...(par || {}), koord: nk.length ? nk : undefined }; }
              pasToe(si.it, { ...si.it, geometrie: g2, parameters: par });
              setTimeout(syncTd, 0);
              setMelding('Punt verwijderd.');
              return;
            }
          }
        }
        // Knooppunt van de geselecteerde lijn of vlak: altijd Terra Draw, ook als er een ander item bovenop ligt.
        { const sel0 = ids[0] ? s2.items.find((x) => x.id === ids[0]) : null;
          if (sel0 && !vastItem(sel0) && sel0.geometrie && sel0.geometrie.type !== 'Point' && !(sel0.groep_id && !s2.iso) && nabijHoekpunt(sel0, e.point)) { map._fmTdKnoop = true; vangMuis(); return; } }
        const spookKlik = !(e.originalEvent.ctrlKey || e.originalEvent.metaKey || e.originalEvent.shiftKey) ? spookOp(e) : null;
        if (spookKlik?.midden) {
          // Middenbolletje: punt erbij en meteen slepen (afbuigen).
          e.preventDefault();
          sleep = { spook: true, sp: spookKlik, start: e.point, bewogen: false };
          map.dragPan.disable();
          return;
        }
        const hit = hitOp(map, e.point, s2.items)?.id || null;
        voorkeurRef.current = hit ? { id: hit, t: Date.now() } : null;
        const raakSel = hit ? ids.includes(hit) : s2.items.some((it) => ids.includes(it.id) && it.geometrie && raakt(it, e));
        // Ctrl/Cmd + klik op iets dat niet geselecteerd is: bijselecteren (bij het loslaten), niet vervangen.
        if (!raakSel && (e.originalEvent.ctrlKey || e.originalEvent.metaKey)) return;
        if (!raakSel) {
          const it = hit ? s2.items.find((x) => x.id === hit) : null;
          if (!it || vastItem(it) || !it.geometrie || isSign(it)) return;
          const groep = it.groep_id ? s2.items.filter((x) => x.groep_id === it.groep_id).map((x) => x.id) : [it.id];
          ids = [it.id, ...groep.filter((x) => x !== it.id)];
          selectieRef.current = ids;
          if (s2.geselecteerd && s2.geselecteerd !== it.id) { try { tdRef.current?.deselectFeature(s2.geselecteerd); } catch {} }
          setGeselecteerd(it.id); setExtra(ids.slice(1));
          try { tdRef.current?.selectFeature(it.id); } catch {}
        }
        if (!ids.length) return;
        // Een tent neemt zijn vloerstukken mee (één geheel).
        const lijst = s2.items.filter((x) => (ids.includes(x.id) || (x.velden?.tentStuk && ids.includes(x.velden.tentStuk.tent) && !ids.includes(x.id))) && !vastItem(x) && x.geometrie);
        if (!lijst.length) return;
        const prim = lijst.find((x) => x.id === ids[0]);
        if (prim && prim.geometrie.type !== 'Point' && raakSel && !(prim.groep_id && !s2.iso) && nabijHoekpunt(prim, e.point)) { map._fmTdKnoop = true; vangMuis(); return; } // knooppunt: Terra Draw (niet in een gesloten groep)
        // Wat je ziet telt: een stelling of wand getekend vanaf een ankerlijn grijp je ook bij de vakken, niet enkel bij de lijn.
        if (!lijst.some((it) => it.id === hit || raakt(it, e))) return;
        e.preventDefault();
        const b = map.getBounds();
        const zicht = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
        const anderen = [];
        const mee = new Set(lijst.map((x) => x.id));
        for (const x of s2.items) {
          // Wat meebeweegt (bv. de vloerstukken van de tent) is geen doel om aan vast te klikken: anders springt het terug.
          if (mee.has(x.id) || ids.includes(x.id) || x.verborgen || !x.geometrie) continue;
          const k = geo.kader([x.geometrie]);
          if (!k || k[2] < zicht[0] || k[0] > zicht[2] || k[3] < zicht[1] || k[1] > zicht[3]) continue;
          anderen.push({ id: x.id, k, g: x.geometrie, recht: isRecht(x.geometrie) });
        }
        sleep = { start: [e.lngLat.lng, e.lngLat.lat], orig: lijst, kader: kaderVan(lijst), anderen, recht: lijst.every((x) => isRecht(x.geometrie)), dx: 0, dy: 0, as: null, bewogen: false, kopie: e.originalEvent.altKey, spookKlik };
        map.dragPan.disable();
      };
      const gedraaid = (it, delta, s0 = sleep) => (s0?.multi || s0?.rond ? draaiRond(it, delta, s0.centrum, st.current.elementen) : draaiItem(it, delta, st.current.elementen));
      const beweeg = (e) => {
        if (!sleep) {
          // Spookpunt tonen boven de geselecteerde lijn.
          if (e.originalEvent.buttons) return;
          const gr = greepRef.current;
          if (gr?.einden && gr.id === st.current.geselecteerd && gr.einden.some((m) => { const q = px(m.punt); return Math.hypot(q.x - e.point.x, q.y - e.point.y) < 10; })) {
            if (spookAan) { toonSpook(null); spookAan = false; }
            zetCursor(map, 'greep', 'pointer'); spookAan = true;
            return;
          }
          const si = st.current.gereedschap === 'selecteer' ? spookItem() : null;
          const mids = si ? middens(si) : [];
          const sp = si && !(e.originalEvent.ctrlKey || e.originalEvent.metaKey) ? spookOp(e) : null;
          zetCursor(map, 'greep', '');
          if (sp) { toonSpook(sp.midden ? null : sp.punt, mids); spookAan = true; zetCursor(map, 'spook', sp.midden ? 'grab' : 'copy'); }
          else if (mids.length) { toonSpook(null, mids); spookAan = true; zetCursor(map, 'spook', ''); }
          else if (spookAan) { toonSpook(null); spookAan = false; zetCursor(map, 'spook', ''); }
          return;
        }
        if (sleep.spook) {
          if (!sleep.bewogen && Math.hypot(e.point.x - sleep.start.x, e.point.y - sleep.start.y) < 4) return;
          sleep.bewogen = true;
          const p = [e.lngLat.lng, e.lngLat.lat];
          sleep.nieuw = metPunt(sleep.sp, sleep.sp.k, p);
          toonSpook(p);
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            if (!sleep?.nieuw) return;
            const n = sleep.nieuw;
            voorbeeldRef.current?.([n]);
            try { tdRef.current?.updateFeatureGeometry(n.id, geo.rondGeom(n.geometrie)); } catch {}
          });
          return;
        }
        if (sleep.bocht) {
          const it0 = sleep.orig[0]; const { a, b, k } = sleep.h;
          let h = geo.boogH(a, b, [e.lngLat.lng, e.lngLat.lat]);
          const m1 = map.unproject([e.point.x, e.point.y]); const m2 = map.unproject([e.point.x + 7, e.point.y]);
          if (Math.abs(h) < turf.distance([m1.lng, m1.lat], [m2.lng, m2.lat], { units: 'meters' })) h = 0; // dicht bij recht: recht
          const bogen = { ...(it0.parameters?.bogen || {}) };
          if (h) bogen[k] = Math.round(h * 100) / 100; else delete bogen[k];
          const n = { ...it0, parameters: { ...(it0.parameters || {}), bogen } };
          sleep.nieuw = n; sleep.bewogen = true;
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            if (!sleep?.nieuw) return;
            const x = sleep.nieuw;
            voorbeeldRef.current?.([x]);
            // Het bochtbolletje volgt de cursor (de andere grepen even weg tot het loslaten).
            const top = h ? geo.boogTop(a, b, h) : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            map.getSource('fm-greep')?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: top }, properties: { bocht: true, gebogen: !!h } }] });
            setMelding(h ? `Bocht ${geo.getal(Math.abs(h), 2)} m · dubbelklik op het bolletje maakt het weer recht` : 'Recht');
          });
          return;
        }
        if (sleep.schaalMulti) {
          const { g, h } = sleep; const S = stelsel(g.c, g.B); const [mu, mv] = S.naar([e.lngLat.lng, e.lngLat.lat]);
          // Vaste kant = de overkant van de greep; Alt = rond het midden; Shift = verhouding behouden.
          const alt = e.originalEvent.altKey;
          const vu = alt ? (g.k.u0 + g.k.u1) / 2 : h.su > 0 ? g.k.u0 : g.k.u1; const vv = alt ? (g.k.v0 + g.k.v1) / 2 : h.sv > 0 ? g.k.v0 : g.k.v1;
          const ru = h.su > 0 ? g.k.u1 : g.k.u0; const rv = h.sv > 0 ? g.k.v1 : g.k.v0;
          let fu = h.su ? Math.max(0.02, (mu - vu) / ((ru - vu) || 1e-9)) : 1; let fv = h.sv ? Math.max(0.02, (mv - vv) / ((rv - vv) || 1e-9)) : 1;
          if (e.originalEvent.shiftKey && h.su && h.sv) { const f0 = Math.max(fu, fv); fu = f0; fv = f0; }
          const n = sleep.orig.map((x) => geschaald(x, g.c, g.B, [vu, vv], [fu, fv]));
          sleep.nieuw = n; sleep.bewogen = true;
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            if (!sleep?.nieuw) return;
            voorbeeldRef.current?.(sleep.nieuw);
            const L0 = g.k.u1 - g.k.u0; const W0 = g.k.v1 - g.k.v0;
            setMelding([h.su ? `Lengte ${geo.getal(L0)} → ${geo.getal(L0 * fu)} m` : '', h.sv ? `Breedte ${geo.getal(W0)} → ${geo.getal(W0 * fv)} m` : ''].filter(Boolean).join(' · ') + ' · Shift = verhouding, Alt = rond het midden');
          });
          return;
        }
        if (sleep.maat) {
          const it0 = sleep.orig[0]; const p0 = it0.parameters; const bd = maatVan(it0, st.current.elementen.find((x) => x.id === it0.element_id)); const rot = Number(p0.rot) || 0;
          const [mx, my] = kaartNaarLokaal(p0.midden, rot, [e.lngLat.lng, e.lngLat.lat]);
          const { sx, sy } = sleep.h;
          let b = bd.b; let d = bd.d; let cx = 0; let cy = 0;
          // Modules: altijd een heel aantal (minstens één) in elke richting.
          const rondB = (v) => (bd.sb ? Math.max(1, Math.round(v / bd.sb)) * bd.sb : Math.max(0.1, Math.round(v * 100) / 100));
          const rondD = (v) => (bd.sd ? Math.max(1, Math.round(v / bd.sd)) * bd.sd : Math.max(0.1, Math.round(v * 100) / 100));
          if (e.originalEvent.altKey) { if (sx) b = rondB(2 * Math.abs(mx)); if (sy) d = rondD(2 * Math.abs(my)); }
          else {
            if (sx) { const vast = (-sx * bd.b) / 2; b = rondB(Math.abs(mx - vast)); cx = vast + (sx * b) / 2; }
            if (sy) { const vast = (-sy * bd.d) / 2; d = rondD(Math.abs(my - vast)); cy = vast + (sy * d) / 2; }
          }
          if (e.originalEvent.shiftKey && sx && sy) {
            // Verhouding behouden.
            const f = Math.max(b / bd.b, d / bd.d); b = rondB(bd.b * f); d = rondD(bd.d * f);
            if (!e.originalEvent.altKey) { cx = (-sx * bd.b) / 2 + (sx * b) / 2; cy = (-sy * bd.d) / 2 + (sy * d) / 2; }
          }
          const midden = lokaalNaarKaart(p0.midden, rot, cx, cy);
          const n = metMaat(it0, b, d, midden);
          sleep.nieuw = n; sleep.bewogen = true;
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            if (!sleep?.nieuw) return;
            const x = sleep.nieuw;
            voorbeeldRef.current?.([x]);
            try { tdRef.current?.updateFeatureGeometry(x.id, geo.rondGeom(x.geometrie)); } catch {}
            setMelding(`${geo.getal(b, 2)} × ${geo.getal(d, 2)} m${bd.sb ? ` · ${Math.round(b / bd.sb)} × ${Math.round(d / bd.sd)} elementen` : ''} · Shift: verhouding · Alt: vanuit het midden`);
          });
          return;
        }
        if (sleep.draai) {
          let delta = turf.bearing(sleep.centrum, [e.lngLat.lng, e.lngLat.lat]) - sleep.start;
          let gelijk = null;
          if (e.originalEvent.shiftKey) delta = Math.round(delta / 15) * 15;
          else if (!(e.originalEvent.ctrlKey || e.originalEvent.metaKey) && sleep.buren.length) {
            // Evenwijdig of haaks op een rand in de buurt: binnen 3° klikt het vast.
            let best = null;
            for (const o of sleep.eigen) for (const b of sleep.buren) {
              let d = ((b.r - (o.r + delta)) % 90 + 135) % 90 - 45;
              if (Math.abs(d) < 3 && (!best || Math.abs(d) < Math.abs(best.d) - 0.05 || (Math.abs(Math.abs(d) - Math.abs(best.d)) <= 0.05 && o.l > best.l))) best = { d, b, l: o.l };
            }
            if (best) { delta += best.d; gelijk = best.b; }
          }
          tekenGidsen(gelijk ? [lijn(gelijk.a, gelijk.b, { soort: 'lijn' })] : []);
          sleep.hoek = delta; sleep.bewogen = true; sleep.gelijk = !!gelijk;
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            if (!sleep) return;
            const nieuw = new Map(sleep.orig.map((x) => [x.id, gedraaid(x, sleep.hoek)]));
            voorbeeldRef.current?.([...nieuw.values()]);
            if (sleep.greepData?.features) { try { map.getSource('fm-greep')?.setData({ type: 'FeatureCollection', features: sleep.greepData.features.map((f) => ({ ...f, geometry: geo.draai(f.geometry, sleep.hoek, sleep.centrum) })) }); } catch {} }
            for (const n of nieuw.values()) { try { tdRef.current?.updateFeatureGeometry(n.id, geo.rondGeom(n.geometrie)); } catch {} }
            const n = nieuw.values().next().value;
            const rot = sleep.multi ? null : (n.parameters?.rot ?? n.parameters?.richting);
            setMelding(`Draaien ${geo.getal(sleep.hoek, 1)}°${rot != null ? ` · nu ${geo.getal(rot, 1)}°` : ''}${sleep.gelijk ? ' · gelijk met het item ernaast' : ''} · Shift: per 15° · Ctrl: vrij`);
          });
          return;
        }
        let dx = e.lngLat.lng - sleep.start[0];
        let dy = e.lngLat.lat - sleep.start[1];
        const startPx = px(sleep.start);
        if (!sleep.bewogen && Math.hypot(e.point.x - startPx.x, e.point.y - startPx.y) < 3) return;
        sleep.bewogen = true;
        if (e.originalEvent.shiftKey) {
          const cos = Math.cos((sleep.start[1] * Math.PI) / 180);
          if (!sleep.as) sleep.as = Math.abs(dx * cos) > Math.abs(dy) ? 'x' : 'y';
          if (sleep.as === 'x') dy = 0; else dx = 0;
        } else sleep.as = null;
        let gidsen = [];
        if (e.originalEvent.altKey) sleep.kopie = true;
        if (!(e.originalEvent.ctrlKey || e.originalEvent.metaKey)) ({ dx, dy, gidsen } = slim(dx, dy, e));
        sleep.dx = dx; sleep.dy = dy;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          if (!sleep) return;
          const nieuw = new Map(sleep.orig.map((x) => [x.id, verschoven(x, sleep.dx, sleep.dy)]));
          voorbeeldRef.current?.([...nieuw.values()]);
          zetCursor(map, 'sleep', 'grabbing');
          // Terra Draw enkel voor wat geselecteerd is (niet elk vloerstuk); de melding hoogstens om de 120 ms (minder herteken van de editor).
          for (const x of nieuw.values()) { if (x.velden?.tentStuk) continue; try { tdRef.current?.updateFeatureGeometry(x.id, geo.rondGeom(x.geometrie)); } catch {} }
          tekenGidsen(gidsen);
          const m = sleep.dx * M_PER_GRAAD * Math.cos((sleep.start[1] * Math.PI) / 180); const n = sleep.dy * M_PER_GRAAD;
          const nu = performance.now(); if (nu - (sleep.meldOp || 0) < 120) return; sleep.meldOp = nu;
          setMelding(`${sleep.kopie ? 'Kopie' : 'Verplaatst'} ${geo.getal(Math.abs(m), 2)} m ${m >= 0 ? 'oost' : 'west'} · ${geo.getal(Math.abs(n), 2)} m ${n >= 0 ? 'noord' : 'zuid'} · Shift: recht · Alt: kopie · Ctrl: zonder hulplijnen`);
        });
      };
      const omhoog = () => {
        if (!sleep) return;
        const s0 = sleep;
        sleep = null;
        voorbeeldRef.current?.(null);
        zetCursor(map, 'sleep', '');
        cancelAnimationFrame(raf);
        map.dragPan.enable();
        tekenGidsen([]);
        if (s0.spook) {
          toonSpook(null); spookAan = false; zetCursor(map, 'spook', '');
          if (s0.bewogen && s0.nieuw) { pasToe(s0.sp.it, s0.nieuw); setTimeout(syncTd, 0); }
          else if (!s0.bewogen) { pasToe(s0.sp.it, metPunt(s0.sp, s0.sp.k, s0.sp.punt)); setTimeout(syncTd, 0); }
          return;
        }
        if (s0.bocht) {
          map._fmBochtSleep = false;
          if (s0.bewogen && s0.nieuw) pasToe(s0.orig[0], s0.nieuw);
          setTimeout(syncTd, 0);
          setMelding('');
          return;
        }
        if (s0.schaalMulti) {
          if (s0.bewogen && s0.nieuw) { s0.orig.forEach((x, i) => pasToe(x, s0.nieuw[i])); setTimeout(syncTd, 0); }
          voorbeeldRef.current?.(null);
          setMelding('');
          return;
        }
        if (s0.maat) {
          if (s0.bewogen && s0.nieuw) { pasToe(s0.orig[0], s0.nieuw); setTimeout(syncTd, 0); }
          setMelding('');
          return;
        }
        if (s0.draai) {
          if (s0.bewogen && s0.hoek) { for (const x of s0.orig) pasToe(x, gedraaid(x, s0.hoek, s0)); setTimeout(syncTd, 0); }
          setMelding('');
          return;
        }
        if (!s0.bewogen && s0.spookKlik) {
          // Klik op het bolletje: punt toevoegen.
          const sp = s0.spookKlik; const it = st.current.items.find((x) => x.id === sp.it.id);
          if (it && it.geometrie === sp.it.geometrie) { toonSpook(null); spookAan = false; pasToe(it, metPunt(sp, sp.k, sp.punt)); setTimeout(syncTd, 0); setMelding('Punt toegevoegd. Sleep het om de lijn af te buigen.'); }
          return;
        }
        if (!s0.bewogen || (!s0.dx && !s0.dy)) return;
        setMelding('');
        if (s0.kopie) {
          // Alt + slepen: originelen blijven staan, kopieën komen op de nieuwe plek.
          const terug = new Map(s0.orig.map((x) => [x.id, x]));
          setItems((l) => { const n = l.map((x) => terug.get(x.id) || x); st.current.items = n; return n; });
          for (const x of s0.orig) { try { tdRef.current?.updateFeatureGeometry(x.id, geo.rondGeom(x.geometrie)); } catch {} }
          const groepen = new Map();
          const nieuweIds = [];
          for (const x of s0.orig) {
            const v = verschoven(x, s0.dx, s0.dy);
            const { id: _, created_at, updated_at, ...rest } = v;
            let gid = null;
            if (x.groep_id) { if (!groepen.has(x.groep_id)) groepen.set(x.groep_id, nieuwId()); gid = groepen.get(x.groep_id); }
            const k = maakItem({ ...rest, id: nieuwId(), groep_id: gid });
            tdRef.current?.addFeatures([tdFeature(k)]);
            nieuweIds.push(k.id);
          }
          setMelding(`${nieuweIds.length} ${nieuweIds.length === 1 ? 'kopie' : 'kopieën'} geplaatst.`);
          setTimeout(() => { const [a, ...r] = nieuweIds; syncTd(); try { tdRef.current?.selectFeature(a); } catch {} setExtra(r); setGeselecteerd(a); }, 30);
          return;
        }
        for (const x of s0.orig) pasToe(x, verschoven(x, s0.dx, s0.dy));
        for (const x of s0.orig) volgMee(x, s0.dx, s0.dy, { groep: false });
        setTimeout(syncTd, 0);
      };
      // Dubbelklik op (de plaats van) een punt van de geselecteerde lijn: niet inzoomen.
      const dubbel = (e) => {
        const si = spookItem();
        if (si && (si.c.some((q) => { const a = px(q); return Math.hypot(a.x - e.point.x, a.y - e.point.y) < 14; }) || spookOp(e))) e.preventDefault();
      };
      // Klik op een lege plek (geen item, geen greep): alles deselecteren, in één keer.
      const klikLeeg = (e) => {
        const s2 = st.current;
        if (s2.gereedschap !== 'selecteer' || s2.doekPenseel || s2.brandPenseel) return;
        if (e.originalEvent.shiftKey || e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
          // Shift/Ctrl/Cmd + klik: item (of zijn groep) bij de selectie of eruit.
          const it = hitOp(map, e.point, s2.items);
          if (!it || vastItem(it)) return;
          const mee = it.groep_id && !s2.iso ? s2.items.filter((x) => x.groep_id === it.groep_id).map((x) => x.id) : [it.id];
          const huidig = selectieRef.current || [];
          const erin = huidig.includes(it.id);
          const nieuw = erin ? huidig.filter((x) => !mee.includes(x)) : [...huidig, ...mee.filter((x) => !huidig.includes(x))];
          const [eerste, ...rest] = nieuw;
          if (s2.geselecteerd && s2.geselecteerd !== eerste) { try { tdRef.current?.deselectFeature(s2.geselecteerd); } catch {} }
          selectieRef.current = nieuw;
          setGeselecteerd(eerste || null); setExtra(rest);
          if (eerste && nieuw.length === 1) { try { tdRef.current?.selectFeature(eerste); } catch {} }
          return;
        }
        if (!s2.geselecteerd && !(selectieRef.current || []).length) return;
        if (hitOp(map, e.point, s2.items)) return;
        const gr = greepRef.current;
        const bij = (p) => { const q = px(p); return Math.hypot(q.x - e.point.x, q.y - e.point.y) < 16; };
        if (gr && ((gr.punt && bij(gr.punt)) || gr.bochten?.some((m) => bij(m.punt)) || gr.einden?.some((m) => bij(m.punt)) || gr.maat?.some((m) => bij(m.punt)) || gr.schaal?.grepen?.some((m) => bij(m.punt)))) return;
        const si = spookItem();
        if (si && si.c.some((q) => bij(q))) return;
        for (const id of [s2.geselecteerd, ...(selectieRef.current || [])]) { if (id) try { tdRef.current?.deselectFeature(id); } catch {} }
        selectieRef.current = [];
        setGeselecteerd(null); setExtra([]);
      };
      map.on('click', klikLeeg);
      map.on('dblclick', dubbel);
      map.on('mousedown', omlaag);
      map.on('mousemove', beweeg);
      map.on('mouseup', omhoog);
      window.addEventListener('mouseup', omhoog);
      return () => {
        map.off('mousedown', omlaag); map.off('mousemove', beweeg); map.off('mouseup', omhoog); map.off('dblclick', dubbel); map.off('click', klikLeeg);
        window.removeEventListener('mouseup', omhoog);
      };
}
