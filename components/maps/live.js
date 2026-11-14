'use client';

// Live samenwerken: wijzigingen van collega's (Supabase Realtime, postgres_changes) en
// aanwezigheid (presence) op één kanaal per plan. De rechten (RLS) gelden ook hier.
//
// startLive({ client, planId, sleutel, onItem, onWeg, onLaag, onPlan, onStatus, onAanwezig, onMuis })
//  -> { stop(), deel(state), muis(lngLat|null) }

export function startLive({ client, planId, sleutel, onItem, onWeg, onLaag, onPlan, onStatus, onAanwezig, onMuis, onBericht, onOpmerking }) {
  let kanaal = null;
  let gestopt = false;
  let ooitVerbonden = false;
  let mijnStaat = null;
  let herstart = null;
  let pogingen = 0;

  let stabiel = null;

  const verbind = () => {
    if (gestopt) return;
    onStatus?.('verbinden');
    // Privékanaal: de databank (realtime.messages, maps.kanaal_mag) laat enkel leden van de organisatie van het plan toe.
    const k = client.channel(`maps-plan-${planId}`, { config: { private: true, presence: { key: sleutel }, broadcast: { self: false } } });
    kanaal = k;
    let af = false; // dit kanaal is al afgeschreven: verdere meldingen ervan negeren
    // Elke melding enkel naar haar eigen tabel: na een herverbinding kon Realtime een
    // melding van items aan de verkeerde binding geven (items verschenen dan als lagen).
    k
      .on('postgres_changes', { event: '*', schema: 'maps', table: 'items', filter: `plan_id=eq.${planId}` }, (p) => { if (p.table === 'items' && p.new?.id) onItem?.(p.new); })
      .on('postgres_changes', { event: '*', schema: 'maps', table: 'items_prullenbak', filter: `plan_id=eq.${planId}` }, (p) => { if (p.table === 'items_prullenbak' && p.new?.id && !p.new.teruggezet_op) onWeg?.(p.new); })
      .on('postgres_changes', { event: '*', schema: 'maps', table: 'lagen', filter: `plan_id=eq.${planId}` }, (p) => { if (p.table === 'lagen') onLaag?.(p.eventType, p.new, p.old); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'maps', table: 'plannen', filter: `id=eq.${planId}` }, (p) => { if (p.table === 'plannen' && p.new?.id) onPlan?.(p.new); })
      .on('postgres_changes', { event: '*', schema: 'maps', table: 'opmerkingen', filter: `plan_id=eq.${planId}` }, (p) => { if (p.table === 'opmerkingen') onOpmerking?.(p.new); })
      .on('presence', { event: 'sync' }, () => { if (k === kanaal) onAanwezig?.(k.presenceState()); })
      .on('broadcast', { event: 'muis' }, ({ payload }) => onMuis?.(payload))
      .on('broadcast', { event: 'bericht' }, ({ payload }) => onBericht?.(payload))
      .subscribe((status) => {
        // Meldingen van een kanaal dat we zelf al vervangen hebben tellen niet: het opruimen van het oude
        // kanaal meldt 'CLOSED', en dat brak vroeger het nieuwe kanaal weer af (eindeloos opnieuw verbinden).
        if (gestopt || af || k !== kanaal) return;
        if (status === 'SUBSCRIBED') {
          onStatus?.('live', ooitVerbonden);
          ooitVerbonden = true;
          // De wachttijd pas terug op nul als de verbinding een halve minuut standhoudt.
          clearTimeout(stabiel);
          stabiel = setTimeout(() => { if (k === kanaal) pogingen = 0; }, 30000);
          if (mijnStaat) k.track(mijnStaat).catch(() => {});
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          onStatus?.('offline');
          clearTimeout(stabiel);
          // Opnieuw verbinden met oplopende wachttijd (max. 30 s).
          af = true;
          clearTimeout(herstart);
          herstart = setTimeout(() => {
            try { client.removeChannel(k); } catch {}
            verbind();
          }, Math.min(30000, 1000 * 2 ** pogingen++));
        }
      });
  };
  verbind();

  let muisTijd = 0; let muisWacht = null;
  return {
    stop() { gestopt = true; clearTimeout(herstart); clearTimeout(stabiel); try { kanaal?.untrack?.(); client.removeChannel(kanaal); } catch {} },
    deel(staat) { mijnStaat = staat; try { kanaal?.track(staat)?.catch?.(() => {}); } catch {} },
    // Muispositie: hoogstens 10 keer per seconde, de laatste altijd.
    muis(pos) {
      const zend = () => { muisTijd = Date.now(); try { kanaal?.send({ type: 'broadcast', event: 'muis', payload: { sleutel, pos } }); } catch {} };
      clearTimeout(muisWacht);
      if (Date.now() - muisTijd > 100) zend(); else muisWacht = setTimeout(zend, 100);
    },
    bericht(payload) { try { kanaal?.send({ type: 'broadcast', event: 'bericht', payload: { sleutel, ...payload } }); } catch {} },
  };
}

// Lobby: wie zit in welk plan (voor de lijst met plannen). Elk geopend plan meldt zich hier.
// Per organisatie (privékanaal): collega's van andere organisaties zien niet wie waar zit.
export function startLobby({ client, sleutel, orgId, onState }) {
  if (!orgId) return { meld() {}, stop() {} };
  const kanaal = client.channel(`maps-aanwezig-${orgId}`, { config: { private: true, presence: { key: sleutel || `kijker-${Math.random().toString(36).slice(2)}` } } });
  let staat = null;
  kanaal.on('presence', { event: 'sync' }, () => onState?.(kanaal.presenceState()))
    .subscribe((s) => { if (s === 'SUBSCRIBED' && staat) kanaal.track(staat).catch(() => {}); });
  return {
    meld(st) { staat = st; try { kanaal.track(st)?.catch?.(() => {}); } catch {} },
    stop() { try { kanaal.untrack?.(); client.removeChannel(kanaal); } catch {} },
  };
}
