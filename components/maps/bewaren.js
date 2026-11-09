'use client';

// Bewaren zonder elkaar te overschrijven.
// Per item onthouden we de laatst gekende stand van de server (met rev). Een wijziging
// stuurt enkel de velden die verschillen van die stand, samen met de rev die we kenden.
// De database (maps.item_wijzig) voegt samen als een ander andere velden aanpaste,
// en meldt een botsing als het om dezelfde velden gaat. Zie migratie 006.

const DIEP = ['velden', 'stijl', 'parameters'];
const NIET = new Set(['id', 'created_at', 'updated_at', 'rev', 'bewerkt_door', 'geplaatst_op', 'geplaatst_door']);

export function gelijk(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == b; // eslint-disable-line eqeqeq
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => gelijk(x, b[i]));
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => gelijk(a[k], b[k]));
}

// Wat moet er naar de server om van `basis` naar `item` te gaan.
export function verschil(basis, item) {
  const p = {};
  for (const k of new Set([...Object.keys(basis || {}), ...Object.keys(item || {})])) {
    if (NIET.has(k)) continue;
    if (!(k in item)) continue; // niet meegegeven = niet gewijzigd
    const a = basis?.[k]; const c = item[k];
    if (DIEP.includes(k) && (a == null || typeof a === 'object') && (c == null || typeof c === 'object') && !Array.isArray(a) && !Array.isArray(c)) {
      const sub = {};
      for (const s of new Set([...Object.keys(a || {}), ...Object.keys(c || {})])) {
        const va = a?.[s]; const vc = c?.[s];
        if (!gelijk(va, vc)) sub[s] = vc === undefined ? null : vc;
      }
      if (Object.keys(sub).length) p[k] = sub;
    } else if (!gelijk(a, c)) {
      p[k] = c === undefined ? null : c;
    }
  }
  return p;
}

// Een patch (zoals verschil() die maakt) op een item toepassen.
export function pasPatchToe(item, patch) {
  const n = { ...item };
  for (const [k, v] of Object.entries(patch)) {
    if (DIEP.includes(k) && v && typeof v === 'object' && !Array.isArray(v)) {
      const o = { ...(item[k] || {}) };
      for (const [s, w] of Object.entries(v)) { if (w === null) delete o[s]; else o[s] = w; }
      n[k] = o;
    } else n[k] = v;
  }
  return n;
}

// Paden van een patch: 'geometrie', 'velden.stroom', …
export const padenVan = (patch) => Object.entries(patch).flatMap(([k, v]) => (DIEP.includes(k) && v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).map((s) => `${k}.${s}`) : [k]));

// Enkel echte kolommen van maps.items doorsturen: een losse sleutel (bv. 'aantal') laat de hele invoeging mislukken.
const KOLOMMEN = ['id', 'plan_id', 'plek_id', 'laag_id', 'element_id', 'groep_id', 'soort', 'geometrie', 'parameters', 'stijl', 'naam', 'notitie', 'velden', 'fase_ids', 'vergrendeld', 'verborgen', 'volgorde', 'geplaatst_op', 'geplaatst_door', 'bewerkt_door'];
const SCHOON = (it) => Object.fromEntries(KOLOMMEN.filter((k) => it[k] !== undefined).map((k) => [k, it[k]]));

/**
 * maakBewaarder({ maps, rpc, …callbacks })
 *  onServer(verzonden, server, status)  server-stand na een geslaagde wijziging of invoeging
 *  onBotsing({ id, mijn, server, door, paden })
 *  onVerwijderd(id, { door, op } | null)   item bestaat niet meer op de server
 *  onStatus('bezig' | 'ok' | 'fout'), onFout(error)
 */
export function maakBewaarder({ maps, rpc, lokaal, onServer, onBotsing, onVerwijderd, onStatus, onFout }) {
  const basis = new Map();
  const ketens = new Map();
  const wachtrij = new Map(); // offline: id -> item, opnieuw te proberen
  let open = 0;
  let timer = null;
  const status = () => onStatus?.(open ? 'bezig' : wachtrij.size ? 'offline' : 'ok');
  const isNetwerk = (e) => !e?.code && /fetch|network|netwerk|offline|Load failed/i.test(String(e?.message || e));
  let zelf = null;
  const planOpnieuw = () => { clearTimeout(timer); timer = setTimeout(() => zelf?.opnieuw(), 10000); };

  const keten = (id, werk) => {
    const p = (ketens.get(id) || Promise.resolve()).then(werk, werk);
    ketens.set(id, p);
    p.finally(() => { if (ketens.get(id) === p) ketens.delete(id); }).catch(() => {});
    return p;
  };

  // Per item een teller die verhoogt bij verwijderen: een bewaring die nog onderweg was,
  // mag het item daarna niet opnieuw als 'gekend op de server' noteren.
  const gen = new Map();
  async function doeBewaar(item) {
    const g0 = gen.get(item.id) || 0;
    const zet = (id, rij) => { if ((gen.get(id) || 0) === g0) basis.set(id, rij); };
    const b = basis.get(item.id);
    if (!b) {
      const { data, error } = await maps().from('items').insert(SCHOON(item)).select().single();
      if (error && error.code === '23505') {
        // Bestaat al (bv. ongedaan maken terwijl een ander het terugzette): als wijziging behandelen.
        const r = await maps().from('items').select('*').eq('id', item.id).maybeSingle();
        if (r.data) { basis.set(item.id, r.data); return doeBewaar(item); }
      }
      if (error) throw error;
      zet(item.id, data);
      onServer?.(item, data, 'nieuw');
      return;
    }
    const patch = SCHOON(verschil(b, item));
    if (!Object.keys(patch).length) return;
    const { data, error } = await rpc('item_wijzig', { p_id: item.id, p_rev: b.rev ?? null, p_patch: patch });
    if (error) throw error;
    const st = data?.status;
    if (st === 'ok' || st === 'samengevoegd') {
      zet(item.id, data.item);
      onServer?.(item, data.item, st);
    } else if (st === 'botsing') {
      onBotsing?.({ id: item.id, mijn: item, server: data.item, door: data.door, paden: data.paden || [] });
    } else if (st === 'verwijderd' || st === 'weg') {
      basis.delete(item.id);
      onVerwijderd?.(item.id, st === 'verwijderd' ? { door: data.door, op: data.op } : null);
    }
  }

  zelf = {
    basis,
    zetBasis(rijen) { for (const r of rijen || []) if (r?.id) basis.set(r.id, r); },
    vergeet(ids) { for (const id of ids) basis.delete(id); },
    // Een stand van de server (realtime of herladen). Is ze nieuwer dan wat we kenden, dan
    // komen de eigen, nog niet bewaarde wijzigingen er bovenop (rebase). Geeft het nieuwe
    // lokale item terug, of null als er niets verandert.
    // Zolang er eigen wijzigingen openstaan, blijft de gekende stand (rev) dezelfde: zo ziet de
    // server bij het bewaren nog altijd een botsing als de collega hetzelfde veld aanpaste.
    extern(rij, lokaal) {
      const b = basis.get(rij.id);
      if (b && (b.rev ?? 0) >= (rij.rev ?? 0)) return null;
      const eigen = b && lokaal ? verschil(b, lokaal) : {};
      if (!Object.keys(eigen).length) { basis.set(rij.id, rij); return { ...rij }; }
      return pasPatchToe(rij, eigen);
    },
    bewaar(item) {
      open++; status();
      wachtrij.delete(item.id);
      return keten(item.id, () => doeBewaar(item))
        .catch((e) => {
          if (isNetwerk(e)) { wachtrij.set(item.id, item); onStatus?.('offline'); planOpnieuw(); return; }
          onFout?.(e); onStatus?.('fout');
        })
        .finally(() => { open--; if (open === 0) status(); });
    },
    // Wat offline bleef staan opnieuw proberen (bij online komen of herverbinden).
    opnieuw() {
      const l = [...wachtrij.values()]; wachtrij.clear();
      // De huidige lokale stand bewaren (die kan intussen aangevuld zijn met wat collega's deden).
      for (const it of l) this.bewaar(lokaal?.(it.id) || it);
      return l.length;
    },
    wachtend: () => wachtrij.size,
    // Botsing: mijn versie toch bewaren, bovenop de stand van de server.
    kiesMijn(item, server) {
      basis.set(item.id, server);
      return this.bewaar(item);
    },
    // Botsing: de versie van de ander houden.
    kiesHun(server) { basis.set(server.id, server); },
    async verwijder(ids) {
      if (!ids.length) return;
      for (const id of ids) { basis.delete(id); gen.set(id, (gen.get(id) || 0) + 1); wachtrij.delete(id); }
      open++; status();
      try {
        const { error } = await maps().from('items').delete().in('id', ids);
        if (error) throw error;
      } catch (e) { onFout?.(e); onStatus?.('fout'); } finally { open--; if (open === 0) status(); }
    },
    async terugzetten(ids) {
      const { data, error } = await rpc('items_terugzetten', { p_ids: ids });
      if (error) throw error;
      for (const r of data || []) basis.set(r.id, r);
      return data || [];
    },
    bezig: () => open > 0 || ketens.size > 0 || wachtrij.size > 0,
    heeftLopend: (id) => ketens.has(id) || wachtrij.has(id),
  };
  if (typeof window !== 'undefined') window.addEventListener('online', () => zelf.opnieuw());
  return zelf;
}

// ---------- Planinstellingen per pad ----------
// Vergelijkt de oude en nieuwe instellingen en geeft de schrijfopdrachten:
// { pad: ['signalisatie', 'routes'], waarde } of { pad, bij: [...], weg: [...] } voor lijsten van eenvoudige waarden.
const eenvoudig = (l) => Array.isArray(l) && l.every((x) => x === null || ['string', 'number', 'boolean'].includes(typeof x));
export function instellingenOpdrachten(oud = {}, nieuw = {}, diepte = 2, pad = []) {
  const r = [];
  for (const k of new Set([...Object.keys(oud || {}), ...Object.keys(nieuw || {})])) {
    const a = oud?.[k]; const b = nieuw?.[k]; const p = [...pad, k];
    if (gelijk(a, b)) continue;
    const metId = (l) => Array.isArray(l) && l.length > 0 && l.every((x) => x && typeof x === 'object' && !Array.isArray(x) && (typeof x.id === 'string' || typeof x.id === 'number'));
    if ((metId(a) || !a?.length) && (metId(b) || !b?.length) && (metId(a) || metId(b))) {
      // Lijst van objecten met id (routes, borden, groepen…): per regel, zodat collega's elkaars regels niet overschrijven.
      const A = a || []; const B = b || [];
      const opA = new Map(A.map((x) => [String(x.id), x]));
      const zet = B.filter((x) => !gelijk(opA.get(String(x.id)), x));
      const weg = A.map((x) => String(x.id)).filter((id) => !B.some((x) => String(x.id) === id));
      const gemeen = B.map((x) => String(x.id)).filter((id) => opA.has(id));
      const oudeVolg = A.map((x) => String(x.id)).filter((id) => gemeen.includes(id));
      const nieuwAchteraan = B.slice(gemeen.length).every((x) => !opA.has(String(x.id))) && B.slice(0, gemeen.length).every((x) => opA.has(String(x.id)));
      const volgorde = gelijk(oudeVolg, gemeen) && nieuwAchteraan ? null : B.map((x) => String(x.id));
      if (zet.length || weg.length || volgorde) r.push({ pad: p, zet, weg, volgorde });
    } else if (eenvoudig(a ?? []) && eenvoudig(b ?? []) && (Array.isArray(a) || Array.isArray(b))) {
      const A = a || []; const B = b || [];
      r.push({ pad: p, bij: B.filter((x) => !A.includes(x)), weg: A.filter((x) => !B.includes(x)) });
    } else if (diepte > 1 && a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      r.push(...instellingenOpdrachten(a, b, diepte - 1, p));
    } else {
      r.push({ pad: p, waarde: b === undefined ? null : b });
    }
  }
  return r;
}
