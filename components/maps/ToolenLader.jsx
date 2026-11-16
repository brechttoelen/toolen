'use client';

// Lader met het beeldmerk van Toolen: de vier ruiten ademen om beurten en het geheel draait per kwartslag.
// Wie minder beweging vraagt (instelling van het toestel), krijgt het stilstaande beeldmerk.
const RUITEN = [
  { x: 11.7, y: 2.7, c: [16, 7], kleur: '#108AED', dx: 0, dy: -2.2 },
  { x: 20.7, y: 11.7, c: [25, 16], kleur: '#28B571', dx: 2.2, dy: 0 },
  { x: 11.7, y: 20.7, c: [16, 25], kleur: '#fff', dx: 0, dy: 2.2 },
  { x: 2.7, y: 11.7, c: [7, 16], kleur: '#fff', dx: -2.2, dy: 0 },
];

export default function ToolenLader({ tekst = 'Laden…' }) {
  return (
    <div className="fm fm-lader" role="status" aria-live="polite">
      <svg viewBox="0 0 32 32" width="72" height="72" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#022056" />
        <g transform="translate(3 3) scale(0.8125)">
          <g className="fm-lader-draai">
            {RUITEN.map((r, i) => (
              <g key={i} className="fm-lader-ruit" style={{ '--dx': `${r.dx}px`, '--dy': `${r.dy}px`, animationDelay: `${i * 0.16}s` }}>
                <rect x={r.x} y={r.y} width="8.6" height="8.6" rx="2.2" fill={r.kleur} transform={`rotate(45 ${r.c[0]} ${r.c[1]})`} />
              </g>
            ))}
          </g>
        </g>
      </svg>
      <span>{tekst}</span>
    </div>
  );
}
