// Lijniconen voor de gsm-app (stroke, kleur uit de tekst).
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const Ic = {
  plannen: () => <svg viewBox="0 0 24 24" {...P}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 10h16M10 10v10" /></svg>,
  kaart: () => <svg viewBox="0 0 24 24" {...P}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>,
  meldingen: () => <svg viewBox="0 0 24 24" {...P}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>,
  meer: () => <svg viewBox="0 0 24 24" {...P}><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>,
  zoek: () => <svg viewBox="0 0 24 24" {...P}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>,
  ik: () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7.5" /></svg>,
  lagen: () => <svg viewBox="0 0 24 24" {...P}><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></svg>,
  meten: () => <svg viewBox="0 0 24 24" {...P}><rect x="2.5" y="8" width="19" height="8" rx="1.5" /><path d="M6.5 8v3M10.5 8v4M14.5 8v3M18.5 8v4" /></svg>,
  foto: () => <svg viewBox="0 0 24 24" {...P}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  wie: () => <svg viewBox="0 0 24 24" {...P}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.2a4.5 4.5 0 0 1 5 4.8" /></svg>,
  melden: () => <svg viewBox="0 0 24 24" {...P}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><path d="M12 6.5v4M12 13h.01" /></svg>,
  thuis: () => <svg viewBox="0 0 24 24" {...P}><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10.5 18h3" /></svg>,
  offline: () => <svg viewBox="0 0 24 24" {...P}><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" /></svg>,
  opbouw: () => <svg viewBox="0 0 24 24" {...P}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>,
  scherm: () => <svg viewBox="0 0 24 24" {...P}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>,
  account: () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>,
  deel: () => <svg viewBox="0 0 24 24" {...P}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>,
  route: () => <svg viewBox="0 0 24 24" {...P}><path d="M5 19c0-6 14-4 14-12" /><circle cx="5" cy="19" r="2" /><path d="m15.5 5.5 3.5 1.5-1.5 3.5" /></svg>,
};
