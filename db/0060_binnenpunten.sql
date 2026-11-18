-- ============================================================================
-- Toolen · 0060_binnenpunten.sql
-- Veldpunten binnen een gebouw: een opmerking op een plek in het binnenplan, gezet via de deellink.
-- opmerkingen.binnen = { host, verd, p: [x, y] } (lokale meters van het binnenplan); punt blijft de plek op
-- de kaart, zodat het punt ook buiten en in de editor zichtbaar is.
-- ============================================================================
alter table maps.opmerkingen add column if not exists binnen jsonb;

create or replace function maps.deel_link_binnenpunt(p_token text, p_host uuid, p_verd text, p_x double precision, p_y double precision,
  p_lng double precision, p_lat double precision, p_naam text, p_tekst text) returns uuid
language plpgsql security definer set search_path = 'maps', 'public' as $$
declare dl maps.deel_links%rowtype; v_id uuid;
begin
  if p_token is null or length(p_token) < 20 or coalesce(trim(p_tekst), '') = '' or p_host is null or p_x is null or p_y is null then return null; end if;
  if abs(p_x) > 5000 or abs(p_y) > 5000 then return null; end if;
  select * into dl from maps.deel_links where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found or not coalesce((dl.opties->>'opmerkingen')::boolean, false) then return null; end if;
  if not maps.org_deelbaar(dl.organisatie_id) then return null; end if;
  if not exists (select 1 from maps.items where id = p_host and plan_id = dl.plan_id) then return null; end if;
  insert into maps.opmerkingen (organisatie_id, item_id, plan_id, punt, binnen, auteur_naam, deel_link_id, tekst)
  values (dl.organisatie_id, null, dl.plan_id,
          case when p_lng between -180 and 180 and p_lat between -85 and 85 then jsonb_build_array(round(p_lng::numeric, 7), round(p_lat::numeric, 7)) end,
          jsonb_build_object('host', p_host, 'verd', left(coalesce(p_verd, ''), 40), 'p', jsonb_build_array(round(p_x::numeric, 3), round(p_y::numeric, 3))),
          left(coalesce(nullif(trim(p_naam), ''), dl.naam), 80), dl.id, left(trim(p_tekst), 2000))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function maps.deel_link_binnenpunt(text, uuid, text, double precision, double precision, double precision, double precision, text, text) from public;
grant execute on function maps.deel_link_binnenpunt(text, uuid, text, double precision, double precision, double precision, double precision, text, text) to anon, authenticated;

create or replace function maps.deel_link_binnenpunt_wijzig(p_token text, p_id uuid, p_x double precision, p_y double precision,
  p_lng double precision, p_lat double precision, p_tekst text, p_weg boolean default false) returns boolean
language plpgsql security definer set search_path = 'maps', 'public' as $$
declare dl maps.deel_links%rowtype; o maps.opmerkingen%rowtype;
begin
  if p_token is null or length(p_token) < 20 or p_id is null then return false; end if;
  select * into dl from maps.deel_links where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found or not coalesce((dl.opties->>'opmerkingen')::boolean, false) then return false; end if;
  if not maps.org_deelbaar(dl.organisatie_id) then return false; end if;
  select * into o from maps.opmerkingen where id = p_id and deel_link_id = dl.id and plan_id = dl.plan_id and binnen is not null and item_id is null and status = 'open';
  if not found then return false; end if;
  if p_weg then delete from maps.opmerkingen where id = o.id; return true; end if;
  if p_x is not null and (abs(p_x) > 5000 or abs(p_y) > 5000) then return false; end if;
  update maps.opmerkingen set
    binnen = case when p_x is not null and p_y is not null then binnen || jsonb_build_object('p', jsonb_build_array(round(p_x::numeric, 3), round(p_y::numeric, 3))) else binnen end,
    punt = case when p_lng between -180 and 180 and p_lat between -85 and 85 then jsonb_build_array(round(p_lng::numeric, 7), round(p_lat::numeric, 7)) else punt end,
    tekst = case when coalesce(trim(p_tekst), '') <> '' then left(trim(p_tekst), 2000) else tekst end
  where id = o.id;
  return true;
end $$;
revoke execute on function maps.deel_link_binnenpunt_wijzig(text, uuid, double precision, double precision, double precision, double precision, text, boolean) from public;
grant execute on function maps.deel_link_binnenpunt_wijzig(text, uuid, double precision, double precision, double precision, double precision, text, boolean) to anon, authenticated;

-- De deellink geeft bij elk veldpunt ook de plek in het binnenplan mee, en ook binnenpunten zonder kaartplek.
do $do$
declare d text;
begin
  select pg_get_functiondef('maps.deel_link_lezen(text,text)'::regprocedure) into d;
  if position('''binnen'', o.binnen' in d) = 0 then
    d := replace(d, '''eigen'', o.deel_link_id = dl.id) order by o.created_at)', '''eigen'', o.deel_link_id = dl.id, ''binnen'', o.binnen) order by o.created_at)');
    d := replace(d, 'where o.plan_id = pl.id and o.punt is not null and o.item_id is null and o.status = ''open''', 'where o.plan_id = pl.id and (o.punt is not null or o.binnen is not null) and o.item_id is null and o.status = ''open''');
    if position('''binnen'', o.binnen' in d) = 0 or position('o.binnen is not null' in d) = 0 then raise exception 'deel_link_lezen niet aangepast'; end if;
    execute d;
  end if;
end $do$;
