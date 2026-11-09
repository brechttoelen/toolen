-- Test van 0007_events.sql (na 0001 + test_0001, 0003, 0004, 0005, 0006).
\set QUIET on
create or replace function pg_temp.ok(voorwaarde boolean, wat text) returns void language plpgsql as $$
begin if voorwaarde is not true then raise exception 'MISLUKT: %', wat; end if; raise notice 'ok  %', wat; end $$;
create or replace function pg_temp.als(u text, org text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u, ''), false);
  perform set_config('request.headers', case when org is null then '{}' else json_build_object('x-organisatie', org)::text end, false);
end $$;

select pg_temp.ok((select count(*) from maps.events) >= 0, 'tabel events bestaat');

select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs');
set role authenticated;
insert into maps.events (id, naam, datum, kleur) values ('70000000-0000-0000-0000-000000000001', 'Ronde van Vlaanderen', '2027-04-04', '#108AED');
select pg_temp.ok((select organisatie_id = (select id from maps.organisaties where slug = 'flcs') from maps.events where id = '70000000-0000-0000-0000-000000000001'), 'organisatie automatisch ingevuld');
update maps.plannen set event_id = '70000000-0000-0000-0000-000000000001' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.ok((select event_id is not null from maps.plannen where id = '20000000-0000-0000-0000-000000000001'), 'plan aan event gekoppeld');
do $$ begin
  insert into maps.events (naam, kleur) values ('Fout', 'rood');
  raise exception 'MISLUKT: ongeldige kleur';
exception when check_violation then raise notice 'ok  ongeldige kleur geweigerd';
end $$;
reset role;

-- Een event van een andere organisatie kan niet aan een plan hangen
select pg_temp.als('', null);
insert into maps.organisaties (id, slug, naam) values ('50000000-0000-0000-0000-0000000000e7', 'anderorg', 'Ander') on conflict do nothing;
insert into maps.events (id, organisatie_id, naam) values ('70000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-0000000000e7', 'Vreemd');
do $$ begin
  update maps.plannen set event_id = '70000000-0000-0000-0000-000000000009' where id = '20000000-0000-0000-0000-000000000001';
  raise exception 'MISLUKT: event van andere organisatie gekoppeld';
exception when insufficient_privilege then raise notice 'ok  event van andere organisatie geweigerd';
end $$;

select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs');
set role authenticated;
select pg_temp.ok((select count(*) from maps.events where naam = 'Vreemd') = 0, 'events van een andere organisatie onzichtbaar');
delete from maps.events where id = '70000000-0000-0000-0000-000000000001';
select pg_temp.ok((select event_id is null from maps.plannen where id = '20000000-0000-0000-0000-000000000001'), 'event weg: plan blijft, zonder event');
reset role;
set role anon;
do $$ begin
  perform 1 from maps.events;
  raise exception 'MISLUKT: anon leest events';
exception when insufficient_privilege then raise notice 'ok  zonder login geen events';
end $$;
reset role;
\echo ALLE TESTS 0007 GESLAAGD
