'use client';

// <option>s voor een laagkeuze: lagen in een map komen samen onder de naam van de map.
export function LaagOpties({ lagen }) {
  const uit = []; const gezien = new Set();
  for (const l of lagen) {
    if (!l.map) { uit.push(<option key={l.id} value={l.id}>{l.naam}</option>); continue; }
    if (gezien.has(l.map)) continue;
    gezien.add(l.map);
    uit.push(<optgroup key={`m:${l.map}`} label={l.map}>{lagen.filter((x) => x.map === l.map).map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}</optgroup>);
  }
  return uit;
}
