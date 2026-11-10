-- Test van 0011_toegang.sql (na test_0010). Alles in een transactie die terugdraait.
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
update maps.organisaties set status = 'actief', plaatsen = 20 where slug = 'flcs';

-- Tweede stap verplicht, ook bij een e-mailcode; SSO enkel als de organisatie ze toelaat.
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs', '{"aal":"aal1","amr":[{"method":"otp"}]}');
set role authenticated;
select pg_temp.ok(cardinality(maps.mijn_organisaties()) = 0, 'e-mailcode zonder tweede stap: geen toegang meer');
reset role;
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs', '{"aal":"aal1","amr":[{"method":"oauth"}],"app_metadata":{"provider":"azure"}}');
set role authenticated;
select pg_temp.ok(cardinality(maps.mijn_organisaties()) = 0, 'Microsoft zonder SSO voor deze organisatie: geen toegang');
reset role;
update maps.organisaties set sso = '{azure}' where slug = 'flcs';
set role authenticated;
select pg_temp.ok(cardinality(maps.mijn_organisaties()) = 1, 'Microsoft met SSO voor deze organisatie: toegang');
reset role;
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs', '{"aal":"aal1","amr":[{"method":"oauth"}],"app_metadata":{"provider":"google"}}');
set role authenticated;
select pg_temp.ok(cardinality(maps.mijn_organisaties()) = 0, 'Google niet toegelaten');
reset role;
update maps.organisaties set sso = '{}' where slug = 'flcs';

-- Inloggen met bedrijfscode
set role anon;
select pg_temp.ok(maps.inlog_info('FLCS') ->> 'naam' is not null, 'bedrijfscode gekend (hoofdletters)');
select pg_temp.ok(maps.inlog_info('bestaatniet') ->> 'naam' is null, 'onbekende code: geen naam');
reset role;
select pg_temp.als('00000000-0000-0000-0000-00000000000a', null, '{"aal":"aal1","amr":[{"method":"password"}]}');
set role authenticated;
select pg_temp.ok(maps.lid_van_code('flcs') = 'flcs', 'lid van flcs');
select pg_temp.ok(maps.lid_van_code('nergens') is null, 'geen lid van onbekende code');
reset role;

-- Uitnodigen
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs', '{"aal":"aal2"}');
set role authenticated;
create temp table t_u as select maps.uitnodiging_maken((select id from maps.organisaties where slug = 'flcs'), 'Nieuwe.Collega@flcs.be', 'Nieuwe Collega', 'bewerker',
  array[(select id from maps.events where naam = 'Event 1')]) r;
grant select on t_u to anon, public;
select pg_temp.ok(length((select r ->> 'token' from t_u)) >= 40, 'token terug');
select pg_temp.ok((select token is null and token_hash is not null from maps.uitnodigingen where id = (select (r ->> 'id')::uuid from t_u)), 'enkel de hash bewaard');
select pg_temp.ok((maps.uitnodiging_mailgegevens((select (r ->> 'id')::uuid from t_u)) -> 'evenementen') = '["Event 1"]', 'mailgegevens met evenement');
reset role;
set role anon;
select pg_temp.ok((maps.uitnodiging_info((select r ->> 'token' from t_u)) ->> 'geldig')::boolean, 'info met token');
select pg_temp.ok(not (maps.uitnodiging_info((select r ->> 'token' from t_u)) ->> 'account')::boolean, 'nog geen account');
select pg_temp.ok(maps.uitnodiging_info('fout-token-van-genoeg-tekens') is null, 'verkeerd token: niets');
reset role;
-- Een lezer mag niet uitnodigen.
select pg_temp.als('00000000-0000-0000-0000-00000000000c', 'flcs', '{"aal":"aal2"}');
set role authenticated;
do $$ begin
  perform maps.uitnodiging_maken((select id from maps.organisaties where slug = 'flcs'), 'x@flcs.be', null, 'lezer', null);
  raise exception 'MISLUKT: lezer kon uitnodigen';
exception when others then if sqlerrm like 'MISLUKT%' then raise; end if; raise notice 'ok  lezer kan niet uitnodigen';
end $$;
reset role;

-- Account aanmaken door de server en aanvaarden
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000e', 'nieuwe.collega@flcs.be');
insert into maps.profielen (id, email) values ('00000000-0000-0000-0000-00000000000e', 'nieuwe.collega@flcs.be') on conflict do nothing;
select pg_temp.als(null, null, null);
select maps.uitnodiging_aanvaarden_door((select r ->> 'token' from t_u), '00000000-0000-0000-0000-00000000000e');
select pg_temp.ok((select event_ids is not null and rol = 'bewerker' from maps.leden where user_id = '00000000-0000-0000-0000-00000000000e'), 'lid met evenementen');
select pg_temp.ok((select naam = 'Nieuwe Collega' from maps.profielen where id = '00000000-0000-0000-0000-00000000000e'), 'naam overgenomen');

-- Beperkt tot Event 1: ziet enkel plannen van Event 1, geen plan zonder event, Event 2 niet.
select pg_temp.als('00000000-0000-0000-0000-00000000000e', 'flcs', '{"aal":"aal2"}');
set role authenticated;
select pg_temp.ok((select count(*) from maps.events) = 1, 'beperkt: één evenement zichtbaar');
select pg_temp.ok((select count(*) from maps.plannen where event_id is null) = 0, 'beperkt: plan zonder event onzichtbaar');
select pg_temp.ok((select count(*) from maps.items where plan_id = '20000000-0000-0000-0000-000000000001') = 0, 'beperkt: items van ander plan onzichtbaar');
select pg_temp.ok((select count(*) from maps.plannen where event_id = (select id from maps.events where naam = 'Event 1')) >= 1, 'beperkt: plan van Event 1 zichtbaar');
do $$ begin
  insert into maps.events (naam) values ('Nieuw event');
  raise exception 'MISLUKT: beperkt lid maakte een event';
exception when others then if sqlerrm like 'MISLUKT%' then raise; end if; raise notice 'ok  beperkt lid maakt geen nieuw event';
end $$;
reset role;
-- Onbeperkt lid ziet alles.
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'flcs', '{"aal":"aal2"}');
set role authenticated;
select pg_temp.ok((select count(*) from maps.events) = 2, 'onbeperkt: alle evenementen');
select pg_temp.ok((select count(*) from maps.items where plan_id = '20000000-0000-0000-0000-000000000001') >= 1, 'onbeperkt: alle items');
reset role;
-- Beheerder: evenementen altijd leeg (alles).
update maps.leden set rol = 'beheerder' where user_id = '00000000-0000-0000-0000-00000000000e';
select pg_temp.ok((select event_ids is null from maps.leden where user_id = '00000000-0000-0000-0000-00000000000e'), 'beheerder: altijd alle evenementen');
select pg_temp.ok(exists (select 1 from maps.logboek_organisatie where actie = 'lid_gewijzigd'), 'wijziging gelogd');

-- 2FA resetten
select pg_temp.als('00000000-0000-0000-0000-00000000000a', 'flcs', '{"aal":"aal2"}');
set role authenticated;
select pg_temp.ok(maps.mfa_reset_toestaan('00000000-0000-0000-0000-00000000000d', (select id from maps.organisaties where slug = 'flcs')) ->> 'email' = 'nieuw@flcs.be', 'eigenaar reset 2FA van een lid');
do $$ begin
  perform maps.mfa_reset_toestaan('00000000-0000-0000-0000-00000000000a', (select id from maps.organisaties where slug = 'flcs'));
  raise exception 'MISLUKT: eigen 2FA resetten';
exception when others then if sqlerrm like 'MISLUKT%' then raise; end if; raise notice 'ok  eigen 2FA niet zelf resetten';
end $$;
reset role;
select pg_temp.als('00000000-0000-0000-0000-00000000000c', 'flcs', '{"aal":"aal2"}');
set role authenticated;
do $$ begin
  perform maps.mfa_reset_toestaan('00000000-0000-0000-0000-00000000000d', (select id from maps.organisaties where slug = 'flcs'));
  raise exception 'MISLUKT: lezer reset 2FA';
exception when others then if sqlerrm like 'MISLUKT%' then raise; end if; raise notice 'ok  lezer kan geen 2FA resetten';
end $$;
reset role;

-- Mails begrenzen
select pg_temp.als(null, null, null);
select pg_temp.ok(maps.mail_toegestaan('a@b.be', 'wachtwoord') and maps.mail_toegestaan('a@b.be', 'wachtwoord') and maps.mail_toegestaan('a@b.be', 'wachtwoord'), 'drie mails per uur');
select pg_temp.ok(not maps.mail_toegestaan('a@b.be', 'wachtwoord'), 'vierde geweigerd');
rollback;
