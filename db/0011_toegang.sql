-- ============================================================================
-- Toolen · 0011_toegang.sql
-- Project: toolen (hlpurcdeouegvphvwygu). Na 0010.
--
-- Inloggen met bedrijfscode, e-mail en wachtwoord; tweestapsverificatie voor iedereen;
-- uitnodigen met een mail; toegang per lid beperken tot gekozen evenementen.
--
--   * organisaties.sso: Microsoft (azure) en/of Google, enkel voor grote klanten (zet het platform)
--   * tweede stap (aal2) verplicht, behalve bij inloggen via een toegelaten SSO van de organisatie
--   * leden.event_ids / uitnodigingen.event_ids: null = alle evenementen
--   * uitnodigingen: token enkel nog als hash bewaard, 7 dagen geldig, naam van de genodigde
--   * restrictieve policies: wie beperkt is, ziet enkel plannen (en alles erin) van zijn evenementen
--   * functies voor de server (service_role): account aanmaken bij een uitnodiging, 2FA resetten
--   * mail_log: om "wachtwoord vergeten" en uitnodigingen te begrenzen
--
-- Terugdraaien: restrictieve policies "evenementen" droppen, mfa_in_orde en mijn_organisaties
-- uit 0010 terugzetten, de nieuwe kolommen en functies droppen.
-- ============================================================================

-- 1. Kolommen -----------------------------------------------------------------

alter table maps.organisaties add column if not exists sso text[] not null default '{}';
alter table maps.organisaties drop constraint if exists organisaties_sso_check;
alter table maps.organisaties add constraint organisaties_sso_check check (sso <@ array['azure','google']::text[]);

alter table maps.leden add column if not exists event_ids uuid[];

alter table maps.uitnodigingen add column if not exists naam text;
alter table maps.uitnodigingen add column if not exists event_ids uuid[];
alter table maps.uitnodigingen add column if not exists token_hash text;
alter table maps.uitnodigingen add column if not exists verstuurd_op timestamptz;
alter table maps.uitnodigingen add column if not exists keer_verstuurd integer not null default 0;
alter table maps.uitnodigingen alter column geldig_tot set default now() + interval '7 days';

create or replace function maps.token_hash(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

-- Bestaande tokens omzetten naar een hash; het token zelf niet meer bewaren.
update maps.uitnodigingen set token_hash = maps.token_hash(token) where token_hash is null and token is not null;
alter table maps.uitnodigingen alter column token drop default;
alter table maps.uitnodigingen alter column token drop not null;
update maps.uitnodigingen set token = null where token is not null;
create unique index if not exists uitnodigingen_token_hash on maps.uitnodigingen (token_hash);

create or replace function maps.nieuw_token() returns text
language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

-- Eigenaars en beheerders zien altijd alle evenementen.
create or replace function maps.leden_evenementen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.rol in ('eigenaar', 'beheerder') or new.event_ids = '{}' then new.event_ids := null; end if;
  if new.event_ids is not null and exists (
       select 1 from unnest(new.event_ids) e where not exists (select 1 from maps.events v where v.id = e and v.organisatie_id = new.organisatie_id)) then
    raise exception 'Een gekozen evenement hoort niet bij deze organisatie.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists leden_evenementen on maps.leden;
create trigger leden_evenementen before insert or update of rol, event_ids on maps.leden for each row execute function maps.leden_evenementen();
drop trigger if exists uitnodigingen_evenementen on maps.uitnodigingen;
create trigger uitnodigingen_evenementen before insert or update of rol, event_ids on maps.uitnodigingen for each row execute function maps.leden_evenementen();

-- Wat er bij een lid verandert (rol, actief, evenementen) in het logboek.
create or replace function maps.leden_loggen() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d jsonb := '{}';
begin
  if new.rol is distinct from old.rol then d := d || jsonb_build_object('rol', jsonb_build_array(old.rol, new.rol)); end if;
  if new.actief is distinct from old.actief then d := d || jsonb_build_object('actief', jsonb_build_array(old.actief, new.actief)); end if;
  if new.event_ids is distinct from old.event_ids then d := d || jsonb_build_object('evenementen', jsonb_build_array(to_jsonb(old.event_ids), to_jsonb(new.event_ids))); end if;
  if d <> '{}' then
    insert into maps.logboek_organisatie (organisatie_id, actie, details)
    values (new.organisatie_id, 'lid_gewijzigd', d || jsonb_build_object('lid', (select email from maps.profielen where id = new.user_id)));
  end if;
  return new;
end $$;
drop trigger if exists leden_loggen on maps.leden;
create trigger leden_loggen after update on maps.leden for each row execute function maps.leden_loggen();
revoke execute on function maps.leden_loggen(), maps.leden_evenementen() from public, anon, authenticated;

-- 2. Tweede stap verplicht -------------------------------------------------------

-- In orde voor een organisatie: met de tweede stap (aal2), of via een SSO die deze organisatie toelaat
-- (Microsoft of Google van een groot bedrijf: die doen zelf de tweede stap).
-- Zonder JWT (service_role, SQL Editor, tests) in orde.
create or replace function maps.mfa_in_orde_voor(p_sso text[]) returns boolean
language sql stable set search_path = '' as $$
  select case
    when auth.jwt() is null or auth.jwt() = '{}'::jsonb then true
    when coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then true
    when exists (select 1 from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
                  where a ->> 'method' = 'oauth')
      then coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = any (coalesce(p_sso, '{}'))
    else false
  end;
$$;

-- Algemeen (zonder organisatie): aal2 of een SSO-aanmelding.
create or replace function maps.mfa_in_orde() returns boolean
language sql stable set search_path = '' as $$
  select case
    when auth.jwt() is null or auth.jwt() = '{}'::jsonb then true
    when coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then true
    else exists (select 1 from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
                  where a ->> 'method' = 'oauth')
  end;
$$;

create or replace function maps.mijn_organisaties(p_min text default 'lezer') returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(o.id), '{}')
    from maps.leden l
    join maps.organisaties o on o.id = l.organisatie_id
   where l.user_id = auth.uid()
     and maps.mfa_in_orde_voor(o.sso)
     and l.actief
     and maps.rol_rang(l.rol) >= maps.rol_rang(p_min)
     and (maps.actieve_organisatie() is null or o.id = maps.actieve_organisatie())
     and case when maps.rol_rang(p_min) >= 2
              then o.status in ('proef','actief','achterstallig')
              else o.status in ('proef','actief','achterstallig','alleen_lezen')
                   or (o.status = 'geblokkeerd' and l.rol = 'eigenaar') end;
$$;

create or replace function maps.lid_van() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(l.organisatie_id), '{}')
    from maps.leden l join maps.organisaties o on o.id = l.organisatie_id
   where l.user_id = auth.uid() and l.actief and maps.mfa_in_orde_voor(o.sso);
$$;

-- 3. Evenementen per lid ----------------------------------------------------------

-- Mag ik aan dit evenement (van deze organisatie)? Leden zonder beperking: altijd.
create or replace function maps.event_toegestaan(p_org uuid, p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is null
      or maps.is_platformbeheerder()
      or exists (select 1 from maps.leden l
                  where l.user_id = auth.uid() and l.organisatie_id = p_org and l.actief
                    and (l.event_ids is null or p_event = any (l.event_ids)));
$$;

-- Mag ik aan dit plan? Snel pad: wie nergens beperkt is, mag (de gewone policies doen de rest).
create or replace function maps.plan_toegestaan(p_plan uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_plan is null
      or not exists (select 1 from maps.leden where user_id = auth.uid() and event_ids is not null)
      or exists (select 1 from maps.plannen p where p.id = p_plan and maps.event_toegestaan(p.organisatie_id, p.event_id));
$$;

-- Plan van een item (voor opmerkingen en bestanden die enkel aan een item hangen).
create or replace function maps.item_plan(p_item uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select plan_id from maps.items where id = p_item;
$$;

do $$
declare t text;
begin
  drop policy if exists evenementen on maps.events;
  create policy evenementen on maps.events as restrictive for all to authenticated
    using (maps.event_toegestaan(organisatie_id, id)) with check (maps.event_toegestaan(organisatie_id, id));
  drop policy if exists evenementen on maps.plannen;
  create policy evenementen on maps.plannen as restrictive for all to authenticated
    using (maps.event_toegestaan(organisatie_id, event_id)) with check (maps.event_toegestaan(organisatie_id, event_id));
  foreach t in array array['lagen','fasen','items','versies','deel_links','items_prullenbak','wijzigingen'] loop
    execute format('drop policy if exists evenementen on maps.%I', t);
    execute format('create policy evenementen on maps.%I as restrictive for all to authenticated using (maps.plan_toegestaan(plan_id)) with check (maps.plan_toegestaan(plan_id))', t);
  end loop;
  foreach t in array array['bestanden','opmerkingen'] loop
    execute format('drop policy if exists evenementen on maps.%I', t);
    execute format('create policy evenementen on maps.%I as restrictive for all to authenticated using (maps.plan_toegestaan(coalesce(plan_id, maps.item_plan(item_id)))) with check (maps.plan_toegestaan(coalesce(plan_id, maps.item_plan(item_id))))', t);
  end loop;
end $$;

-- 4. Inloggen met bedrijfscode ---------------------------------------------------

-- Wat het inlogscherm over een bedrijfscode mag weten: naam en toegelaten SSO.
-- Onbekende code: geen naam, enkel wachtwoord (de fout volgt pas na inloggen, zonder te zeggen wat er mis is).
create or replace function maps.inlog_info(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('code', o.slug, 'naam', o.naam, 'sso', to_jsonb(o.sso))
       from maps.organisaties o
      where o.slug = lower(btrim(p_code)) and o.status <> 'verwijderd'),
    jsonb_build_object('code', lower(btrim(coalesce(p_code, ''))), 'naam', null, 'sso', '[]'::jsonb));
$$;

-- Na het wachtwoord: ben ik actief lid van dit bedrijf? Geeft de slug of null.
create or replace function maps.lid_van_code(p_code text) returns text
language sql stable security definer set search_path = '' as $$
  select o.slug from maps.organisaties o join maps.leden l on l.organisatie_id = o.id
   where o.slug = lower(btrim(p_code)) and l.user_id = auth.uid() and l.actief
     and (o.status in ('proef','actief','achterstallig','alleen_lezen') or (o.status = 'geblokkeerd' and l.rol = 'eigenaar'));
$$;

-- 5. Uitnodigingen -------------------------------------------------------------

-- Nieuwe uitnodiging (beheerder van de organisatie of platform). Geeft id en token (enkel nu te zien).
create or replace function maps.uitnodiging_maken(p_org uuid, p_email text, p_naam text, p_rol text, p_event_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_token text := maps.nieuw_token(); v_id uuid;
begin
  if not (p_org = any (maps.mijn_organisaties('beheerder')) or maps.is_platformbeheerder()) then
    raise exception 'Enkel een beheerder kan uitnodigen.' using errcode = '42501';
  end if;
  -- Een oude open uitnodiging voor hetzelfde adres vervangt deze.
  delete from maps.uitnodigingen where organisatie_id = p_org and lower(email) = lower(btrim(p_email)) and aanvaard_op is null;
  insert into maps.uitnodigingen (organisatie_id, email, naam, rol, event_ids, token_hash, geldig_tot)
  values (p_org, p_email, nullif(btrim(coalesce(p_naam, '')), ''), p_rol, p_event_ids, maps.token_hash(v_token), now() + interval '7 days')
  returning id into v_id;
  insert into maps.logboek_organisatie (organisatie_id, actie, details)
  values (p_org, 'uitgenodigd', jsonb_build_object('email', lower(btrim(p_email)), 'rol', p_rol, 'evenementen', to_jsonb(p_event_ids)));
  return jsonb_build_object('id', v_id, 'token', v_token);
end $$;

-- Opnieuw versturen: nieuw token, weer 7 dagen geldig. Geeft alles wat de mail nodig heeft.
create or replace function maps.uitnodiging_vernieuwen(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_token text := maps.nieuw_token(); u maps.uitnodigingen%rowtype;
begin
  select * into u from maps.uitnodigingen where id = p_id and aanvaard_op is null;
  if not found then raise exception 'Deze uitnodiging bestaat niet (meer).' using errcode = 'P0001'; end if;
  if not (u.organisatie_id = any (maps.mijn_organisaties('beheerder')) or maps.is_platformbeheerder()) then
    raise exception 'Enkel een beheerder kan uitnodigen.' using errcode = '42501';
  end if;
  update maps.uitnodigingen set token_hash = maps.token_hash(v_token), geldig_tot = now() + interval '7 days' where id = p_id;
  return jsonb_build_object('id', u.id, 'token', v_token);
end $$;

-- Gegevens voor de mail (na maken of vernieuwen); ook de naam van wie uitnodigt.
create or replace function maps.uitnodiging_mailgegevens(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('email', u.email, 'naam', u.naam, 'rol', u.rol, 'organisatie', o.naam, 'code', o.slug,
                            'geldig_tot', u.geldig_tot,
                            'door', (select coalesce(p.naam, p.email) from maps.profielen p where p.id = auth.uid()),
                            'door_email', (select p.email from maps.profielen p where p.id = auth.uid()),
                            'evenementen', (select coalesce(jsonb_agg(e.naam order by e.naam), '[]'::jsonb) from maps.events e where e.id = any (u.event_ids)))
    from maps.uitnodigingen u join maps.organisaties o on o.id = u.organisatie_id
   where u.id = p_id
     and (u.organisatie_id = any (maps.mijn_organisaties('beheerder')) or maps.is_platformbeheerder());
$$;

create or replace function maps.uitnodiging_verstuurd(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update maps.uitnodigingen set verstuurd_op = now(), keer_verstuurd = keer_verstuurd + 1
   where id = p_id and (organisatie_id = any (maps.mijn_organisaties('beheerder')) or maps.is_platformbeheerder());
$$;

-- Wat staat er in een uitnodiging (vóór het aanvaarden). Ook: bestaat er al een account voor dit adres.
create or replace function maps.uitnodiging_info(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('email', u.email, 'naam', u.naam, 'rol', u.rol, 'organisatie', o.naam, 'slug', o.slug,
                            'geldig', u.aanvaard_op is null and u.geldig_tot > now(), 'aanvaard', u.aanvaard_op is not null,
                            'account', exists (select 1 from auth.users a where lower(a.email) = lower(u.email)),
                            'door', (select coalesce(p.naam, p.email) from maps.profielen p where p.id = u.uitgenodigd_door))
    from maps.uitnodigingen u join maps.organisaties o on o.id = u.organisatie_id
   where p_token is not null and length(p_token) >= 20 and u.token_hash = maps.token_hash(p_token);
$$;

-- Aanvaarden: door de ingelogde gebruiker (p_user null) of door de server na het aanmaken van het account.
create or replace function maps.uitnodiging_aanvaarden_door(p_token text, p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u maps.uitnodigingen%rowtype; v_email text; o maps.organisaties%rowtype;
begin
  select email into v_email from auth.users where id = p_user;
  if v_email is null then raise exception 'Niet ingelogd' using errcode = '42501'; end if;
  select * into u from maps.uitnodigingen where token_hash = maps.token_hash(p_token) and aanvaard_op is null and geldig_tot > now();
  if not found then raise exception 'Deze uitnodiging is niet (meer) geldig.' using errcode = 'P0001'; end if;
  if lower(u.email) <> lower(v_email) then
    raise exception 'Deze uitnodiging is voor %. Log in met dat adres.', u.email using errcode = '42501';
  end if;
  perform set_config('maps.via_uitnodiging', '1', true);
  update maps.uitnodigingen set aanvaard_op = now() where id = u.id;
  insert into maps.leden (organisatie_id, user_id, rol, event_ids, uitgenodigd_door)
  values (u.organisatie_id, p_user, u.rol, u.event_ids, u.uitgenodigd_door)
  on conflict (organisatie_id, user_id) do update set actief = true, rol = excluded.rol, event_ids = excluded.event_ids;
  perform set_config('maps.via_uitnodiging', '', true);
  if u.naam is not null then update maps.profielen set naam = coalesce(naam, u.naam) where id = p_user; end if;
  insert into maps.logboek_organisatie (organisatie_id, door, actie, details)
  values (u.organisatie_id, p_user, 'uitnodiging_aanvaard', jsonb_build_object('email', u.email, 'rol', u.rol));
  select * into o from maps.organisaties where id = u.organisatie_id;
  return jsonb_build_object('slug', o.slug, 'naam', o.naam);
end $$;

create or replace function maps.uitnodiging_aanvaarden(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd' using errcode = '42501'; end if;
  return maps.uitnodiging_aanvaarden_door(p_token, auth.uid());
end $$;

-- Platform: organisatie met eerste eigenaar; de uitnodiging krijgt een token (mail via de server).
create or replace function maps.platform_organisatie_aanmaken(
  p_naam text, p_slug text, p_kort text, p_pakket text, p_plaatsen integer, p_lezers integer,
  p_modules text[], p_status text, p_proef_tot timestamptz, p_eigenaar_email text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_user uuid; v_token text; v_uitn uuid; p maps.pakketten;
begin
  if not maps.is_platformbeheerder() then raise exception 'Enkel voor platformbeheerders' using errcode = '42501'; end if;
  select * into p from maps.pakketten where id = coalesce(p_pakket, 'proef');
  if p.id is null then raise exception 'Onbekend pakket: %', p_pakket using errcode = 'P0001'; end if;
  insert into maps.organisaties (naam, slug, kort, pakket, plaatsen, lezers_max, modules, status, proef_tot)
  values (btrim(p_naam), lower(btrim(p_slug)), nullif(btrim(p_kort), ''), p.id, coalesce(p_plaatsen, p.plaatsen),
          coalesce(p_lezers, p.lezers), coalesce(p_modules, p.modules), coalesce(p_status, 'proef'),
          coalesce(p_proef_tot, case when coalesce(p_status, 'proef') = 'proef' and p.proef_dagen is not null then now() + make_interval(days => p.proef_dagen) end))
  returning id into v_org;
  insert into maps.logboek_organisatie (organisatie_id, actie, details)
  values (v_org, 'organisatie_aangemaakt', jsonb_build_object('naam', p_naam, 'slug', p_slug, 'pakket', p.id, 'door', 'platform'));
  if coalesce(btrim(p_eigenaar_email), '') <> '' then
    select id into v_user from auth.users where lower(email) = lower(btrim(p_eigenaar_email));
    if v_user is not null then
      insert into maps.leden (organisatie_id, user_id, rol) values (v_org, v_user, 'eigenaar');
    else
      v_token := maps.nieuw_token();
      insert into maps.uitnodigingen (organisatie_id, email, rol, token_hash) values (v_org, p_eigenaar_email, 'eigenaar', maps.token_hash(v_token)) returning id into v_uitn;
    end if;
  end if;
  return jsonb_build_object('id', v_org, 'slug', lower(btrim(p_slug)), 'eigenaar_lid', v_user is not null, 'token', v_token, 'uitnodiging', v_uitn);
exception when unique_violation then
  raise exception 'Het adres %.toolen.be is al in gebruik.', lower(btrim(p_slug)) using errcode = 'P0001';
end $$;

-- 6. Leden met evenementen en tweestapsverificatie -----------------------------------

drop function if exists maps.leden_van(uuid);
create function maps.leden_van(p_org uuid)
returns table (user_id uuid, email text, naam text, rol text, actief boolean, sinds timestamptz, laatste_login timestamptz, ik boolean, event_ids uuid[], mfa boolean)
language sql stable security definer set search_path = '' as $$
  select l.user_id, p.email, p.naam, l.rol, l.actief, l.sinds, l.laatste_login, l.user_id = auth.uid(), l.event_ids,
         exists (select 1 from auth.mfa_factors f where f.user_id = l.user_id and f.status = 'verified')
    from maps.leden l left join maps.profielen p on p.id = l.user_id
   where l.organisatie_id = p_org
     and (p_org = any (maps.lid_van()) or maps.is_platformbeheerder())
   order by maps.rol_rang(l.rol) desc, coalesce(p.naam, p.email);
$$;

-- Mag ik de tweestapsverificatie van dit lid resetten? Beheerder (eigenaar voor een eigenaar),
-- niet voor jezelf; het platform altijd. Logt meteen. De server wist daarna de factoren.
create or replace function maps.mfa_reset_toestaan(p_user uuid, p_org uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare doel maps.leden%rowtype; ik maps.leden%rowtype; v_email text; v_org text;
begin
  select * into doel from maps.leden where user_id = p_user and organisatie_id = p_org;
  if not found then raise exception 'Geen lid van deze organisatie.' using errcode = '42501'; end if;
  if not maps.is_platformbeheerder() then
    if p_user = auth.uid() then raise exception 'Je eigen tweestapsverificatie reset je niet zelf.' using errcode = '42501'; end if;
    select * into ik from maps.leden where user_id = auth.uid() and organisatie_id = p_org and actief;
    if not found or not (p_org = any (maps.mijn_organisaties('beheerder'))) then
      raise exception 'Enkel een beheerder kan dit.' using errcode = '42501';
    end if;
    if doel.rol = 'eigenaar' then raise exception 'De tweestapsverificatie van een eigenaar reset enkel Toolen.' using errcode = '42501'; end if;
  end if;
  select email into v_email from maps.profielen where id = p_user;
  select naam into v_org from maps.organisaties where id = p_org;
  insert into maps.logboek_organisatie (organisatie_id, actie, details) values (p_org, 'mfa_gereset', jsonb_build_object('lid', v_email));
  return jsonb_build_object('email', v_email, 'organisatie', v_org,
                            'door', (select coalesce(p.naam, p.email) from maps.profielen p where p.id = auth.uid()));
end $$;

-- 7. Mails begrenzen -------------------------------------------------------------

create table if not exists maps.mail_log (
  id    bigint generated always as identity primary key,
  email text not null,
  soort text not null,
  op    timestamptz not null default now()
);
create index if not exists mail_log_email on maps.mail_log (lower(email), soort, op desc);
alter table maps.mail_log enable row level security;
revoke all on maps.mail_log from anon, authenticated;

-- Mag er nog een mail van deze soort naar dit adres? (max p_max per uur). Registreert meteen.
create or replace function maps.mail_toegestaan(p_email text, p_soort text, p_max integer default 3) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from maps.mail_log where op < now() - interval '2 days';
  if (select count(*) from maps.mail_log where lower(email) = lower(p_email) and soort = p_soort and op > now() - interval '1 hour') >= p_max then
    return false;
  end if;
  insert into maps.mail_log (email, soort) values (lower(p_email), p_soort);
  return true;
end $$;

-- Platform: leden zonder wachtwoord (voor de mail "stel je wachtwoord in").
create or replace function maps.platform_zonder_wachtwoord() returns table (user_id uuid, email text, naam text, organisatie text)
language sql stable security definer set search_path = '' as $$
  select distinct on (u.id) u.id, u.email::text, p.naam, o.naam
    from auth.users u join maps.leden l on l.user_id = u.id and l.actief
    join maps.organisaties o on o.id = l.organisatie_id
    left join maps.profielen p on p.id = u.id
   where maps.is_platformbeheerder() and coalesce(u.encrypted_password, '') = ''
   order by u.id, o.naam;
$$;

-- 8. Rechten ---------------------------------------------------------------------

revoke execute on function maps.token_hash(text), maps.nieuw_token() from public, anon, authenticated;
revoke execute on function maps.inlog_info(text) from public;
grant execute on function maps.inlog_info(text) to anon, authenticated;
revoke execute on function maps.uitnodiging_info(text) from public;
grant execute on function maps.uitnodiging_info(text) to anon, authenticated, service_role;
do $$
declare f text;
begin
  foreach f in array array['maps.lid_van_code(text)', 'maps.uitnodiging_maken(uuid,text,text,text,uuid[])', 'maps.uitnodiging_vernieuwen(uuid)',
                           'maps.uitnodiging_mailgegevens(uuid)', 'maps.uitnodiging_verstuurd(uuid)', 'maps.uitnodiging_aanvaarden(text)',
                           'maps.leden_van(uuid)', 'maps.mfa_reset_toestaan(uuid,uuid)', 'maps.platform_zonder_wachtwoord()',
                           'maps.event_toegestaan(uuid,uuid)', 'maps.plan_toegestaan(uuid)', 'maps.item_plan(uuid)', 'maps.mfa_in_orde_voor(text[])',
                           'maps.platform_organisatie_aanmaken(text,text,text,text,integer,integer,text[],text,timestamptz,text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  -- Enkel voor de server (service_role).
  foreach f in array array['maps.uitnodiging_aanvaarden_door(text,uuid)', 'maps.mail_toegestaan(text,text,integer)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
grant select, insert on maps.mail_log to service_role;
