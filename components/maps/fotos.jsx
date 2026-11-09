'use client';

// Foto's bij een item (zaal, gebouw…): in de browser verkleind en gecomprimeerd (WebP, max.
// 1600 px, plus een miniatuur van 360 px), bewaard in de bucket en in de tabel bestanden
// (soort 'foto', item_id), zodat ze ook in de eigenschappen op de kaart verschijnen.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { sb, maps, BUCKET, publiekeUrl, foutTekst } from './db';
import { bevestig } from './dialoog';

const GROOT = 1600; const KLEIN = 360;

async function naarBlob(bron, max, kwaliteit) {
  const s = Math.min(1, max / Math.max(bron.width, bron.height));
  const w = Math.max(1, Math.round(bron.width * s)); const h = Math.max(1, Math.round(bron.height * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bron, 0, 0, w, h);
  const blob = (await new Promise((r) => c.toBlob(r, 'image/webp', kwaliteit))) || (await new Promise((r) => c.toBlob(r, 'image/jpeg', kwaliteit)));
  return { blob, w, h };
}

export async function comprimeer(bestand) {
  let beeld;
  try { beeld = await createImageBitmap(bestand, { imageOrientation: 'from-image' }); } catch {
    beeld = await new Promise((ok, nok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nok; i.src = URL.createObjectURL(bestand); });
  }
  const groot = await naarBlob(beeld, GROOT, 0.8);
  const klein = await naarBlob(beeld, KLEIN, 0.72);
  beeld.close?.();
  return { groot, klein };
}

export async function laadFotos(itemId) {
  const { data } = await maps().from('bestanden').select('*').eq('item_id', itemId).eq('soort', 'foto').order('created_at');
  return data || [];
}

export async function bewaarFoto(planId, itemId, bestand) {
  const { groot, klein } = await comprimeer(bestand);
  const id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2));
  const ext = groot.blob.type === 'image/webp' ? 'webp' : 'jpg';
  const pad = `${planId}/fotos/${itemId}/${id}.${ext}`; const mini = `${planId}/fotos/${itemId}/${id}_t.${ext}`;
  const st = sb().storage.from(BUCKET);
  const r1 = await st.upload(pad, groot.blob, { contentType: groot.blob.type, cacheControl: '31536000' }); if (r1.error) throw r1.error;
  const r2 = await st.upload(mini, klein.blob, { contentType: klein.blob.type, cacheControl: '31536000' }); if (r2.error) throw r2.error;
  const rij = { plan_id: planId, item_id: itemId, soort: 'foto', pad, meta: { mini, naam: bestand.name, b: groot.w, h: groot.h, kb: Math.round(groot.blob.size / 1024), origineel_kb: Math.round(bestand.size / 1024) } };
  const { data, error } = await maps().from('bestanden').insert(rij).select().single();
  if (error) throw error;
  return data || { id, ...rij };
}

export async function verwijderFoto(rij) {
  await sb().storage.from(BUCKET).remove([rij.pad, rij.meta?.mini].filter(Boolean));
  const { error } = await maps().from('bestanden').delete().eq('id', rij.id);
  if (error) throw error;
}

// Strook met miniaturen, toevoegen en een grote weergave.
export function FotoStrook({ planId, itemId, schrijven, titel = "Foto's", vast = null, kolommen = 4, tekst = {} }) {
  const [lijst, setLijst] = useState(vast || []);
  const [bezig, setBezig] = useState(0);
  const [fout, setFout] = useState('');
  const [groot, setGroot] = useState(null); // index
  const invoer = useRef(null);
  // vast = lijst uit een deel-link (geen databank-toegang): enkel tonen.
  useEffect(() => { if (vast) { setLijst(vast); return undefined; } let weg = false; setLijst([]); if (itemId) laadFotos(itemId).then((l) => { if (!weg) setLijst(l); }); return () => { weg = true; }; }, [itemId, vast]);
  if (!schrijven && !lijst.length) return null;
  const voegToe = async (bestanden) => {
    setFout('');
    for (const f of bestanden) {
      if (!/^image\//.test(f.type)) continue;
      setBezig((n) => n + 1);
      try { const r = await bewaarFoto(planId, itemId, f); setLijst((l) => [...l, r]); } catch (e) { setFout(foutTekst(e) || 'Uploaden mislukt.'); }
      setBezig((n) => n - 1);
    }
  };
  const wis = async (rij) => {
    if (!await bevestig('Deze foto verwijderen?', { ok: 'Verwijderen', gevaar: true })) return;
    try { await verwijderFoto(rij); setLijst((l) => l.filter((x) => x.id !== rij.id)); setGroot(null); } catch (e) { setFout(foutTekst(e)); }
  };
  return (
    <div className="fm-fotostrook"
      onDragOver={(e) => { if (schrijven && e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDrop={(e) => { if (!schrijven) return; e.preventDefault(); voegToe([...e.dataTransfer.files]); }}>
      <div className="fm-bs-subkop" style={{ padding: 0 }}>{titel}{lijst.length ? ` · ${lijst.length}` : ''}</div>
      {(lijst.length > 0 || bezig > 0) && (
        <div className="fm-fotoraster" style={{ gridTemplateColumns: `repeat(${kolommen}, 1fr)` }}>
          {lijst.map((f, i) => <button key={f.id} className="fm-fotomini" onClick={() => setGroot(i)} aria-label={`Foto ${i + 1} groot tonen`}><img src={publiekeUrl(f.meta?.mini || f.pad)} alt="" loading="lazy" /></button>)}
          {Array.from({ length: bezig }, (_, i) => <span key={`b${i}`} className="fm-fotomini bezig" aria-label="Bezig met uploaden" />)}
        </div>
      )}
      {fout && <div className="fm-sub" style={{ color: '#B4123A' }}>{fout}</div>}
      {schrijven && (
        <>
          <button className="fm-knop klein" onClick={() => invoer.current?.click()}>Foto toevoegen</button>
          <input ref={invoer} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { const l = [...(e.target.files || [])]; e.target.value = ''; voegToe(l); }} />
        </>
      )}
      {groot != null && lijst[groot] && <FotoGroot lijst={lijst} i={groot} setI={setGroot} onWis={schrijven ? wis : null} tekst={tekst} />}
    </div>
  );
}

export function FotoGroot({ lijst, i, setI, onWis, tekst = {} }) {
  useEffect(() => {
    const t = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); setI(null); }
      if (e.key === 'ArrowRight') { e.stopPropagation(); setI((i + 1) % lijst.length); }
      if (e.key === 'ArrowLeft') { e.stopPropagation(); setI((i - 1 + lijst.length) % lijst.length); }
    };
    window.addEventListener('keydown', t, true); return () => window.removeEventListener('keydown', t, true);
  }, [i, lijst.length, setI]);
  const f = lijst[i];
  const inhoud = (
    <div className="fm fm-fotogroot" role="dialog" aria-label="Foto" onClick={(e) => { if (e.target === e.currentTarget) setI(null); }}>
      <img src={publiekeUrl(f.pad)} alt="" />
      <div className="fm-fotogroot-balk">
        <span>{f.titel ? <strong style={{ marginRight: 8 }}>{f.titel}</strong> : null}{i + 1} / {lijst.length}{f.meta?.kb ? ` · ${f.meta.kb} kB` : ''}</span>
        <span style={{ flex: 1 }} />
        {lijst.length > 1 && <><button className="fm-knop klein" onClick={() => setI((i - 1 + lijst.length) % lijst.length)}>‹ {tekst.vorige || 'Vorige'}</button><button className="fm-knop klein" onClick={() => setI((i + 1) % lijst.length)}>{tekst.volgende || 'Volgende'} ›</button></>}
        <a className="fm-knop klein" href={publiekeUrl(f.pad)} target="_blank" rel="noreferrer">{tekst.openen || 'Openen'}</a>
        {onWis && <button className="fm-knop klein" style={{ color: '#B4123A' }} onClick={() => onWis(f)}>Verwijderen</button>}
        <button className="fm-knop klein zwart" onClick={() => setI(null)}>{tekst.sluiten || 'Sluiten'}</button>
      </div>
    </div>
  );
  return createPortal(inhoud, document.body);
}
