-- Test van 0003_beheer.sql (na 0001 en test_0001 op dezelfde databank).
\set QUIET on
set client_min_messages = warning;
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'platform@toolen.be'),
  ('00000000-0000-0000-0000-0000000000e2', 'klant@golazo.be');
insert into maps.platform_beheerders values ('00000000-0000-0000-0000-0000000000e1');

-- 1. Platform: overzicht en organisaties aanmaken
select pg_temp.als('00000000-0000-0000-0000-0000000000e1', null);
set role authenticated;
select pg_temp.ok((select count(*) from maps.platform_overzicht()) >= 2, 'platform ziet alle organisaties');
select pg_temp.ok((maps.platform_organisatie_aanmaken('Golazo', 'golazo', 'Golazo', 'pro', 5, 25, '{stroom}', 'proef', now() + interval '30 days', 'klant@golazo.be'))->>'eigenaar_lid' = 'true', 'bestaande gebruiker meteen eigenaar');
select pg_temp.ok((maps.platform_organisatie_aanmaken('Sporza', 'sporza', null, 'organisatie', 20, 100, '{}', 'actief', null, 'baas@sporza.be'))->>'token' is not null, 'nieuwe gebruiker krijgt een uitnodiging');
select pg_temp.ok((select count(*) from maps.leden_van((select id from maps.organisaties where slug = 'golazo'))) = 1, 'platform ziet de leden');
update maps.organisaties set plaatsen = 8, status = 'actief' where slug = 'golazo';
select pg_temp.ok((select count(*) from maps.logboek_organisatie l join maps.organisaties o on o.id = l.organisatie_id where o.slug = 'golazo' and l.actie = 'gewijzigd') = 1, 'wijziging staat in het logboek');
reset role;

-- 2. Gewone gebruiker ziet het platformoverzicht niet
select pg_temp.als('00000000-0000-0000-0000-00000000000b', null);
set role authenticated;
select pg_temp.ok((select count(*) from maps.platform_overzicht()) = 0, 'gewone gebruiker: geen platformoverzicht');
do $$ begin
  perform maps.platform_organisatie_aanmaken('X', 'xxx', null, null, null, null, null, null, null, null);
  raise exception 'MISLUKT: gewone gebruiker kon een organisatie aanmaken';
exception when insufficient_privilege then raise notice 'ok  gewone gebruiker kan geen organisatie aanmaken via het platform';
end $$;
reset role;

-- 3. Uitnodiging voor eigenaar aanvaarden
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e3', 'baas@sporza.be');
select pg_temp.als('00000000-0000-0000-0000-0000000000e3', null);
set role authenticated;
select pg_temp.ok((maps.uitnodiging_info((select token from maps.uitnodigingen where email = 'baas@sporza.be')))->>'organisatie' is null, 'info: niet zichtbaar via de tabel (RLS), wel via de functie');
reset role;
select pg_temp.ok((maps.uitnodiging_info((select token from maps.uitnodigingen where email = 'baas@sporza.be')))->>'organisatie' = 'Sporza', 'uitnodiging_info');
create temp table tok as select token from maps.uitnodigingen where email = 'baas@sporza.be';
grant select on tok to authenticated;
select pg_temp.als('00000000-0000-0000-0000-0000000000e3', null);
set role authenticated;
select pg_temp.ok((maps.uitnodiging_aanvaarden((select token from tok)))->>'slug' = 'sporza', 'eigenaar-uitnodiging aanvaard');
select pg_temp.ok((select maps.ik()->>'rol') = 'eigenaar', 'nieuwe eigenaar');
-- 4. Eigenaar nodigt een beheerder uit; die kan geen eigenaar uitnodigen
insert into maps.uitnodigingen (organisatie_id, email, rol, token) values ((select id from maps.organisaties where slug = 'sporza'), 'Beheer@Sporza.be ', 'beheerder', 'beheerderbeheerder000001');
select pg_temp.ok((select email from maps.uitnodigingen where token = 'beheerderbeheerder000001') = 'beheer@sporza.be', 'e-mailadres opgeschoond');
do $$ begin
  insert into maps.uitnodigingen (organisatie_id, email, rol) values ((select id from maps.organisaties where slug = 'sporza'), 'baas@sporza.be', 'lezer');
  raise exception 'MISLUKT: bestaand lid opnieuw uitgenodigd';
exception when raise_exception then
  if sqlerrm like 'MISLUKT%' then raise; end if;
  raise notice 'ok  bestaand lid niet opnieuw uitnodigen';
end $$;
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e4', 'beheer@sporza.be');
select pg_temp.als('00000000-0000-0000-0000-0000000000e4', null);
set role authenticated;
select pg_temp.ok((maps.uitnodiging_aanvaarden('beheerderbeheerder000001'))->>'slug' = 'sporza', 'beheerder aanvaard');
do $$ begin
  insert into maps.uitnodigingen (organisatie_id, email, rol) values ((select id from maps.organisaties where slug = 'sporza'), 'tweede@sporza.be', 'eigenaar');
  raise exception 'MISLUKT: beheerder nodigde een eigenaar uit';
exception when insufficient_privilege then raise notice 'ok  beheerder kan geen eigenaar uitnodigen';
end $$;
insert into maps.uitnodigingen (organisatie_id, email, rol) values ((select id from maps.organisaties where slug = 'sporza'), 'bewerker@sporza.be', 'bewerker');
select pg_temp.ok((select count(*) from maps.uitnodigingen where organisatie_id = (select id from maps.organisaties where slug = 'sporza')) >= 2, 'beheerder ziet de uitnodigingen');
select pg_temp.ok((select count(*) from maps.leden_van((select id from maps.organisaties where slug = 'sporza'))) = 2, 'leden_van voor een lid');
select pg_temp.ok((select count(*) from maps.leden_van((select id from maps.organisaties where slug = 'golazo'))) = 0, 'leden_van van een andere organisatie: leeg');
reset role;

\echo ALLE TESTS 0003 GESLAAGD
