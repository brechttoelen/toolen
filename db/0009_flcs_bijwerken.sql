-- ============================================================================
-- 0009 · FLCS bijwerken: de laatste stand uit FLCS Maps ophalen zonder Toolen te wissen
-- ============================================================================
-- maps.flcs_bijwerken() haalt per plan de laatste stand uit FLCS (schema flcsmaps in het
-- Publitool-project). Wat in Toolen werd gemaakt, blijft staan: ontvangers en deellinks,
-- events, versies, nieuwe plannen en opmerkingen.
--
-- Per plan, met een vingerafdruk van het plan, zijn lagen, fasen en items:
--   nieuw          plan bestaat nog niet in Toolen: alles wordt overgenomen
--   bijgewerkt     gewijzigd in FLCS, niet in Toolen: FLCS wint
--   ongewijzigd    niets veranderd in FLCS (wijzigingen in Toolen blijven)
--   conflict       gewijzigd in FLCS én in Toolen: overgeslagen, tenzij flcs_bijwerken(true)
--   weg in FLCS    plan bestaat niet meer in FLCS: blijft in Toolen
-- Bijwerken = de rijen van FLCS overnemen (zelfde id's), wat in FLCS weg is ook in Toolen
-- weghalen (items, lagen, fasen). Opmerkingen bij items blijven, want items houden hun id.
-- Bibliotheek, leveranciers en vaste aansluitingen: het recentst gewijzigde wint.
--
-- Draaien: db/flcs_bijwerken.sql (verbinding maken, deze functie aanroepen, verbinding weg).
-- De eerste keer werkt ze ook als volledige import (alle plannen zijn dan nieuw).
-- ============================================================================

create table if not exists maps.import_stand (
  plan_id       uuid primary key references maps.plannen(id) on delete cascade,
  bron          text not null default 'flcs',
  bron_vinger   text not null,
  toolen_vinger text not null,
  op            timestamptz not null default now()
);
alter table maps.import_stand enable row level security;
drop policy if exists platform on maps.import_stand;
create policy platform on maps.import_stand for select to authenticated using (maps.is_platformbeheerder());
grant select on maps.import_stand to authenticated;

-- Lijst van de bestanden die nog gekopieerd moeten worden (beheerpagina /maps/beheer/import).
create table if not exists maps.import_bestanden (
  naam          text primary key,
  bron          text not null default 'flcs',
  gekopieerd_op timestamptz,
  fout          text
);
alter table maps.import_bestanden enable row level security;
drop policy if exists platform on maps.import_bestanden;
create policy platform on maps.import_bestanden for all to authenticated
  using (maps.is_platformbeheerder()) with check (maps.is_platformbeheerder());
grant select, update on maps.import_bestanden to authenticated;

-- Vingerafdruk van een plan in Toolen (dezelfde formule als voor FLCS in flcs_bijwerken).
create or replace function maps.plan_vinger(p uuid) returns text
language sql stable security definer set search_path = '' as $$
  select md5(concat_ws('|',
    (select concat(pl.rev, '/', pl.verwijderd_op) from maps.plannen pl where pl.id = p),
    (select string_agg(l.id || ':' || l.rev, ',' order by l.id) from maps.lagen l where l.plan_id = p),
    (select string_agg(md5(concat_ws(';', f.id, f.naam, f.van, f.tot, f.volgorde)), ',' order by f.id) from maps.fasen f where f.plan_id = p),
    (select string_agg(i.id || ':' || i.rev, ',' order by i.id) from maps.items i where i.plan_id = p)));
$$;
revoke execute on function maps.plan_vinger(uuid) from public, anon, authenticated;

create or replace function maps.flcs_bijwerken(p_flcs_wint boolean default false)
returns table (wat text, plan text, stand text)
language plpgsql security definer set search_path = 'maps', 'public' as $$
declare
  v_org uuid;
  r record;
  v_tv text;
  v_brecht uuid;
begin
  if to_regclass('flcs_bron.plannen') is null then
    raise exception 'Geen verbinding met FLCS: draai db/flcs_bijwerken.sql (dat maakt eerst de verbinding).';
  end if;
  select id into v_org from maps.organisaties where slug = 'flcs';
  if v_org is null then raise exception 'Organisatie flcs bestaat niet.'; end if;

  -- Gebruikers FLCS → Toolen op e-mailadres; beide accounts van Brecht naar zijn Toolen-account.
  drop table if exists pg_temp.bw_wie, pg_temp.bw_plannen, pg_temp.bw_lagen, pg_temp.bw_fasen, pg_temp.bw_items, pg_temp.bw_plan, pg_temp.bw_doe;
  create temp table bw_wie (oud uuid primary key, nieuw uuid) on commit drop;
  insert into bw_wie select t.user_id, u.id from flcs_bron.toegang t join auth.users u on lower(u.email) = lower(t.email) on conflict do nothing;
  select id into v_brecht from auth.users where lower(email) = 'brecht.toelen@start-box.be';
  if v_brecht is not null then
    insert into bw_wie select t.user_id, v_brecht from flcs_bron.toegang t
     where lower(t.email) in ('brecht.toelen@flandersclassics.be', 'brecht.toelen@start-box.be')
    on conflict (oud) do update set nieuw = excluded.nieuw;
  end if;

  -- Bronrijen één keer ophalen (lokale kopie: sneller dan steeds over de verbinding).
  create temp table bw_plannen on commit drop as select * from flcs_bron.plannen;
  create temp table bw_lagen on commit drop as select * from flcs_bron.lagen;
  create temp table bw_fasen on commit drop as select * from flcs_bron.fasen;
  create temp table bw_items on commit drop as select * from flcs_bron.items;

  -- Wat er per plan moet gebeuren.
  create temp table bw_plan (id uuid primary key, naam text, fv text, tv text, st_bron text, st_toolen text, actie text) on commit drop;
  insert into bw_plan (id, naam, fv)
  select p.id, p.naam, md5(concat_ws('|',
    concat(p.rev, '/', p.verwijderd_op),
    (select string_agg(l.id || ':' || l.rev, ',' order by l.id) from bw_lagen l where l.plan_id = p.id),
    (select string_agg(md5(concat_ws(';', f.id, f.naam, f.van, f.tot, f.volgorde)), ',' order by f.id) from bw_fasen f where f.plan_id = p.id),
    (select string_agg(i.id || ':' || i.rev, ',' order by i.id) from bw_items i where i.plan_id = p.id)))
  from bw_plannen p;
  update bw_plan b set tv = case when exists (select 1 from maps.plannen x where x.id = b.id) then maps.plan_vinger(b.id) end,
                       st_bron = s.bron_vinger, st_toolen = s.toolen_vinger
    from (select b2.id, s0.bron_vinger, s0.toolen_vinger from bw_plan b2 left join maps.import_stand s0 on s0.plan_id = b2.id) s
   where s.id = b.id;
  update bw_plan set actie = case
      when tv is null then 'nieuw'
      when exists (select 1 from maps.plannen x where x.id = bw_plan.id and x.organisatie_id <> v_org) then 'andere organisatie'
      when tv = fv then 'ongewijzigd'
      when st_bron is not null and fv = st_bron then 'ongewijzigd'
      when (st_toolen is null or tv <> st_toolen) and not p_flcs_wint then 'conflict'
      else 'bijgewerkt' end;
  create temp table bw_doe on commit drop as select id from bw_plan where actie in ('nieuw', 'bijgewerkt');

  -- Triggers uit (organisatie, rev, logboek, nummering, prullenbak en modulebewaking worden overgenomen).
  alter table maps.plekken disable trigger user;
  alter table maps.plannen disable trigger user;
  alter table maps.bibliotheek disable trigger user;
  alter table maps.lagen disable trigger user;
  alter table maps.fasen disable trigger user;
  alter table maps.items disable trigger user;
  alter table maps.items_prullenbak disable trigger user;
  alter table maps.versies disable trigger user;
  alter table maps.deel_links disable trigger user;
  alter table maps.opmerkingen disable trigger user;
  alter table maps.bestanden disable trigger user;
  alter table maps.leveranciers disable trigger user;
  alter table maps.vaste_aansluitingen disable trigger user;
  alter table maps.feedback disable trigger user;

  insert into maps.plekken (organisatie_id, id, naam, kader, contacten, created_at)
  select v_org, id, naam, kader, contacten, created_at from flcs_bron.plekken
  on conflict (id) do nothing;

  -- Plannen: nieuw of bijgewerkt. Event en eigen instellingen van Toolen blijven.
  insert into maps.plannen (organisatie_id, id, naam, editie_naam, edition_id, plek_id, locatie, centrum, zoom, basiskaart, status, versie,
                            titelblok, instellingen, aangemaakt_door, bewerkt_door, created_at, updated_at, rev, verwijderd_op, verwijderd_door)
  select v_org, p.id, p.naam, p.editie_naam, p.edition_id, p.plek_id, p.locatie, p.centrum, p.zoom, p.basiskaart, p.status, p.versie,
         maps.flcs_url(p.titelblok), maps.flcs_url(p.instellingen), maps.flcs_wie(p.aangemaakt_door), maps.flcs_wie(p.bewerkt_door),
         p.created_at, p.updated_at, p.rev, p.verwijderd_op, maps.flcs_wie(p.verwijderd_door)
    from bw_plannen p where p.id in (select id from bw_doe)
  on conflict (id) do update set naam = excluded.naam, editie_naam = excluded.editie_naam, edition_id = excluded.edition_id, plek_id = excluded.plek_id,
    locatie = excluded.locatie, centrum = excluded.centrum, zoom = excluded.zoom, basiskaart = excluded.basiskaart, status = excluded.status,
    versie = excluded.versie, titelblok = excluded.titelblok, instellingen = coalesce(maps.plannen.instellingen, '{}'::jsonb) || coalesce(excluded.instellingen, '{}'::jsonb),
    bewerkt_door = excluded.bewerkt_door, updated_at = excluded.updated_at, rev = excluded.rev,
    verwijderd_op = excluded.verwijderd_op, verwijderd_door = excluded.verwijderd_door;

  -- Bibliotheek: nieuw, of de FLCS-versie als die recenter is.
  insert into maps.bibliotheek (organisatie_id, id, naam, categorie, tekenwijze, breedte_m, diepte_m, eenheid_m, hoogte_m, omtrek, stijl, icoon,
                                standaardlaag, leverancier, leverancier_id, artikel_id, eigenschappen, varianten, actief, created_at, updated_at,
                                plan_id, rev, familie)
  select v_org, b.id, b.naam, b.categorie, b.tekenwijze, b.breedte_m, b.diepte_m, b.eenheid_m, b.hoogte_m, b.omtrek, b.stijl, b.icoon,
         b.standaardlaag, b.leverancier, b.leverancier_id, b.artikel_id, maps.flcs_url(b.eigenschappen), b.varianten, b.actief, b.created_at, b.updated_at,
         b.plan_id, b.rev, b.familie
    from flcs_bron.bibliotheek b
   where b.plan_id is null or exists (select 1 from maps.plannen x where x.id = b.plan_id)
  on conflict (id) do update set naam = excluded.naam, categorie = excluded.categorie, tekenwijze = excluded.tekenwijze, breedte_m = excluded.breedte_m,
    diepte_m = excluded.diepte_m, eenheid_m = excluded.eenheid_m, hoogte_m = excluded.hoogte_m, omtrek = excluded.omtrek, stijl = excluded.stijl,
    icoon = excluded.icoon, standaardlaag = excluded.standaardlaag, leverancier = excluded.leverancier, leverancier_id = excluded.leverancier_id,
    artikel_id = excluded.artikel_id, eigenschappen = excluded.eigenschappen, varianten = excluded.varianten, actief = excluded.actief,
    updated_at = excluded.updated_at, plan_id = excluded.plan_id, rev = excluded.rev, familie = excluded.familie
   where maps.bibliotheek.updated_at < excluded.updated_at;

  -- Inhoud van de plannen: lagen en fasen eerst, dan items; wat in FLCS weg is, ook hier weg.
  insert into maps.lagen (organisatie_id, id, plan_id, naam, kleur, stijl, zichtbaar, vergrendeld, printbaar, volgorde, rev, updated_at, map)
  select v_org, id, plan_id, naam, kleur, stijl, zichtbaar, vergrendeld, printbaar, volgorde, rev, updated_at, map
    from bw_lagen where plan_id in (select id from bw_doe)
  on conflict (id) do update set naam = excluded.naam, kleur = excluded.kleur, stijl = excluded.stijl, zichtbaar = excluded.zichtbaar,
    vergrendeld = excluded.vergrendeld, printbaar = excluded.printbaar, volgorde = excluded.volgorde, rev = excluded.rev,
    updated_at = excluded.updated_at, map = excluded.map;
  insert into maps.fasen (organisatie_id, id, plan_id, naam, van, tot, volgorde)
  select v_org, id, plan_id, naam, van, tot, volgorde from bw_fasen where plan_id in (select id from bw_doe)
  on conflict (id) do update set naam = excluded.naam, van = excluded.van, tot = excluded.tot, volgorde = excluded.volgorde;

  delete from maps.items i where i.plan_id in (select id from bw_doe) and not exists (select 1 from bw_items b where b.id = i.id);
  insert into maps.items (organisatie_id, id, plan_id, plek_id, laag_id, element_id, groep_id, soort, geometrie, parameters, stijl, naam, notitie,
                          velden, fase_ids, vergrendeld, verborgen, volgorde, geplaatst_op, geplaatst_door, bewerkt_door, created_at, updated_at, rev)
  select v_org, id, plan_id, plek_id, laag_id, element_id, groep_id, soort, geometrie, parameters, stijl, naam, notitie,
         maps.flcs_url(velden), fase_ids, vergrendeld, verborgen, volgorde, geplaatst_op, maps.flcs_wie(geplaatst_door), maps.flcs_wie(bewerkt_door),
         created_at, updated_at, rev
    from bw_items where plan_id in (select id from bw_doe)
  on conflict (id) do update set plan_id = excluded.plan_id, plek_id = excluded.plek_id, laag_id = excluded.laag_id, element_id = excluded.element_id,
    groep_id = excluded.groep_id, soort = excluded.soort, geometrie = excluded.geometrie, parameters = excluded.parameters, stijl = excluded.stijl,
    naam = excluded.naam, notitie = excluded.notitie, velden = excluded.velden, fase_ids = excluded.fase_ids, vergrendeld = excluded.vergrendeld,
    verborgen = excluded.verborgen, volgorde = excluded.volgorde, geplaatst_op = excluded.geplaatst_op, geplaatst_door = excluded.geplaatst_door,
    bewerkt_door = excluded.bewerkt_door, updated_at = excluded.updated_at, rev = excluded.rev;
  delete from maps.lagen l where l.plan_id in (select id from bw_doe) and not exists (select 1 from bw_lagen b where b.id = l.id);
  delete from maps.fasen f where f.plan_id in (select id from bw_doe) and not exists (select 1 from bw_fasen b where b.id = f.id);

  delete from maps.items_prullenbak where plan_id in (select id from bw_doe);
  insert into maps.items_prullenbak (organisatie_id, id, plan_id, plek_id, laag_id, element_id, groep_id, soort, geometrie, parameters, stijl, naam,
                                     notitie, velden, fase_ids, vergrendeld, verborgen, volgorde, geplaatst_op, geplaatst_door, bewerkt_door,
                                     created_at, updated_at, rev, verwijderd_op, verwijderd_door, teruggezet_op)
  select v_org, id, plan_id, plek_id, laag_id, element_id, groep_id, soort, geometrie, parameters, stijl, naam,
         notitie, maps.flcs_url(velden), fase_ids, vergrendeld, verborgen, volgorde, geplaatst_op, maps.flcs_wie(geplaatst_door), maps.flcs_wie(bewerkt_door),
         created_at, updated_at, rev, verwijderd_op, maps.flcs_wie(verwijderd_door), teruggezet_op
    from flcs_bron.items_prullenbak where plan_id in (select id from bw_doe)
  on conflict do nothing;

  -- Versies, deellinks, opmerkingen en bestanden van FLCS: erbij of bijwerken. Wat Toolen zelf maakte, blijft.
  insert into maps.versies (organisatie_id, id, plan_id, versie, momentopname, opmerking, door, created_at)
  select v_org, id, plan_id, versie, maps.flcs_url(momentopname), opmerking, maps.flcs_wie(door), created_at
    from flcs_bron.versies where plan_id in (select id from bw_doe)
  on conflict (id) do nothing;
  insert into maps.deel_links (organisatie_id, id, plan_id, token, naam, laag_ids, fase_ids, opties, geldig_tot, ingetrokken_op, keer_geopend,
                               created_at, live, versie_id)
  select v_org, d.id, d.plan_id, d.token, d.naam, d.laag_ids, d.fase_ids, d.opties, d.geldig_tot, d.ingetrokken_op, d.keer_geopend,
         d.created_at, d.live, case when exists (select 1 from maps.versies v where v.id = d.versie_id) then d.versie_id end
    from flcs_bron.deel_links d where d.plan_id in (select id from bw_doe)
  on conflict (id) do update set naam = excluded.naam, laag_ids = excluded.laag_ids, fase_ids = excluded.fase_ids,
    opties = excluded.opties || jsonb_strip_nulls(jsonb_build_object('onderdelen', maps.deel_links.opties->'onderdelen', 'ontvanger', maps.deel_links.opties->'ontvanger',
                                                                     'laatste_pdf', maps.deel_links.opties->'laatste_pdf', 'vorige_pdf', maps.deel_links.opties->'vorige_pdf')),
    geldig_tot = excluded.geldig_tot, ingetrokken_op = excluded.ingetrokken_op, keer_geopend = greatest(maps.deel_links.keer_geopend, excluded.keer_geopend),
    live = excluded.live, versie_id = excluded.versie_id;
  insert into maps.opmerkingen (organisatie_id, id, item_id, auteur_id, auteur_naam, deel_link_id, tekst, status, created_at, plan_id, punt)
  select v_org, o.id, o.item_id, maps.flcs_wie(o.auteur_id), o.auteur_naam, o.deel_link_id, o.tekst, o.status, o.created_at, o.plan_id, o.punt
    from flcs_bron.opmerkingen o
   where (o.plan_id in (select id from bw_doe) or o.item_id in (select id from bw_items where plan_id in (select id from bw_doe)))
     and (o.item_id is null or exists (select 1 from maps.items i where i.id = o.item_id))
  on conflict (id) do update set tekst = excluded.tekst, status = excluded.status;
  insert into maps.bestanden (organisatie_id, id, plan_id, item_id, soort, pad, meta, created_at)
  select v_org, b.id, b.plan_id, b.item_id, b.soort, b.pad, b.meta, b.created_at
    from flcs_bron.bestanden b
   where (b.plan_id in (select id from bw_doe) or b.item_id in (select id from bw_items where plan_id in (select id from bw_doe)))
     and (b.item_id is null or exists (select 1 from maps.items i where i.id = b.item_id))
     and (b.plan_id is null or exists (select 1 from maps.plannen x where x.id = b.plan_id))
  on conflict (id) do update set pad = excluded.pad, meta = excluded.meta, item_id = excluded.item_id, soort = excluded.soort;

  -- Logboek van de bijgewerkte plannen: dat van FLCS.
  delete from maps.wijzigingen where plan_id in (select id from bw_doe);
  insert into maps.wijzigingen (organisatie_id, plan_id, tabel, rij_id, actie, rev, velden, door, op)
  select v_org, plan_id, tabel, rij_id, actie, rev, velden, maps.flcs_wie(door), op
    from flcs_bron.wijzigingen where plan_id in (select id from bw_doe) order by id;

  -- Leveranciers en vaste aansluitingen: nieuw, of de FLCS-versie als die recenter is.
  insert into maps.leveranciers (organisatie_id, id, naam, soort, categorieen, regios, gemeente, contactpersoon, email, email2, telefoon, projecten,
                                 opmerkingen, actief, created_at, updated_at)
  select v_org, id, naam, soort, categorieen, regios, gemeente, contactpersoon, email, email2, telefoon, projecten, opmerkingen, actief, created_at, updated_at
    from flcs_bron.leveranciers
  on conflict (id) do update set naam = excluded.naam, soort = excluded.soort, categorieen = excluded.categorieen, regios = excluded.regios,
    gemeente = excluded.gemeente, contactpersoon = excluded.contactpersoon, email = excluded.email, email2 = excluded.email2, telefoon = excluded.telefoon,
    projecten = excluded.projecten, opmerkingen = excluded.opmerkingen, actief = excluded.actief, updated_at = excluded.updated_at
   where maps.leveranciers.updated_at < excluded.updated_at;
  insert into maps.vaste_aansluitingen (organisatie_id, id, naam, soort, beheerder, gemeente, adres, geometrie, uitgangen, max_ampere, kva, sleutel,
                                        contact, ean, foto, opmerking, laatst_gecontroleerd, actief, bron_item_id, aangemaakt_door, bewerkt_door,
                                        created_at, updated_at)
  select v_org, v.id, v.naam, v.soort, v.beheerder, v.gemeente, v.adres, v.geometrie, v.uitgangen, v.max_ampere, v.kva, v.sleutel,
         v.contact, v.ean, v.foto, v.opmerking, v.laatst_gecontroleerd, v.actief,
         case when exists (select 1 from maps.items i where i.id = v.bron_item_id) then v.bron_item_id end,
         maps.flcs_wie(v.aangemaakt_door), maps.flcs_wie(v.bewerkt_door), v.created_at, v.updated_at
    from flcs_bron.vaste_aansluitingen v
  on conflict (id) do update set naam = excluded.naam, soort = excluded.soort, beheerder = excluded.beheerder, gemeente = excluded.gemeente,
    adres = excluded.adres, geometrie = excluded.geometrie, uitgangen = excluded.uitgangen, max_ampere = excluded.max_ampere, kva = excluded.kva,
    sleutel = excluded.sleutel, contact = excluded.contact, ean = excluded.ean, foto = excluded.foto, opmerking = excluded.opmerking,
    laatst_gecontroleerd = excluded.laatst_gecontroleerd, actief = excluded.actief, bewerkt_door = excluded.bewerkt_door, updated_at = excluded.updated_at
   where maps.vaste_aansluitingen.updated_at < excluded.updated_at;
  insert into maps.feedback (organisatie_id, id, created_at, auteur_id, auteur_naam, soort, tekst, status, plan_id, item_id, deel_link_id, context,
                             schermafdruk, antwoord, afgehandeld_door, afgehandeld_op)
  select v_org, id, created_at, maps.flcs_wie(auteur_id), auteur_naam, soort, tekst, status, plan_id, item_id, deel_link_id, context,
         schermafdruk, antwoord, maps.flcs_wie(afgehandeld_door), afgehandeld_op
    from flcs_bron.feedback
  on conflict (id) do update set status = excluded.status, antwoord = excluded.antwoord, afgehandeld_door = excluded.afgehandeld_door, afgehandeld_op = excluded.afgehandeld_op;

  alter table maps.plekken enable trigger user;
  alter table maps.plannen enable trigger user;
  alter table maps.bibliotheek enable trigger user;
  alter table maps.lagen enable trigger user;
  alter table maps.fasen enable trigger user;
  alter table maps.items enable trigger user;
  alter table maps.items_prullenbak enable trigger user;
  alter table maps.versies enable trigger user;
  alter table maps.deel_links enable trigger user;
  alter table maps.opmerkingen enable trigger user;
  alter table maps.bestanden enable trigger user;
  alter table maps.leveranciers enable trigger user;
  alter table maps.vaste_aansluitingen enable trigger user;
  alter table maps.feedback enable trigger user;

  -- Nieuwe plannen met een editie: bij het event met die naam (of een nieuw event).
  insert into maps.events (organisatie_id, naam, edition_id)
  select distinct on (btrim(p.editie_naam)) v_org, btrim(p.editie_naam), p.edition_id
    from maps.plannen p
   where p.id in (select id from bw_plan where actie = 'nieuw') and coalesce(btrim(p.editie_naam), '') <> '' and p.event_id is null
     and not exists (select 1 from maps.events e where e.organisatie_id = v_org and e.naam = btrim(p.editie_naam))
   order by btrim(p.editie_naam), p.updated_at desc;
  alter table maps.plannen disable trigger user;
  update maps.plannen p set event_id = e.id from maps.events e
   where p.id in (select id from bw_plan where actie = 'nieuw') and p.event_id is null and e.organisatie_id = v_org and e.naam = btrim(p.editie_naam);
  alter table maps.plannen enable trigger user;

  -- Stand onthouden, om de volgende keer te zien wat er in FLCS en in Toolen veranderde.
  insert into maps.import_stand (plan_id, bron_vinger, toolen_vinger, op)
  select b.id, b.fv, maps.plan_vinger(b.id), now() from bw_plan b
   where b.actie in ('nieuw', 'bijgewerkt') or (b.actie = 'ongewijzigd' and b.st_bron is null)
  on conflict (plan_id) do update set bron_vinger = excluded.bron_vinger, toolen_vinger = excluded.toolen_vinger, op = excluded.op;

  -- Nieuwe bestanden om te kopiëren (beheerpagina /maps/beheer/import).
  insert into maps.import_bestanden (naam) select name from flcs_bron.opslag where bucket_id = 'flcsmaps' on conflict (naam) do nothing;

  return query
    select b.actie, b.naam, case b.actie when 'conflict' then 'Gewijzigd in FLCS en in Toolen: overgeslagen. Met flcs_bijwerken(true) wint FLCS.'
                                         when 'andere organisatie' then 'Dit id hoort in Toolen bij een andere organisatie: overgeslagen.' else '' end
      from bw_plan b
    union all
    select 'weg in FLCS', p.naam, 'Blijft in Toolen.' from maps.plannen p join maps.import_stand s on s.plan_id = p.id
     where not exists (select 1 from bw_plan b where b.id = p.id)
    union all
    select 'bestanden', null, (select count(*) from maps.import_bestanden where gekopieerd_op is null) || ' nog te kopiëren via /maps/beheer/import'
    order by 1, 2;
end $$;
revoke execute on function maps.flcs_bijwerken(boolean) from public, anon, authenticated;

-- Hulpfuncties (in een vaste functie: pg_temp kan niet vanuit een functie aangemaakt worden).
create or replace function maps.flcs_url(j jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select replace(j::text, 'https://vojkrpenkqsphaflsdfh.supabase.co/storage/v1/object/public/flcsmaps/',
                          'https://hlpurcdeouegvphvwygu.supabase.co/storage/v1/object/public/maps/')::jsonb
$$;
create or replace function maps.flcs_wie(u uuid) returns uuid
language plpgsql stable set search_path = '' as $$
declare v uuid;
begin
  if u is null then return null; end if;
  if to_regclass('pg_temp.bw_wie') is null then return u; end if;
  execute 'select nieuw from pg_temp.bw_wie where oud = $1' into v using u;
  return coalesce(v, u);
end $$;
revoke execute on function maps.flcs_url(jsonb) from public, anon, authenticated;
revoke execute on function maps.flcs_wie(uuid) from public, anon, authenticated;
