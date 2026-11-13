'use client';

// Koppeling met GridLab (in het Publitool-project van FLCS): sponsor-backdrops als doek in Toolen Maps.
// - Lezen gebeurt via de server van Toolen (/api/koppeling/gridlab), voor organisaties met de koppeling gridlab.
// - Tekenen gebeurt met de exportcode van GridLab zelf (map gridlab/), dus het doek is gelijk aan de JPEG uit GridLab.
// - Het beeld wordt in de Toolen Maps-bucket bewaard (zo werkt het ook in de deellink en de PDF) en
//   vernieuwd zodra het ontwerp in GridLab gewijzigd is (vernieuwGridlabDoeken).
import { sb, maps, BUCKET } from './db';
import { heeftKoppeling, getOrganisatie } from './merk';
import { renderJpegBlob } from './gridlab/exportJpeg';
import { setLogoVersions } from './gridlab/logoUrl';
import { withRecalcMargins } from './gridlab/formatGeometry';

// Eén vraag aan de server geeft ontwerpen, logo-overrides en logoversies (kort bewaard).
let _bron = null;
async function haal(ids = null) {
  if (!ids && _bron && Date.now() - _bron.op < 60000) return _bron.d;
  const r = await fetch('/api/koppeling/gridlab', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org: getOrganisatie()?.slug, ids }) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 403 || r.status === 401) return null;
  if (!r.ok) throw new Error(d.fout || 'GridLab is niet bereikbaar.');
  if (!ids) _bron = { op: Date.now(), d };
  return d;
}

// Zoals GridLab een ontwerp laadt (useDesignState.recalcOnLoad): marges herrekenen, behalve bij een portiek.
function opLaden(fmt) {
  if (!fmt) return fmt;
  if (fmt.type === 'portiek') return fmt;
  if (fmt.AbsMarginTop_mm == null && fmt.AbsMarginLeft_mm == null) return fmt;
  return withRecalcMargins(fmt);
}

export const statusVan = (d) => (d?.approval_locked ? 'Goedgekeurd' : 'In bewerking');
const cm = (mm) => Math.round((Number(mm) || 0) / 10);
export const afmetingVan = (fmt) => (fmt?.CanvasWidth_mm && fmt?.CanvasHeight_mm ? `${cm(fmt.CanvasWidth_mm)} × ${cm(fmt.CanvasHeight_mm)} cm` : '');

// Ontwerpen die deze gebruiker in GridLab mag zien. null = geen toegang tot GridLab.
export async function gridlabOntwerpen() {
  const d = await haal();
  return d ? d.ontwerpen || [] : null;
}

let _logos = null;
async function laadLogoInfo() {
  // Cache-busters per logo (zoals GridLab: bijgewerkt logo = nieuwe URL) en eventuele logo-overrides.
  if (_logos && Date.now() - _logos.op < 60000) return _logos;
  const d = (await haal()) || {};
  const versies = {};
  for (const f of d.logos || []) {
    const raw = (f.name || '').replace(/\.(png|svg)$/i, ''); if (!raw) continue;
    const key = raw.replace(/ /g, '_'); const t = f.t; const token = t ? new Date(t).getTime() : null;
    if (token && !(key in versies)) versies[key] = token;
  }
  setLogoVersions(versies);
  _logos = { op: Date.now(), custom: Object.fromEntries((d.overrides || []).map((r) => [r.sponsor_name, r.logo_data_url])) };
  return _logos;
}

// Eén canvas van een ontwerp tekenen: { blob, kleur, afmeting, canvas }.
export async function tekenGridlab(ontwerp, canvasId = null) {
  const cs = Array.isArray(ontwerp?.canvases) && ontwerp.canvases.length ? ontwerp.canvases : [];
  const c = cs.find((x) => x.id === canvasId) || cs[0];
  if (!c?.format) throw new Error('Dit GridLab-ontwerp heeft geen canvas om te tekenen.');
  const { custom } = await laadLogoInfo();
  const fmt = opLaden({ ...c.format });
  const blob = await renderJpegBlob(fmt, c.slots || [], custom, c.header || null, c.divider || null);
  if (!blob) throw new Error('Tekenen mislukt.');
  return { blob, kleur: fmt.BackgroundColor_Hex || '#000000', afmeting: afmetingVan(fmt), canvas: c };
}

const pad = (map) => `ontwerpen/${map}/gridlab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
const gridlabInfo = (o, c) => ({ id: o.id, canvas: c.id, versie: o.version ?? null, bijgewerkt: o.updated_at, status: statusVan(o), naam: o.name, event: o.event || null, canvasNaam: c.label || null });

// Als doek in de bibliotheek zetten (dit event of alle events), met de koppeling naar GridLab.
export async function gridlabAlsDoek({ ontwerp, canvasId, planId = null, alle = false, drager = 'hek', naam = null, eventId = null }) {
  const r = await tekenGridlab(ontwerp, canvasId);
  const beeld = pad(getOrganisatie()?.slug || 'organisatie');
  const up = await sb().storage.from(BUCKET).upload(beeld, r.blob, { contentType: 'image/jpeg' }); if (up.error) throw up.error;
  const meer = (ontwerp.canvases || []).length > 1 ? ` · ${r.canvas.label || 'canvas'}` : '';
  // Bereik: een event (eventId), anders de organisatie. Oude aanroepen met planId zonder alle: bij het plan.
  const rij = { naam: naam || `${ontwerp.name}${meer}`, categorie: drager === 'vlag' ? 'Vlaggen' : 'Doeken en drukwerk', tekenwijze: 'doek', stijl: {}, actief: true,
    plan_id: eventId || alle ? null : planId, event_id: eventId || null,
    eigenschappen: { kleur: r.kleur, afmeting: r.afmeting, beeld, gridlab: gridlabInfo(ontwerp, r.canvas), ...(drager !== 'hek' ? { drager } : {}) } };
  const { data, error } = await maps().from('bibliotheek').insert(rij).select().single(); if (error) throw error;
  window.dispatchEvent(new CustomEvent('fm-ontwerp-nieuw', { detail: data }));
  return data;
}

// Doeken uit GridLab bijwerken als het ontwerp sinds de vorige keer gewijzigd is. Geeft de bijgewerkte rijen terug.
// Enkel doeken die deze gebruiker mag wijzigen (de rest wordt overgeslagen, zonder melding).
let _bezig = false;
export async function vernieuwGridlabDoeken(doeken = []) {
  const gekoppeld = doeken.filter((d) => d?.eigenschappen?.gridlab?.id);
  if (!gekoppeld.length || _bezig || !heeftKoppeling('gridlab')) return [];
  _bezig = true;
  try {
    const ids = [...new Set(gekoppeld.map((d) => d.eigenschappen.gridlab.id))];
    const d0 = await haal(ids).catch(() => null);
    const data = d0?.ontwerpen;
    if (!data) return [];
    const perId = new Map(data.map((o) => [o.id, o])); const uit = [];
    for (const d of gekoppeld) {
      const g = d.eigenschappen.gridlab; const o = perId.get(g.id); if (!o) continue;
      if (o.updated_at === g.bijgewerkt && (o.version ?? null) === (g.versie ?? null) && statusVan(o) === g.status) continue;
      try {
        const r = await tekenGridlab(o, g.canvas);
        const beeld = pad(d.plan_id || getOrganisatie()?.slug || 'organisatie');
        const up = await sb().storage.from(BUCKET).upload(beeld, r.blob, { contentType: 'image/jpeg' }); if (up.error) continue;
        const eig = { ...d.eigenschappen, kleur: r.kleur, afmeting: r.afmeting || d.eigenschappen.afmeting, beeld, gridlab: gridlabInfo(o, r.canvas) };
        const { data: rij, error: e2 } = await maps().from('bibliotheek').update({ eigenschappen: eig }).eq('id', d.id).select().single();
        if (e2 || !rij) { await sb().storage.from(BUCKET).remove([beeld]); continue; }
        if (d.eigenschappen.beeld && d.eigenschappen.beeld !== beeld) sb().storage.from(BUCKET).remove([d.eigenschappen.beeld]).catch(() => {});
        uit.push(rij);
      } catch { /* ontwerp kan niet getekend worden: het oude beeld blijft */ }
    }
    return uit;
  } finally { _bezig = false; }
}

// Alle ontwerpen (elk canvas) in één keer als doek in de organisatiebibliotheek. Wat er al staat, wordt overgeslagen.
export async function gridlabAllesOvernemen(onStap = () => {}) {
  const lijst = (await gridlabOntwerpen()) || [];
  const { data: al } = await maps().from('bibliotheek').select('eigenschappen').is('plan_id', null).not('eigenschappen->gridlab', 'is', null);
  const heeft = new Set((al || []).map((r) => `${r.eigenschappen?.gridlab?.id}|${r.eigenschappen?.gridlab?.canvas}`));
  const taken = lijst.flatMap((o) => (o.canvases || []).filter((c) => c?.format).map((c) => ({ o, c }))).filter(({ o, c }) => !heeft.has(`${o.id}|${c.id}`));
  let klaar = 0; const fouten = [];
  for (const { o, c } of taken) {
    onStap(klaar, taken.length, o.name);
    try { await gridlabAlsDoek({ ontwerp: o, canvasId: c.id, planId: null, alle: true }); } catch (e) { fouten.push(`${o.name}: ${e?.message || e}`); }
    klaar++;
  }
  onStap(klaar, taken.length, '');
  return { nieuw: taken.length - fouten.length, overgeslagen: heeft.size, fouten };
}
