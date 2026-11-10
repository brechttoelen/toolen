-- Test van 0010_inloggen_limieten_systeem.sql (na 0001 + test_0001 en 0003 … 0009).
\set QUIET on
create or replace function pg_temp.ok(voorwaarde boolean, wat text) returns void language plpgsql as $$
begin if voorwaarde is not true then raise exception 'MISLUKT: %', wat; end if; raise notice 'ok  %', wat; end $$;
create or replace function pg_temp.als(u text, org text, claims jsonb) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u, ''), false);
  perform set_config('request.jwt.claims', coalesce(claims, '{}')::text, false);
  perform set_config('request.headers', case when org is null then '{}' else json_build_object('x-organisatie', org)::text end, false);
end $$;
update maps.organisaties set status = 'actief', pakket = 'event' where slug = 'flcs';

-- MFA
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs', '{"aal":"aal1","amr":[{"method":"otp"}]}');
set role authenticated;
select pg_temp.ok(cardinality(maps.mijn_organisaties()) = 0, 'e-mailcode zonder tweede stap: geen toegang (sinds 0011)');
select pg_temp.ok((select count(*) from maps.plannen) = 0, 'e-mailcode: geen plannen (sinds 0011)');
reset role;
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs', '{"aal":"aal1","amr":[{"method":"password"}]}');
set role authenticated;
select pg_temp.ok(cardinality(maps.mijn_organisaties()) = 0, 'wachtwoord zonder tweede stap: geen toegang');
select pg_temp.ok((select count(*) from maps.plannen) = 0, 'wachtwoord zonder tweede stap: geen plannen');
reset role;
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs', '{"aal":"aal2","amr":[{"method":"totp"},{"method":"password"}]}');
set role authenticated;
select pg_temp.ok((select count(*) from maps.plannen) > 0, 'wachtwoord met code: toegang');
reset role;
insert into maps.platform_beheerders (user_id) values ('00000000-0000-0000-0000-00000000000a') on conflict do nothing;
select pg_temp.als('00000000-0000-0000-0000-00000000000a', null, '{"aal":"aal1","amr":[{"method":"oauth"}]}');
set role authenticated;
select pg_temp.ok(not maps.is_platformbeheerder() and maps.is_platformbeheerder_zonder_mfa(), 'platformbeheer vraagt altijd de tweede stap');
reset role;
select pg_temp.als('00000000-0000-0000-0000-00000000000a', null, '{"aal":"aal2"}');
set role authenticated;
select pg_temp.ok(maps.is_platformbeheerder(), 'platformbeheer met tweede stap');
select pg_temp.ok((maps.platform_systeem()->>'gebruikers')::int >= 1, 'systeemcijfers');
reset role;
delete from maps.platform_beheerders where user_id = '00000000-0000-0000-0000-00000000000a';

-- Twee apparaten
insert into auth.sessions (user_id, created_at) values ('00000000-0000-0000-0000-00000000000a', now() - interval '2 hours');
insert into auth.sessions (user_id, created_at) values ('00000000-0000-0000-0000-00000000000a', now() - interval '1 hour');
select pg_temp.ok((select count(*) from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000a') = 2, 'twee apparaten mogen');
insert into auth.sessions (user_id, created_at) values ('00000000-0000-0000-0000-00000000000a', now());
select pg_temp.ok((select count(*) from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000a') = 2, 'derde apparaat: oudste afgemeld');
select pg_temp.ok((select min(created_at) from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000a') > now() - interval '90 minutes', 'het oudste is weg');
select pg_temp.ok((select sum(afgemeld) from maps.sessie_log) = 1, 'afmelding gelogd');

-- Limieten (pakket event: 3 events per jaar, 25 deellinks)
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs', '{"aal":"aal2"}');
set role authenticated;
delete from maps.events;
select pg_temp.ok(maps.events_in_jaar((select id from maps.organisaties where slug = 'flcs'), extract(year from current_date)::int) >= 0, 'telling events');
do $$ declare n int; begin
  n := maps.events_in_jaar((select id from maps.organisaties where slug = 'flcs'), extract(year from current_date)::int);
  for i in 1..greatest(0, 3 - n) loop insert into maps.events (naam) values ('Event ' || i); end loop;
  begin
    insert into maps.events (naam) values ('Eén te veel');
    raise exception 'MISLUKT: vierde event toegelaten';
  exception when sqlstate 'P0001' then if sqlerrm like 'MISLUKT%' then raise; end if; raise notice 'ok  vierde event geweigerd (%)', sqlerrm; end;
  begin
    insert into maps.plannen (naam) values ('Plan zonder event');
    raise exception 'MISLUKT: plan zonder event toegelaten boven de limiet';
  exception when sqlstate 'P0001' then if sqlerrm like 'MISLUKT%' then raise; end if; raise notice 'ok  plan zonder event telt mee'; end;
end $$;
insert into maps.plannen (naam, event_id) values ('Plan bij bestaand event', (select id from maps.events limit 1));
select pg_temp.ok(true, 'plan bij een bestaand event mag altijd');
select pg_temp.ok((maps.gebruik((select id from maps.organisaties where slug = 'flcs'))->>'max_events_jaar')::int = 3, 'gebruik toont de limiet');
reset role;
select pg_temp.als(null, null, null);
update maps.organisaties set limieten = '{"max_deellinks": 0}' where slug = 'flcs';
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs', '{"aal":"aal2"}');
set role authenticated;
do $$ begin
  insert into maps.deel_links (plan_id, naam) values ('20000000-0000-0000-0000-000000000001', 'Te veel');
  raise exception 'MISLUKT: deellink boven de limiet';
exception when sqlstate 'P0001' then if sqlerrm like 'MISLUKT%' then raise; end if; raise notice 'ok  deellink boven de limiet geweigerd'; end $$;
insert into maps.deel_links (plan_id, naam, ingetrokken_op) values ('20000000-0000-0000-0000-000000000001', 'Uit', now());
select pg_temp.ok(true, 'een uitgezette link mag (enkel PDF)');
reset role;
select pg_temp.als(null, null, null);
update maps.organisaties set limieten = '{}' where slug = 'flcs';
\echo ALLE TESTS GESLAAGD
