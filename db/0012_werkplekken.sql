-- ============================================================================
-- Toolen · 0012_werkplekken.sql
-- Project: toolen (hlpurcdeouegvphvwygu). Na 0011.
--
-- Een bewerker kan beperkt worden tot gekozen werkplekken (Signalisatie, Stroom, Veiligheid,
-- Branding, TV), bv. de elektricien enkel Stroom. Hij ziet het hele plan, maar wijzigt enkel
-- items van zijn werkplekken en de instellingen van die werkplekken.
--
--   * leden.werkplekken / uitnodigingen.werkplekken: null = alles (eigenaar en beheerder altijd null)
--   * items.werkplekken: berekend door de database bij elke wijziging (niet door de app)
--   * restrictieve policies op schrijven: items enkel van je werkplekken; lagen, fasen, versies,
--     deellinks en nieuwe plannen enkel zonder beperking; plannen: enkel de instellingen van je werkplekken
--
-- Terugdraaien: policies "werkplekken_*" en trigger items_werkplekken/plannen_werkplekken droppen,
-- kolommen werkplekken droppen.
-- ============================================================================

alter table maps.leden add column if not exists werkplekken text[];
alter table maps.uitnodigingen add column if not exists werkplekken text[];
alter table maps.items add column if not exists werkplekken text[] not null default '{}';
do $$ begin
  alter table maps.leden drop constraint if exists leden_werkplekken_check;
  alter table maps.leden add constraint leden_werkplekken_check check (werkplekken <@ array['sign','stroom','veiligheid','branding','tv']::text[]);
  alter table maps.uitnodigingen drop constraint if exists uitnodigingen_werkplekken_check;
  alter table maps.uitnodigingen add constraint uitnodigingen_werkplekken_check check (werkplekken <@ array['sign','stroom','veiligheid','branding','tv']::text[]);
end $$;
create index if not exists items_werkplekken on maps.items using gin (werkplekken);

-- Werkplekken van een item: dezelfde regels als de lens van elke werkplek in de editor
-- (werkruimtes.js, relevanteItems), op velden, element uit de bibliotheek en de naam van de laag.
create or replace function maps.werkplekken_van(v jsonb, p_element uuid, p_laag uuid, p_naam text) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  eig jsonb := '{}'; l text := ''; en text := ''; cat text := ''; tw text := ''; r text[] := '{}';
begin
  v := coalesce(v, '{}');
  if p_element is not null then
    select coalesce(b.eigenschappen, '{}'), coalesce(b.categorie, ''), coalesce(b.naam, ''), coalesce(b.tekenwijze, '')
      into eig, cat, en, tw from maps.bibliotheek b where b.id = p_element;
    eig := coalesce(eig, '{}'); cat := coalesce(cat, ''); en := coalesce(en, ''); tw := coalesce(tw, '');
  end if;
  if p_laag is not null then select lower(naam) into l from maps.lagen where id = p_laag; l := coalesce(l, ''); end if;

  if v ? 'sign' or (v -> 'verkeer') ? 'soort' or l ~ '(signali|bord|parking|^verkeer$)' or coalesce(p_naam, '') ~* '^ppo\y' then
    r := array_append(r, 'sign'); end if;
  if (v -> 'stroom') ? 'rol' or coalesce((eig ->> 'kva') ~ '^[0-9.]+$' and (eig ->> 'kva')::numeric > 0, false) or eig ? 'ampere' or eig ? 'stekkerdoos'
     or jsonb_typeof(eig -> 'aansluitingen') = 'array' and jsonb_array_length(eig -> 'aansluitingen') > 0 or eig ? 'kw'
     or l ~ '(stroom|elektr)' or en ~* '(kabelgoot|kabelbrug)' then
    r := array_append(r, 'stroom'); end if;
  if eig ? 'veiligheid' or cat = 'Veiligheid' or v ? 'attesten' or v ? 'publiek' or v ? 'personen'
     or coalesce((eig ->> 'kva') ~ '^[0-9.]+$' and (eig ->> 'kva')::numeric > 0, false)
     or cat ~* '(tent|chapiteau|paviljoen)'
     or l ~ '(veiligheid|ehbo|hulpdienst|nood|evacuatie|brandweer)' then
    r := array_append(r, 'veiligheid'); end if;
  if eig ?| array['wand','totem','frame','drape','vlag','doek','vlaghouder'] or eig ->> 'truss_doek' in ('kubus','boog')
     or (tw = 'lijn' and en ~* '(heras|bouwhek|werfhek)') or v ? 'doeken' or v ? 'doek'
     or l ~ '(branding|doek|sponsor)' then
    r := array_append(r, 'branding'); end if;
  if v ? 'tvcamera' or (v -> 'stelling') ? 'camera' or v ? 'tvkabel' or eig ?| array['kabelcam','tvcamera','kraan']
     or cat = 'TV-compound' or eig ->> 'subgroep' = 'Camera''s' or (eig -> 'stelling3d') ? 'camera'
     or l ~ '^(tv|camera|broadcast|compound)' then
    r := array_append(r, 'tv'); end if;
  return r;
end $$;

create or replace function maps.items_werkplekken() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.werkplekken := maps.werkplekken_van(new.velden, new.element_id, new.laag_id, new.naam);
  return new;
end $$;
drop trigger if exists items_werkplekken on maps.items;
create trigger items_werkplekken before insert or update on maps.items for each row execute function maps.items_werkplekken();

-- Bestaande items invullen, zonder log, rev of updated_at te laten tikken (open editors botsen dan niet).
alter table maps.items disable trigger items_log;
alter table maps.items disable trigger items_rev;
alter table maps.items disable trigger items_updated;
alter table maps.items disable trigger items_zz_module;
alter table maps.items disable trigger items_sign_nummer;
update maps.items set werkplekken = maps.werkplekken_van(velden, element_id, laag_id, naam);
alter table maps.items enable trigger items_log;
alter table maps.items enable trigger items_rev;
alter table maps.items enable trigger items_updated;
alter table maps.items enable trigger items_zz_module;
alter table maps.items enable trigger items_sign_nummer;

-- Eigenaars en beheerders: nooit beperkt. Lege lijst: geen beperking.
create or replace function maps.leden_werkplekken() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.rol in ('eigenaar', 'beheerder', 'lezer') or new.werkplekken = '{}' then new.werkplekken := null; end if;
  return new;
end $$;
drop trigger if exists leden_werkplekken on maps.leden;
create trigger leden_werkplekken before insert or update of rol, werkplekken on maps.leden for each row execute function maps.leden_werkplekken();
drop trigger if exists uitnodigingen_werkplekken on maps.uitnodigingen;
create trigger uitnodigingen_werkplekken before insert or update of rol, werkplekken on maps.uitnodigingen for each row execute function maps.leden_werkplekken();

-- Mijn werkplekken in een organisatie (null = alles).
create or replace function maps.mijn_werkplekken(p_org uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select l.werkplekken from maps.leden l where l.user_id = auth.uid() and l.organisatie_id = p_org and l.actief;
$$;

-- Mag ik hier schrijven? p_wp null: iets van het hele plan (lagen, fasen, versies …), enkel zonder beperking.
create or replace function maps.werkplek_mag(p_org uuid, p_wp text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is null or maps.is_platformbeheerder() or (
    select case when l.werkplekken is null then true
                when p_wp is null then false
                else l.werkplekken && p_wp end
      from maps.leden l where l.user_id = auth.uid() and l.organisatie_id = p_org and l.actief)
  is not false;
$$;

-- Instellingen van een plan die bij een werkplek horen (de rest van het plan blijft voor wie beperkt is dicht).
create or replace function maps.plan_werkplek_sleutels(p_wp text[]) returns text[]
language sql immutable set search_path = '' as $$
  select array['claims', 'groepen', 'verborgen_elementen']
      || case when 'sign' = any (p_wp) then array['signalisatie', 'verkeer'] else '{}'::text[] end
      || case when 'stroom' = any (p_wp) then array['stroom'] else '{}'::text[] end
      || case when 'veiligheid' = any (p_wp) then array['brandveiligheid', 'attesten'] else '{}'::text[] end
      || case when 'branding' = any (p_wp) then array['branding'] else '{}'::text[] end
      || case when 'tv' = any (p_wp) then array['tv'] else '{}'::text[] end;
$$;

create or replace function maps.plannen_werkplekken() returns trigger
language plpgsql security definer set search_path = '' as $$
declare wp text[]; k text; vrij text[];
begin
  if auth.uid() is null or maps.is_platformbeheerder() then return new; end if;
  select werkplekken into wp from maps.leden where user_id = auth.uid() and organisatie_id = new.organisatie_id and actief;
  if wp is null then return new; end if;
  if (to_jsonb(new) - array['instellingen','rev','updated_at','bewerkt_door']) is distinct from (to_jsonb(old) - array['instellingen','rev','updated_at','bewerkt_door']) then
    raise exception 'Je mag enkel je werkplekken wijzigen, niet de gegevens van het plan.' using errcode = '42501';
  end if;
  vrij := maps.plan_werkplek_sleutels(wp);
  for k in select distinct x from (select jsonb_object_keys(coalesce(new.instellingen, '{}')) x union select jsonb_object_keys(coalesce(old.instellingen, '{}'))) s loop
    if (new.instellingen -> k) is distinct from (old.instellingen -> k) and not (k = any (vrij)) then
      raise exception 'Je mag enkel de instellingen van je werkplekken wijzigen (%).', k using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists plannen_werkplekken on maps.plannen;
create trigger plannen_werkplekken before update on maps.plannen for each row execute function maps.plannen_werkplekken();

do $$
declare t text;
begin
  -- Items: enkel van je werkplekken (bij wijzigen: oud én nieuw).
  drop policy if exists werkplekken_maken on maps.items;
  drop policy if exists werkplekken_wijzigen on maps.items;
  drop policy if exists werkplekken_wissen on maps.items;
  create policy werkplekken_maken on maps.items as restrictive for insert to authenticated with check (maps.werkplek_mag(organisatie_id, werkplekken));
  create policy werkplekken_wijzigen on maps.items as restrictive for update to authenticated using (maps.werkplek_mag(organisatie_id, werkplekken)) with check (maps.werkplek_mag(organisatie_id, werkplekken));
  create policy werkplekken_wissen on maps.items as restrictive for delete to authenticated using (maps.werkplek_mag(organisatie_id, werkplekken));
  -- Wat bij het hele plan hoort: enkel zonder beperking.
  foreach t in array array['lagen','fasen','versies','deel_links','plekken','vaste_aansluitingen','events'] loop
    execute format('drop policy if exists werkplekken_maken on maps.%I', t);
    execute format('drop policy if exists werkplekken_wijzigen on maps.%I', t);
    execute format('drop policy if exists werkplekken_wissen on maps.%I', t);
    execute format('create policy werkplekken_maken on maps.%I as restrictive for insert to authenticated with check (maps.werkplek_mag(organisatie_id, null))', t);
    execute format('create policy werkplekken_wijzigen on maps.%I as restrictive for update to authenticated using (maps.werkplek_mag(organisatie_id, null))', t);
    execute format('create policy werkplekken_wissen on maps.%I as restrictive for delete to authenticated using (maps.werkplek_mag(organisatie_id, null))', t);
  end loop;
  drop policy if exists werkplekken_maken on maps.plannen;
  drop policy if exists werkplekken_wissen on maps.plannen;
  create policy werkplekken_maken on maps.plannen as restrictive for insert to authenticated with check (maps.werkplek_mag(organisatie_id, null));
  create policy werkplekken_wissen on maps.plannen as restrictive for delete to authenticated using (maps.werkplek_mag(organisatie_id, null));
end $$;

-- Vaste aansluitingen zijn stroom: wie Stroom mag, mag die ook.
drop policy if exists werkplekken_maken on maps.vaste_aansluitingen;
drop policy if exists werkplekken_wijzigen on maps.vaste_aansluitingen;
drop policy if exists werkplekken_wissen on maps.vaste_aansluitingen;
create policy werkplekken_maken on maps.vaste_aansluitingen as restrictive for insert to authenticated with check (maps.werkplek_mag(organisatie_id, array['stroom']));
create policy werkplekken_wijzigen on maps.vaste_aansluitingen as restrictive for update to authenticated using (maps.werkplek_mag(organisatie_id, array['stroom']));
create policy werkplekken_wissen on maps.vaste_aansluitingen as restrictive for delete to authenticated using (maps.werkplek_mag(organisatie_id, array['stroom']));

-- Uitnodigen met werkplekken.
drop function if exists maps.uitnodiging_maken(uuid, text, text, text, uuid[]);
create or replace function maps.uitnodiging_maken(p_org uuid, p_email text, p_naam text, p_rol text, p_event_ids uuid[], p_werkplekken text[] default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_token text := maps.nieuw_token(); v_id uuid;
begin
  if not (p_org = any (maps.mijn_organisaties('beheerder')) or maps.is_platformbeheerder()) then
    raise exception 'Enkel een beheerder kan uitnodigen.' using errcode = '42501';
  end if;
  delete from maps.uitnodigingen where organisatie_id = p_org and lower(email) = lower(btrim(p_email)) and aanvaard_op is null;
  insert into maps.uitnodigingen (organisatie_id, email, naam, rol, event_ids, werkplekken, token_hash, geldig_tot)
  values (p_org, p_email, nullif(btrim(coalesce(p_naam, '')), ''), p_rol, p_event_ids, p_werkplekken, maps.token_hash(v_token), now() + interval '7 days')
  returning id into v_id;
  insert into maps.logboek_organisatie (organisatie_id, actie, details)
  values (p_org, 'uitgenodigd', jsonb_build_object('email', lower(btrim(p_email)), 'rol', p_rol, 'evenementen', to_jsonb(p_event_ids), 'werkplekken', to_jsonb(p_werkplekken)));
  return jsonb_build_object('id', v_id, 'token', v_token);
end $$;

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
  insert into maps.leden (organisatie_id, user_id, rol, event_ids, werkplekken, uitgenodigd_door)
  values (u.organisatie_id, p_user, u.rol, u.event_ids, u.werkplekken, u.uitgenodigd_door)
  on conflict (organisatie_id, user_id) do update set actief = true, rol = excluded.rol, event_ids = excluded.event_ids, werkplekken = excluded.werkplekken;
  perform set_config('maps.via_uitnodiging', '', true);
  if u.naam is not null then update maps.profielen set naam = coalesce(naam, u.naam) where id = p_user; end if;
  insert into maps.logboek_organisatie (organisatie_id, door, actie, details)
  values (u.organisatie_id, p_user, 'uitnodiging_aanvaard', jsonb_build_object('email', u.email, 'rol', u.rol));
  select * into o from maps.organisaties where id = u.organisatie_id;
  return jsonb_build_object('slug', o.slug, 'naam', o.naam);
end $$;

create or replace function maps.leden_loggen() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d jsonb := '{}';
begin
  if new.rol is distinct from old.rol then d := d || jsonb_build_object('rol', jsonb_build_array(old.rol, new.rol)); end if;
  if new.actief is distinct from old.actief then d := d || jsonb_build_object('actief', jsonb_build_array(old.actief, new.actief)); end if;
  if new.event_ids is distinct from old.event_ids then d := d || jsonb_build_object('evenementen', jsonb_build_array(to_jsonb(old.event_ids), to_jsonb(new.event_ids))); end if;
  if new.werkplekken is distinct from old.werkplekken then d := d || jsonb_build_object('werkplekken', jsonb_build_array(to_jsonb(old.werkplekken), to_jsonb(new.werkplekken))); end if;
  if d <> '{}' then
    insert into maps.logboek_organisatie (organisatie_id, actie, details)
    values (new.organisatie_id, 'lid_gewijzigd', d || jsonb_build_object('lid', (select email from maps.profielen where id = new.user_id)));
  end if;
  return new;
end $$;

drop function if exists maps.leden_van(uuid);
create function maps.leden_van(p_org uuid)
returns table (user_id uuid, email text, naam text, rol text, actief boolean, sinds timestamptz, laatste_login timestamptz, ik boolean, event_ids uuid[], mfa boolean, werkplekken text[])
language sql stable security definer set search_path = '' as $$
  select l.user_id, p.email, p.naam, l.rol, l.actief, l.sinds, l.laatste_login, l.user_id = auth.uid(), l.event_ids,
         exists (select 1 from auth.mfa_factors f where f.user_id = l.user_id and f.status = 'verified'), l.werkplekken
    from maps.leden l left join maps.profielen p on p.id = l.user_id
   where l.organisatie_id = p_org
     and (p_org = any (maps.lid_van()) or maps.is_platformbeheerder())
   order by maps.rol_rang(l.rol) desc, coalesce(p.naam, p.email);
$$;

revoke execute on function maps.items_werkplekken(), maps.leden_werkplekken(), maps.plannen_werkplekken(), maps.leden_loggen() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['maps.werkplekken_van(jsonb,uuid,uuid,text)', 'maps.mijn_werkplekken(uuid)', 'maps.werkplek_mag(uuid,text[])',
                           'maps.plan_werkplek_sleutels(text[])', 'maps.leden_van(uuid)',
                           'maps.uitnodiging_maken(uuid,text,text,text,uuid[],text[])'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  revoke execute on function maps.uitnodiging_aanvaarden_door(text, uuid) from public, anon, authenticated;
  grant execute on function maps.uitnodiging_aanvaarden_door(text, uuid) to service_role;
end $$;
