'use client';

// Puntsoorten in het binnenplan: stekkerblokken en vaste aansluitingen van het gebouw,
// met een eigen symbooltje op vaste grootte.

export const PUNT_TYPES = [
  { k: 'punt', naam: 'Punt', kleur: '#1d1d1b' },
  { k: 'renner', naam: 'Renner (camerabeeld)', kort: 'Renner', kleur: '#1d1d1b' },
  { k: 'stekker', naam: 'Stekkerblok', kleur: '#CA8A04' },
  { k: 'stroom', naam: 'Stroomaansluiting (vast)', kort: 'Stroom (vast)', kleur: '#0E7490', vast: true },
  // Waar een kabel van buiten (generator, kast) het gebouw of de tent binnenkomt: geen materiaal, wel een
  // knoop in de stroomplanning (kast met één doorlus, zie stroom.js).
  { k: 'invoer', naam: 'Stroominvoer (kabel van buiten)', kort: 'Stroominvoer', kleur: '#7C3AED', materiaal: false },
  { k: 'water', naam: 'Wateraansluiting (vast)', kort: 'Water (vast)', kleur: '#2563EB', vast: true },
  { k: 'data', naam: 'Netwerk / internet', kort: 'Netwerk', kleur: '#7C3AED' },
  { k: 'brand', naam: 'Brandblusser', kleur: '#DC2626' },
  { k: 'ehbo', naam: 'EHBO', kleur: '#16A34A' },
];
export const PUNT = Object.fromEntries(PUNT_TYPES.map((t) => [t.k, t]));

// Symbool rond (x, y) in schermpixels.
export function PuntSymbool({ type = 'punt', x, y, aan = false, kleur }) {
  const t = PUNT[type] || PUNT.punt; const k = kleur || t.kleur;
  const rand = aan ? '#2563EB' : '#fff';
  const r = 9;
  const ring = <circle cx={x} cy={y} r={aan ? r + 2.5 : r + 1.5} fill={rand} />;
  if (type === 'stekker') return (
    <g>{ring}<rect x={x - 9} y={y - 6} width={18} height={12} rx={3} fill={k} />
      {[-5, 0, 5].map((d) => <circle key={d} cx={x + d} cy={y} r={1.6} fill="#fff" />)}</g>
  );
  if (type === 'invoer') return (
    <g>{ring}<circle cx={x} cy={y} r={r} fill={k} /><path d={`M${x - 7} ${y}H${x + 1}M${x - 2} ${y - 3}l3 3-3 3`} stroke="#fff" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d={`M${x + 3} ${y - 5}v10`} stroke="#fff" strokeWidth={2} /></g>
  );
  if (type === 'stroom') return (
    <g>{ring}<circle cx={x} cy={y} r={r} fill={k} /><path d={`M${x + 1.5} ${y - 6}L${x - 3.5} ${y + 1}H${x - 0.5}L${x - 1.5} ${y + 6}L${x + 3.5} ${y - 1}H${x + 0.5}Z`} fill="#fff" /></g>
  );
  if (type === 'water') return (
    <g>{ring}<circle cx={x} cy={y} r={r} fill={k} /><path d={`M${x} ${y - 6}C${x + 3.5} ${y - 1.5} ${x + 4} ${y + 1} ${x + 4} ${y + 2}A4 4 0 0 1 ${x - 4} ${y + 2}C${x - 4} ${y + 1} ${x - 3.5} ${y - 1.5} ${x} ${y - 6}Z`} fill="#fff" /></g>
  );
  if (type === 'data') return (
    <g>{ring}<circle cx={x} cy={y} r={r} fill={k} /><path d={`M${x - 4} ${y + 3}h8M${x} ${y + 3}v-3M${x - 3} ${y - 4}h6v4h-6z`} stroke="#fff" strokeWidth={1.4} fill="none" /></g>
  );
  if (type === 'brand') return (
    <g>{ring}<circle cx={x} cy={y} r={r} fill={k} /><path d={`M${x} ${y - 6}C${x + 5} ${y - 1} ${x + 4} ${y + 5} ${x} ${y + 5}C${x - 4} ${y + 5} ${x - 5} ${y} ${x - 1} ${y - 3}C${x - 1} ${y} ${x + 1} ${y} ${x} ${y - 6}Z`} fill="#fff" /></g>
  );
  if (type === 'ehbo') return (
    <g>{ring}<circle cx={x} cy={y} r={r} fill={k} /><path d={`M${x - 1.6} ${y - 5}h3.2v3.4h3.4v3.2h-3.4v3.4h-3.2v-3.4h-3.4v-3.2h3.4z`} fill="#fff" /></g>
  );
  if (type === 'renner') return (
    <g>{ring}<circle cx={x} cy={y} r={r} fill={k} /><circle cx={x} cy={y - 2.6} r={2.3} fill="#fff" /><path d={`M${x - 4.6} ${y + 5.2}C${x - 4.6} ${y + 0.6} ${x + 4.6} ${y + 0.6} ${x + 4.6} ${y + 5.2}Z`} fill="#fff" /></g>
  );
  return <g>{ring}<circle cx={x} cy={y} r={6} fill={k} /></g>;
}
