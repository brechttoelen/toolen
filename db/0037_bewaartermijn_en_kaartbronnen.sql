-- 0037 · Bewaartermijn voor het wijzigingenlogboek en een dagelijkse controle van de kaartbronnen
--
-- 1. maps.wijzigingen (wie wijzigde wat, voor "Geschiedenis" en "Sinds je vorige bezoek") groeide zonder einde.
--    Rijen ouder dan 12 maanden gaan elke nacht weg. Versies en de prullenbak van plannen blijven zoals ze zijn.
-- 2. De kaartlagen komen van externe, gratis diensten (overheden, OpenStreetMap). Die geven geen garantie.
--    De app controleert elke dag één tegel per bron en bewaart hier de stand; Systeem toont wat uitvalt.

create or replace function maps.wijzigingen_opruimen() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from maps.wijzigingen where op < now() - interval '12 months';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function maps.wijzigingen_opruimen() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'maps-wijzigingen-opruimen';
select cron.schedule('maps-wijzigingen-opruimen', '40 3 * * *', $$select maps.wijzigingen_opruimen()$$);

create table if not exists maps.kaartbron_status (
  bron text primary key,
  naam text not null,
  soort text not null default 'tegel',
  ok boolean not null,
  status integer,
  ms integer,
  fout text,
  gecontroleerd_op timestamptz not null default now(),
  -- Sinds wanneer de bron onafgebroken faalt (leeg zolang ze werkt).
  faalt_sinds timestamptz
);
alter table maps.kaartbron_status enable row level security;
revoke all on maps.kaartbron_status from public, anon, authenticated;

-- De server (geheime sleutel) bewaart de uitslag van één controleronde.
create or replace function maps.kaartbronnen_bewaren(p_rijen jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Enkel voor de server.' using errcode = '42501';
  end if;
  insert into maps.kaartbron_status as k (bron, naam, soort, ok, status, ms, fout, gecontroleerd_op, faalt_sinds)
  select r->>'bron', r->>'naam', coalesce(r->>'soort', 'tegel'), (r->>'ok')::boolean, nullif(r->>'status', '')::integer, nullif(r->>'ms', '')::integer,
         nullif(r->>'fout', ''), now(), case when (r->>'ok')::boolean then null else now() end
  from jsonb_array_elements(p_rijen) r
  on conflict (bron) do update set naam = excluded.naam, soort = excluded.soort, ok = excluded.ok, status = excluded.status, ms = excluded.ms,
    fout = excluded.fout, gecontroleerd_op = excluded.gecontroleerd_op,
    faalt_sinds = case when excluded.ok then null else coalesce(k.faalt_sinds, excluded.gecontroleerd_op) end;
  -- Bronnen die niet meer gecontroleerd worden (uit de app gehaald) verdwijnen uit de lijst.
  delete from maps.kaartbron_status where bron not in (select r->>'bron' from jsonb_array_elements(p_rijen) r);
end $$;
revoke all on function maps.kaartbronnen_bewaren(jsonb) from public, anon, authenticated;
grant execute on function maps.kaartbronnen_bewaren(jsonb) to service_role;

-- Wanneer liep de laatste controle? Voor de server, om niet vaker dan nodig te controleren.
create or replace function maps.kaartbronnen_laatst() returns timestamptz
language sql stable security definer set search_path = '' as $$
  select max(gecontroleerd_op) from maps.kaartbron_status
$$;
revoke all on function maps.kaartbronnen_laatst() from public, anon, authenticated;
grant execute on function maps.kaartbronnen_laatst() to service_role;

create or replace function maps.platform_kaartbronnen() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not maps.is_platformbeheerder() then null else coalesce((
    select jsonb_agg(to_jsonb(k) order by k.ok, k.naam) from maps.kaartbron_status k), '[]'::jsonb) end
$$;
revoke all on function maps.platform_kaartbronnen() from public, anon;
grant execute on function maps.platform_kaartbronnen() to authenticated;
