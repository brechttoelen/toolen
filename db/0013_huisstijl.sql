-- ============================================================================
-- Toolen · 0013_huisstijl.sql
-- Project: toolen (hlpurcdeouegvphvwygu). Na 0012.
--
-- Eigen huisstijl per organisatie (module "huisstijl"), enkel in te stellen door het platform:
--   organisaties.huisstijl = { primair, accent, logo_licht, logo_donker, toolen_verbergen }
--   logo_licht: logo voor een lichte achtergrond (PNG-url), logo_donker: voor een donkere.
-- Zichtbaar in de app, op het inlogscherm, op deellinks, in PDF's en in de uitnodigingsmail,
-- met de vermelding "met Toolen Maps" (tenzij toolen_verbergen).
--
-- Terugdraaien: kolom huisstijl, trigger organisaties_huisstijl en de functies huisstijl* droppen.
-- ============================================================================

create or replace function maps.module_ids() returns text[]
language sql immutable set search_path = '' as $$
  select array['stroom','signalisatie','stelling','branding','veiligheid','binnen','groot','terrein','leveranciers','integraties','huisstijl','stock','gridlab'];
$$;

alter table maps.organisaties add column if not exists huisstijl jsonb not null default '{}';

-- Enkel het platform wijzigt de huisstijl; kleuren als #RRGGBB, logo's als https-url.
create or replace function maps.huisstijl_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
declare h jsonb := coalesce(new.huisstijl, '{}');
begin
  if new.huisstijl is not distinct from old.huisstijl then return new; end if;
  if auth.uid() is not null and not maps.is_platformbeheerder() then
    raise exception 'De huisstijl stelt Toolen in.' using errcode = '42501';
  end if;
  if coalesce(h ->> 'primair', '#000000') !~ '^#[0-9A-Fa-f]{6}$' or coalesce(h ->> 'accent', '#000000') !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Kleuren als #RRGGBB.' using errcode = 'P0001';
  end if;
  if coalesce(h ->> 'logo_licht', 'https://') !~ '^https://' or coalesce(h ->> 'logo_donker', 'https://') !~ '^https://' then
    raise exception 'Logo''s als https-adres.' using errcode = 'P0001';
  end if;
  new.huisstijl := jsonb_strip_nulls(h);
  return new;
end $$;
drop trigger if exists organisaties_huisstijl on maps.organisaties;
create trigger organisaties_huisstijl before update of huisstijl on maps.organisaties for each row execute function maps.huisstijl_bewaken();

-- Huisstijl zoals de app ze toont: enkel met de module, anders null. Ook naam en korte naam.
create or replace function maps.huisstijl_van(p_org uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when 'huisstijl' = any (o.modules) and o.huisstijl <> '{}'
              then o.huisstijl || jsonb_build_object('naam', o.naam, 'kort', coalesce(o.kort, o.naam)) end
    from maps.organisaties o where o.id = p_org and o.status <> 'verwijderd';
$$;

-- Voor iedereen (inlogscherm, deellink): per bedrijfscode of per deellink.
create or replace function maps.huisstijl(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select maps.huisstijl_van(o.id) from maps.organisaties o where o.slug = lower(btrim(p_slug));
$$;

create or replace function maps.huisstijl_deellink(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select maps.huisstijl_van(d.organisatie_id) from maps.deel_links d
   where p_token is not null and length(p_token) >= 20 and d.token = p_token and d.ingetrokken_op is null;
$$;

-- Uitnodigingsmail met de huisstijl.
create or replace function maps.uitnodiging_mailgegevens(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('email', u.email, 'naam', u.naam, 'rol', u.rol, 'organisatie', o.naam, 'code', o.slug,
                            'geldig_tot', u.geldig_tot,
                            'door', (select coalesce(p.naam, p.email) from maps.profielen p where p.id = auth.uid()),
                            'door_email', (select p.email from maps.profielen p where p.id = auth.uid()),
                            'evenementen', (select coalesce(jsonb_agg(e.naam order by e.naam), '[]'::jsonb) from maps.events e where e.id = any (u.event_ids)),
                            'werkplekken', to_jsonb(u.werkplekken),
                            'huisstijl', maps.huisstijl_van(o.id))
    from maps.uitnodigingen u join maps.organisaties o on o.id = u.organisatie_id
   where u.id = p_id
     and (u.organisatie_id = any (maps.mijn_organisaties('beheerder')) or maps.is_platformbeheerder());
$$;

-- Logo's opladen door het platform in huisstijl/<organisatie>/.
drop policy if exists maps_huisstijl_opladen on storage.objects;
drop policy if exists maps_huisstijl_wijzigen on storage.objects;
drop policy if exists maps_huisstijl_wissen on storage.objects;
create policy maps_huisstijl_opladen on storage.objects for insert to authenticated
  with check (bucket_id = 'maps' and name like 'huisstijl/%' and maps.is_platformbeheerder());
create policy maps_huisstijl_wijzigen on storage.objects for update to authenticated
  using (bucket_id = 'maps' and name like 'huisstijl/%' and maps.is_platformbeheerder());
create policy maps_huisstijl_wissen on storage.objects for delete to authenticated
  using (bucket_id = 'maps' and name like 'huisstijl/%' and maps.is_platformbeheerder());

revoke execute on function maps.huisstijl_bewaken() from public, anon, authenticated;
revoke execute on function maps.huisstijl_van(uuid) from public, anon;
grant execute on function maps.huisstijl_van(uuid) to authenticated, service_role;
revoke execute on function maps.huisstijl(text), maps.huisstijl_deellink(text) from public;
grant execute on function maps.huisstijl(text), maps.huisstijl_deellink(text) to anon, authenticated, service_role;
revoke execute on function maps.uitnodiging_mailgegevens(uuid) from public, anon;
grant execute on function maps.uitnodiging_mailgegevens(uuid) to authenticated, service_role;
