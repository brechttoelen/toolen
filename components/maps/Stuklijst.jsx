'use client';

import { heeftKoppeling } from './merk';
import { POWERLOCK_ADERS, kabelStukken } from './stroom';
import Info from './info';
import { useEffect, useMemo, useState } from 'react';
import * as turf from '@turf/turf';
import { brugCfg, brugStukken } from './rennersbrug';
import { isKabelcam, kabelcamInst } from './kabelcam';
import { maten, toebehorenTelling, toebehorenVan, heeftFracties, fractiesVan, fractieVan, isTotem, isVlag, isVlagHek, totemPanelen, herkomstVan, trussDoek, tentVloerItem, modules, koordMaat, koordVan, aantalVlaggen, toebehorenNaam } from './stijl';
import { sb } from './db';
import { getal, middelpunt, rond, lengte } from './geo';
import { vergelijkCategorie } from './categorieen';
import { PUNT } from './binnenPunten';
import { isWand, wandTelling, wandFrames, frameNaam, lengtesVanItem, naarMeterLijn } from './framewand';
import { isTrussBouw, trussStukken, trussTelling, trussTypeVoor } from './trussbouw';
import { isStellingBouw, stellingOmschrijving } from './stellingbouw';
import { zitMeubel, naamMeubel } from './meubel';

export function berekenStuklijst(items, elementen, lagen, actieveFase = null, std = null) {
  // Per regel onthouden uit welke items ze komt (r.ids): voor het materiaalscherm (doorklikken naar de kaart, leverancier wisselen).
  const perElement = new Map(); let huidig = null;
  { const zet = perElement.set.bind(perElement); perElement.set = (k, r) => { if (huidig) { if (!r.ids) Object.defineProperty(r, 'ids', { value: new Set(), enumerable: false }); r.ids.add(huidig); } return zet(k, r); }; }
  const vrij = new Map();
  let capaciteit = 0;
  for (const it of items) {
    huidig = it.id;
    if (it.verborgen) continue;
    if (actieveFase && it.fase_ids?.length && !it.fase_ids.includes(actieveFase)) continue;
    // Een kabel getekend met het kabelgereedschap (zonder element): telt als het bibliotheek-element van zijn kabeltype.
    const kt = !it.element_id && it.velden?.stroom?.rol === 'kabel' ? it.velden.stroom.kabeltype : null;
    const el = it.element_id ? elementen.get(it.element_id) : kt ? [...elementen.values()].find((e) => e.eigenschappen?.kabeltype === kt) || null : null;
    if (['vluchtweg', 'brandweertoegang', 'uitgang'].includes(el?.eigenschappen?.veiligheid)) continue; // aanduiding, geen materiaal
    if (el?.eigenschappen?.huis || it.velden?.binnen?.huis) {
      // Materiaal van de locatie zelf: niet mee te brengen. Eigen stoelen aan een tafel van het huis wel.
      const mb = it.velden?.meubel; const z = mb && !mb.stoel_huis ? zitMeubel(mb) : 0;
      if (z) { const r = perElement.get('vrij|meubel:stoel') || { naam: 'Stoel', categorie: 'Binnenruimte', leverancier: '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' }; r.aantal += z; perElement.set('vrij|meubel:stoel', r); }
      continue;
    }
    const m = maten(it, el);
    if (m.capaciteit) capaciteit += m.capaciteit;
    // Gele vlaggen op palen, hekeinden of punten (bv. een materiaalpost).
    { const nv = aantalVlaggen(it); if (nv) { const rv = perElement.get('vrij|gele-vlag') || { naam: 'Gele vlag (op paal)', categorie: 'Signalisatie', leverancier: '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' }; rv.aantal += nv; perElement.set('vrij|gele-vlag', rv); } }
    if (el) {
      if (isKabelcam(el)) {
        // Kabelcam: aan elk uiteinde een verreiker (nooit eigen masten).
        const vr = kabelcamInst(it, el).verreiker ? elementen.get(kabelcamInst(it, el).verreiker) : null;
        if (vr) { const sl = `kabelcam-vr:${vr.id}`; const r = perElement.get(sl) || { naam: `${vr.naam} (kabelcam)`, categorie: vr.categorie, leverancier: vr.leverancier || '', artikel_id: vr.artikel_id || null, aantal: 0, meter: 0, tekenwijze: 'punt' }; r.aantal += 2; perElement.set(sl, r); }
      }
      if (isVlagHek(el) && Array.isArray(it.velden?.vlaggen)) {
        // Beachvlaggen in de hekken: per ontwerp een vlagdoek, plus mast met Heras-klemmen.
        const ids = it.velden.vlaggen.slice(0, Math.max(0, (m.stuks || it.velden.vlaggen.length))).filter(Boolean);
        for (const id of ids) {
          const d = elementen.get(id);
          const sl = `paneel:${id}`;
          const r = perElement.get(sl) || { naam: `Vlagdoek · ${d ? d.naam : '?'}${d?.eigenschappen?.afmeting ? ` (${d.eigenschappen.afmeting})` : ''}`, categorie: 'Doeken en drukwerk', leverancier: '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
          r.aantal += 1; perElement.set(sl, r);
        }
        if (ids.length) {
          const r = perElement.get('vlagmast-heras') || { naam: 'Beachvlag-mast met Heras-klemmen', categorie: 'Doeken en drukwerk', leverancier: '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
          r.aantal += ids.length; perElement.set('vlagmast-heras', r);
        }
      }
      if (el.eigenschappen?.doek !== 'bedrukt' && isVlagHek(el) && Array.isArray(it.velden?.doeken) && it.velden.doeken.some(Boolean)) {
        // Sponsordoek over een gewoon of gezeild Heras: het hek blijft wat het is, de doeken komen er als regel bij.
        for (const id of it.velden.doeken.slice(0, m.stuks || it.velden.doeken.length).filter(Boolean)) {
          const d = elementen.get(id);
          const sl = `doek-los:${id}`;
          const r = perElement.get(sl) || { naam: `Doek · ${d ? d.naam : '?'}${d?.eigenschappen?.afmeting ? ` (${d.eigenschappen.afmeting})` : ''}`, categorie: 'Doeken en drukwerk', leverancier: '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
          r.aantal += 1; perElement.set(sl, r);
        }
      }
      if (el.eigenschappen?.doek === 'bedrukt' && Array.isArray(it.velden?.doeken) && it.velden.doeken.length && m.stuks) {
        // Per doek uit de doekenbibliotheek een eigen regel.
        const per = new Map();
        for (let i = 0; i < m.stuks; i++) { const id = it.velden.doeken[i] || ''; per.set(id, (per.get(id) || 0) + 1); }
        for (const [id, n] of per) {
          const d = id ? elementen.get(id) : null;
          const hk = herkomstVan(it, el, std);
          const sl = `${el.id}|doek:${id}|h:${hk}`;
          const r = perElement.get(sl) || { naam: `${el.naam} · ${d ? d.naam : 'zonder doek'}`, categorie: el.categorie, leverancier: hk, artikel_id: el.artikel_id || null, aantal: 0, meter: 0, tekenwijze: 'lijn' };
          r.aantal += n; r.meter += (m.lengte || 0) * (n / m.stuks);
          perElement.set(sl, r);
        }
        const tb0 = toebehorenTelling(it, el);
        for (const [k, n] of Object.entries(tb0 || {})) {
          const s2 = `${el.id}|tb|${k}`;
          const r2 = perElement.get(s2) || { naam: `${toebehorenNaam(el, k)} · ${el.naam}`, categorie: el.categorie, leverancier: el.leverancier || '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
          r2.aantal += n; perElement.set(s2, r2);
          if (toebehorenVan(el).find((x) => x.k === k)?.soort === 'driehoek') {
            // Elke steundriehoek: twee extra hekken.
            const s3 = `${el.id}|driehoek`;
            const r3 = perElement.get(s3) || { naam: `${el.naam} · in steundriehoeken`, categorie: el.categorie, leverancier: el.leverancier || '', artikel_id: el.artikel_id || null, aantal: 0, meter: 0, tekenwijze: 'punt' };
            r3.aantal += 2 * n; perElement.set(s3, r3);
          }
        }
        continue;
      }
      if (isWand(el)) {
        // B-matrix frame-wand: frames per maat, en per ontwerp een doek (voor- en achterkant apart geteld).
        const L = lengtesVanItem(it) || [];
        for (const [sl, n] of Object.entries(wandTelling(L, it, el))) {
          const [b, h] = sl.split('x').map(Number);
          const k = `wand:${sl}|h:${herkomstVan(it, el, std)}`;
          const r = perElement.get(k) || { naam: frameNaam(Math.min(b, h), Math.max(b, h), el), categorie: el.categorie, leverancier: herkomstVan(it, el, std), artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
          r.aantal += n; perElement.set(k, r);
        }
        for (const f of wandFrames(L, it, el)) for (const id of [f.voor, f.achter]) {
          if (!id) continue; const d = elementen.get(id);
          const k = `paneel:${id}`;
          const r = perElement.get(k) || { naam: `Frame-doek · ${d ? d.naam : '?'}${d?.eigenschappen?.afmeting ? ` (${d.eigenschappen.afmeting})` : ''}`, categorie: 'Doeken en drukwerk', leverancier: '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
          r.aantal += 1; perElement.set(k, r);
        }
        continue;
      }
      if (isTotem(el) || isVlag(el) || trussDoek(el)) {
        // Infototem, beachvlag en truss: elk ontwerp een eigen regel (de drager zelf telt hieronder gewoon mee).
        for (const id of (isTotem(el) || trussDoek(el) ? totemPanelen(it, el) : [it.velden?.ontwerp]).filter(Boolean)) {
          const d = elementen.get(id);
          const sl = `paneel:${id}`;
          const r = perElement.get(sl) || { naam: `${trussDoek(el) ? 'Truss-doek' : isTotem(el) ? 'Totempaneel' : 'Vlagdoek'} · ${d ? d.naam : '?'}${d?.eigenschappen?.afmeting ? ` (${d.eigenschappen.afmeting})` : ''}`, categorie: el.categorie, leverancier: '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
          r.aantal += 1; perElement.set(sl, r);
        }
      }
      if (heeftFracties(el)) {
        // Afval: per maat en per fractie een regel. Een afvaleiland telt als zijn losse containers.
        const doel = (el.eigenschappen.eiland_van && elementen.get(el.eigenschappen.eiland_van)) || el;
        for (const f of fractiesVan(it, el)) {
          const sl = `${doel.id}|fr:${f}`;
          const r = perElement.get(sl) || { naam: `${doel.naam} · ${fractieVan(f).naam}`, categorie: doel.categorie, leverancier: doel.leverancier || '', artikel_id: doel.artikel_id || null, aantal: 0, meter: 0, tekenwijze: doel.tekenwijze };
          r.aantal += 1;
          if (doel !== el) r.via = { ...(r.via || {}), [el.naam]: (r.via?.[el.naam] || 0) + 1 };
          perElement.set(sl, r);
        }
        continue;
      }
      const doekNaam = el.eigenschappen?.doek === 'bedrukt' ? (it.velden?.doek_naam || '').trim() : '';
      const hk = herkomstVan(it, el, std);
      const sleutel = `${el.id}|${it.velden?.variant || ''}${doekNaam ? `|doek:${doekNaam}` : ''}|h:${hk}`;
      const r = perElement.get(sleutel) || { naam: [el.naam, it.velden?.variant, doekNaam].filter(Boolean).join(' · '), categorie: el.categorie, leverancier: hk, artikel_id: el.artikel_id || null, aantal: 0, meter: 0, tekenwijze: el.tekenwijze };
      if (el.tekenwijze === 'lijn' && isStellingBouw(it)) {
        // Stellingconstructie: één regel per soort stelling (maat, dekhoogte), geen onderdelen. Die verschillen
        // per leverancier en per constructie; de leverancier rekent ze zelf uit.
        const om = stellingOmschrijving(it.velden.stelling);
        const s5 = `${el.id}|stelling|${om}|h:${hk}`;
        const r5 = perElement.get(s5) || { naam: om, categorie: el.categorie, leverancier: hk, artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
        r5.aantal += 1; perElement.set(s5, r5);
        continue;
      }
      if (el.tekenwijze === 'lijn' && isTrussBouw(it) && it.geometrie?.type === 'LineString') {
        // Vrij gebouwde truss: stukken per lengte, hoekstukken en baseplates.
        const st = trussStukken(naarMeterLijn(it.geometrie.coordinates).pts, it); const TY = trussTypeVoor(el, it.velden?.truss); const t = trussTelling(st, TY);
        r.kabels = r.kabels || {};
        for (const [l, k] of Object.entries(t.stukken)) { r.kabels[l] = (r.kabels[l] || 0) + k; r.aantal += k; }
        r.meter += st.reduce((a, x) => a + x.L, 0); perElement.set(sleutel, r);
        for (const [naam, k] of [...Object.entries(t.hoeken).map(([n, k2]) => [`${n} ${TY.kort}`, k2]), [`Baseplate ${TY.kort}`, t.voet]]) {
          if (!k) continue; const s4 = `${el.id}|x|${naam}`;
          const r4 = perElement.get(s4) || { naam, categorie: el.categorie, leverancier: el.leverancier || '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
          r4.aantal += k; perElement.set(s4, r4);
        }
        for (const d of it.velden.truss.doeken || []) for (const id of [d.voor, d.achter]) {
          if (!id) continue; const o = elementen.get(id); const k = `paneel:${id}`;
          const r6 = perElement.get(k) || { naam: `Truss-doek · ${o ? o.naam : '?'}`, categorie: 'Doeken en drukwerk', leverancier: '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
          r6.aantal += 1; perElement.set(k, r6);
        }
        continue;
      }
      // Dubbele poort: twee vleugels (elk een poort met een wiel).
      const n = el.tekenwijze === 'lijn' ? (m.stuks || 0) : el.eigenschappen?.inzet === 'poort' && it.parameters?.dubbel ? 2 : (m.stuks || 1);
      // Kabels: getekende lengte omzetten naar te huren lengtes (bv. 50/25/10/5 m), met wat speling.
      const kl = el.eigenschappen?.kabel_lengtes;
      const telStukken = !(Array.isArray(kl) && kl.length);
      if (el.tekenwijze === 'lijn') { if (telStukken) r.aantal += n; r.meter += m.lengte || 0; } else r.aantal += n;
      // Vakken met een ander element (bv. trap of helling in een stellingvloer): apart tellen.
      if (it.parameters?.vakken && el.eigenschappen?.module) {
        const per = new Map(); let weg = 0;
        for (const v of Object.values(it.parameters.vakken)) {
          if (typeof v === 'string') { per.set(v, (per.get(v) || 0) + 1); weg += 1; }
          else if (v?.id) { per.set(v.id, (per.get(v.id) || 0) + 1); weg += (v.w || 1) * (v.h || 1); }
        }
        r.aantal -= weg;
        for (const [id, k] of per) {
          const ov = elementen.get(id); if (!ov) continue;
          const s5 = `${ov.id}|h:${hk}`;
          const r5 = perElement.get(s5) || { naam: ov.naam, categorie: ov.categorie, leverancier: hk, artikel_id: ov.artikel_id || null, aantal: 0, meter: 0, tekenwijze: ov.tekenwijze };
          r5.aantal += k; perElement.set(s5, r5);
        }
      }
      if (el.tekenwijze === 'lijn' && Array.isArray(kl) && kl.length && m.lengte > 0) {
        const sp = 1 + (Number(el.eigenschappen.speling_pct ?? (el.eigenschappen.kabeltype ? 10 : 5)) || 0) / 100;
        // Truss: elk recht stuk apart (in een hoek komt een hoekstuk, de stukken lopen niet door).
        const c = it.geometrie?.coordinates || [];
        const stukken = el.eigenschappen.per_recht_stuk && c.length > 2
          ? c.slice(1).map((p, k) => lengte({ type: 'LineString', coordinates: [c[k], p] })) : [m.lengte];
        r.kabels = r.kabels || {};
        for (const L of stukken) {
          if (!(L > 0.05)) continue;
          const st = kabelStukken(L * sp - (el.eigenschappen.per_recht_stuk ? 0.03 : 0), kl);
          // Powerlock e.d.: per lengte een set losse aders (L1, L2, L3, N, PE).
          const ad = Math.max(1, Number(el.eigenschappen.aders) || 1); r.aders = ad;
          for (const [l, k] of Object.entries(st)) { r.kabels[l] = (r.kabels[l] || 0) + k * ad; r.aantal += k * ad; }
        }
      }
      // Hoekstukken en uiteinden (torens, voeten) van een truss.
      const extra = (naam, n) => {
        if (!n) return;
        const s4 = `${el.id}|x|${naam}`;
        const r4 = perElement.get(s4) || { naam, categorie: el.categorie, leverancier: el.leverancier || '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
        r4.aantal += n; perElement.set(s4, r4);
      };
      // Halve platen aan de rand (vloer in verband) apart, als het element er een naam voor heeft.
      if (el.eigenschappen?.halve_naam && m.halve > 0) { r.aantal -= m.halve; extra(el.eigenschappen.halve_naam, m.halve); }
      // Vloer in een tent: de vloerdelen apart.
      if (it.velden?.vloer && elementen.get(it.velden.vloer)) {
        const vEl = elementen.get(it.velden.vloer); const vi = tentVloerItem(it, vEl); const vm = vi ? modules(vi, vEl) : null;
        if (vm?.stuks) extra(`${vEl.naam} · vloer in tent`, vm.stuks);
      }
      // Rennersbrug: de stellingelementen waaruit ze bestaat.
      if (el.eigenschappen?.generator === 'rennersbrug') {
        const st = brugStukken(brugCfg(it.parameters));
        extra('Stellingvloer (element 1,04 × 2,07 m) · rennersbrug', st.vloer);
        extra('Hellingbaan (element 1,04 × 2,07 m) · rennersbrug', st.helling);
      }
      if (el.tekenwijze === 'lijn' && el.eigenschappen?.hoek_naam) extra(el.eigenschappen.hoek_naam, Math.max(0, (it.geometrie?.coordinates?.length || 0) - 2));
      // Paal en net: per lijn één paal meer dan er vakken zijn.
      if (el.tekenwijze === 'lijn' && el.eigenschappen?.paal_naam && m.stuks) {
        // Vakken met enkel een koord: geen net, wel palen; het koord apart in meter.
        const km = koordMaat(it, el);
        const palen = m.stuks + 1 - km.vakken + koordVan(it).size;
        if (km.vakken) { r.aantal -= km.vakken; r.meter -= km.meter; extra(`Koord tussen palen (m) · ${el.naam}`, Math.ceil(km.meter)); }
        extra(el.eigenschappen.paal_naam, palen);
      }
      if (el.tekenwijze === 'lijn' && el.eigenschappen?.einden_naam) {
        const mt = (el.eigenschappen.montages || []).find(([k]) => k === (it.velden?.montage || el.eigenschappen.montages?.[0]?.[0]));
        extra([el.eigenschappen.einden_naam, mt?.[1], it.velden?.variant].filter(Boolean).join(' · '), 2);
      }
      perElement.set(sleutel, r);
      // Samengestelde elementen: de onderdelen tellen mee bij hun eigen element.
      for (const o of el.eigenschappen?.onderdelen || []) {
        const deel = o.element_id ? elementen.get(o.element_id) : null;
        const hoeveel = n * (Number(o.aantal) || 1);
        if (!hoeveel || (!deel && !o.naam)) continue;
        const s3 = deel ? `${deel.id}|` : `vrij|${o.naam}`;
        const r3 = perElement.get(s3) || { naam: deel ? deel.naam : o.naam, categorie: deel ? deel.categorie : el.categorie, leverancier: deel?.leverancier || '', artikel_id: deel?.artikel_id || null, aantal: 0, meter: 0, tekenwijze: deel?.tekenwijze === 'lijn' ? 'punt' : (deel?.tekenwijze || 'punt') };
        r3.aantal += hoeveel;
        r3.via = { ...(r3.via || {}), [el.naam]: (r3.via?.[el.naam] || 0) + hoeveel };
        perElement.set(s3, r3);
      }
      // Inrichting van een unit (meubilair geteld, niet getekend).
      for (const [id, hoeveel] of Object.entries(it.velden?.inrichting || {})) {
        const deel = elementen.get(id);
        if (!deel || !(hoeveel > 0)) continue;
        const s5 = `${deel.id}|`;
        const r5 = perElement.get(s5) || { naam: deel.naam, categorie: deel.categorie, leverancier: deel.leverancier || '', artikel_id: deel.artikel_id || null, aantal: 0, meter: 0, tekenwijze: deel.tekenwijze === 'lijn' ? 'punt' : deel.tekenwijze };
        r5.aantal += hoeveel;
        r5.via = { ...(r5.via || {}), [el.naam]: (r5.via?.[el.naam] || 0) + hoeveel };
        perElement.set(s5, r5);
      }
      const tb = toebehorenTelling(it, el);
      for (const [k, n] of Object.entries(tb || {})) {
        const s2 = `${el.id}|tb|${k}`;
        const r2 = perElement.get(s2) || { naam: `${toebehorenNaam(el, k)} · ${el.naam}`, categorie: el.categorie, leverancier: el.leverancier || '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
        r2.aantal += n; perElement.set(s2, r2);
        if (toebehorenVan(el).find((x) => x.k === k)?.soort === 'driehoek') {
          // Elke steundriehoek: twee extra hekken.
          const s3 = `${el.id}|driehoek`;
          const r3 = perElement.get(s3) || { naam: `${el.naam} · in steundriehoeken`, categorie: el.categorie, leverancier: el.leverancier || '', artikel_id: el.artikel_id || null, aantal: 0, meter: 0, tekenwijze: 'punt' };
          r3.aantal += 2 * n; perElement.set(s3, r3);
        }
      }
    } else if (it.velden?.verkeer?.soort === 'afsluiting' && m.lengte > 0) {
      // Afsluiting (verkeer): nadars van 2,5 m, plus het C3-bord.
      const r = perElement.get('vrij|nadar') || { naam: 'Nadar 2,5 m (afsluiting)', categorie: 'Verkeer', leverancier: '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
      r.aantal += Math.ceil(m.lengte / 2.5); r.meter += m.lengte; perElement.set('vrij|nadar', r);
      const c = perElement.get('vrij|c3') || { naam: 'Bord C3 (afsluiting)', categorie: 'Verkeer', leverancier: '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
      c.aantal += 1; perElement.set('vrij|c3', c);
    } else if (it.velden?.punt && PUNT[it.velden.punt.type] && it.velden.punt.type !== 'punt' && PUNT[it.velden.punt.type].materiaal !== false) {
      // Punten in het binnenplan met een soort (stekkerblok, netwerk, brandblusser…) tellen als materiaal.
      const t = PUNT[it.velden.punt.type]; const sl = `vrij|punt:${t.k}`;
      const r = perElement.get(sl) || { naam: t.naam, categorie: t.k === 'brand' || t.k === 'ehbo' ? 'Veiligheid' : t.k === 'data' ? 'Data en telecom' : 'Elektriciteit', leverancier: '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' };
      r.aantal += 1; perElement.set(sl, r);
    } else if (it.velden?.meubel) {
      // Eigen of gehuurd meubilair uit het binnenplan (niet van het huis): tafels, stoelen, podium…
      const mb = it.velden.meubel; const z = zitMeubel(mb);
      const tel = (sl, naam, n) => { if (!n) return; const r = perElement.get(sl) || { naam, categorie: 'Binnenruimte', leverancier: '', artikel_id: null, aantal: 0, meter: 0, tekenwijze: 'punt' }; r.aantal += n; perElement.set(sl, r); };
      if (mb.type !== 'stoel' && mb.type !== 'rijen') { const nm = naamMeubel({ ...mb, stoelen: {} }); tel(`vrij|meubel:${nm}`, nm, 1); }
      if (mb.type === 'rijen' && mb.tafels) tel('vrij|meubel:klastafel', 'Klastafel', mb.rijen * Math.max(1, Math.ceil(mb.per_rij / (mb.gang_na || mb.per_rij))));
      if (!mb.stoel_huis) tel('vrij|meubel:stoel', 'Stoel', z);
    } else if (it.soort !== 'tekst') {
      const laag = lagen.get(it.laag_id)?.naam || 'Zonder laag';
      const r = vrij.get(laag) || { laag, lijnen: 0, meter: 0, vlakken: 0, m2: 0, punten: 0 };
      if (it.geometrie?.type === 'LineString') { r.lijnen += 1; r.meter += m.lengte || 0; }
      else if (it.geometrie?.type === 'Polygon') { r.vlakken += 1; r.m2 += m.oppervlakte || 0; }
      else r.punten += 1;
      vrij.set(laag, r);
    }
  }
  const elementenLijst = [...perElement.values()].sort((a, b) => vergelijkCategorie(a.categorie, b.categorie) || a.naam.localeCompare(b.naam, 'nl', { numeric: true }));
  return { elementen: elementenLijst, vrij: [...vrij.values()], capaciteit };
}

// Stukken per standaardlengte: dezelfde afrondregel als de kabellijst van de stroomplanning (stroom.js),
// zodat stuklijst en kabellijst gelijk tellen.
export { kabelStukken };

export function stuklijstCsv(s) {
  const r = [['Categorie', 'Element', 'Leverancier', 'Aantal', 'Meter'].join(';')];
  for (const e of s.elementen) r.push([e.categorie, e.naam, e.leverancier, e.aantal, e.tekenwijze === 'lijn' ? getal(e.meter) : ''].join(';'));
  return '﻿' + r.join('\n');
}

// Leverlijst per leverancier: wat, waar, wanneer plaatsen en ophalen.
export function leverlijstCsv(items, elementen, lagen, fasen, leverancier, std = null) {
  return '\ufeff' + leverlijstRijen(items, elementen, lagen, fasen, leverancier, std).map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}
// Zelfde lijst als rijen (getallen als getal), voor Excel en PDF.
export function leverlijstRijen(items, elementen, lagen, fasen, leverancier, std = null) {
  const r = [['Element', 'Naam', 'Laag', 'Fasen', 'Aantal', 'Meter', 'Plaatsen', 'Weghalen', 'Breedtegraad', 'Lengtegraad', 'Google Maps', 'Notitie']];
  for (const it of items) {
    const el = it.element_id ? elementen.get(it.element_id) : null;
    if (!el || herkomstVan(it, el, std) !== leverancier || el.eigenschappen?.huis) continue;
    const m = maten(it, el);
    const p = middelpunt(it.geometrie) || [];
    const v = it.velden || {};
    r.push([el.naam, it.naam || '', lagen.get(it.laag_id)?.naam || '', (it.fase_ids || []).map((f) => fasen.find((x) => x.id === f)?.naam).filter(Boolean).join(', '),
      el.tekenwijze === 'lijn' ? m.stuks ?? '' : m.stuks || 1, el.tekenwijze === 'lijn' ? rond(m.lengte || 0, 1) : '', v.opbouw || '', v.afbraak || '',
      p[1] ? Number(p[1].toFixed(6)) : '', p[0] ? Number(p[0].toFixed(6)) : '', p[1] ? `https://www.google.com/maps?q=${p[1].toFixed(6)},${p[0].toFixed(6)}` : '', (it.notitie || '').replace(/\n/g, ' ')]);
  }
  return r;
}
// Stuklijst als rijen: kop + per regel categorie, element, leverancier, aantal, meter.
export function stuklijstRijen(s, metLev = true) {
  const r = [metLev ? ['Categorie', 'Element', 'Leverancier', 'Aantal', 'Meter'] : ['Categorie', 'Element', 'Aantal', 'Meter']];
  for (const e of s.elementen) { const m = e.tekenwijze === 'lijn' && e.meter ? rond(e.meter, 1) : ''; r.push(metLev ? [e.categorie || '', e.naam, e.leverancier || '', e.aantal, m] : [e.categorie || '', e.naam, e.aantal, m]); }
  return r;
}

export default function Stuklijst({ items: alleItems, elementen, lagen, actieveFase, fasen, groepen = {}, herkomst = null, onHerkomst = () => {}, std = null, onMateriaal = null }) {
  // Groepen (bv. een rennersbrug of een geïmporteerd podium): stuklijst per groep.
  const [groep, setGroep] = useState('');
  const groepLijst = useMemo(() => {
    const m = new Map();
    for (const it of alleItems) if (it.groep_id && !it.verborgen) m.set(it.groep_id, (m.get(it.groep_id) || 0) + 1);
    let n = 0;
    return [...m].map(([id, aantal]) => ({ id, aantal, naam: groepen[id]?.naam || `Groep ${++n}` })).sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { numeric: true }));
  }, [alleItems, groepen]);
  // Binnenplannen: per gebouw, per verdieping (keuze "binnen:host" of "binnen:host:verd").
  const binnenLijst = useMemo(() => {
    const uit = [];
    for (const h of alleItems) {
      const n = alleItems.filter((x) => x.velden?.binnen?.host === h.id).length;
      if (!n) continue;
      const el = h.element_id ? elementen.get(h.element_id) : null;
      const naam = h.naam || el?.naam || 'Gebouw';
      const vs = h.velden?.binnenplan?.verdiepingen?.length ? h.velden.binnenplan.verdiepingen : [{ id: 'g', naam: 'Gelijkvloers' }];
      uit.push({ id: `binnen:${h.id}`, naam: `${naam} (binnenplan)`, aantal: n, host: h });
      if (vs.length > 1) for (const v of vs) { const k = alleItems.filter((x) => x.velden?.binnen?.host === h.id && (x.velden.binnen.verd || 'g') === v.id).length; if (k) uit.push({ id: `binnen:${h.id}:${v.id}`, naam: `${naam} › ${v.naam}`, aantal: k, host: h }); }
    }
    return uit;
  }, [alleItems, elementen]);
  const binnenKeuze = groep.startsWith('binnen:') ? groep.split(':') : null;
  const items = binnenKeuze
    ? alleItems.filter((x) => x.velden?.binnen?.host === binnenKeuze[1] && (!binnenKeuze[2] || (x.velden.binnen.verd || 'g') === binnenKeuze[2]))
    : groep ? alleItems.filter((x) => x.groep_id === groep) : alleItems;
  // Per ruimte (vlakken met "Dit is een ruimte"): welke elementen staan erin.
  const perRuimte = useMemo(() => {
    if (!binnenKeuze) return [];
    const ruimtes = items.filter((x) => x.velden?.ruimte && x.geometrie?.type === 'Polygon');
    const uit = ruimtes.map((r) => ({ r, tel: new Map() }));
    const rest = new Map();
    for (const it of items) {
      if (!it.element_id || it.velden?.ruimte) continue;
      const g = it.geometrie; if (!g) continue;
      const c = it.parameters?.midden || (g.type === 'Point' ? g.coordinates : middelpunt(g));
      const hit = uit.find((u) => { try { return turf.booleanPointInPolygon(turf.point(c), u.r.geometrie); } catch { return false; } });
      const naam = elementen.get(it.element_id)?.naam || '?';
      const m = hit ? hit.tel : rest; m.set(naam, (m.get(naam) || 0) + 1);
    }
    return [...uit.map((u) => ({ naam: u.r.naam || 'Ruimte zonder naam', tel: u.tel })), ...(rest.size && uit.length ? [{ naam: 'Buiten een ruimte', tel: rest }] : [])].filter((x) => x.tel.size);
  }, [items, binnenKeuze?.join(':'), elementen]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = berekenStuklijst(items, elementen, lagen, actieveFase, std);
  const fase = fasen.find((f) => f.id === actieveFase);
  const download = () => {
    const blob = new Blob([stuklijstCsv(s)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stuklijst${groep ? ` ${groepLijst.find((g) => g.id === groep)?.naam || ''}` : ''}.csv`.replace(/[\\/:*?"<>|]/g, '');
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const leveranciers = [...new Set(s.elementen.map((e) => e.leverancier).filter(Boolean))].sort();
  // Voorraad ter plaatse (bv. tafels van de locatie): bij het element in de bibliotheek.
  const voorraad = useMemo(() => { const m = new Map(); for (const el of elementen.values()) { const v = Number(el.eigenschappen?.voorraad); if (v >= 0 && el.eigenschappen?.voorraad != null) m.set(el.naam, v); } return m; }, [elementen]);
  const [stock, setStock] = useState({});
  const artikelIds = [...new Set(s.elementen.map((e) => e.artikel_id).filter(Boolean))].join(',');
  useEffect(() => {
    if (!artikelIds || !heeftKoppeling('stock')) return;
    sb().schema('logistiek').from('artikels').select('id, aantal_totaal').in('id', artikelIds.split(','))
      .then(({ data }) => setStock(Object.fromEntries((data || []).map((a) => [a.id, a.aantal_totaal]))));
  }, [artikelIds]);
  const leverDownload = (l) => {
    const blob = new Blob([leverlijstCsv(items, elementen, lagen, fasen, l, std)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leverlijst ${l}.csv`.replace(/[\\/:*?"<>|]/g, '');
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <div>
      <div className="fm-sectie">
        <div className="fm-kop">Stuklijst{fase ? ` · ${fase.naam}` : ' · alle fasen'}</div>
        {onMateriaal && <button className="fm-knop zwart vol" onClick={onMateriaal}>Materiaal per leverancier openen</button>}
        {(groepLijst.length > 0 || binnenLijst.length > 0) && (
          <select aria-label="Groep of binnenplan" value={groep} onChange={(e) => setGroep(e.target.value)} style={{ height: 28, fontSize: 12 }}>
            <option value="">Heel het plan</option>
            {binnenLijst.length > 0 && <optgroup label="Binnenplannen">{binnenLijst.map((g) => <option key={g.id} value={g.id}>{g.naam} · {g.aantal} items</option>)}</optgroup>}
            {groepLijst.length > 0 && <optgroup label="Groepen">{groepLijst.map((g) => <option key={g.id} value={g.id}>{g.naam} · {g.aantal} items</option>)}</optgroup>}
          </select>
        )}
        {leveranciers.length > 1 && (
          <select aria-label="Geleverd door" value={herkomst || ''} onChange={(e) => onHerkomst(e.target.value || null)} style={{ height: 28, fontSize: 12 }} title="Filtert de stuklijst en toont op de kaart enkel deze items scherp">
            <option value="">Alle leveranciers</option>
            {leveranciers.map((l) => <option key={l} value={l}>Geleverd door {l}</option>)}
          </select>
        )}
        {!s.elementen.length && <div className="fm-sub">Nog geen bibliotheek-elementen in dit plan.</div>}
        {s.elementen.length > 0 && (
          <table className="fm-tabel">
            <thead><tr><th>Element</th><th style={{ textAlign: 'right' }}>Aantal</th></tr></thead>
            <tbody>
              {s.elementen.filter((e) => !herkomst || e.leverancier === herkomst).map((e) => (
                <tr key={`${e.naam}|${e.leverancier}`}><td>{e.naam}{e.leverancier && !herkomst && <span className="fm-sub"> · {e.leverancier}</span>}{e.tekenwijze === 'lijn' && <div className="fm-sub">{getal(e.meter)} m{e.kabels ? ` · huren: ${Object.entries(e.kabels).sort((a, b) => b[0] - a[0]).map(([l, k]) => `${k} × ${l} m`).join(' + ')}${e.aders > 1 ? ` (${e.aders} aders per verbinding: ${POWERLOCK_ADERS})` : ''}` : ''}</div>}{e.via && <div className="fm-sub">waarvan {Object.entries(e.via).map(([k, v]) => `${v} in ${k}`).join(', ')}</div>}{(() => { const vr = voorraad.get(e.naam); if (vr == null) return null; const tekort = e.aantal - vr; return <div className="fm-sub" style={{ color: tekort > 0 ? '#B91C1C' : undefined }}>{vr} ter plaatse{tekort > 0 ? ` · ${tekort} aan te vullen` : ' · genoeg'}</div>; })()}{e.artikel_id && stock[e.artikel_id] != null && <div className="fm-sub" style={{ color: stock[e.artikel_id] < e.aantal ? '#B91C1C' : undefined }}>{stock[e.artikel_id]} in stock{stock[e.artikel_id] < e.aantal ? ` · ${e.aantal - stock[e.artikel_id]} te kort` : ''}</div>}</td><td className="getal">{e.aantal || (e.tekenwijze === 'lijn' ? '' : 0)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {s.capaciteit > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Capaciteit vlakken</span><strong>{s.capaciteit.toLocaleString('nl-BE')} p</strong></div>}
        {s.elementen.length > 0 && <button className="fm-knop klein" onClick={download}>Als CSV (Excel)</button>}
      </div>
      {perRuimte.length > 0 && (
        <div className="fm-sectie">
          <div className="fm-kop">Per ruimte<Info>Ruimtes zijn vlakken in het binnenplan met "Dit is een ruimte" aangevinkt.</Info></div>
          {perRuimte.map((r) => (
            <div key={r.naam} style={{ fontSize: 12 }}><b>{r.naam}</b>: {[...r.tel].map(([n, k]) => `${k} × ${n}`).join(', ')}</div>
          ))}
        </div>
      )}
      {leveranciers.length > 0 && (
        <div className="fm-sectie">
          <div className="fm-kop">Per leverancier<Info>Leverlijst: wat, waar (coördinaten en kaartlink) en wanneer plaatsen en weghalen.</Info></div>
          {leveranciers.map((l) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>{l} · {s.elementen.filter((e) => e.leverancier === l).reduce((t, e) => t + e.aantal, 0)} st.</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button className={`fm-knop klein ${herkomst === l ? 'zwart' : ''}`} aria-pressed={herkomst === l} title="Enkel deze items scherp op de kaart" onClick={() => onHerkomst(herkomst === l ? null : l)}>{herkomst === l ? 'Getoond' : 'Op kaart'}</button>
                <button className="fm-knop klein" onClick={() => leverDownload(l)}>Leverlijst</button>
              </span>
            </div>
          ))}
        </div>
      )}
      {s.vrij.length > 0 && (
        <div className="fm-sectie">
          <div className="fm-kop">Vrij getekend</div>
          <table className="fm-tabel">
            <tbody>
              {s.vrij.map((v) => (
                <tr key={v.laag}><td>{v.laag}</td><td className="getal">{[v.lijnen ? `${getal(v.meter)} m` : '', v.vlakken ? `${getal(v.m2, 0)} m²` : '', v.punten ? `${v.punten} pt` : ''].filter(Boolean).join(' · ')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
