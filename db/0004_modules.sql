-- ============================================================================
-- Toolen · 0004_modules.sql
-- Project: toolen (hlpurcdeouegvphvwygu). Na 0001 en 0003.
--
-- Modules uit het pakket afdwingen in de databank. Een item dat bij een module hoort
-- (herkend aan zijn velden) kan zonder die module niet aangemaakt of gewijzigd worden.
-- Bestaande items blijven zichtbaar en staan mee in de PDF; verwijderen mag.
--
--   velden.sign, velden.verkeer        → signalisatie
--   velden.stroom                      → stroom
--   velden.stelling                    → stelling
--   velden.binnen, velden.binnenplan   → binnen
--   velden.doeken, velden.vlaggen      → branding
--
-- Terugdraaien: drop trigger items_zz_module on maps.items; drop function maps.items_module_bewaken(), maps.org_heeft_module(uuid, text);
-- ============================================================================

create or replace function maps.org_heeft_module(p_org uuid, p_module text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from maps.organisaties where id = p_org and p_module = any (modules));
$$;

create or replace function maps.items_module_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  k text; m text;
  nv jsonb := coalesce(new.velden, '{}');
  ov jsonb := case when tg_op = 'UPDATE' then coalesce(old.velden, '{}') else '{}' end;
  regels constant jsonb := '{"sign":"signalisatie","verkeer":"signalisatie","stroom":"stroom","stelling":"stelling",
                             "binnen":"binnen","binnenplan":"binnen","doeken":"branding","vlaggen":"branding"}';
  namen constant jsonb := '{"signalisatie":"Signalisatie","stroom":"Stroom","stelling":"Stellingbouwer 3D","binnen":"Binnenplan","branding":"Branding"}';
begin
  if auth.uid() is null then return new; end if;  -- import, service role, SQL Editor
  for k, m in select key, value #>> '{}' from jsonb_each(regels) loop
    if (nv ? k or ov ? k) and not maps.org_heeft_module(new.organisatie_id, m) then
      raise exception '% zit niet in het pakket van deze organisatie.', namen ->> m using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- Naam begint met zz: triggers lopen alfabetisch, en deze moet na items_org (organisatie invullen).
drop trigger if exists items_zz_module on maps.items;
create trigger items_zz_module before insert or update on maps.items for each row execute function maps.items_module_bewaken();

revoke execute on function maps.items_module_bewaken() from public, anon, authenticated;
grant execute on function maps.org_heeft_module(uuid, text) to authenticated;
