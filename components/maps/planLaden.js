'use client';

// Een plan laden zonder de editor (voor het exporttabblad): dezelfde gegevens als de editor gebruikt.
import { maps } from './db';
import { metTekeningen } from './tekeningen';
import { laadVasteAansluitingen } from './vasteAansluitingen';

export async function laadPlanData(planId) {
  const [p, l, f, i, b] = await Promise.all([
    maps().from('plannen').select('*').eq('id', planId).maybeSingle(),
    maps().from('lagen').select('*').eq('plan_id', planId).order('volgorde'),
    maps().from('fasen').select('*').eq('plan_id', planId).order('volgorde'),
    maps().from('items').select('*').eq('plan_id', planId).order('volgorde'),
    maps().from('bibliotheek').select('*').eq('actief', true).or(`plan_id.is.null,plan_id.eq.${planId}`).order('categorie').order('naam'),
  ]);
  const fout = [p, l, f, i, b].find((r) => r.error);
  if (fout) throw fout.error;
  if (!p.data) throw new Error('Dit plan bestaat niet (meer).');
  let els = b.data || [];
  // Elementen die niet meer aangeboden worden maar nog op het plan staan.
  const ids = new Set(els.map((e) => e.id));
  const mist = [...new Set((i.data || []).map((it) => it.element_id).filter((id) => id && !ids.has(id)))];
  if (mist.length) { const r = await maps().from('bibliotheek').select('*').in('id', mist); if (!r.error && r.data) els = [...els, ...r.data]; }
  els = metTekeningen(els).filter((x) => x.tekenwijze !== 'stijl');
  let vast = []; try { vast = await laadVasteAansluitingen(); } catch {}
  return { plan: p.data, lagen: l.data || [], fasen: f.data || [], items: i.data || [], elementenMap: new Map(els.map((e) => [e.id, e])), vast };
}

// Export in een nieuw tabblad starten: de opdracht gaat via localStorage mee (sleutel in de url).
// Het tabblad meldt zijn voortgang via een BroadcastChannel; de editor toont die (ExportVoortgang).
export const EXPORT_KANAAL = 'toolen-export';
export const exportVensters = new Map(); // sleutel → venster (om er naartoe te springen)
export function startExport(planId, opdracht, naam = '') {
  const k = Math.random().toString(36).slice(2, 10);
  try { localStorage.setItem(`fm-export-${k}`, JSON.stringify({ ...opdracht, naam, op: Date.now() })); } catch { return false; }
  const w = window.open(`/maps/${planId}/export?k=${k}`, '_blank');
  if (!w) return false;
  exportVensters.set(k, w);
  try { const c = new BroadcastChannel(EXPORT_KANAAL); c.postMessage({ k, naam: naam || 'PDF', pct: 0, tekst: 'Starten…' }); c.close(); } catch {}
  return true;
}
