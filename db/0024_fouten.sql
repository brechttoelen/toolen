-- 0024 · Eigen foutmonitoring (geen externe dienst)
--
-- De app meldt zelf fouten uit de browser en van de server. Ze komen in maps.fouten en zijn enkel zichtbaar
-- voor platformbeheer (Systeem → Fouten), gegroepeerd per soort fout. Geen inhoud van plannen, geen invoer
-- van gebruikers: enkel de foutmelding, de plek in de code, de pagina, de versie en het soort toestel.
-- Bewaartermijn 30 dagen. Begrensd per gebruiker en in totaal, zodat niemand de tabel kan volstorten.

create table if not exists maps.fouten (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  vinger text not null,
  bron text not null default 'browser',
  bericht text not null,
  stapel text,
  adres text,
  versie text,
  toestel text,
  user_id uuid,
  organisatie text
);
create index if not exists fouten_vinger on maps.fouten (vinger, created_at desc);
create index if not exists fouten_tijd on maps.fouten (created_at desc);
alter table maps.fouten enable row level security;
revoke all on maps.fouten from public, anon, authenticated;

create or replace function maps.fout_melden(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_bericht text := left(coalesce(p ->> 'bericht', ''), 500);
  v_stapel text := left(coalesce(p ->> 'stapel', ''), 4000);
  v_bron text := case when p ->> 'bron' = 'server' and v_uid is null and coalesce(auth.role(), '') = 'service_role' then 'server' else 'browser' end;
begin
  if v_bericht = '' then return; end if;
  -- Grenzen: 30 per uur per gebruiker, 300 per uur voor bezoekers zonder account samen, 2000 per uur in totaal.
  if (select count(*) from maps.fouten where created_at > now() - interval '1 hour') >= 2000 then return; end if;
  if v_uid is not null and (select count(*) from maps.fouten where user_id = v_uid and created_at > now() - interval '1 hour') >= 30 then return; end if;
  if v_uid is null and v_bron = 'browser' and (select count(*) from maps.fouten where user_id is null and bron = 'browser' and created_at > now() - interval '1 hour') >= 300 then return; end if;
  insert into maps.fouten (vinger, bron, bericht, stapel, adres, versie, toestel, user_id, organisatie)
  values (
    -- Zelfde fout = zelfde melding zonder cijfers en id's, plus de eerste regel van de plek in de code.
    md5(v_bron || '|' || regexp_replace(v_bericht, '[0-9a-f]{8}-[0-9a-f-]{27}|[0-9]+', '#', 'g') || '|' || split_part(regexp_replace(v_stapel, '^[^\n]*\n', ''), E'\n', 1)),
    v_bron, v_bericht, nullif(v_stapel, ''), left(p ->> 'adres', 300), left(p ->> 'versie', 40), left(p ->> 'toestel', 200), v_uid, left(p ->> 'organisatie', 40));
  -- Opruimen: af en toe alles ouder dan 30 dagen weg.
  if random() < 0.02 then delete from maps.fouten where created_at < now() - interval '30 days'; end if;
end $$;
revoke all on function maps.fout_melden(jsonb) from public;
grant execute on function maps.fout_melden(jsonb) to anon, authenticated, service_role;

-- Overzicht voor platformbeheer: per soort fout het aantal, wie geraakt is en een voorbeeld.
create or replace function maps.platform_fouten() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not maps.is_platformbeheerder() then null else coalesce((
    select jsonb_agg(r order by r.laatst desc) from (
      select f.vinger, max(f.created_at) as laatst, min(f.created_at) as eerst, count(*) as aantal,
        count(*) filter (where f.created_at > now() - interval '24 hours') as vandaag,
        count(distinct f.user_id) as gebruikers,
        (array_agg(distinct f.organisatie) filter (where f.organisatie is not null))[1:6] as organisaties,
        (array_agg(f.bron order by f.created_at desc))[1] as bron,
        (array_agg(f.bericht order by f.created_at desc))[1] as bericht,
        (array_agg(f.stapel order by f.created_at desc))[1] as stapel,
        (array_agg(f.adres order by f.created_at desc))[1] as adres,
        (array_agg(f.versie order by f.created_at desc))[1] as versie,
        (array_agg(f.toestel order by f.created_at desc))[1] as toestel
      from maps.fouten f where f.created_at > now() - interval '30 days'
      group by f.vinger order by max(f.created_at) desc limit 100) r), '[]'::jsonb) end;
$$;
revoke all on function maps.platform_fouten() from public, anon;
grant execute on function maps.platform_fouten() to authenticated;

create or replace function maps.platform_fout_weg(p_vinger text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not maps.is_platformbeheerder() then raise exception 'Enkel voor platformbeheer.' using errcode = '42501'; end if;
  delete from maps.fouten where vinger = p_vinger;
end $$;
revoke all on function maps.platform_fout_weg(text) from public, anon;
grant execute on function maps.platform_fout_weg(text) to authenticated;
