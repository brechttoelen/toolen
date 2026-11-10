'use client';

// Eén terugknop voor alle volledige schermen (materiaal, delen, exporteren, PDF, bouwers): altijd links bovenaan.
export default function TerugKnop({ onClick, tekst = 'Terug naar de kaart', titel = 'Terug naar de kaart (Esc)' }) {
  return (
    <button type="button" className="fm-terugknop" onClick={onClick} title={titel}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {tekst}
    </button>
  );
}
