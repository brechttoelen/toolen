-- Test van 0005_pakketten.sql (na 0001 + test_0001, 0003 + test_0003, 0004 + test_0004).
\set QUIET on
create or replace function pg_temp.ok(voorwaarde boolean, wat text) returns void language plpgsql as $$
begin if voorwaarde is not true then raise exception 'MISLUKT: %', wat; end if; raise notice 'ok  %', wat; end $$;
create or replace function pg_temp.als(u text, org text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u, ''), false);
  perform set_config('request.headers', case when org is null then '{}' else json_build_object('x-organisatie', org)::text end, false);
end $$;

-- 1. Pakketten lezen en beheren
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs');
set role authenticated;
select pg_temp.ok((select count(*) from maps.pakketten) = 5, 'iedereen ziet de pakketten');
update maps.pakketten set plaatsen = 99 where id = 'event';
select pg_temp.ok((select plaatsen from maps.pakketten where id = 'event') = 5, 'gewone gebruiker kan geen pakket wijzigen');
do $$ begin
  perform maps.platform_pakket_toepassen((select id from maps.organisaties where slug = 'flcs'), 'maatwerk');
  raise exception 'MISLUKT: gewone gebruiker paste een pakket toe';
exception when insufficient_privilege then raise notice 'ok  gewone gebruiker kan geen pakket toepassen';
end $$;
reset role;

select pg_temp.als('00000000-0000-0000-0000-0000000000e1', null);
set role authenticated;
insert into maps.pakketten (id, naam, plaatsen, lezers, modules, modules_keuze, prijs_jaar) values ('koers', 'Koers', 8, 50, '{signalisatie,veiligheid}', 0, 2400);
select pg_temp.ok((select naam from maps.pakketten where id = 'koers') = 'Koers', 'platform maakt een pakket');
do $$ begin
  insert into maps.pakketten (id, naam, modules) values ('fout', 'Fout', '{vliegen}');
  raise exception 'MISLUKT: onbekende module in pakket';
exception when check_violation then raise notice 'ok  onbekende module geweigerd';
end $$;

-- 2. Nieuwe organisatie met de waarden van het pakket
select pg_temp.ok((maps.platform_organisatie_aanmaken('Wielerbond', 'wielerbond', null, 'koers', null, null, null, 'proef', null, null))->>'slug' = 'wielerbond', 'organisatie met pakket koers');
select pg_temp.ok((select plaatsen = 8 and lezers_max = 50 and modules = '{signalisatie,veiligheid}' from maps.organisaties where slug = 'wielerbond'), 'plaatsen, lezers en modules uit het pakket');
select pg_temp.ok((maps.platform_organisatie_aanmaken('Proefje', 'proefje', null, 'proef', 3, null, null, null, null, null))->>'slug' = 'proefje', 'proeforganisatie');
select pg_temp.ok((select plaatsen = 3 and proef_tot > now() + interval '29 days' and 'stroom' = any (modules) from maps.organisaties where slug = 'proefje'), 'afwijkende plaatsen, proef van 30 dagen');
do $$ begin
  perform maps.platform_organisatie_aanmaken('X', 'xyz', null, 'bestaatniet', null, null, null, null, null, null);
  raise exception 'MISLUKT: onbekend pakket';
exception when raise_exception then
  if sqlerrm like 'MISLUKT%' then raise; end if;
  raise notice 'ok  onbekend pakket geweigerd';
end $$;

-- 3. Pakket toepassen; koppelingen blijven
update maps.organisaties set modules = '{stroom,stock}' where slug = 'wielerbond';
select maps.platform_pakket_toepassen((select id from maps.organisaties where slug = 'wielerbond'), 'organisatie');
select pg_temp.ok((select pakket = 'organisatie' and plaatsen = 20 and 'branding' = any (modules) and 'stock' = any (modules) and not 'integraties' = any (modules)
                   from maps.organisaties where slug = 'wielerbond'), 'pakket toegepast, stock blijft');
do $$ begin
  update maps.organisaties set modules = '{vliegen}' where slug = 'wielerbond';
  raise exception 'MISLUKT: onbekende module bij organisatie';
exception when check_violation then raise notice 'ok  onbekende module bij organisatie geweigerd';
end $$;
do $$ begin
  delete from maps.pakketten where id = 'organisatie';
  raise exception 'MISLUKT: gebruikt pakket verwijderd';
exception when foreign_key_violation then raise notice 'ok  pakket in gebruik kan niet weg';
end $$;
update maps.pakketten set id = 'organisatie_2026' where id = 'organisatie';
select pg_temp.ok((select pakket from maps.organisaties where slug = 'wielerbond') = 'organisatie_2026', 'pakket hernoemd: organisaties volgen');
update maps.pakketten set id = 'organisatie' where id = 'organisatie_2026';
reset role;

-- 4. Modulebewaking: bestaande items blijven verplaatsbaar
select pg_temp.als('', null);
update maps.organisaties set modules = '{stroom,branding}' where slug = 'flcs';
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs');
set role authenticated;
insert into maps.items (id, plan_id, soort, geometrie, velden) values
  ('40000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-000000000001', 'element', '{}', '{"stroom":{"rol":"bron"},"doeken":["a"]}');
reset role;
select pg_temp.als('', null);
update maps.organisaties set modules = '{}' where slug = 'flcs';
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs');
set role authenticated;
update maps.items set naam = 'Generator 1', geometrie = '{"type":"Point","coordinates":[3,51]}' where id = '40000000-0000-0000-0000-0000000000b1';
select pg_temp.ok((select naam from maps.items where id = '40000000-0000-0000-0000-0000000000b1') = 'Generator 1', 'bestaand item verplaatsen en hernoemen zonder module');
do $$ begin
  update maps.items set velden = velden || '{"stroom":{"rol":"kast"}}' where id = '40000000-0000-0000-0000-0000000000b1';
  raise exception 'MISLUKT: stroomgegevens gewijzigd zonder module';
exception when insufficient_privilege then raise notice 'ok  stroomgegevens wijzigen geweigerd';
end $$;
do $$ begin
  update maps.items set velden = velden || '{"paneel_1":"x"}' where id = '40000000-0000-0000-0000-0000000000b1';
  raise exception 'MISLUKT: totempaneel zonder branding';
exception when insufficient_privilege then raise notice 'ok  totempaneel geweigerd zonder branding';
end $$;
update maps.items set velden = velden - 'doeken' where id = '40000000-0000-0000-0000-0000000000b1';
select pg_temp.ok((select not (velden ? 'doeken') from maps.items where id = '40000000-0000-0000-0000-0000000000b1'), 'doeken weghalen mag');
insert into maps.items (plan_id, soort, geometrie, velden) values ('20000000-0000-0000-0000-000000000001', 'element', '{}', '{"stroom":null,"licht":{"richting":90}}');
select pg_temp.ok(true, 'leeg stroomveld en licht zijn basis');
reset role;

\echo ALLE TESTS 0005 GESLAAGD
