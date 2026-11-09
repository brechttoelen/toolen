\set QUIET on
create or replace function pg_temp.ok(voorwaarde boolean, wat text) returns void language plpgsql as $$
begin if voorwaarde is not true then raise exception 'MISLUKT: %', wat; end if; raise notice 'ok  %', wat; end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false), set_config('request.headers', '{"x-organisatie":"flcs"}', false);
select set_config('request.jwt.claim.sub', '', false);
update maps.organisaties set modules = '{}' where slug = 'flcs';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into maps.items (plan_id, soort, geometrie) values ('20000000-0000-0000-0000-000000000001', 'punt', '{}');
select pg_temp.ok(true, 'gewoon item zonder module');
do $$ begin
  insert into maps.items (plan_id, soort, geometrie, velden) values ('20000000-0000-0000-0000-000000000001', 'lijn', '{}', '{"stroom":{"kabel":true}}');
  raise exception 'MISLUKT: stroomitem zonder module';
exception when insufficient_privilege then raise notice 'ok  stroomitem geweigerd zonder module (%)', sqlerrm;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
update maps.organisaties set modules = '{stroom}' where slug = 'flcs';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into maps.items (id, plan_id, soort, geometrie, velden) values ('40000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000001', 'lijn', '{}', '{"stroom":{"kabel":true}}');
select pg_temp.ok(true, 'stroomitem met module');
reset role;
select set_config('request.jwt.claim.sub', '', false);
update maps.organisaties set modules = '{}' where slug = 'flcs';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select pg_temp.ok((select count(*) from maps.items where id = '40000000-0000-0000-0000-0000000000a1') = 1, 'bestaand stroomitem blijft zichtbaar');
do $$ begin
  update maps.items set naam = 'x' where id = '40000000-0000-0000-0000-0000000000a1';
  raise exception 'MISLUKT: vergrendeld item gewijzigd';
exception when insufficient_privilege then raise notice 'ok  bestaand stroomitem vergrendeld';
end $$;
delete from maps.items where id = '40000000-0000-0000-0000-0000000000a1';
select pg_temp.ok((select count(*) from maps.items where id = '40000000-0000-0000-0000-0000000000a1') = 0, 'verwijderen mag');
reset role;
\echo ALLE TESTS 0004 GESLAAGD
