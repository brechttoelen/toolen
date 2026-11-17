-- Volledige stroom van de fiche zoals de app ze doet, als eigenaar van flcs, in één DO-blok dat eindigt met
-- 'RAPPORT: …' (niets blijft bewaard). Taken, leveringen, geld, laadlijst, catering, team, deellink zonder login,
-- een plan kopiëren zoals PlannenLijst het doet en de fiche overnemen.
-- Resultaat 17 nov 2026: deellink 2 taken, overnemen koppelt taken en leverpunten aan de nieuwe items,
-- offertes gaan niet mee, budget komt als vorig jaar, notities met meenemen en parkings gaan mee.
do $$
declare r text := ''; org uuid; pid uuid; p2 uuid; tid uuid; slid uuid; lev uuid; pers uuid; v uuid; it uuid; tok text; j jsonb; n int; eig text;
begin
  select id into org from maps.organisaties where slug = 'flcs';
  select user_id::text into eig from maps.leden where organisatie_id = org and rol = 'eigenaar' and actief limit 1;
  select id into pid from maps.plannen where organisatie_id = org and event_id is not null and wedstrijd_van is not null limit 1;
  select id into lev from maps.leveranciers where organisatie_id = org limit 1;
  select id into it from maps.items where plan_id = pid limit 1;
  update maps.organisaties set modules = array_append(modules, 'fiche') where id = org and not ('fiche' = any(modules));
  perform set_config('request.headers', '{"x-organisatie":"flcs"}', true);
  perform set_config('request.jwt.claims', json_build_object('sub', eig, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  insert into maps.taken (plan_id, titel, soort) values (pid, 'Plaatsen hekken', 'Levering') returning id into tid;
  insert into maps.taak_dagen (taak_id, anker, dag, uur_van) values (tid, 'start', -2, '07:00'), (tid, 'start', -1, null);
  insert into maps.taak_koppelingen (taak_id, soort, item_id, label) values (tid, 'item', it, 'x');
  insert into maps.site_leveranciers (plan_id, leverancier_id) values (pid, lev) returning id into slid;
  insert into maps.leveringen (site_leverancier_id, soort, anker, dag, uur_van, leverpunt_item_id, wat) values (slid, 'levering', 'start', -3, '08:00', it, '3 trailers');
  insert into maps.offertes (site_leverancier_id, bedrag_excl, status) values (slid, 1000, 'ontvangen');
  insert into maps.facturen (site_leverancier_id, bedrag_excl, status) values (slid, 1100, 'ontvangen');
  select id into v from maps.vennootschappen where organisatie_id = org limit 1;
  insert into maps.plan_vennootschappen (plan_id, vennootschap_id, standaard) values (pid, v, true);
  insert into maps.budgetposten (plan_id, omschrijving, budget, vennootschap_id) values (pid, 'Drukwerk', 500, v);
  insert into maps.budgetposten (site_leverancier_id, omschrijving, budget) values (slid, 'Hekken', 900);
  insert into maps.laadregels (plan_id, aantal, wat, bron_id) values (pid, 24, 'Krijtspray', (select id from maps.laad_bronnen where organisatie_id = org limit 1));
  insert into maps.cateringregels (plan_id, soort, product, eenheid, voor_tekst, anker, dag, aantal, leverancier_id) values (pid, 'crew', 'Warme maaltijd', 'pers', 'Gemeente', 'start', -2, 10, lev);
  insert into maps.catering_prijzen (plan_id, leverancier_id, product, eenheid, prijs) values (pid, lev, 'Warme maaltijd', 'pers', 12.5);
  insert into maps.notities (plan_id, tekst, tab, meenemen) values (pid, 'Soep te kort', 'catering', true);
  insert into maps.personen (naam, telefoon) values ('Pieter', '+32') returning id into pers;
  insert into maps.site_rollen (plan_id, persoon_id, rol, toegang) values (pid, pers, 'Parking', 'deellink');
  update maps.taak_dagen set uitvoerder_persoon_id = pers where taak_id = tid;
  insert into maps.deel_links (plan_id, naam, live, persoon_id, laag_ids, opties) values (pid, 'Taken Pieter', true, pers, array(select id from maps.lagen where plan_id = pid), '{"taal":"nl","taken":true}') returning token into tok;
  insert into maps.programma (plan_id, anker, dag, uur_van, wat) values (pid, 'start', 0, '14:10', 'Start');
  update maps.plannen set instellingen = coalesce(instellingen,'{}') || '{"fiche":{"parkings":[{"id":"p","nr":"5"}]}}' where id = pid;
  r := r || 'inserts ok | ';
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  j := maps.deel_link_taken(tok);
  execute 'reset role';
  r := r || 'deellink: ' || (j->>'persoon') || ' ' || jsonb_array_length(j->'taken') || ' taken, rol ' || (j->>'rol') || ' | ';
  perform set_config('request.jwt.claims', json_build_object('sub', eig, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  insert into maps.plannen (naam, event_id, centrum, zoom, vorig_plan_id, wedstrijd_van, wedstrijd_tot) select naam || ' kopie', event_id, centrum, zoom, id, wedstrijd_van + 364, wedstrijd_tot + 364 from maps.plannen where id = pid returning id into p2;
  insert into maps.lagen (plan_id, naam, kleur, stijl, volgorde) select p2, naam, kleur, stijl, volgorde from maps.lagen where plan_id = pid;
  insert into maps.items (plan_id, bron_item_id, soort, geometrie, naam, velden, laag_id) select p2, i.id, i.soort, i.geometrie, i.naam, i.velden, (select n2.id from maps.lagen n2 join maps.lagen o on o.naam = n2.naam where o.id = i.laag_id and n2.plan_id = p2 limit 1) from maps.items i where i.plan_id = pid;
  j := maps.fiche_overnemen(pid, p2);
  r := r || 'overnemen: ' || j::text || ' | ';
  select count(*) into n from maps.taak_koppelingen k join maps.items i on i.id = k.item_id where k.plan_id = p2 and i.plan_id = p2; r := r || 'koppelingen naar nieuw item: ' || n || ' | ';
  select count(*) into n from maps.leveringen l join maps.items i on i.id = l.leverpunt_item_id where l.plan_id = p2 and i.plan_id = p2; r := r || 'leverpunt naar nieuw item: ' || n || ' | ';
  select count(*) into n from maps.offertes where plan_id = p2; r := r || 'offertes mee: ' || n || ' (0 verwacht) | ';
  select count(*) into n from maps.budgetposten where plan_id = p2 and vorig_jaar is not null; r := r || 'budget als vorig jaar: ' || n || ' | ';
  select count(*) into n from maps.notities where plan_id = p2; r := r || 'notities mee: ' || n || ' | ';
  select (instellingen->'fiche'->'parkings'->0->>'nr') into tok from maps.plannen where id = p2; r := r || 'parking mee: ' || coalesce(tok, 'nee');
  execute 'reset role';
  raise exception 'RAPPORT: %', r;
end $$;
