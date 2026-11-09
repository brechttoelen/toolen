-- Een veldpunt na het plaatsen nog aanpassen, verschuiven of weghalen via dezelfde deellink (zolang het open staat).
create or replace function flcsmaps.deel_link_punt_wijzig(p_token text, p_id uuid, p_lng double precision, p_lat double precision, p_tekst text, p_weg boolean default false)
returns boolean language plpgsql security definer set search_path to 'flcsmaps', 'public' as $$
declare dl flcsmaps.deel_links%rowtype; pl flcsmaps.plannen%rowtype; o flcsmaps.opmerkingen%rowtype;
begin
  if p_token is null or length(p_token) < 20 or p_id is null then return false; end if;
  select * into dl from flcsmaps.deel_links where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found or not coalesce((dl.opties->>'opmerkingen')::boolean, false) then return false; end if;
  select * into o from flcsmaps.opmerkingen where id = p_id and deel_link_id = dl.id and plan_id = dl.plan_id and punt is not null and item_id is null and status = 'open';
  if not found then return false; end if;
  if p_weg then delete from flcsmaps.opmerkingen where id = o.id; return true; end if;
  select * into pl from flcsmaps.plannen where id = dl.plan_id;
  if p_lng is not null and p_lat is not null then
    if p_lng < -180 or p_lng > 180 or p_lat < -85 or p_lat > 85 then return false; end if;
    if pl.centrum is not null and jsonb_typeof(to_jsonb(pl.centrum)) = 'array'
       and (abs((to_jsonb(pl.centrum)->>0)::float - p_lng) > 0.3 or abs((to_jsonb(pl.centrum)->>1)::float - p_lat) > 0.2) then return false; end if;
  end if;
  update flcsmaps.opmerkingen set
    punt = case when p_lng is not null and p_lat is not null then jsonb_build_array(round(p_lng::numeric, 7), round(p_lat::numeric, 7)) else punt end,
    tekst = case when coalesce(trim(p_tekst), '') <> '' then left(trim(p_tekst), 2000) else tekst end
  where id = o.id;
  return true;
end $$;
revoke all on function flcsmaps.deel_link_punt_wijzig(text, uuid, double precision, double precision, text, boolean) from public;
grant execute on function flcsmaps.deel_link_punt_wijzig(text, uuid, double precision, double precision, text, boolean) to anon, authenticated;

-- deel_link_lezen: per veldpunt of het van deze link is (dan mag je het hier aanpassen).
do $do$
declare d text;
begin
  d := pg_get_functiondef('flcsmaps.deel_link_lezen'::regproc);
  if position('''eigen''' in d) = 0 then
    d := replace(d, $r$'status', o.status, 'op', o.created_at) order by o.created_at)
                                   from flcsmaps.opmerkingen o where o.plan_id = pl.id$r$,
                    $r$'status', o.status, 'op', o.created_at, 'eigen', o.deel_link_id = dl.id) order by o.created_at)
                                   from flcsmaps.opmerkingen o where o.plan_id = pl.id$r$);
    if position('''eigen''' in d) = 0 then raise exception 'aanpassing mislukt'; end if;
    execute d;
  end if;
end $do$;
