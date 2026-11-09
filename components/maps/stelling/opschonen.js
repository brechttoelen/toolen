// Opschonen van een opgeslagen stelling (eenmalig bij het openen van de bouwer): alles op het rozettenraster en
// geen doeken die niet kunnen bestaan. Geeft dezelfde stelling terug als er niets te doen was.
// - Dekken die niet in de rozetten van hun staanders hangen (naast een hogere toren) → dichtste hoogte erboven.
// - Doeken: 'perVak' wordt een doek per vak; van/tot begrensd tot grond en top van de staanders; restjes < 0,2 m weg;
//   oude soorten (op de leuning, band, zijkant, onder) op een vlakke wand worden een doek tussen twee hoogtes.
import { delenVan, stellingAfgeleid, wandMaten, RAND, HOEKEN, DEK_ROZET, ROZET, LEUNING_H, grondVan, sleutel } from '../stellingbouw';

const r2 = (x) => Math.round(x * 100) / 100;
let teller = 0;
const nieuwId = () => `o${Date.now().toString(36)}${(teller++).toString(36)}`;

function deelSchoon(d, verbonden) {
  let st = d; let veranderd = false;
  // 1. Dekken op de rozetten.
  const af0 = stellingAfgeleid(st, { verbonden });
  if (af0.scheef?.length) {
    const v = { ...st.vakken }; for (const x of af0.scheef) if (v[x.s]) v[x.s] = { ...v[x.s], h: x.voorstel };
    st = { ...st, vakken: v }; veranderd = true;
  }
  // 2. Doeken.
  if (Array.isArray(st.doeken) && st.doeken.length) {
    const af = stellingAfgeleid(st, { verbonden });
    const rand = (s) => af.randen.find((r) => r.s === s);
    const grenzen = (r) => {
      const wm = wandMaten(r, af.grondOp);
      const kn = [RAND[r.k][0], RAND[r.k][1]].map((c) => af.knopen.find((n) => n.i === r.i + HOEKEN[c][0] && n.j === r.j + HOEKEN[c][1])).filter(Boolean);
      return { g: wm.g, g0: wm.g0, top: kn.length ? Math.max(...kn.map((n) => n.top)) : Math.max(r.ha, r.hb) };
    };
    const uit = [];
    for (const dIn of st.doeken) {
      const d0 = dIn.id ? dIn : { ...dIn, id: nieuwId() }; if (d0 !== dIn) veranderd = true;
      if (d0.soort === 'dak') { const vk = (d0.vakken || []).filter((k) => st.vakken?.[k]); if (vk.length) uit.push(vk.length === d0.vakken.length ? d0 : { ...d0, vakken: vk }); if (vk.length !== d0.vakken.length) veranderd = true; continue; }
      const rs = (d0.randen || []).filter((s) => rand(s));
      if (!rs.length) { veranderd = true; continue; }
      let d1 = rs.length === (d0.randen || []).length ? d0 : { ...d0, randen: rs };
      // Oude soorten op een vlakke wand → tussen twee hoogtes (langs een helling blijven ze zoals ze zijn).
      if (d1.soort !== 'vlak' && rs.every((s) => { const r = rand(s); return Math.abs(r.ha - r.hb) < 0.01; })) {
        const r = rand(rs[0]); const hh = r.ha; const gz = grondVan(st.vakken?.[sleutel(r.i, r.j)]);
        const vt = d1.soort === 'zijkant' ? [gz, hh] : d1.soort === 'band' ? [Math.max(gz, hh - 1), hh] : d1.soort === 'onder' ? [gz, Math.min(hh, gz + 2)] : d1.soort === 'doorgang' ? null : [hh + 0.1, hh + LEUNING_H];
        if (vt) { d1 = { ...d1, soort: 'vlak', van: r2(vt[0]), tot: r2(vt[1]) }; veranderd = true; }
      }
      if (d1.soort === 'vlak') {
        const gz = Math.min(...rs.map((s) => grenzen(rand(s)).g0 + ROZET)); const tp = Math.max(...rs.map((s) => grenzen(rand(s)).top));
        const r0 = rand(rs[0]); const g00 = grenzen(r0).g0;
        const van = r2(Math.max(gz, Number(d1.van ?? g00 + ROZET))); const tot = r2(Math.min(tp, Number(d1.tot ?? Math.min(r0.ha, r0.hb) - DEK_ROZET)));
        if (tot - van < 0.2) { veranderd = true; continue; }
        if (van !== d1.van || tot !== d1.tot) { d1 = { ...d1, van, tot }; veranderd = true; }
      }
      if (d1.perVak) { const { perVak, ...rest } = d1; for (const s of d1.randen) uit.push({ ...rest, id: nieuwId(), randen: [s] }); veranderd = true; continue; }
      uit.push(d1);
    }
    if (veranderd) st = { ...st, doeken: uit };
  }
  return veranderd ? st : d;
}

export function stellingOpschonen(st) {
  if (!st?.vakken) return st;
  const delen = delenVan(st);
  let uit = st;
  const hoofd = deelSchoon(st, delen[0]?.verbonden);
  if (hoofd !== st) uit = { ...hoofd, delen: st.delen };
  if (Array.isArray(st.delen) && st.delen.length) {
    const nd = st.delen.map((c) => { const dl = delen.find((x) => x.id === c.id); return dl ? deelSchoon(c, dl.verbonden) : c; });
    if (nd.some((c, k) => c !== st.delen[k])) uit = { ...uit, delen: nd };
  }
  return uit;
}
