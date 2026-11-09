-- FLCS Maps: veldpunten = opmerkingen op een plek (niet op een item), bv. tijdens een terreinbezoek via een deellink:
-- "camera 3 hier". Achteraf zichtbaar in de editor om in te tekenen.
alter table flcsmaps.opmerkingen alter column item_id drop not null;
alter table flcsmaps.opmerkingen add column if not exists plan_id uuid references flcsmaps.plannen(id) on delete cascade;
alter table flcsmaps.opmerkingen add column if not exists punt jsonb;
alter table flcsmaps.opmerkingen drop constraint if exists opmerkingen_item_of_punt;
alter table flcsmaps.opmerkingen add constraint opmerkingen_item_of_punt
  check (item_id is not null or (plan_id is not null and jsonb_typeof(punt) = 'array' and jsonb_array_length(punt) = 2));
create index if not exists opmerkingen_plan_punt on flcsmaps.opmerkingen (plan_id) where punt is not null;

create or replace function flcsmaps.deel_link_punt(p_token text, p_lng double precision, p_lat double precision, p_naam text, p_tekst text)
returns uuid language plpgsql security definer set search_path to 'flcsmaps', 'public' as $$
declare dl flcsmaps.deel_links%rowtype; pl flcsmaps.plannen%rowtype; v_id uuid;
begin
  if p_token is null or length(p_token) < 20 or coalesce(trim(p_tekst), '') = '' then return null; end if;
  if p_lng is null or p_lat is null or p_lng < -180 or p_lng > 180 or p_lat < -85 or p_lat > 85 then return null; end if;
  select * into dl from flcsmaps.deel_links
   where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found or not coalesce((dl.opties->>'opmerkingen')::boolean, false) then return null; end if;
  select * into pl from flcsmaps.plannen where id = dl.plan_id; if not found then return null; end if;
  -- Enkel in de buurt van het plan (binnen ± 20 km van het centrum).
  if pl.centrum is not null and jsonb_typeof(to_jsonb(pl.centrum)) = 'array'
     and (abs((to_jsonb(pl.centrum)->>0)::float - p_lng) > 0.3 or abs((to_jsonb(pl.centrum)->>1)::float - p_lat) > 0.2) then return null; end if;
  insert into flcsmaps.opmerkingen (item_id, plan_id, punt, auteur_naam, deel_link_id, tekst)
  values (null, dl.plan_id, jsonb_build_array(round(p_lng::numeric, 7), round(p_lat::numeric, 7)), left(coalesce(nullif(trim(p_naam), ''), dl.naam), 80), dl.id, left(trim(p_tekst), 2000))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function flcsmaps.deel_link_punt(text, double precision, double precision, text, text) from public;
grant execute on function flcsmaps.deel_link_punt(text, double precision, double precision, text, text) to anon, authenticated;

-- deel_link_lezen: de veldpunten van dit plan mee teruggeven (als opmerkingen aan staan).
do $do$
declare d text;
begin
  d := pg_get_functiondef('flcsmaps.deel_link_lezen'::regproc);
  if position('''veldpunten''' in d) = 0 then
    d := replace(d, $r$      'opmerkingen', case when coalesce((dl.opties->>'opmerkingen')::boolean, false) then$r$,
      $r$      'veldpunten', case when coalesce((dl.opties->>'opmerkingen')::boolean, false) then
                       coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'punt', o.punt, 'auteur', coalesce(o.auteur_naam, 'FLCS'),
                                                                     'tekst', o.tekst, 'status', o.status, 'op', o.created_at) order by o.created_at)
                                   from flcsmaps.opmerkingen o where o.plan_id = pl.id and o.punt is not null and o.item_id is null), '[]')
                     else '[]'::jsonb end,
      'opmerkingen', case when coalesce((dl.opties->>'opmerkingen')::boolean, false) then$r$);
    if position('''veldpunten''' in d) = 0 then raise exception 'aanpassing deel_link_lezen mislukt'; end if;
    execute d;
  end if;
end $do$;
