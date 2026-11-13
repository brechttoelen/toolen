// Terra Draw opstarten (enkel wie mag schrijven): modi, stijl, snappen, selectie en wijzigingen.
// Uit Editor.jsx gehaald: de body van een useEffect; Editor roept dit aan met zijn
// state, refs en callbacks. Geeft de opruimfunctie terug.

import {
  TerraDraw, TerraDrawSelectMode, TerraDrawPointMode, TerraDrawLineStringMode, TerraDrawPolygonMode,
  TerraDrawRectangleMode, TerraDrawCircleMode, TerraDrawFreehandMode, TerraDrawModeUndoRedo,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import * as geo from './geo';
import { platen, padMaat, haaks } from './stijl';
import { TD_MODUS, KNOOP_PX } from './gereedschap';
import { bboxVan } from './controle';

// Terra Draw houdt enkel vast wat geselecteerd is (en wat je aan het tekenen bent): met honderden items erin
// schudde elke beweging de hele laag opnieuw. Alles wat een item nodig heeft (selecteren), laadt het op dat
// moment uit de items; wat niet geladen is, hoeft ook niet bijgewerkt te worden.
function slimTd(td, { st, tdFeature, bewerkbaar }) {
  const heeft = (id) => { try { return td.hasFeature(id); } catch { return false; } };
  const laad = (id) => {
    if (!id) return false;
    if (heeft(id)) return true;
    const it = st.current.items.find((x) => x.id === id);
    if (!it || !bewerkbaar(it)) return false;
    const r = td.addFeatures([tdFeature(it)]);
    return !!r?.[0]?.valid;
  };
  const w = {
    echt: td,
    laad,
    hasFeature: heeft,
    selectFeature: (id) => { if (!laad(id)) throw new Error(`Toolen Maps: item ${id} niet te selecteren`); td.selectFeature(id); },
    deselectFeature: (id) => { if (heeft(id)) td.deselectFeature(id); },
    addFeatures: (fs) => td.addFeatures(fs.filter((f) => !heeft(f.id))),
    removeFeatures: (ids) => { const l = ids.filter(heeft); if (l.length) td.removeFeatures(l); },
    updateFeatureGeometry: (id, g) => { if (heeft(id)) td.updateFeatureGeometry(id, g); },
    updateFeatureProperties: (id, p) => { if (heeft(id)) td.updateFeatureProperties(id, p); },
    getSnapshotFeature: (id) => td.getSnapshotFeature(id),
    getSnapshot: () => td.getSnapshot(),
  };
  for (const k of ['setMode', 'getMode', 'updateModeOptions', 'on', 'off', 'start', 'stop', 'undo', 'redo', 'canUndo', 'canRedo', 'clear']) if (typeof td[k] === 'function') w[k] = (...a) => td[k](...a);
  Object.defineProperty(w, 'enabled', { get: () => td.enabled });
  return w;
}

const GREEP_STIL = ['fm-greep-v', 'fm-greep-vt', 'fm-greep-b', 'fm-greep-l', 'fm-greep-p'];

export default function terraDrawStart(ctx) {
  // ctx is een functie: de waarden worden pas gelezen als het effect loopt (zoals de oorspronkelijke closure).
  const { bewerkbaar, grbRef, kaartKlaar, laagVoorElement, laatsteSelectie, maakItem, mapRef, naTekenenRef, puntStijlRef, schrijven, setExtra, setGereedschap, setGeselecteerd, setMelding, setMetingen, shiftRef, snapMiddenRef, st, syncTd, tdFeature, tdRef, volgMee, voorkeurRef, voorbeeldRef, wijzigItem } = ctx();
    const map = mapRef.current;
    if (!kaartKlaar || !map || !schrijven || tdRef.current) return;
    const verborgen = (f) => !!f.properties?.pid;
    const rood = '#E11D48';
    const vlakStijl = {
      fillColor: rood, fillOpacity: (f) => (verborgen(f) ? 0 : 0.15),
      outlineColor: rood, outlineOpacity: (f) => (verborgen(f) ? 0 : 1), outlineWidth: (f) => (verborgen(f) ? 1 : 2),
    };
    const snapping = () => {
      const s = st.current.snap;
      return { toCoordinate: s.punten, toLine: s.lijnen, ...(s.hoek ? { toDegree: { degree: 15 } } : {}), toCustom: snapMidden };
    };
    // Eigen objectsnap: midden van segmenten van items, en hoekpunten en lijnen van
    // DXF-onderleggers en GRB (gebouwen, wegranden).
    // Schermposities per kaartbeeld onthouden: tijdens het slepen van een knooppunt staat de kaart stil, dus
    // hoeft niet elk hoekpunt (van honderden items en de GRB) bij elke muisbeweging opnieuw geprojecteerd te worden.
    const projCache = { sleutel: '', m: new Map() };
    const proj = (c) => {
      // Enkel de publieke kaartfuncties: map.transform bestaat niet meer in MapLibre 6 (tekenen en meten vielen daardoor stil).
      const ce = map.getCenter(); const cv = map.getCanvas(); const k = `${map.getZoom()}|${ce.lng}|${ce.lat}|${map.getBearing()}|${map.getPitch()}|${cv.clientWidth}|${cv.clientHeight}`;
      if (projCache.sleutel !== k) { projCache.sleutel = k; projCache.m = new Map(); }
      let q = projCache.m.get(c); if (!q) { q = map.project(c); projCache.m.set(c, q); }
      return q;
    };
    const bbCache = new WeakMap();
    const bbVan = (g) => { let b = bbCache.get(g); if (b === undefined) { b = bboxVan(g); bbCache.set(g, b); } return b; };
    function snapMidden(ev) {
      const p0 = [ev.containerX, ev.containerY];
      let best = null; let bestD = 12;
      const zien = map.getBounds();
      const kandidaat = (c, vast = true) => {
        const q = vast ? proj(c) : map.project(c);
        const d = Math.hypot(q.x - p0[0], q.y - p0[1]);
        if (d < bestD) { bestD = d; best = c; }
      };
      // Items zitten niet meer allemaal in Terra Draw (enkel de selectie), dus hoekpunten, lijnen en middens
      // van items snappen hier zelf. Enkel items in beeld (omhullende rechthoek), niet verborgen.
      const sn = st.current.snap;
      const lijnenVanItems = [];
      if (sn.midden || sn.punten || sn.lijnen) {
        const verbLagen = new Set((st.current.lagen || []).filter((l) => !l.zichtbaar).map((l) => l.id));
        const fase = st.current.actieveFase;
        const B = zien.toArray(); // [[w, z], [o, n]]
        // Het item waarvan je een knooppunt versleept niet zelf: anders trekt het punt terug naar zijn oude plek.
        const zelf = map._fmTdKnoop ? st.current.geselecteerd : null;
        for (const it of st.current.items) {
          const gg = it.geometrie;
          if (!gg || gg.type === 'Point' || it.verborgen || it.velden?.binnen || it.id === zelf) continue;
          if (it.laag_id && verbLagen.has(it.laag_id)) continue;
          if (fase && it.fase_ids?.length && !it.fase_ids.includes(fase)) continue;
          const bb = bbVan(gg);
          if (!bb || bb[2] < B[0][0] || bb[0] > B[1][0] || bb[3] < B[0][1] || bb[1] > B[1][1]) continue;
          const c = gg.type === 'LineString' ? gg.coordinates : gg.coordinates[0];
          if (sn.punten) for (let i = 0; i < c.length; i++) kandidaat(c[i]);
          if (sn.midden) for (let i = 0; i < c.length - 1; i++) kandidaat([(c[i][0] + c[i + 1][0]) / 2, (c[i][1] + c[i + 1][1]) / 2], false);
          if (sn.lijnen) lijnenVanItems.push(gg.type === 'LineString' ? gg : { type: 'LineString', coordinates: c });
        }
      }
      const extern = [...lijnenVanItems, ...(map._fmSnaplijnen || []), ...(map._fmHulplijnen || []), ...(st.current.snap.grb ? grbRef.current : [])];
      let bestLijn = null; let bestLijnD = 8;
      for (const lg of extern) {
        const c = lg.coordinates;
        for (let i = 0; i < c.length; i++) {
          if (!zien.contains(c[i]) && (i === c.length - 1 || !zien.contains(c[i + 1]))) continue;
          kandidaat(c[i]);
          if (i < c.length - 1) {
            const a = proj(c[i]); const b = proj(c[i + 1]);
            const dx = b.x - a.x; const dy = b.y - a.y; const l2 = dx * dx + dy * dy;
            if (!l2) continue;
            const t = Math.max(0, Math.min(1, ((p0[0] - a.x) * dx + (p0[1] - a.y) * dy) / l2));
            const px = a.x + t * dx; const py = a.y + t * dy;
            const d = Math.hypot(px - p0[0], py - p0[1]);
            if (d < bestLijnD) { bestLijnD = d; bestLijn = map.unproject([px, py]); }
          }
        }
      }
      if (best) return best;
      return bestLijn ? [bestLijn.lng, bestLijn.lat] : undefined;
    }
    const vlakFlags = { feature: { draggable: false, rotateable: true, scaleable: true, coordinates: { draggable: true, midpoints: false, deletable: true, snappable: true } } };
    const td = new TerraDraw({
      // Pas vanaf 4 px beweging telt een klik als slepen (anders gaat een klik met wat trillen verloren).
      adapter: new TerraDrawMapLibreGLAdapter({ map, minPixelDragDistanceSelecting: 4 }),
      // Tijdens het tekenen: laatste punt ongedaan maken (knop, Backspace of Ctrl Z).
      undoRedo: { modeLevel: new TerraDrawModeUndoRedo() },
      modes: [
        new TerraDrawSelectMode({
          // Selecteren en deselecteren doet de editor zelf (één regel voor oplichten, klikken en slepen);
          // Terra Draw toont enkel de knooppunten van wat geselecteerd is.
          allowManualSelection: false,
          allowManualDeselection: false,
          pointerDistance: KNOOP_PX,
          flags: {
            polygon: vlakFlags,
            linestring: vlakFlags,
            point: { feature: { draggable: false } },
            element: { feature: { draggable: false, rotateable: true } },
            cirkel: { feature: { draggable: false } },
          },
          keyEvents: { deselect: 'Escape', delete: null, rotate: null, scale: null },
          styles: {
            selectedPolygonColor: (f) => f.properties.kleur || rood, selectedPolygonFillOpacity: 0,
            selectedPolygonOutlineColor: '#1d1d1b', selectedPolygonOutlineWidth: (f) => (f.properties.gebogen ? 0 : 2),
            selectedLineStringColor: '#1d1d1b', selectedLineStringWidth: 2, selectedLineStringOpacity: (f) => (f.properties.gebogen ? 0 : 0.6),
            selectedPointColor: '#ffffff', selectedPointOpacity: 0, selectedPointWidth: 15, selectedPointOutlineColor: '#1d1d1b', selectedPointOutlineOpacity: 1, selectedPointOutlineWidth: 2,
            selectionPointColor: '#ffffff', selectionPointOutlineColor: '#1d1d1b', selectionPointWidth: 5, selectionPointOutlineWidth: 2,
            midPointColor: '#ffffff', midPointOutlineColor: '#1d1d1b', midPointWidth: 3,
          },
        }),
        new TerraDrawPointMode({ styles: { pointColor: rood, pointWidth: 7, pointOpacity: (f) => (verborgen(f) ? 0 : 1), pointOutlineWidth: (f) => (verborgen(f) ? 0 : 2), pointOutlineColor: '#ffffff', pointOutlineOpacity: (f) => (verborgen(f) ? 0 : 1) } }),
        new TerraDrawLineStringMode({ pointerDistance: 12, snapping: snapping(), keyEvents: { cancel: null, finish: 'Enter' }, styles: { lineStringColor: rood, lineStringWidth: 3, lineStringOpacity: (f) => (verborgen(f) ? 0 : 1) } }),
        new TerraDrawPolygonMode({ pointerDistance: 14, snapping: snapping(), keyEvents: { cancel: null, finish: 'Enter' }, styles: vlakStijl }),
        new TerraDrawPolygonMode({ modeName: 'element', styles: vlakStijl }),
        new TerraDrawPolygonMode({ modeName: 'cirkel', styles: vlakStijl }),
        new TerraDrawRectangleMode({ styles: vlakStijl }),
        new TerraDrawCircleMode({ styles: vlakStijl }),
        new TerraDrawFreehandMode({ styles: vlakStijl }),
      ],
    });
    td.start();
    tdRef.current = slimTd(td, { st, tdFeature, bewerkbaar });
    if (typeof window !== 'undefined') window.__fmTd = td; // voor tests
    snapMiddenRef.current = snapMidden;

    td.on('finish', (id, ctx) => {
      setTimeout(() => naAfwerken(id, ctx), 0);
    });
    td.on('select', (id) => {
      const nid = String(id);
      const vorige = laatsteSelectie.current;
      if (shiftRef.current && vorige && vorige !== nid && st.current.items.some((x) => x.id === vorige)) {
        setExtra((x) => (x.includes(vorige) ? x : [...x.filter((y) => y !== nid), vorige]));
      } else if (!shiftRef.current) {
        // Een groep selecteert als geheel.
        const it = st.current.items.find((x) => x.id === nid);
        setExtra(it?.groep_id && !st.current.iso ? st.current.items.filter((x) => x.groep_id === it.groep_id && x.id !== nid).map((x) => x.id) : []);
      }
      laatsteSelectie.current = nid;
      setGeselecteerd(nid);
    });
    // Vlag op de kaart (overleeft een herstart van Terra Draw): er staat een knooppunt-voorbeeld.
    const sleepVoorbeeldRef = { get v() { return !!mapRef.current?._fmTdVb; }, set v(x) { if (mapRef.current) mapRef.current._fmTdVb = x; } };
    td.on('change', (ids, type) => {
      if (type !== 'update' && type !== 'create') return;
      const f = td.getSnapshotFeature(ids[0]);
      // Een punt van een bestaand item verslepen: het item zelf (met zijn stijl, bochten, afronding) meteen
      // meetekenen, niet enkel de dunne bewerklijn. Bij het loslaten neemt naAfwerken het over.
      if (type === 'update' && f?.properties?.pid && voorbeeldRef?.current && mapRef.current?._fmTdKnoop) {
        const it = st.current.items.find((x) => x.id === f.properties.pid);
        if (it && JSON.stringify(it.geometrie?.coordinates) !== JSON.stringify(f.geometry.coordinates)) {
          voorbeeldRef.current([{ ...it, geometrie: f.geometry }]);
          sleepVoorbeeldRef.v = true;
        }
        return;
      }
      if (!f || f.properties?.pid || !f.properties?.currentlyDrawing) return;
      const g2 = f.geometry;
      const elL = st.current.gereedschap === 'element' && st.current.gekozenElement?.tekenwijze === 'lijn' ? st.current.gekozenElement : null;
      if (g2.type === 'LineString' && g2.coordinates.length >= 2 && elL && Number(elL.eenheid_m) > 0) {
        const L = geo.lengte(g2); const e = Number(elL.eenheid_m);
        const n = Math.round(L / e); const rest = L - n * e;
        const vol = elL.eigenschappen?.lengte_snap === 'vol';
        setMelding(`${geo.getal(L)} m · ${Math.max(1, n)} stuks${Math.abs(rest) < Math.min(0.5, e * 0.15) ? ' ✓ past' : ` · ${rest > 0 ? '+' : ''}${geo.getal(rest)} m`}${vol ? ' · enkel volledige stuks' : ''}`);
      } else if (g2.type === 'LineString' && g2.coordinates.length >= 2 && st.current.gereedschap === 'element' && st.current.gekozenElement?.eigenschappen?.module) {
        const el = st.current.gekozenElement; const leg = st.current.plaatLeg === 'vak' ? 'dwars' : st.current.plaatLeg;
        const nep = { soort: 'element', geometrie: g2, parameters: { leg, rijen: 1 } };
        const pm = padMaat(nep, el);
        setMelding(`${geo.getal(geo.lengte(g2))} m · ${platen(nep, el).stuks} platen · pad ${geo.getal(pm.W)} m breed`);
      } else if (g2.type === 'LineString' && g2.coordinates.length >= 2) setMelding(`Lengte ${geo.getal(geo.lengte(g2))} m`);
      else if (g2.type === 'Polygon' && g2.coordinates[0].length >= 4) setMelding(`Oppervlakte ${geo.getal(geo.oppervlakte(g2), 0)} m² · omtrek ${geo.getal(geo.lengte(g2))} m`);
    });
    // Loslaten: het knooppunt-slepen is voorbij (naAfwerken ruimt het voorbeeld op; dit is het vangnet).
    { const m0 = mapRef.current; if (m0) m0._fmVoorbeeldWeg = () => voorbeeldRef?.current?.(null);
      // Terra Draw meldt geen wijzigingen tijdens het slepen van een knooppunt: zelf per beeld zijn lijn uitlezen.
      if (m0) m0._fmTdVolg = () => {
        if (!m0._fmTdKnoop || m0._fmTdRaf) return;
        m0._fmTdRaf = requestAnimationFrame(() => {
          m0._fmTdRaf = 0; const id = st.current.geselecteerd; if (!id || !m0._fmTdKnoop) return;
          let f = null; try { f = td.getSnapshotFeature(id) || null; if (!f || f.properties?.pid !== id) f = td.getSnapshot().find((x) => x.properties?.pid === id) || null; } catch {}
          const it = st.current.items.find((x) => x.id === id); if (!f || !it || !f.geometry) return;
          if (JSON.stringify(it.geometrie?.coordinates) === JSON.stringify(f.geometry.coordinates)) return;
          voorbeeldRef?.current?.([{ ...it, geometrie: f.geometry }]); m0._fmTdVb = true;
          // De '+' en de bochtbolletjes horen bij de oude vorm: tijdens het slepen even weg.
          if (!m0._fmGreepWeg) { m0._fmGreepWeg = true; for (const l of GREEP_STIL) if (m0.getLayer(l)) m0.setLayoutProperty(l, 'visibility', 'none'); }
        });
      };
      if (m0 && !m0._fmTdPid) { m0._fmTdPid = true; m0.getCanvas().addEventListener('pointerdown', (e) => { m0._fmPid = e.pointerId; }, true); }
      if (m0 && !m0._fmTdBeweeg) { m0._fmTdBeweeg = true; m0.on('mousemove', (e) => { if (e.originalEvent?.buttons) m0._fmTdVolg?.(); }); m0.on('touchmove', () => m0._fmTdVolg?.()); }
      // Losgelaten boven iets anders dan de kaart (paneel, knop, kaartje): Terra Draw krijgt dan geen 'loslaten' en het
      // knooppunt bleef aan de muis hangen. Het loslaten dan zelf aan de kaart doorgeven.
      if (m0 && !m0._fmTdUpBuiten) { m0._fmTdUpBuiten = true; window.addEventListener('pointerup', (e) => {
        const cc = m0.getCanvasContainer(); if (!m0._fmTdKnoop || !cc || cc.contains(e.target)) return;
        try { m0.getCanvas().dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, button: e.button, buttons: 0 })); } catch {}
      }, true); }
      if (m0 && !m0._fmTdUp) { m0._fmTdUp = true; const op = () => { m0._fmTdKnoop = false; if (m0._fmGreepWeg) setTimeout(() => { m0._fmGreepWeg = false; for (const l of GREEP_STIL) if (m0.getLayer(l)) m0.setLayoutProperty(l, 'visibility', 'visible'); }, 150); setTimeout(() => { if (m0._fmTdVb) { m0._fmTdVb = false; m0._fmVoorbeeldWeg?.(); } }, 120); }; window.addEventListener('mouseup', op); window.addEventListener('touchend', op); } }
    td.on('deselect', () => { if (sleepVoorbeeldRef.v) { sleepVoorbeeldRef.v = false; voorbeeldRef?.current?.(null); } if (st.current.doekPenseel || st.current.brandPenseel || st.current.stilDeselect) return; setGeselecteerd(null); if (!shiftRef.current) setExtra([]); });

    syncTd();
    td.setMode(TD_MODUS[st.current.gereedschap] || 'static');

    function naAfwerken(id, ctx) {
      const f = td.getSnapshotFeature(id);
      if (!f) return;
      const { gereedschap: g, gekozenElement: el } = st.current;
      // Bewerking van een bestaand item (slepen, draaien, knooppunten).
      if (f.properties?.pid) {
        if (sleepVoorbeeldRef.v) { sleepVoorbeeldRef.v = false; setTimeout(() => voorbeeldRef?.current?.(null), 60); }
        const it = st.current.items.find((x) => x.id === f.properties.pid);
        if (!it) return;
        const patch = { geometrie: f.geometry };
        const elx = it.element_id ? st.current.elementen.find((e) => e.id === it.element_id) : null;
        if (elx?.eigenschappen?.module && elx.eigenschappen.strak && f.geometry.type === 'LineString' && f.geometry.coordinates.length > 2) {
          const h = haaks(f.geometry); patch.geometrie = h;
          setTimeout(() => { try { td.updateFeatureGeometry(it.id, geo.rondGeom(h)); } catch {} }, 0);
        }
        // Een punt van een bestaande lijn verslepen: niet terug laten springen naar een heel aantal stukken
        // (dat voelde plakkerig bij kleine aanpassingen); enkel bij "enkel volledige stuks".
        if (elx?.tekenwijze === 'lijn' && f.geometry.type === 'LineString' && Number(elx.eenheid_m) > 0 && elx.eigenschappen?.lengte_snap === 'vol') {
          const sn = geo.snapLijnLengte(f.geometry, Number(elx.eenheid_m), 'vol');
          if (sn.gesnapt && sn.geometrie !== f.geometry) { patch.geometrie = sn.geometrie; setTimeout(() => { try { td.updateFeatureGeometry(it.id, geo.rondGeom(sn.geometrie)); } catch {} }, 0); }
        } else if (elx?.tekenwijze === 'lijn' && f.geometry.type === 'LineString' && Number(elx.eenheid_m) > 0) {
          const L = geo.lengte(f.geometry); const e = Number(elx.eenheid_m); const n = Math.ceil(L / e - 1e-6);
          setTimeout(() => setMelding(`${elx.naam}: ${geo.getal(L)} m · ${n} stuks${Math.abs(L - Math.round(L / e) * e) < 0.05 ? ' ✓' : ''}`), 30);
        }
        const oud = geo.middelpunt(it.geometrie);
        const nu = geo.middelpunt(f.geometry);
        const dx = nu[0] - oud[0]; const dy = nu[1] - oud[1];
        const e0 = geo.eersteCoord(it.geometrie); const e1 = geo.eersteCoord(f.geometry);
        const verschoven = Math.abs((e1[0] - e0[0]) - dx) < 1e-9 && Math.abs((e1[1] - e0[1]) - dy) < 1e-9 && (Math.abs(dx) > 1e-12 || Math.abs(dy) > 1e-12);
        if (['veelhoek', 'ellips', 'sector'].includes(it.soort) || (it.soort === 'rechthoek' && Number(it.parameters?.afronding) > 0)) {
          const m0 = it.parameters?.midden || oud;
          patch.parameters = { ...it.parameters, midden: [m0[0] + dx, m0[1] + dy] };
        } else if (it.soort === 'element' || it.soort === 'rechthoek') {
          const lees = geo.leesElement(f.geometry);
          if (lees) patch.parameters = { ...it.parameters, midden: lees.midden, rot: geo.rond(lees.rot, 1) };
        } else if (it.soort === 'cirkel') {
          patch.parameters = { ...it.parameters, midden: geo.middelpunt(f.geometry) };
        } else if (f.geometry.type === 'Point') {
          patch.parameters = { ...it.parameters, midden: f.geometry.coordinates };
        }
        wijzigItem(it.id, patch);
        if (verschoven) volgMee(it, dx, dy);
        return;
      }
      // Meten: blijft als hulplaag op de kaart staan (wordt niet bewaard).
      if (g === 'meten' || g === 'meten-vlak') {
        const gm = f.geometry;
        setMetingen((m) => [...m, { id: String(id), geometrie: gm }]);
        setMelding(gm.type === 'Polygon'
          ? `Oppervlakte ${geo.getal(geo.oppervlakte(gm), 0)} m² · omtrek ${geo.getal(geo.lengte(gm))} m`
          : `Afstand ${geo.getal(geo.lengte(gm))} m`);
        td.removeFeatures([id]);
        return;
      }
      const mode = f.properties.mode;
      const nid = String(id);
      let nieuw = null;
      if (mode === 'point') {
        nieuw = g === 'tekst'
          ? { soort: 'tekst', naam: 'Tekst', geometrie: f.geometry }
          : { soort: 'punt', geometrie: f.geometry, parameters: { midden: f.geometry.coordinates }, ...(puntStijlRef.current?.icoon || puntStijlRef.current?.kleur ? { stijl: { ...(puntStijlRef.current.icoon ? { icoon: puntStijlRef.current.icoon } : {}), ...(puntStijlRef.current.kleur ? { kleur: puntStijlRef.current.kleur } : {}) } } : {}) };
      } else if (mode === 'linestring' && g === 'notitie') {
        const c = f.geometry.coordinates;
        nieuw = { soort: 'notitie', naam: 'Notitie', geometrie: { type: 'LineString', coordinates: [c[0], c[c.length - 1]] }, stijl: { kleur: '#1d1d1b' } };
      } else if (mode === 'linestring' && g === 'maatlijn') {
        nieuw = { soort: 'lijn', naam: null, geometrie: f.geometry, stijl: { maatlijn: true, kleur: '#1d1d1b', dikte: 1, label: false } };
      } else if (mode === 'linestring') {
        if (g === 'element' && el?.eigenschappen?.module) {
          const leg = st.current.plaatLeg === 'vak' ? 'dwars' : st.current.plaatLeg;
          nieuw = { soort: 'element', element_id: el.id, laag_id: laagVoorElement(el), geometrie: el.eigenschappen?.strak ? haaks(f.geometry) : f.geometry, parameters: { leg, rijen: 1, ...(leg === 'sporen' ? { tussen: 1.2 } : {}) } };
        } else if (g === 'element' && el?.tekenwijze === 'lijn') {
          const sn = geo.snapLijnLengte(f.geometry, Number(el.eenheid_m), el.eigenschappen?.lengte_snap || 'zacht');
          nieuw = { soort: 'element', element_id: el.id, laag_id: laagVoorElement(el), geometrie: sn.geometrie };
          if (sn.gesnapt) setTimeout(() => setMelding(`${el.naam}: ${sn.stuks} volledige stuks · ${geo.getal(geo.lengte(sn.geometrie))} m`), 30);
        }
        else nieuw = { soort: 'lijn', geometrie: f.geometry };
      } else if (mode === 'rectangle') {
        const ring = f.geometry.coordinates[0];
        const b = geo.rond(geo.lengte({ type: 'LineString', coordinates: [ring[0], ring[1]] }), 2);
        const d = geo.rond(geo.lengte({ type: 'LineString', coordinates: [ring[1], ring[2]] }), 2);
        const midden = geo.middelpunt(f.geometry);
        nieuw = { soort: 'rechthoek', parameters: { midden, breedte: b, diepte: d, rot: 0 }, geometrie: geo.elementVeelhoek(midden, b, d, 0) };
      } else if (mode === 'circle') {
        const midden = geo.middelpunt(f.geometry);
        const straal = geo.rond(geo.lengte({ type: 'LineString', coordinates: [midden, f.geometry.coordinates[0][0]] }), 2);
        nieuw = { soort: 'cirkel', parameters: { midden, straal }, geometrie: geo.cirkel(midden, straal) };
      } else {
        nieuw = { soort: 'vlak', geometrie: f.geometry };
      }
      td.removeFeatures([id]);
      const it = maakItem({ id: nid, ...nieuw });
      td.addFeatures([tdFeature(it)]);
      if (g === 'tekst') { td.setMode('select'); setGereedschap('selecteer'); try { td.selectFeature(nid); } catch {} }
      else naTekenenRef.current?.([nid]);
    }
}
