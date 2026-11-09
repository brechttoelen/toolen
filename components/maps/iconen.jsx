'use client';

// Lijniconen (geen emoji, geen icoontekens).
const PADEN = {
  selecteer: <path d="M5 3l6 17 2.5-7.5L21 10z" />,
  hand: <path d="M8 13V5a1.5 1.5 0 013 0v6M11 11V4a1.5 1.5 0 013 0v7M14 11V6a1.5 1.5 0 013 0v8c0 4-3 7-7 7s-6-3-7-6l-1-3a1.5 1.5 0 012.7-1.2L8 13" />,
  gebouw: <><path d="M4 21V6l8-3 8 3v15" /><path d="M10 21v-5h4v5M8 9h1M11.5 9h1M15 9h1M8 12.5h1M11.5 12.5h1M15 12.5h1" /></>,
  punt: <><path d="M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  bouwers: <><path d="M3 21h18M6 21V9l6-5 6 5v12" /><path d="M9 21v-6h6v6M4 10l8-6.5 8 6.5" /></>,
  streetview: <><circle cx="12" cy="5" r="2.5" /><path d="M9 21l1-7H8.5V10a3.5 3.5 0 017 0v4H14l1 7" /></>,
  tent: <><path d="M2 20L12 4l10 16z" /><path d="M12 4v16M9 20l3-5 3 5" /></>,
  lijn: <path d="M4 19L9 9l6 5 5-10" />,
  vlak: <path d="M4 18L7 5l10 2 3 9-9 4z" />,
  rechthoek: <rect x="4" y="6" width="16" height="12" />,
  kader: <><rect x="3" y="4" width="14" height="12" strokeDasharray="2.5 2" /><path d="M13 12l4 9 1.4-3.6L22 16z" /></>,
  schaar: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M8 7.5 20 17M8 16.5 20 7" /></>,
  verder: <><path d="M3 18 10 10" /><path d="M10 10l7-4" strokeDasharray="2 2" /><circle cx="10" cy="10" r="1.8" /><path d="M17 3v6M14 6h6" /></>,
  evenwijdig: <><path d="M4 16 16 4M8 20 20 8" /></>,
  cirkel: <circle cx="12" cy="12" r="8" />,
  veelhoek: <path d="M12 4l9 16H3z" />,
  ellips: <ellipse cx="12" cy="12" rx="9" ry="5.5" />,
  sector: <path d="M12 20L5 6a10 10 0 0114 0z" />,
  vrijehand: <path d="M3 17c3-6 5 2 8-3s4-7 7-4 1 7-2 6" />,
  tekst: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
  element: <><path d="M2 20L12 5l10 15z" /><path d="M12 5v15" /></>,
  meten: <><rect x="2" y="8" width="20" height="8" /><path d="M6 8v4M10 8v3M14 8v4M18 8v3" /></>,
  ongedaan: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  opnieuw: <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" />,
  terug: <path d="M15 18l-6-6 6-6" />,
  oog: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  oogdicht: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 004.4-1" /></>,
  slot: <><rect x="5" y="11" width="14" height="10" /><path d="M8 11V7a4 4 0 018 0v4" /></>,
  slotopen: <><rect x="5" y="11" width="14" height="10" /><path d="M8 11V7a4 4 0 017.5-2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  klok: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  prullenbak: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  navigeer: <path d="M3 11l18-8-8 18-2-8z" />,
  lagen: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  boek: <><path d="M4 4h6a2 2 0 012 2v14a2 2 0 00-2-2H4z" /><path d="M20 4h-6a2 2 0 00-2 2v14a2 2 0 012-2h6z" /></>,
  lijstje: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  bliksem: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  vlam: <path d="M12 3c1 3 4 5 4 9a4 4 0 01-8 0c0-1.5.5-2.5 1-3.5.5 1.5 1.5 2 2 2 0-3-1-5 1-7.5z" />,
  stekker: <><rect x="3" y="8" width="18" height="8" rx="2" /><path d="M8 12h.01M12 12h.01M16 12h.01M21 12h1" /></>,
  penseel: <><path d="M18 3l3 3-9 9-3-3z" /><path d="M9 12c-3 0-4 2-4 4 0 2-1 3-2 4 3 0 7-1 8-4" /></>,
  vlag: <path d="M6 21V3M6 4c4-1 8 3 12 1v8c-4 2-8-2-12-1" />,
  feedback: <path d="M4 5h16v11H9l-5 4V5zM8 9h8M8 12h5" />,
  bord: <><rect x="4" y="3" width="16" height="10" /><path d="M12 13v8M9 8h6M13 6l2 2-2 2" /></>,
  vink: <><path d="M4 12l5 5L20 6" /></>,
  plan: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h7" /></>,
  scherm: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  pijlomlaag: <path d="M6 9l6 6 6-6" />,
  draailinks: <path d="M4 4v6h6M4.5 10A8 8 0 1 1 6 17" />,
  draairechts: <path d="M20 4v6h-6M19.5 10A8 8 0 1 0 18 17" />,
  kopie: <><rect x="8" y="8" width="12" height="12" /><path d="M4 16V4h12" /></>,
  voor: <><rect x="9" y="9" width="11" height="11" /><path d="M4 15V4h11" strokeDasharray="2 2" /></>,
  achter: <><rect x="4" y="4" width="11" height="11" /><path d="M9 20h11V9" strokeDasharray="2 2" /></>,
};

export function Icoon({ naam, maat = 20 }) {
  return (
    <svg width={maat} height={maat} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PADEN[naam] || null}
    </svg>
  );
}
