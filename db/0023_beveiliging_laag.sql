-- 0023 · Beveiliging, kleinere punten uit de audit van november 2026
--
-- 1. Leden: enkel via een uitnodiging (of door Toolen); een rij kan niet van persoon of organisatie wisselen.
-- 2. Uitnodigingen: rechtstreeks wijzigen kan niet meer (vroeger kon een beheerder een openstaande uitnodiging
--    tot eigenaar maken en zelf aanvaarden). Aanmaken en vernieuwen gaat via de functies.
-- 3. Deellinks: het token maakt altijd de databank (willekeurig, 256 bits) en wijzigt nooit.
-- 4. Hulpfuncties: niet meer rechtstreeks op te vragen voor andere organisaties.

-- 1. Leden ------------------------------------------------------------------
revoke insert on maps.leden from authenticated;
revoke update on maps.leden from authenticated;
grant update (rol, actief, event_ids, werkplekken) on maps.leden to authenticated;

-- 2. Uitnodigingen ----------------------------------------------------------
revoke insert, update on maps.uitnodigingen from authenticated;

-- 3. Deellinks --------------------------------------------------------------
create or replace function maps.deellink_token() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.token := maps.nieuw_token();
  elsif new.token is distinct from old.token then
    raise exception 'Het adres van een deellink kan niet wijzigen. Maak een nieuwe link.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists deel_links_token on maps.deel_links;
create trigger deel_links_token before insert or update on maps.deel_links for each row execute function maps.deellink_token();
alter function maps.deellink_token() security definer;
revoke all on function maps.deellink_token() from public, anon, authenticated;

-- 4. Hulpfuncties -----------------------------------------------------------
-- Enkel gebruikt binnen andere functies van de databank (die als eigenaar draaien).
revoke execute on function maps.deellinks_actief(uuid), maps.events_in_jaar(uuid, integer), maps.opslag_mb(uuid),
  maps.limiet(uuid, text), maps.org_deelbaar(uuid), maps.org_heeft_module(uuid, text), maps.huisstijl_van(uuid),
  maps.plan_vinger(uuid), maps.enige_organisatie(), maps.actieve_organisatie()
  from public, anon, authenticated;

-- Door de app opgevraagd: enkel voor de eigen organisatie.
create or replace function maps.plaatsen_in_gebruik(p_org uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plaatsen', (select count(*) from maps.leden where organisatie_id = p_org and actief and rol <> 'lezer')
              + (select count(*) from maps.uitnodigingen where organisatie_id = p_org and aanvaard_op is null and geldig_tot > now() and rol <> 'lezer'),
    'lezers',   (select count(*) from maps.leden where organisatie_id = p_org and actief and rol = 'lezer')
              + (select count(*) from maps.uitnodigingen where organisatie_id = p_org and aanvaard_op is null and geldig_tot > now() and rol = 'lezer'),
    'plaatsen_max', o.plaatsen, 'lezers_max', o.lezers_max)
  from maps.organisaties o
  where o.id = p_org
    and (auth.uid() is null or p_org = any (maps.lid_van()) or maps.is_platformbeheerder() or coalesce(current_setting('maps.via_uitnodiging', true), '') = '1');
$$;

-- In de regels van bestanden en opmerkingen: enkel items van de eigen organisaties.
create or replace function maps.item_plan(p_item uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select plan_id from maps.items where id = p_item and (organisatie_id = any (maps.lid_van()) or maps.is_platformbeheerder() or auth.uid() is null);
$$;

-- Werkplekken van een item: met de rechten van de gebruiker zelf (geen inzage in andermans bibliotheek of lagen).
alter function maps.werkplekken_van(jsonb, uuid, uuid, text) security invoker;
