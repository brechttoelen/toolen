-- ============================================================================
-- Toolen · 0051_fiche_overnemen_en_delen.sql
-- maps.fiche_overnemen(van, naar): de fiche van een vorige editie meenemen naar een
--   gekopieerd plan. Items worden gekoppeld via items.bron_item_id, lagen op naam.
--   Komt mee: leveranciers (status terug op nog niets), leveringen, taken met hun dagen
--   en koppelingen, programma, laadlijst, catering, team, vennootschappen, budgetposten
--   (bedrag wordt 'vorig jaar') en notities met 'meenemen'. Offertes, facturen en prijzen niet.
-- maps.deel_link_taken(token): de taken van de persoon van een deellink, zonder login.
-- ============================================================================

create or replace function maps.fiche_overnemen(p_van uuid, p_naar uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  org uuid; van maps.plannen; naar maps.plannen; n_taken int := 0; n_regels int := 0;
begin
  select * into van from maps.plannen where id = p_van;
  select * into naar from maps.plannen where id = p_naar;
  if van.id is null or naar.id is null then raise exception 'Plan niet gevonden.'; end if;
  if van.organisatie_id <> naar.organisatie_id then raise exception 'De plannen horen bij een andere organisatie.' using errcode = '42501'; end if;
  org := naar.organisatie_id;
  if not (org = any (maps.mijn_organisaties('bewerker'))) or not maps.plan_toegestaan(p_van) or not maps.plan_toegestaan(p_naar) then
    raise exception 'Geen rechten op deze plannen.' using errcode = '42501';
  end if;
  if not maps.org_heeft_module(org, 'fiche') then return jsonb_build_object('overgenomen', false); end if;
  if exists (select 1 from maps.taken where plan_id = p_naar) or exists (select 1 from maps.site_leveranciers where plan_id = p_naar) then
    raise exception 'Dit plan heeft al een fiche.';
  end if;

  create temp table _item on commit drop as
    select b.id oud, n.id nieuw from maps.items n join maps.items b on b.id = n.bron_item_id where n.plan_id = p_naar and b.plan_id = p_van;
  create temp table _laag on commit drop as
    select o.id oud, n.id nieuw from maps.lagen o join maps.lagen n on n.plan_id = p_naar and n.naam = o.naam where o.plan_id = p_van;
  create temp table _sl (oud uuid, nieuw uuid) on commit drop;
  create temp table _lev (oud uuid, nieuw uuid) on commit drop;
  create temp table _taak (oud uuid, nieuw uuid) on commit drop;

  insert into _sl select id, gen_random_uuid() from maps.site_leveranciers where plan_id = p_van;
  insert into maps.site_leveranciers (id, organisatie_id, plan_id, leverancier_id, status, aanspreekpunt_id, wat, materiaal, opmerking, volgorde)
  select m.nieuw, org, p_naar, s.leverancier_id, 'nog_niets', s.aanspreekpunt_id, s.wat, s.materiaal, s.opmerking, s.volgorde
    from maps.site_leveranciers s join _sl m on m.oud = s.id;

  insert into _lev select id, gen_random_uuid() from maps.leveringen where plan_id = p_van;
  insert into maps.leveringen (id, organisatie_id, plan_id, site_leverancier_id, soort, anker, dag, uur_van, uur_tot, leverpunt_item_id, leverpunt_tekst, wat, opmerking)
  select m.nieuw, org, p_naar, sl.nieuw, l.soort, l.anker, l.dag, l.uur_van, l.uur_tot, it.nieuw, l.leverpunt_tekst, l.wat, l.opmerking
    from maps.leveringen l join _lev m on m.oud = l.id join _sl sl on sl.oud = l.site_leverancier_id
    left join _item it on it.oud = l.leverpunt_item_id;

  insert into _taak select id, gen_random_uuid() from maps.taken where plan_id = p_van;
  insert into maps.taken (id, organisatie_id, plan_id, titel, soort, info, waar_tekst, wie_persoon_id, wie_leverancier_id, wie_tekst, relatie, voorbereiding, deadline_anker, deadline_dag, volgorde)
  select m.nieuw, org, p_naar, t.titel, t.soort, t.info, t.waar_tekst, t.wie_persoon_id, t.wie_leverancier_id, t.wie_tekst, t.relatie, t.voorbereiding, t.deadline_anker, t.deadline_dag, t.volgorde
    from maps.taken t join _taak m on m.oud = t.id;
  get diagnostics n_taken = row_count;
  update maps.taken t set ouder_id = mo.nieuw, levering_id = ml.nieuw
    from maps.taken o join _taak m on m.oud = o.id
    left join _taak mo on mo.oud = o.ouder_id left join _lev ml on ml.oud = o.levering_id
   where t.id = m.nieuw and (o.ouder_id is not null or o.levering_id is not null);

  insert into maps.taak_dagen (organisatie_id, plan_id, taak_id, anker, dag, uur_van, uur_tot, uitvoerder_persoon_id, opmerking)
  select org, p_naar, m.nieuw, d.anker, d.dag, d.uur_van, d.uur_tot, d.uitvoerder_persoon_id, d.opmerking
    from maps.taak_dagen d join _taak m on m.oud = d.taak_id;

  insert into maps.taak_koppelingen (organisatie_id, plan_id, taak_id, soort, item_id, groep_id, laag_id, laaggroep, label)
  select org, p_naar, m.nieuw, k.soort, it.nieuw, k.groep_id, lg.nieuw, k.laaggroep, k.label
    from maps.taak_koppelingen k join _taak m on m.oud = k.taak_id
    left join _item it on it.oud = k.item_id left join _laag lg on lg.oud = k.laag_id;
  -- Groepen: groep_id verwijst naar items.groep_id; die krijgen bij het kopiëren dezelfde waarde mee.

  insert into maps.programma (organisatie_id, plan_id, anker, dag, uur_van, uur_tot, wat, volgorde)
  select org, p_naar, anker, dag, uur_van, uur_tot, wat, volgorde from maps.programma where plan_id = p_van;

  insert into maps.laadregels (organisatie_id, plan_id, bron_id, aantal, eenheid, wat, waar_item_id, waar_tekst, opmerking, pakket_id, volgorde)
  select org, p_naar, r.bron_id, r.aantal, r.eenheid, r.wat, it.nieuw, r.waar_tekst, r.opmerking, r.pakket_id, r.volgorde
    from maps.laadregels r left join _item it on it.oud = r.waar_item_id where r.plan_id = p_van;
  get diagnostics n_regels = row_count;

  insert into maps.cateringregels (organisatie_id, plan_id, leverancier_id, soort, product, eenheid, voor_tekst, voor_leverancier_id, groep, anker, dag, uur, leverplaats_item_id, leverplaats_tekst, aantal, vennootschap_id, rechtstreeks, opmerking, volgorde)
  select org, p_naar, c.leverancier_id, c.soort, c.product, c.eenheid, c.voor_tekst, c.voor_leverancier_id, c.groep, c.anker, c.dag, c.uur, it.nieuw, c.leverplaats_tekst, c.aantal, c.vennootschap_id, c.rechtstreeks, c.opmerking, c.volgorde
    from maps.cateringregels c left join _item it on it.oud = c.leverplaats_item_id where c.plan_id = p_van;

  insert into maps.site_rollen (organisatie_id, plan_id, persoon_id, rol, toegang, volgorde)
  select org, p_naar, persoon_id, rol, toegang, volgorde from maps.site_rollen where plan_id = p_van;

  insert into maps.plan_vennootschappen (organisatie_id, plan_id, vennootschap_id, standaard, wat)
  select org, p_naar, vennootschap_id, standaard, wat from maps.plan_vennootschappen where plan_id = p_van;

  insert into maps.budgetposten (organisatie_id, plan_id, site_leverancier_id, vennootschap_id, omschrijving, vorig_jaar, opmerking, volgorde)
  select org, p_naar, sl.nieuw, b.vennootschap_id, b.omschrijving, coalesce(b.budget, b.vorig_jaar), b.opmerking, b.volgorde
    from maps.budgetposten b left join _sl sl on sl.oud = b.site_leverancier_id where b.plan_id = p_van;

  insert into maps.notities (organisatie_id, plan_id, tekst, auteur_naam, tab, meenemen)
  select org, p_naar, n.tekst, coalesce(n.auteur_naam, 'Vorige editie'), n.tab, true
    from maps.notities n where n.plan_id = p_van and n.meenemen;

  update maps.plannen set vorig_plan_id = p_van,
         instellingen = coalesce(instellingen, '{}'::jsonb) || jsonb_build_object('fiche', coalesce(van.instellingen -> 'fiche', '{}'::jsonb))
   where id = p_naar;

  return jsonb_build_object('overgenomen', true, 'taken', n_taken, 'laadregels', n_regels, 'items_gekoppeld', (select count(*) from _item));
end $$;
revoke execute on function maps.fiche_overnemen(uuid, uuid) from public, anon;
grant execute on function maps.fiche_overnemen(uuid, uuid) to authenticated;

-- Taken van de persoon achter een deellink (zonder login): titel, dagen, uren, waar en status.
create or replace function maps.deel_link_taken(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with d as (
    select d.* from maps.deel_links d
     where p_token is not null and length(p_token) >= 20 and d.token = p_token
       and d.ingetrokken_op is null and (d.geldig_tot is null or d.geldig_tot > now())
       and d.persoon_id is not null and maps.org_deelbaar(d.organisatie_id))
  select jsonb_build_object(
    'persoon', (select p.naam from maps.personen p join d on d.persoon_id = p.id),
    'rol', (select r.rol from maps.site_rollen r join d on d.persoon_id = r.persoon_id and d.plan_id = r.plan_id),
    'wedstrijd_van', (select pl.wedstrijd_van from maps.plannen pl join d on d.plan_id = pl.id),
    'wedstrijd_tot', (select pl.wedstrijd_tot from maps.plannen pl join d on d.plan_id = pl.id),
    'taken', coalesce((
      select jsonb_agg(jsonb_build_object('titel', t.titel, 'info', t.info, 'waar', t.waar_tekst, 'anker', td.anker, 'dag', td.dag,
                                          'uur_van', td.uur_van, 'uur_tot', td.uur_tot, 'status', td.status) order by td.anker desc, td.dag, td.uur_van nulls last)
        from d join maps.taak_dagen td on td.plan_id = d.plan_id
        join maps.taken t on t.id = td.taak_id
       where td.uitvoerder_persoon_id = d.persoon_id or t.wie_persoon_id = d.persoon_id), '[]'::jsonb))
  from d;
$$;
revoke execute on function maps.deel_link_taken(text) from public;
grant execute on function maps.deel_link_taken(text) to anon, authenticated;
