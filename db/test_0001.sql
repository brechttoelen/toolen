-- Test van 0001_basis.sql op een lokale Postgres met Supabase-stubs.
-- Draaien: psql -v ON_ERROR_STOP=1 -f test_0001.sql   (stopt bij de eerste mislukte test)
\set QUIET on
set client_min_messages = warning;

-- Gebruikers en organisaties (als superuser, zoals het platform)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'brecht@flcs.be'),
  ('00000000-0000-0000-0000-00000000000b', 'jan@vrt.be'),
  ('00000000-0000-0000-0000-00000000000c', 'lezer@flcs.be'),
  ('00000000-0000-0000-0000-00000000000d', 'nieuw@flcs.be');
insert into maps.organisaties (id, slug, naam, kort, plaatsen, lezers_max) values
  ('10000000-0000-0000-0000-000000000001', 'flcs', 'Flanders Classics', 'FLCS', 2, 2),
  ('10000000-0000-0000-0000-000000000002', 'vrt', 'VRT', 'VRT', 5, 5);
insert into maps.leden (organisatie_id, user_id, rol) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'eigenaar'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'lezer'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'bewerker');
insert into maps.bibliotheek (organisatie_id, naam, categorie) values (null, 'Generator 20 kVA (publiek)', 'Stroom');

create or replace function pg_temp.als(u text, org text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u, ''), false);
  perform set_config('request.headers', case when org is null then '{}' else json_build_object('x-organisatie', org)::text end, false);
end $$;
create or replace function pg_temp.ok(voorwaarde boolean, wat text) returns void language plpgsql as $$
begin
  if voorwaarde is not true then raise exception 'MISLUKT: %', wat; end if;
  raise notice 'ok  %', wat;
end $$;
set client_min_messages = notice;

-- 1. Eigenaar FLCS maakt een plan, laag en item zonder organisatie mee te geven
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs');
set role authenticated;
insert into maps.plannen (id, naam) values ('20000000-0000-0000-0000-000000000001', 'Ronde 2027');
insert into maps.lagen (id, plan_id, naam) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Finish');
insert into maps.items (id, plan_id, laag_id, soort, geometrie) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'punt', '{"type":"Point","coordinates":[3.6,50.8]}');
select pg_temp.ok((select organisatie_id from maps.items where id = '40000000-0000-0000-0000-000000000001') = '10000000-0000-0000-0000-000000000001', 'item krijgt de organisatie van het plan');
select pg_temp.ok((maps.ik()->>'role') = 'admin', 'ik(): eigenaar = admin');
select pg_temp.ok((select maps.ik()->'organisatie'->>'slug') = 'flcs', 'ik(): organisatie flcs');
select pg_temp.ok((select count(*) from maps.bibliotheek where organisatie_id is null) = 1, 'publieke bibliotheek zichtbaar');
select pg_temp.ok((select (maps.item_wijzig('40000000-0000-0000-0000-000000000001', null, '{"naam":"EHBO"}'))->>'status') = 'ok', 'item_wijzig werkt');
insert into maps.deel_links (plan_id, naam, laag_ids, token) values ('20000000-0000-0000-0000-000000000001', 'Politie', '{30000000-0000-0000-0000-000000000001}', 'tokentokentokentokentoken01');
reset role;

-- 2. Bewerker van VRT ziet niets van FLCS en kan er niets in zetten
select pg_temp.als('00000000-0000-0000-0000-00000000000b', 'vrt');
set role authenticated;
select pg_temp.ok((select count(*) from maps.plannen) = 0, 'VRT ziet geen FLCS-plannen');
select pg_temp.ok((select count(*) from maps.items) = 0, 'VRT ziet geen FLCS-items');
select pg_temp.ok((select count(*) from maps.toegang) = 1, 'VRT ziet enkel de eigen collega''s');
do $$ begin
  insert into maps.items (plan_id, soort, geometrie) values ('20000000-0000-0000-0000-000000000001', 'punt', '{}');
  raise exception 'MISLUKT: VRT kon een item in een FLCS-plan zetten';
exception when insufficient_privilege or check_violation or not_null_violation then raise notice 'ok  VRT kan geen item in een FLCS-plan zetten';
end $$;
-- ook niet met de header van FLCS
select pg_temp.als('00000000-0000-0000-0000-00000000000b', 'flcs');
select pg_temp.ok((select count(*) from maps.plannen) = 0, 'VRT met header flcs ziet nog steeds niets');
select pg_temp.ok(maps.ik() is null, 'ik() is leeg in een organisatie waar je geen lid bent');
reset role;

-- 3. Lezer van FLCS: lezen ja, schrijven nee
select pg_temp.als('00000000-0000-0000-0000-00000000000c', 'flcs');
set role authenticated;
select pg_temp.ok((select count(*) from maps.items) = 1, 'lezer ziet het item');
select pg_temp.ok((select maps.ik()->>'role') = 'viewer', 'ik(): lezer = viewer');
do $$ begin
  insert into maps.plannen (naam) values ('Mag niet');
  raise exception 'MISLUKT: lezer kon een plan maken';
exception when insufficient_privilege then raise notice 'ok  lezer kan geen plan maken';
end $$;
reset role;

-- 4. Zonder header, lid van één organisatie: nieuwe rij komt in die organisatie
select pg_temp.als('00000000-0000-0000-0000-00000000000a', null);
set role authenticated;
insert into maps.leveranciers (naam) values ('Intermetal');
select pg_temp.ok((select organisatie_id from maps.leveranciers where naam = 'Intermetal') = '10000000-0000-0000-0000-000000000001', 'zonder header: de enige organisatie');
reset role;

-- 5. Lid van twee organisaties: de header bepaalt wat je ziet
insert into maps.leden (organisatie_id, user_id, rol) values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'lezer');
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'vrt');
set role authenticated;
select pg_temp.ok((select count(*) from maps.plannen) = 0, 'met header vrt geen FLCS-plannen');
select pg_temp.ok((select maps.ik()->>'role') = 'viewer', 'in VRT lezer');
select pg_temp.ok(jsonb_array_length(maps.ik()->'organisaties') = 2, 'ik() toont beide organisaties');
reset role;
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs');
set role authenticated;
select pg_temp.ok((select count(*) from maps.plannen) = 1, 'met header flcs wel het FLCS-plan');
reset role;

-- 6. Plaatsen: FLCS heeft 2 plaatsen (eigenaar = 1). Eén bewerker kan erbij, een tweede niet.
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs');
set role authenticated;
insert into maps.uitnodigingen (organisatie_id, email, rol, token) values ('10000000-0000-0000-0000-000000000001', 'nieuw@flcs.be', 'bewerker', 'uitnodiginguitnodiging01');
do $$ begin
  insert into maps.uitnodigingen (organisatie_id, email, rol) values ('10000000-0000-0000-0000-000000000001', 'teveel@flcs.be', 'bewerker');
  raise exception 'MISLUKT: derde betalende plaats toegelaten';
exception when raise_exception then
  if sqlerrm like 'MISLUKT%' then raise; end if;
  raise notice 'ok  derde betalende plaats geweigerd (%)', sqlerrm;
end $$;
-- lezers: max 2, er is er 1, een tweede mag, een derde niet
insert into maps.uitnodigingen (organisatie_id, email, rol) values ('10000000-0000-0000-0000-000000000001', 'lezer2@flcs.be', 'lezer');
do $$ begin
  insert into maps.uitnodigingen (organisatie_id, email, rol) values ('10000000-0000-0000-0000-000000000001', 'lezer3@flcs.be', 'lezer');
  raise exception 'MISLUKT: derde lezer toegelaten';
exception when raise_exception then
  if sqlerrm like 'MISLUKT%' then raise; end if;
  raise notice 'ok  derde lezer geweigerd';
end $$;
-- pakket wijzigen mag de eigenaar niet zelf
do $$ begin
  update maps.organisaties set plaatsen = 50 where slug = 'flcs';
  raise exception 'MISLUKT: eigenaar kon zijn plaatsen verhogen';
exception when insufficient_privilege then raise notice 'ok  eigenaar kan plaatsen niet zelf verhogen';
end $$;
update maps.organisaties set adres = 'Gent' where slug = 'flcs';
select pg_temp.ok((select adres from maps.organisaties where slug = 'flcs') = 'Gent', 'eigenaar kan het adres wijzigen');
reset role;

-- 7. Uitnodiging aanvaarden met het juiste adres
select pg_temp.als('00000000-0000-0000-0000-00000000000d', null);
set role authenticated;
select pg_temp.ok((maps.uitnodiging_aanvaarden('uitnodiginguitnodiging01'))->>'slug' = 'flcs', 'uitnodiging aanvaard');
reset role;
select pg_temp.ok((select rol from maps.leden where user_id = '00000000-0000-0000-0000-00000000000d') = 'bewerker', 'nieuw lid is bewerker');

-- 8. Laatste eigenaar kan niet weg
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs');
set role authenticated;
do $$ begin
  update maps.leden set rol = 'bewerker' where user_id = '00000000-0000-0000-0000-00000000000a' and organisatie_id = '10000000-0000-0000-0000-000000000001';
  raise exception 'MISLUKT: laatste eigenaar weg';
exception when raise_exception then
  if sqlerrm like 'MISLUKT%' then raise; end if;
  raise notice 'ok  laatste eigenaar blijft (%)', sqlerrm;
end $$;
reset role;

-- 9. Deellink zonder login
select pg_temp.als(null, null);
set role anon;
select pg_temp.ok((maps.deel_link_lezen('tokentokentokentokentoken01'))->'organisatie'->>'kort' = 'FLCS', 'deellink geeft de organisatie mee');
select pg_temp.ok(jsonb_array_length((maps.deel_link_lezen('tokentokentokentokentoken01'))->'items') = 1, 'deellink toont het item');
do $$ begin
  perform count(*) from maps.plannen;
  raise exception 'MISLUKT: anon kan tabellen lezen';
exception when insufficient_privilege then raise notice 'ok  anon heeft geen toegang tot de tabellen';
end $$;
reset role;

-- 10. Status: alleen-lezen → lezen ja, schrijven nee, deellink werkt; geblokkeerd → deellink uit
select pg_temp.als(null, null);
update maps.organisaties set status = 'alleen_lezen' where slug = 'flcs';
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs');
set role authenticated;
select pg_temp.ok((select count(*) from maps.items) = 1, 'alleen-lezen: items zichtbaar');
select pg_temp.ok((select maps.ik()->>'role') = 'viewer', 'alleen-lezen: eigenaar wordt viewer');
do $$ begin
  update maps.items set naam = 'x';
  if found then raise exception 'MISLUKT: schrijven in alleen-lezen'; end if;
  raise notice 'ok  alleen-lezen: wijzigen raakt geen rijen';
end $$;
reset role;
select pg_temp.als(null, null);
set role anon;
select pg_temp.ok(maps.deel_link_lezen('tokentokentokentokentoken01') is not null, 'alleen-lezen: deellink werkt');
reset role;
select pg_temp.als(null, null);
update maps.organisaties set status = 'geblokkeerd' where slug = 'flcs';
select pg_temp.als(null, null);
set role anon;
select pg_temp.ok(maps.deel_link_lezen('tokentokentokentokentoken01') is null, 'geblokkeerd: deellink uit');
reset role;
select pg_temp.als('00000000-0000-0000-0000-00000000000c', 'flcs');
set role authenticated;
select pg_temp.ok((select count(*) from maps.items) = 0, 'geblokkeerd: lezer ziet niets');
reset role;
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs');
set role authenticated;
select pg_temp.ok((select count(*) from maps.items) = 1, 'geblokkeerd: eigenaar kan nog lezen (exporteren)');
reset role;
select pg_temp.als(null, null);
update maps.organisaties set status = 'actief' where slug = 'flcs';

-- 11. Prullenbak en logboek houden de organisatie bij
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs');
set role authenticated;
delete from maps.items where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.ok((select organisatie_id from maps.items_prullenbak where id = '40000000-0000-0000-0000-000000000001') = '10000000-0000-0000-0000-000000000001', 'prullenbak met organisatie');
select pg_temp.ok((select count(*) from maps.wijzigingen where organisatie_id = '10000000-0000-0000-0000-000000000001') >= 2, 'wijzigingen met organisatie');
select pg_temp.ok((select count(*) from maps.items_terugzetten(array['40000000-0000-0000-0000-000000000001'::uuid])) = 1, 'item teruggezet');
reset role;

-- 12. Nieuwe organisatie aanmaken
select pg_temp.als('00000000-0000-0000-0000-00000000000b', null);
set role authenticated;
select pg_temp.ok((maps.organisatie_aanmaken('Golazo', 'golazo'))->>'slug' = 'golazo', 'organisatie aangemaakt');
reset role;
select pg_temp.ok((select rol from maps.leden l join maps.organisaties o on o.id = l.organisatie_id where o.slug = 'golazo') = 'eigenaar', 'maker is eigenaar');
do $$ begin
  insert into maps.organisaties (slug, naam) values ('login', 'x');
  raise exception 'MISLUKT: gereserveerde slug toegelaten';
exception when check_violation then raise notice 'ok  gereserveerde slug geweigerd';
end $$;

-- 13. Organisatie volledig wissen (cascade) lukt ondanks de eigenaarscontrole
delete from maps.organisaties where slug = 'golazo';
select pg_temp.ok(not exists (select 1 from maps.organisaties where slug = 'golazo'), 'organisatie gewist');

\echo ALLE TESTS GESLAAGD
