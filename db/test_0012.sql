-- Test van 0012_werkplekken.sql (na test_0011). Alles in een transactie die terugdraait.
\set QUIET on
begin;
create or replace function pg_temp.ok(voorwaarde boolean, wat text) returns void language plpgsql as $$
begin if voorwaarde is not true then raise exception 'MISLUKT: %', wat; end if; raise notice 'ok  %', wat; end $$;
create or replace function pg_temp.als(u text, org text, claims jsonb) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u, ''), false);
  perform set_config('request.jwt.claims', (coalesce(claims, '{}')::jsonb || jsonb_build_object('sub', u))::text, false);
  perform set_config('request.headers', case when org is null then '{}' else json_build_object('x-organisatie', org)::text end, false);
end $$;
create or replace function pg_temp.faalt(sql text, wat text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'MISLUKT: %', wat;
exception when others then if sqlerrm like 'MISLUKT%' then raise; end if; raise notice 'ok  %', wat;
end $$;
update maps.organisaties set status = 'actief', plaatsen = 20, modules = array(select distinct unnest(modules || array['stroom','signalisatie'])) where slug = 'flcs';

-- Werkplekken van items worden berekend.
select pg_temp.als(null, null, null);
insert into maps.items (id, plan_id, soort, geometrie, velden) values
  ('99000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'punt', '{"type":"Point","coordinates":[3.6,50.8]}', '{"stroom":{"rol":"kast"}}'),
  ('99000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'punt', '{"type":"Point","coordinates":[3.6,50.8]}', '{}'),
  ('99000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'punt', '{"type":"Point","coordinates":[3.6,50.8]}', '{"sign":{"nr":1}}');
select pg_temp.ok((select werkplekken = '{stroom}' from maps.items where id = '99000000-0000-0000-0000-000000000001'), 'kast: stroom');
select pg_temp.ok((select werkplekken = '{}' from maps.items where id = '99000000-0000-0000-0000-000000000002'), 'los punt: geen werkplek');
select pg_temp.ok((select werkplekken = '{sign}' from maps.items where id = '99000000-0000-0000-0000-000000000003'), 'bordpunt: signalisatie');

-- Bewerker d enkel Stroom.
update maps.leden set werkplekken = '{stroom}' where user_id = '00000000-0000-0000-0000-00000000000d';
select pg_temp.ok((select werkplekken = '{stroom}' from maps.leden where user_id = '00000000-0000-0000-0000-00000000000d'), 'bewerker beperkt tot Stroom');
update maps.leden set werkplekken = '{stroom}' where user_id = '00000000-0000-0000-0000-00000000000a' and rol = 'eigenaar';
select pg_temp.ok((select werkplekken is null from maps.leden where user_id = '00000000-0000-0000-0000-00000000000a' and rol = 'eigenaar'), 'eigenaar: nooit beperkt');

select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'flcs', '{"aal":"aal2"}');
set role authenticated;
select pg_temp.ok((select count(*) from maps.items where plan_id = '20000000-0000-0000-0000-000000000001') >= 3, 'ziet het hele plan');
select pg_temp.ok(maps.mijn_werkplekken((select id from maps.organisaties where slug = 'flcs')) = '{stroom}', 'mijn werkplekken');
update maps.items set naam = 'Kast A' where id = '99000000-0000-0000-0000-000000000001';
select pg_temp.ok((select naam = 'Kast A' from maps.items where id = '99000000-0000-0000-0000-000000000001'), 'stroomitem wijzigen mag');
update maps.items set naam = 'Weg' where id = '99000000-0000-0000-0000-000000000002';
select pg_temp.ok((select naam is distinct from 'Weg' from maps.items where id = '99000000-0000-0000-0000-000000000002'), 'gewoon item wijzigen: niets gewijzigd');
update maps.items set naam = 'Weg' where id = '99000000-0000-0000-0000-000000000003';
select pg_temp.ok((select naam is distinct from 'Weg' from maps.items where id = '99000000-0000-0000-0000-000000000003'), 'bordpunt wijzigen: niets gewijzigd');
select pg_temp.faalt($q$update maps.items set velden = '{}' where id = '99000000-0000-0000-0000-000000000001'$q$, 'kast omzetten naar gewoon item: geweigerd');
select pg_temp.faalt($q$insert into maps.items (plan_id, soort, geometrie, velden) values ('20000000-0000-0000-0000-000000000001', 'punt', '{"type":"Point","coordinates":[3.6,50.8]}', '{}')$q$, 'gewoon item maken: geweigerd');
insert into maps.items (plan_id, soort, geometrie, velden) values ('20000000-0000-0000-0000-000000000001', 'lijn', '{"type":"LineString","coordinates":[[3.6,50.8],[3.61,50.8]]}', '{"stroom":{"rol":"kabel"}}');
select pg_temp.ok(true, 'kabel maken mag');
delete from maps.items where id = '99000000-0000-0000-0000-000000000002';
select pg_temp.ok(exists (select 1 from maps.items where id = '99000000-0000-0000-0000-000000000002'), 'gewoon item wissen: niets gewist');
-- Plan: enkel de instellingen van Stroom.
update maps.plannen set instellingen = coalesce(instellingen, '{}') || '{"stroom":{"gelijktijdigheid":0.7}}' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.ok((select instellingen -> 'stroom' ->> 'gelijktijdigheid' = '0.7' from maps.plannen where id = '20000000-0000-0000-0000-000000000001'), 'instellingen van Stroom: mag');
select pg_temp.faalt($q$update maps.plannen set instellingen = coalesce(instellingen, '{}') || '{"pdf":{"x":1}}' where id = '20000000-0000-0000-0000-000000000001'$q$, 'andere instellingen: geweigerd');
select pg_temp.faalt($q$update maps.plannen set naam = 'Anders' where id = '20000000-0000-0000-0000-000000000001'$q$, 'naam van het plan: geweigerd');
select pg_temp.faalt($q$insert into maps.lagen (plan_id, naam) values ('20000000-0000-0000-0000-000000000001', 'Nieuw')$q$, 'laag maken: geweigerd');
select pg_temp.faalt($q$insert into maps.plannen (naam) values ('Nieuw plan')$q$, 'plan maken: geweigerd');
reset role;

-- Zonder beperking: alles.
update maps.leden set werkplekken = null where user_id = '00000000-0000-0000-0000-00000000000d';
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'flcs', '{"aal":"aal2"}');
set role authenticated;
update maps.items set naam = 'Mag' where id = '99000000-0000-0000-0000-000000000002';
select pg_temp.ok((select naam = 'Mag' from maps.items where id = '99000000-0000-0000-0000-000000000002'), 'zonder beperking: alles wijzigen');
reset role;
rollback;
