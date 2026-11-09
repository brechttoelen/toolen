-- ============================================================================
-- Toolen · 0003_beheer.sql
-- Project: toolen (hlpurcdeouegvphvwygu). Na 0001 (0002 is los, mag later).
--
-- Voor het platformbeheer (/beheer) en het ledenbeheer per organisatie (/instellingen):
--   * platformbeheerders zien leden, uitnodigingen en profielen van alle organisaties
--   * een organisatie aanmaken met een eerste eigenaar (uitnodiging of meteen lid)
--   * uitnodigen als eigenaar (enkel platform of een eigenaar), aanvaarden via de link
--   * logboek bij wijzigingen van pakket, plaatsen, modules en status
--   * overzichtsfuncties: platform_overzicht(), leden_van(org), uitnodiging_info(token)
--
-- Terugdraaien: de functies en policies hieronder droppen; de check op
-- uitnodigingen.rol terugzetten naar ('beheerder','bewerker','lezer').
-- ============================================================================

-- Uitnodigen als eigenaar mag (door het platform of een eigenaar).
alter table maps.uitnodigingen drop constraint if exists uitnodigingen_rol_check;
alter table maps.uitnodigingen add constraint uitnodigingen_rol_check check (rol in ('eigenaar','beheerder','bewerker','lezer'));

create or replace function maps.uitnodiging_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(btrim(new.email));
  if new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Geen geldig e-mailadres: %', new.email using errcode = 'P0001';
  end if;
  if auth.uid() is null or maps.is_platformbeheerder() then return new; end if;
  if new.rol = 'eigenaar' and not exists (select 1 from maps.leden where organisatie_id = new.organisatie_id and user_id = auth.uid() and rol = 'eigenaar' and actief) then
    raise exception 'Enkel een eigenaar kan iemand als eigenaar uitnodigen.' using errcode = '42501';
  end if;
  if exists (select 1 from maps.leden l join maps.profielen p on p.id = l.user_id
              where l.organisatie_id = new.organisatie_id and l.actief and lower(p.email) = new.email) then
    raise exception '% is al lid van deze organisatie.', new.email using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists uitnodigingen_bewaken on maps.uitnodigingen;
create trigger uitnodigingen_bewaken before insert on maps.uitnodigingen for each row execute function maps.uitnodiging_bewaken();

-- Eigenaarscontrole: niet bij het platform en niet bij het aanvaarden van een uitnodiging
-- (die is al gecontroleerd bij het uitnodigen).
create or replace function maps.eigenaar_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  org uuid := coalesce((n ->> 'organisatie_id')::uuid, (o ->> 'organisatie_id')::uuid);
  ik_eigenaar boolean;
begin
  if auth.uid() is not null and not maps.is_platformbeheerder()
     and coalesce(current_setting('maps.via_uitnodiging', true), '') <> '1' then
    select exists (select 1 from maps.leden where organisatie_id = org and user_id = auth.uid() and rol = 'eigenaar' and actief) into ik_eigenaar;
    if tg_op = 'INSERT' and (n ->> 'user_id')::uuid = auth.uid()
       and not exists (select 1 from maps.leden where organisatie_id = org and rol = 'eigenaar') then
      ik_eigenaar := true;
    end if;
    if not ik_eigenaar and ((n ->> 'rol') = 'eigenaar' or (o ->> 'rol') = 'eigenaar') then
      raise exception 'Enkel een eigenaar kan eigenaars toevoegen, wijzigen of verwijderen.' using errcode = '42501';
    end if;
  end if;
  if (o ->> 'rol') = 'eigenaar' and coalesce((o ->> 'actief')::boolean, false)
     and (n is null or (n ->> 'rol') <> 'eigenaar' or not coalesce((n ->> 'actief')::boolean, false))
     and not exists (select 1 from maps.leden where organisatie_id = org and rol = 'eigenaar' and actief and user_id <> (o ->> 'user_id')::uuid)
     and exists (select 1 from maps.organisaties where id = org) then
    raise exception 'Er moet minstens één eigenaar blijven.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create or replace function maps.uitnodiging_aanvaarden(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u maps.uitnodigingen%rowtype; mijn_email text; o maps.organisaties%rowtype;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd' using errcode = '42501'; end if;
  select email into mijn_email from auth.users where id = auth.uid();
  select * into u from maps.uitnodigingen where token = p_token and aanvaard_op is null and geldig_tot > now();
  if not found then raise exception 'Deze uitnodiging is niet (meer) geldig.' using errcode = 'P0001'; end if;
  if lower(u.email) <> lower(mijn_email) then
    raise exception 'Deze uitnodiging is voor %. Log in met dat adres.', u.email using errcode = '42501';
  end if;
  perform set_config('maps.via_uitnodiging', '1', true);
  update maps.uitnodigingen set aanvaard_op = now() where id = u.id;
  insert into maps.leden (organisatie_id, user_id, rol, uitgenodigd_door)
  values (u.organisatie_id, auth.uid(), u.rol, u.uitgenodigd_door)
  on conflict (organisatie_id, user_id) do update set actief = true, rol = excluded.rol;
  perform set_config('maps.via_uitnodiging', '', true);
  insert into maps.logboek_organisatie (organisatie_id, actie, details) values (u.organisatie_id, 'uitnodiging_aanvaard', jsonb_build_object('email', u.email, 'rol', u.rol));
  select * into o from maps.organisaties where id = u.organisatie_id;
  return jsonb_build_object('slug', o.slug, 'naam', o.naam);
end $$;

-- Wat staat er in een uitnodiging (om ze te tonen vóór het aanvaarden).
create or replace function maps.uitnodiging_info(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('email', u.email, 'rol', u.rol, 'organisatie', o.naam, 'slug', o.slug,
                            'geldig', u.aanvaard_op is null and u.geldig_tot > now(), 'aanvaard', u.aanvaard_op is not null,
                            'door', (select coalesce(p.naam, p.email) from maps.profielen p where p.id = u.uitgenodigd_door))
    from maps.uitnodigingen u join maps.organisaties o on o.id = u.organisatie_id
   where p_token is not null and length(p_token) >= 20 and u.token = p_token;
$$;

-- Leden van een organisatie met naam en e-mail (voor leden en het platform).
create or replace function maps.leden_van(p_org uuid)
returns table (user_id uuid, email text, naam text, rol text, actief boolean, sinds timestamptz, laatste_login timestamptz, ik boolean)
language sql stable security definer set search_path = '' as $$
  select l.user_id, p.email, p.naam, l.rol, l.actief, l.sinds, l.laatste_login, l.user_id = auth.uid()
    from maps.leden l left join maps.profielen p on p.id = l.user_id
   where l.organisatie_id = p_org
     and (p_org = any (maps.lid_van()) or maps.is_platformbeheerder())
   order by maps.rol_rang(l.rol) desc, coalesce(p.naam, p.email);
$$;

-- Overzicht voor het platform: elke organisatie met gebruik.
create or replace function maps.platform_overzicht()
returns table (id uuid, slug text, naam text, kort text, status text, status_sinds timestamptz, proef_tot timestamptz, pakket text,
               plaatsen integer, plaatsen_gebruikt bigint, lezers_max integer, lezers_gebruikt bigint, modules text[],
               plannen bigint, eigenaars text, laatste_wijziging timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.id, o.slug, o.naam, o.kort, o.status, o.status_sinds, o.proef_tot, o.pakket,
         o.plaatsen, (maps.plaatsen_in_gebruik(o.id) ->> 'plaatsen')::bigint,
         o.lezers_max, (maps.plaatsen_in_gebruik(o.id) ->> 'lezers')::bigint,
         o.modules,
         (select count(*) from maps.plannen p where p.organisatie_id = o.id and p.verwijderd_op is null),
         (select string_agg(coalesce(pr.email, ''), ', ') from maps.leden l left join maps.profielen pr on pr.id = l.user_id
           where l.organisatie_id = o.id and l.rol = 'eigenaar' and l.actief),
         (select max(w.op) from maps.wijzigingen w where w.organisatie_id = o.id),
         o.created_at
    from maps.organisaties o
   where maps.is_platformbeheerder()
   order by o.naam;
$$;

-- Organisatie aanmaken door het platform, met een eerste eigenaar.
-- Bestaat de gebruiker al: meteen eigenaar. Anders: een uitnodiging (token terug).
create or replace function maps.platform_organisatie_aanmaken(
  p_naam text, p_slug text, p_kort text, p_pakket text, p_plaatsen integer, p_lezers integer,
  p_modules text[], p_status text, p_proef_tot timestamptz, p_eigenaar_email text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_user uuid; v_token text;
begin
  if not maps.is_platformbeheerder() then raise exception 'Enkel voor platformbeheerders' using errcode = '42501'; end if;
  insert into maps.organisaties (naam, slug, kort, pakket, plaatsen, lezers_max, modules, status, proef_tot)
  values (btrim(p_naam), lower(btrim(p_slug)), nullif(btrim(p_kort), ''), coalesce(p_pakket, 'proef'), coalesce(p_plaatsen, 5),
          coalesce(p_lezers, 25), coalesce(p_modules, '{}'), coalesce(p_status, 'proef'), p_proef_tot)
  returning id into v_org;
  insert into maps.logboek_organisatie (organisatie_id, actie, details)
  values (v_org, 'organisatie_aangemaakt', jsonb_build_object('naam', p_naam, 'slug', p_slug, 'door', 'platform'));
  if coalesce(btrim(p_eigenaar_email), '') <> '' then
    select id into v_user from auth.users where lower(email) = lower(btrim(p_eigenaar_email));
    if v_user is not null then
      insert into maps.leden (organisatie_id, user_id, rol) values (v_org, v_user, 'eigenaar');
    else
      insert into maps.uitnodigingen (organisatie_id, email, rol) values (v_org, p_eigenaar_email, 'eigenaar') returning token into v_token;
    end if;
  end if;
  return jsonb_build_object('id', v_org, 'slug', lower(btrim(p_slug)), 'eigenaar_lid', v_user is not null, 'token', v_token);
exception when unique_violation then
  raise exception 'Het adres %.toolen.be is al in gebruik.', lower(btrim(p_slug)) using errcode = 'P0001';
end $$;

-- Logboek en status_sinds bij wijzigingen van het abonnement.
create or replace function maps.organisatie_loggen() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d jsonb := '{}';
begin
  if new.status is distinct from old.status then
    new.status_sinds := now();
    d := d || jsonb_build_object('status', jsonb_build_array(old.status, new.status));
  end if;
  if new.pakket is distinct from old.pakket then d := d || jsonb_build_object('pakket', jsonb_build_array(old.pakket, new.pakket)); end if;
  if new.plaatsen is distinct from old.plaatsen then d := d || jsonb_build_object('plaatsen', jsonb_build_array(old.plaatsen, new.plaatsen)); end if;
  if new.lezers_max is distinct from old.lezers_max then d := d || jsonb_build_object('lezers_max', jsonb_build_array(old.lezers_max, new.lezers_max)); end if;
  if new.modules is distinct from old.modules then d := d || jsonb_build_object('modules', jsonb_build_array(to_jsonb(old.modules), to_jsonb(new.modules))); end if;
  if new.proef_tot is distinct from old.proef_tot then d := d || jsonb_build_object('proef_tot', jsonb_build_array(old.proef_tot, new.proef_tot)); end if;
  if new.naam is distinct from old.naam then d := d || jsonb_build_object('naam', jsonb_build_array(old.naam, new.naam)); end if;
  if d <> '{}' then
    insert into maps.logboek_organisatie (organisatie_id, actie, details) values (new.id, 'gewijzigd', d);
  end if;
  return new;
end $$;

drop trigger if exists organisaties_loggen on maps.organisaties;
create trigger organisaties_loggen before update on maps.organisaties for each row execute function maps.organisatie_loggen();

-- Platformbeheerders zien en beheren leden, uitnodigingen en profielen van iedereen.
drop policy if exists platform on maps.leden;
create policy platform on maps.leden for all to authenticated
  using (maps.is_platformbeheerder()) with check (maps.is_platformbeheerder());
drop policy if exists platform on maps.uitnodigingen;
create policy platform on maps.uitnodigingen for all to authenticated
  using (maps.is_platformbeheerder()) with check (maps.is_platformbeheerder());
drop policy if exists platform on maps.profielen;
create policy platform on maps.profielen for select to authenticated
  using (maps.is_platformbeheerder());
-- Leden lezen ook de openstaande uitnodigingen van hun organisatie (plaatsenteller).
drop policy if exists lezen on maps.uitnodigingen;
create policy lezen on maps.uitnodigingen for select to authenticated
  using (organisatie_id in (select unnest(maps.lid_van())));

revoke execute on function maps.uitnodiging_bewaken(), maps.organisatie_loggen() from public, anon, authenticated;
grant execute on function maps.uitnodiging_info(text) to anon, authenticated;
grant execute on function maps.leden_van(uuid), maps.platform_overzicht(),
  maps.platform_organisatie_aanmaken(text, text, text, text, integer, integer, text[], text, timestamptz, text)
  to authenticated;
