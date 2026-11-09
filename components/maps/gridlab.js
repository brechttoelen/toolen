'use client';

// Koppeling met GridLab (schema gridlab in dezelfde database): sponsor-backdrops als doek in Toolen Maps.
// - Lezen gebeurt met de eigen login: wie in GridLab de ontwerpen mag zien, ziet ze hier ook (RLS van GridLab).
// - Tekenen gebeurt met de exportcode van GridLab zelf (map gridlab/), dus het doek is gelijk aan de JPEG uit GridLab.
// - Het beeld wordt in de Toolen Maps-bucket bewaard (zo werkt het ook in de deellink en de PDF) en
//   vernieuwd zodra het ontwerp in GridLab gewijzigd is (vernieuwGridlabDoeken).
import { sb, maps, BUCKET } from './db';
import { renderJpegBlob } from './gridlab/exportJpeg';
import { setLogoVersions, LOGO_BUCKET } from './gridlab/logoUrl';
import { withRecalcMargins } from './gridlab/formatGeometry';

const gl = () => sb().schema('gridlab');
const LIJST = 'id, name, event, season, edition, version, approval_locked, updated_at, format_code, folder, canvases';

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
  const { data, error } = await gl().from('designs').select(LIJST).order('updated_at', { ascending: false });
  if (error) { if (/permission|not allowed|PGRST106|schema/i.test(`${error.message} ${error.code}`)) return null; throw error; }
  return data || [];
}

let _logos = null;
async function laadLogoInfo() {
  // Cache-busters per logo (zoals GridLab: bijgewerkt logo = nieuwe URL) en eventuele logo-overrides.
  if (_logos && Date.now() - _logos.op < 60000) return _logos;
  const [lijst, ovr] = await Promise.all([
    sb().storage.from(LOGO_BUCKET).list('', { limit: 2000 }),
    gl().from('logo_overrides').select('sponsor_name, logo_data_url'),
  ]);
  const versies = {};
  for (const f of lijst.data || []) {
    const raw = (f.name || '').replace(/\.(png|svg)$/i, ''); if (!raw) continue;
    const key = raw.replace(/ /g, '_'); const t = f.updated_at || f.created_at || f.metadata?.lastModified; const token = t ? new Date(t).getTime() : null;
    if (token && !(key in versies)) versies[key] = token;
  }
  setLogoVersions(versies);
  _logos = { op: Date.now(), custom: Object.fromEntries((ovr.data || []).map((r) => [r.sponsor_name, r.logo_data_url])) };
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
export async function gridlabAlsDoek({ ontwerp, canvasId, planId, alle = false, drager = 'hek', naam = null }) {
  const r = await tekenGridlab(ontwerp, canvasId);
  const beeld = pad(alle ? 'flcs' : planId);
  const up = await sb().storage.from(BUCKET).upload(beeld, r.blob, { contentType: 'image/jpeg' }); if (up.error) throw up.error;
  const meer = (ontwerp.canvases || []).length > 1 ? ` · ${r.canvas.label || 'canvas'}` : '';
  const rij = { naam: naam || `${ontwerp.name}${meer}`, categorie: 'Doeken en drukwerk', tekenwijze: 'doek', stijl: {}, actief: true, plan_id: alle ? null : planId,
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
  if (!gekoppeld.length || _bezig) return [];
  _bezig = true;
  try {
    const ids = [...new Set(gekoppeld.map((d) => d.eigenschappen.gridlab.id))];
    const { data, error } = await gl().from('designs').select(LIJST).in('id', ids);
    if (error || !data) return [];
    const perId = new Map(data.map((o) => [o.id, o])); const uit = [];
    for (const d of gekoppeld) {
      const g = d.eigenschappen.gridlab; const o = perId.get(g.id); if (!o) continue;
      if (o.updated_at === g.bijgewerkt && (o.version ?? null) === (g.versie ?? null) && statusVan(o) === g.status) continue;
      try {
        const r = await tekenGridlab(o, g.canvas);
        const beeld = pad(d.plan_id || 'flcs');
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
