'use client';

// Wie is er in het plan, in welke werkruimte, en wat doet hij.
import { useEffect, useRef, useState } from 'react';
import { WERKRUIMTES } from './werkruimtes';

// Vaste kleur per persoon (goed te onderscheiden, ook van de werkruimtekleuren).
const KLEUREN = ['#0EA5E9', '#D946EF', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#14B8A6', '#F97316', '#64748B', '#EC4899'];
export function kleurVoor(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return KLEUREN[h % KLEUREN.length];
}
export const initialen = (naam) => String(naam || '?').split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// Presence-state (Supabase) naar een lijst andere aanwezigen; één persoon met meerdere tabbladen telt één keer.
export function anderenUit(state, mijnUid) {
  const per = new Map();
  for (const [key, lijst] of Object.entries(state || {})) {
    for (const s of lijst || []) {
      if (!s?.uid || s.uid === mijnUid) continue;
      const vorige = per.get(s.uid);
      if (!vorige || (s.actief || 0) > (vorige.actief || 0)) per.set(s.uid, { ...s, key });
    }
  }
  return [...per.values()].sort((a, b) => String(a.naam).localeCompare(String(b.naam), 'nl'));
}

const wrNaam = (id) => WERKRUIMTES.find((w) => w.id === id)?.naam || 'Plan';
const wrKleur = (id) => WERKRUIMTES.find((w) => w.id === id)?.kleur || '#1d1d1b';

export function Avatar({ p, maat = 28, rand = true }) {
  return (
    <span className="fm-avatar" style={{ width: maat, height: maat, background: p.kleur, boxShadow: rand ? `0 0 0 2px #fff, 0 0 0 4px ${wrKleur(p.werkruimte)}` : 'none', fontSize: maat * 0.4 }} aria-hidden>
      {initialen(p.naam)}
    </span>
  );
}

export default function Aanwezigen({ anderen, items, naamVan, muisAan, onMuisAan, onVolg }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const dicht = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', dicht);
    return () => document.removeEventListener('pointerdown', dicht);
  }, [open]);
  if (!anderen.length) return null;
  const wat = (p) => {
    const id = p.bewerkt && Date.now() - (p.actief || 0) < 30000 ? p.bewerkt : p.selectie?.[0];
    const it = id ? items.find((x) => x.id === id) : null;
    if (!it) return wrNaam(p.werkruimte);
    return `${wrNaam(p.werkruimte)} · ${p.bewerkt === id ? 'bewerkt' : 'bekijkt'} ${naamVan(it)}`;
  };
  return (
    <div className="fm-aanwezig" ref={ref}>
      <button className="fm-aanwezig-rij" onClick={() => setOpen((o) => !o)} aria-label={`${anderen.length} collega's in dit plan`} title={anderen.map((p) => `${p.naam} · ${wat(p)}`).join('\n')}>
        {anderen.slice(0, 4).map((p) => <Avatar key={p.uid} p={p} />)}
        {anderen.length > 4 && <span className="fm-avatar meer">+{anderen.length - 4}</span>}
      </button>
      {open && (
        <div className="fm-menu fm-aanwezig-menu">
          <div className="fm-ctxkop">Ook in dit plan</div>
          {anderen.map((p) => (
            <button key={p.uid} onClick={() => { setOpen(false); onVolg(p); }}>
              <Avatar p={p} maat={24} />
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                <b>{p.naam}</b><small>{wat(p)}</small>
              </span>
            </button>
          ))}
          <label className="fm-vink" style={{ padding: '6px 10px', borderTop: '1px solid #E8E8E6' }}>
            <input type="checkbox" checked={muisAan} onChange={(e) => onMuisAan(e.target.checked)} />Muis van collega&apos;s tonen
          </label>
        </div>
      )}
    </div>
  );
}

// Banner boven Info als een collega dit item bewerkt of bekijkt.
export function SlotBanner({ slot, kijkers, onToch }) {
  if (slot) {
    return (
      <div className="fm-slotbanner" style={{ borderLeftColor: slot.kleur }}>
        <Avatar p={slot} maat={22} rand={false} />
        <span><b>{slot.naam}</b> bewerkt dit nu.</span>
        <button className="fm-knop klein" onClick={onToch}>Toch bewerken</button>
      </div>
    );
  }
  if (kijkers?.length) {
    return (
      <div className="fm-slotbanner zacht">
        {kijkers.slice(0, 3).map((p) => <Avatar key={p.uid} p={p} maat={20} rand={false} />)}
        <span>Ook geselecteerd door {kijkers.map((p) => p.naam).join(', ')}</span>
      </div>
    );
  }
  return null;
}
