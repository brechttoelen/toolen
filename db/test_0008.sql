-- Test van 0008_ontvangers.sql (na 0001 + test_0001, 0003 … 0007).
\set QUIET on
create or replace function pg_temp.ok(voorwaarde boolean, wat text) returns void language plpgsql as $$
begin if voorwaarde is not true then raise exception 'MISLUKT: %', wat; end if; raise notice 'ok  %', wat; end $$;

update maps.organisaties set status = 'actief' where slug = 'flcs';
-- Twee lagen in een map, één los; een item per laag en een gebouw met binnenplan.
insert into maps.lagen (id, plan_id, naam, map) values
  ('30000000-0000-0000-0000-000000000081', '20000000-0000-0000-0000-000000000001', 'Tenten', 'Tenten'),
  ('30000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000001', 'Vloeren', 'Tenten'),
  ('30000000-0000-0000-0000-000000000083', '20000000-0000-0000-0000-000000000001', 'Branding', null);
insert into maps.items (id, plan_id, laag_id, soort, geometrie, velden) values
  ('40000000-0000-0000-0000-000000000081', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000081', 'punt', '{"type":"Point","coordinates":[3.6,50.8]}', '{}'),
  ('40000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000082', 'punt', '{"type":"Point","coordinates":[3.6,50.8]}', '{}'),
  ('40000000-0000-0000-0000-000000000083', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000083', 'lijn', '{"type":"LineString","coordinates":[[3.6,50.8],[3.61,50.8]]}', '{}'),
  ('40000000-0000-0000-0000-000000000084', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000083', 'punt', '{"type":"Point","coordinates":[3.6,50.8]}', '{"binnenplan":true}'),
  ('40000000-0000-0000-0000-000000000085', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000083', 'punt', '{"type":"Point","coordinates":[3.6,50.8]}', '{"binnen":{"host":"40000000-0000-0000-0000-000000000084"}}');

insert into maps.deel_links (organisatie_id, plan_id, naam, token, opties) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Tentenbouwer', 'ontvangerontvangerontvanger1',
   '{"pdf":true,"laatste_pdf":{"pad":"x/y.pdf","versie":3,"op":"2026-11-10"},"ontvanger":{"soort":"Leverancier"},"onderdelen":[
     {"id":"a","soort":"plan","naam":"Tenten","mappen":["Tenten"]},
     {"id":"b","soort":"plan","naam":"Branding zonder lijnen","laag_ids":["30000000-0000-0000-0000-000000000083"],"verberg_soorten":["lijn"]},
     {"id":"c","soort":"binnen","naam":"VIP","item":"40000000-0000-0000-0000-000000000084"},
     {"id":"d","soort":"werkplek","naam":"Stroom","werkplek":"stroomplan"}]}');

set role anon;
select pg_temp.ok(jsonb_array_length((maps.deel_link_lezen('ontvangerontvangerontvanger1'))->'onderdelen') = 3, 'drie onderdelen in de link (werkplek enkel in de PDF)');
select pg_temp.ok((maps.deel_link_lezen('ontvangerontvangerontvanger1'))->>'deel' = 'a', 'zonder keuze het eerste onderdeel');
select pg_temp.ok((select count(*) from jsonb_array_elements((maps.deel_link_lezen('ontvangerontvangerontvanger1'))->'items')) = 2, 'map Tenten: beide lagen');
select pg_temp.ok((select count(*) from jsonb_array_elements((maps.deel_link_lezen('ontvangerontvangerontvanger1', 'b'))->'items') i where i->>'soort' = 'lijn') = 0, 'onderdeel b: lijnen verborgen');
select pg_temp.ok((select count(*) from jsonb_array_elements((maps.deel_link_lezen('ontvangerontvangerontvanger1', 'b'))->'items')) = 2, 'onderdeel b: punten van de laag Branding');
select pg_temp.ok((maps.deel_link_lezen('ontvangerontvangerontvanger1', 'c'))->'link'->'opties'->>'binnen' = '40000000-0000-0000-0000-000000000084', 'onderdeel c: binnenplan');
select pg_temp.ok((maps.deel_link_lezen('ontvangerontvangerontvanger1', 'c'))->'link'->'opties' ? 'onderdelen' = false, 'interne instellingen niet in de link');
select pg_temp.ok((maps.deel_link_lezen('ontvangerontvangerontvanger1', 'd')) is null, 'werkplek is geen onderdeel van de link');
select pg_temp.ok((maps.deel_link_lezen('ontvangerontvangerontvanger1'))->'pdf'->>'pad' = 'x/y.pdf', 'laatste PDF te downloaden');
select pg_temp.ok((maps.deel_link_lezen('tokentokentokentokentoken01'))->'onderdelen' = '[]'::jsonb, 'oude link zonder onderdelen werkt nog');
reset role;
select pg_temp.ok((select keer_geopend from maps.deel_links where token = 'ontvangerontvangerontvanger1') = 4, 'wisselen tussen onderdelen telt niet mee');

-- Nieuwe laag in de map komt er vanzelf bij
insert into maps.lagen (id, plan_id, naam, map) values ('30000000-0000-0000-0000-000000000084', '20000000-0000-0000-0000-000000000001', 'Verankering', 'Tenten');
insert into maps.items (plan_id, laag_id, soort, geometrie) values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000084', 'punt', '{"type":"Point","coordinates":[3.6,50.8]}');
set role anon;
select pg_temp.ok((select count(*) from jsonb_array_elements((maps.deel_link_lezen('ontvangerontvangerontvanger1'))->'items')) = 3, 'nieuwe laag in de map zit erbij');
reset role;

-- Profielen worden ontvangers, één keer
update maps.plannen set instellingen = coalesce(instellingen, '{}') || '{"pdf_profielen":[{"id":"p1","naam":"Politie A3","papier":"A3","schaal":500,"centrum":[3.6,50.8],"fase":null,"inst":{"legende":true,"lagen":["30000000-0000-0000-0000-000000000081"]}}]}' where id = '20000000-0000-0000-0000-000000000001';
\i db/0008_ontvangers.sql
\i db/0008_ontvangers.sql
select pg_temp.ok((select count(*) from maps.deel_links where opties->>'profiel_id' = 'p1') = 1, 'profiel één keer omgezet');
select pg_temp.ok((select ingetrokken_op is not null and opties->'onderdelen'->0->'inst'->>'schaal' = '500' and opties->'onderdelen'->0->'inst' ? 'legende' and laag_ids = '{30000000-0000-0000-0000-000000000081}' from maps.deel_links where opties->>'profiel_id' = 'p1'), 'profiel: link uit, kader en lagen mee');
\echo ALLE TESTS GESLAAGD
