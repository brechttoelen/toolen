-- 0022 · Beveiliging (audit november 2026)
--
-- 1. Opslag privé: de bucket "maps" was publiek (wie een adres had, zag het bestand, ook na uitschrijven
--    of intrekken van een deellink). Nu enkel via /b met een controle per pad:
--      <plan-id>/...                    leden van de organisatie van het plan (met evenementrechten) of een geldige deellink van dat plan
--      <org-id>/ontvangers/<link>/...   leden van de organisatie of die deellink
--      ontwerpen/<plan-id>/...          zoals het plan
--      huisstijl/...                    iedereen (loginpagina)
--      feedback/...                     beheerders en platform
--      bibliotheek/, doeken/, flcs/ ... gedeelde beelden: ingelogde leden of een geldige deellink
--    Schrijven: enkel in de eigen organisatie (vroeger: een beheerder van eender welke organisatie kon
--    bestanden van een andere organisatie overschrijven of wissen).
-- 2. Deellink: een vaste versie of PDF van een ander plan kan niet meer via de eigen link getoond worden.
-- 3. Deellinks: hoogstens 60 opmerkingen of feedback per link per uur; context begrensd.
-- 4. Organisatie: SSO en "SSO verplicht" wijzigt enkel Toolen (anders kon een eigenaar de tweede stap omzeilen).
-- 5. Profiel: enkel je naam wijzigen, niet je e-mailadres (vroeger kon je je als iemand anders voordoen).
-- 6. Zelf organisaties aanmaken kan niet meer zonder Toolen (eindeloze proefperiodes).
-- 7. Live samenwerken: privékanalen met rechten (vroeger kon wie een plan-id kende meekijken, berichten
--    sturen en via een kleurwaarde code uitvoeren bij collega's); de lobby per organisatie.
-- 8. Opruimen: postgres_fdw uit het publieke schema, anon kan geen interne functies meer uitvoeren.

-- 1. Opslag ----------------------------------------------------------------
create or replace function maps.is_uuid(t text) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(t ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false);
$$;

-- Lezen: p_token = token van een deellink (of null).
create or replace function maps.pad_lezen(p_pad text, p_token text default null) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare s1 text := split_part(p_pad, '/', 1); s2 text := split_part(p_pad, '/', 2); s3 text := split_part(p_pad, '/', 3);
        pl uuid; org uuid; dl maps.deel_links%rowtype; heeft_dl boolean := false;
begin
  if p_pad is null or p_pad = '' or p_pad ~ '(^|/)\.\.?(/|$)' then return false; end if;
  if s1 = 'huisstijl' then return true; end if;
  if p_token is not null and length(p_token) >= 20 then
    select * into dl from maps.deel_links d where d.token = p_token and d.ingetrokken_op is null and (d.geldig_tot is null or d.geldig_tot > now());
    heeft_dl := found and maps.org_deelbaar(dl.organisatie_id);
  end if;
  if maps.is_platformbeheerder() then return true; end if;
  -- Plan of organisatie vooraan (of ontwerpen/<plan>).
  if maps.is_uuid(s1) then
    select id, organisatie_id into pl, org from maps.plannen where id = s1::uuid;
    if pl is null then
      select id into org from maps.organisaties where id = s1::uuid;
      if org is null then return false; end if;
      return org = any (maps.lid_van()) or (heeft_dl and dl.organisatie_id = org and s2 = 'ontvangers' and s3 = dl.id::text);
    end if;
  elsif s1 = 'ontwerpen' and maps.is_uuid(s2) then
    select id, organisatie_id into pl, org from maps.plannen where id = s2::uuid;
  end if;
  if pl is not null then
    return (org = any (maps.lid_van()) and maps.plan_toegestaan(pl)) or (heeft_dl and dl.plan_id = pl);
  end if;
  if s1 = 'feedback' then return maps.mag_beheren(); end if;
  -- Gedeelde beelden (bibliotheek, doeken, ontwerpen zonder plan, oude FLCS-paden).
  return cardinality(maps.lid_van()) > 0 or heeft_dl;
end $$;

create or replace function maps.pad_schrijven(p_pad text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare s1 text := split_part(p_pad, '/', 1); s2 text := split_part(p_pad, '/', 2); pl uuid; org uuid;
begin
  if p_pad is null or p_pad = '' or p_pad ~ '(^|/)\.\.?(/|$)' then return false; end if;
  if maps.is_platformbeheerder() then return true; end if;
  if s1 = 'huisstijl' then return false; end if;
  if s1 = 'feedback' then return maps.mag_lezen(); end if;
  if maps.is_uuid(s1) then
    select id, organisatie_id into pl, org from maps.plannen where id = s1::uuid;
    if pl is null then
      select id into org from maps.organisaties where id = s1::uuid;
      return org is not null and org = any (maps.mijn_organisaties('bewerker'));
    end if;
  elsif s1 = 'ontwerpen' and maps.is_uuid(s2) then
    select id, organisatie_id into pl, org from maps.plannen where id = s2::uuid;
  end if;
  if pl is not null then return org = any (maps.mijn_organisaties('bewerker')) and maps.plan_toegestaan(pl); end if;
  return maps.mag_schrijven();
end $$;

-- Beheren (wissen of overschrijven van andermans bestand): beheerder van de organisatie van het pad.
create or replace function maps.pad_beheren(p_pad text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare s1 text := split_part(p_pad, '/', 1); s2 text := split_part(p_pad, '/', 2); org uuid;
begin
  if maps.is_platformbeheerder() then return true; end if;
  if maps.is_uuid(s1) then
    select organisatie_id into org from maps.plannen where id = s1::uuid;
    if org is null then org := s1::uuid; end if;
  elsif s1 = 'ontwerpen' and maps.is_uuid(s2) then
    select organisatie_id into org from maps.plannen where id = s2::uuid;
  end if;
  return org is not null and org = any (maps.mijn_organisaties('beheerder'));
end $$;

-- Voor /b: mag deze aanvrager (sessie of deellink) dit bestand zien?
create or replace function maps.bestand_mag(p_pad text, p_token text default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select maps.pad_lezen(p_pad, p_token);
$$;

revoke all on function maps.pad_lezen(text, text), maps.pad_schrijven(text), maps.pad_beheren(text), maps.bestand_mag(text, text), maps.is_uuid(text) from public;
grant execute on function maps.pad_lezen(text, text), maps.pad_schrijven(text), maps.pad_beheren(text), maps.is_uuid(text) to authenticated;
grant execute on function maps.bestand_mag(text, text) to anon, authenticated;

update storage.buckets set public = false, file_size_limit = 104857600 where id = 'maps';

drop policy if exists maps_opladen on storage.objects;
drop policy if exists maps_wijzigen on storage.objects;
drop policy if exists maps_wissen on storage.objects;
drop policy if exists maps_huisstijl_opladen on storage.objects;
drop policy if exists maps_huisstijl_wijzigen on storage.objects;
drop policy if exists maps_huisstijl_wissen on storage.objects;
drop policy if exists maps_lezen on storage.objects;

create policy maps_lezen on storage.objects for select to authenticated
  using (bucket_id = 'maps' and maps.pad_lezen(name, null));
create policy maps_opladen on storage.objects for insert to authenticated
  with check (bucket_id = 'maps' and maps.pad_schrijven(name));
create policy maps_wijzigen on storage.objects for update to authenticated
  using (bucket_id = 'maps' and ((owner_id = auth.uid()::text and maps.pad_schrijven(name)) or maps.pad_beheren(name)))
  with check (bucket_id = 'maps' and maps.pad_schrijven(name));
create policy maps_wissen on storage.objects for delete to authenticated
  using (bucket_id = 'maps' and ((owner_id = auth.uid()::text and maps.pad_schrijven(name)) or maps.pad_beheren(name)));

-- 2. Deellink: vaste versie en PDF horen bij dit plan en deze link ----------
do $$
declare d text := pg_get_functiondef('maps.deel_link_lezen(text, text)'::regprocedure); n text;
begin
  n := replace(d, 'from maps.versies v where v.id = dl.versie_id;', 'from maps.versies v where v.id = dl.versie_id and v.plan_id = dl.plan_id;');
  n := replace(n, $q$'pdf', case when coalesce((dl.opties->>'pdf')::boolean, true) and jsonb_typeof(dl.opties->'laatste_pdf') = 'object'$q$,
                  $q$'pdf', case when coalesce((dl.opties->>'pdf')::boolean, true) and jsonb_typeof(dl.opties->'laatste_pdf') = 'object' and coalesce(dl.opties->'laatste_pdf'->>'pad', '') like dl.organisatie_id::text || '/ontvangers/' || dl.id::text || '/%'$q$);
  if n = d or position('v.plan_id = dl.plan_id' in n) = 0 or position('/ontvangers/' in n) = 0 then
    raise exception 'deel_link_lezen: aanpassing niet gelukt (tekst gewijzigd?)';
  end if;
  execute n;
end $$;

-- 3. Grenzen voor anonieme bijdragen via een deellink -----------------------
create or replace function maps.deellink_bijdrage_mag(p_link uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select count(*) from maps.opmerkingen where deel_link_id = p_link and created_at > now() - interval '1 hour')
       + (select count(*) from maps.feedback where deel_link_id = p_link and created_at > now() - interval '1 hour') < 60;
$$;
revoke all on function maps.deellink_bijdrage_mag(uuid) from public, anon, authenticated;

do $$
declare f text; d text; n text;
begin
  foreach f in array array['maps.deel_link_feedback(text, text, text, text, jsonb)', 'maps.deel_link_opmerking(text, uuid, text, text)', 'maps.deel_link_punt(text, double precision, double precision, text, text)'] loop
    d := pg_get_functiondef(f::regprocedure);
    n := regexp_replace(d, '(if not maps\.org_deelbaar\(dl\.organisatie_id\) then return (false|null); end if;)',
                        '\1' || E'\n  if not maps.deellink_bijdrage_mag(dl.id) then return \\2; end if;');
    if n = d then raise exception '%: aanpassing niet gelukt', f; end if;
    execute n;
  end loop;
  d := pg_get_functiondef('maps.deel_link_feedback(text, text, text, text, jsonb)'::regprocedure);
  n := replace(d, $q$coalesce(p_context, '{}'::jsonb) || jsonb_build_object('bron', 'deellink')$q$,
                  $q$(case when jsonb_typeof(p_context) = 'object' and length(p_context::text) <= 20000 then p_context else '{}'::jsonb end) || jsonb_build_object('bron', 'deellink')$q$);
  if n = d then raise exception 'deel_link_feedback context: aanpassing niet gelukt'; end if;
  execute n;
end $$;

-- 4. SSO enkel via Toolen ----------------------------------------------------
create or replace function maps.organisatie_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or maps.is_platformbeheerder() then return new; end if;
  if (new.status, new.pakket, new.plaatsen, new.lezers_max, new.modules, new.limieten, new.proef_tot, new.slug,
      new.stripe_klant_id, new.stripe_abonnement_id, new.status_sinds, new.sso, new.sso_verplicht)
     is distinct from
     (old.status, old.pakket, old.plaatsen, old.lezers_max, old.modules, old.limieten, old.proef_tot, old.slug,
      old.stripe_klant_id, old.stripe_abonnement_id, old.status_sinds, old.sso, old.sso_verplicht) then
    raise exception 'Pakket, plaatsen, modules, status, adres en aanmelden met Microsoft of Google wijzig je via Toolen.' using errcode = '42501';
  end if;
  return new;
end $$;

-- 5. Profiel: enkel de naam --------------------------------------------------
revoke update on maps.profielen from authenticated;
grant update (naam) on maps.profielen to authenticated;

-- 6. Organisaties aanmaken enkel via Toolen ---------------------------------
revoke execute on function maps.organisatie_aanmaken(text, text) from public, anon, authenticated;

-- 7. Live samenwerken: privékanalen ------------------------------------------
-- Onderwerpen: maps-plan-<plan-id> (wijzigingen, aanwezigheid, muis, berichten) en maps-aanwezig-<org-id> (lobby).
create or replace function maps.kanaal_mag(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_id text; org uuid;
begin
  if p_topic like 'maps-plan-%' then
    v_id := substr(p_topic, 11);
    if not maps.is_uuid(v_id) then return false; end if;
    select organisatie_id into org from maps.plannen where id = v_id::uuid;
    return org is not null and (maps.is_platformbeheerder() or (org = any (maps.lid_van()) and maps.plan_toegestaan(v_id::uuid)));
  elsif p_topic like 'maps-aanwezig-%' then
    v_id := substr(p_topic, 15);
    if not maps.is_uuid(v_id) then return false; end if;
    return v_id::uuid = any (maps.lid_van());
  end if;
  return false;
end $$;
revoke all on function maps.kanaal_mag(text) from public, anon;
grant execute on function maps.kanaal_mag(text) to authenticated;

drop policy if exists maps_kanaal_lezen on realtime.messages;
drop policy if exists maps_kanaal_zenden on realtime.messages;
create policy maps_kanaal_lezen on realtime.messages for select to authenticated
  using (maps.kanaal_mag(realtime.topic()));
create policy maps_kanaal_zenden on realtime.messages for insert to authenticated
  with check (maps.kanaal_mag(realtime.topic()));

-- 8. Opruimen ----------------------------------------------------------------
create schema if not exists extensions;
alter extension postgres_fdw set schema extensions;
revoke execute on function maps.deellinks_bewaken(), maps.events_bewaken(), maps.sessies_beperken() from public, anon, authenticated;
alter table maps.mail_log enable row level security;
revoke all on maps.mail_log from anon, authenticated;

-- Bestaand logo: van het publieke adres van de opslag naar /b.
update maps.organisaties set huisstijl = jsonb_set(huisstijl, '{logo_licht}', to_jsonb(replace(huisstijl->>'logo_licht', 'https://hlpurcdeouegvphvwygu.supabase.co/storage/v1/object/public/maps/', 'https://login.toolen.be/b/')))
 where huisstijl->>'logo_licht' like 'https://hlpurcdeouegvphvwygu.supabase.co/storage/v1/object/public/maps/%';
