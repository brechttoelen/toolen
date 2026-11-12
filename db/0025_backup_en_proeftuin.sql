-- 0025 · Eigen backups en een proeftuin
--
-- 1. Backups zonder betalend plan: elke nacht een momentopname van alle gegevens (plannen, items, bibliotheek,
--    leden, deellinks ...) in maps.backups. De laatste 10 automatische en 5 handmatige blijven bewaard.
--    Platformbeheer kan er een maken en een downloaden (Systeem → Backups). Logboeken zitten er niet in.
--    Dit beschermt tegen een foute wijziging of een bug; een download bewaar je buiten de databank.
-- 2. Proeftuin: een organisatie kopiëren naar een andere (bibliotheek, leveranciers en gekozen plannen),
--    om vrij te testen zonder echte plannen te raken. Ook bruikbaar om een nieuwe klant een startbibliotheek te geven.

create extension if not exists pg_cron;

create table if not exists maps.backups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  soort text not null default 'auto',
  door uuid,
  tabellen jsonb not null default '{}'::jsonb,
  bytes bigint not null default 0,
  inhoud jsonb not null
);
alter table maps.backups enable row level security;
revoke all on maps.backups from public, anon, authenticated;

create or replace function maps.backup_maken(p_soort text default 'hand') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_soort text := case when p_soort = 'auto' then 'auto' else 'hand' end;
  t text; v_rijen jsonb; v_inhoud jsonb := '{}'::jsonb; v_tel jsonb := '{}'::jsonb; v_id uuid;
begin
  -- Platformbeheer, of de databank zelf (nachtelijke taak, geen gebruiker).
  if not (maps.is_platformbeheerder() or (v_uid is null and coalesce(auth.role(), '') not in ('anon', 'authenticated'))) then
    raise exception 'Enkel voor platformbeheer.' using errcode = '42501';
  end if;
  for t in select c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'maps' and c.relkind = 'r' and c.relname not in ('backups', 'wijzigingen', 'fouten', 'mail_log', 'sessie_log', 'import_bestanden', 'import_stand') order by 1
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from maps.%I x', t) into v_rijen;
    v_inhoud := v_inhoud || jsonb_build_object(t, v_rijen);
    v_tel := v_tel || jsonb_build_object(t, jsonb_array_length(v_rijen));
  end loop;
  insert into maps.backups (soort, door, tabellen, bytes, inhoud) values (v_soort, v_uid, v_tel, pg_catalog.octet_length(v_inhoud::text), v_inhoud) returning id into v_id;
  delete from maps.backups b where b.soort = 'auto' and b.id not in (select id from maps.backups where soort = 'auto' order by created_at desc limit 10);
  delete from maps.backups b where b.soort = 'hand' and b.id not in (select id from maps.backups where soort = 'hand' order by created_at desc limit 5);
  return v_id;
end $$;
revoke all on function maps.backup_maken(text) from public, anon;
grant execute on function maps.backup_maken(text) to authenticated;

create or replace function maps.platform_backups() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not maps.is_platformbeheerder() then null else coalesce((
    select jsonb_agg(jsonb_build_object('id', b.id, 'op', b.created_at, 'soort', b.soort, 'bytes', b.bytes, 'tabellen', b.tabellen) order by b.created_at desc) from maps.backups b), '[]'::jsonb) end;
$$;
revoke all on function maps.platform_backups() from public, anon;
grant execute on function maps.platform_backups() to authenticated;

create or replace function maps.platform_backup_inhoud(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not maps.is_platformbeheerder() then null else (select jsonb_build_object('gemaakt', b.created_at, 'soort', b.soort, 'tabellen', b.inhoud) from maps.backups b where b.id = p_id) end;
$$;
revoke all on function maps.platform_backup_inhoud(uuid) from public, anon;
grant execute on function maps.platform_backup_inhoud(uuid) to authenticated;

-- Elke nacht om 03:15 (UTC).
select cron.unschedule(jobid) from cron.job where jobname = 'maps-backup';
select cron.schedule('maps-backup', '15 3 * * *', $$select maps.backup_maken('auto')$$);

-- 2. Organisatie kopiëren -------------------------------------------------------
-- Kopieert de bibliotheek, de leveranciers en de gekozen plannen (met events, lagen, fasen en items) van p_van
-- naar p_naar. Alles krijgt nieuwe id's; verwijzingen (element, laag, fase, ontwerpen in velden) wijzen naar de kopie.
create or replace function maps.platform_kopieer_organisatie(p_van uuid, p_naar uuid, p_plannen uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); r record; j jsonb; tx text; m record; v_tel jsonb := '{}'::jsonb; n int;
  tabellen text[] := array['leveranciers', 'events', 'plannen', 'bibliotheek', 'lagen', 'fasen', 'items'];
  t text;
begin
  if not (maps.is_platformbeheerder() or (v_uid is null and coalesce(auth.role(), '') not in ('anon', 'authenticated'))) then
    raise exception 'Enkel voor platformbeheer.' using errcode = '42501';
  end if;
  if p_van = p_naar or not exists (select 1 from maps.organisaties where id = p_naar) then raise exception 'Kies een andere, bestaande organisatie als doel.' using errcode = 'P0001'; end if;
  create temp table _kopie (tabel text, oud uuid primary key, nieuw uuid not null default gen_random_uuid(), rij jsonb) on commit drop;
  insert into _kopie (tabel, oud, rij) select 'leveranciers', x.id, to_jsonb(x) from maps.leveranciers x where x.organisatie_id = p_van
    and not exists (select 1 from maps.leveranciers d where d.organisatie_id = p_naar and d.naam = x.naam);
  insert into _kopie (tabel, oud, rij) select 'plannen', x.id, to_jsonb(x) from maps.plannen x where x.organisatie_id = p_van and x.id = any (p_plannen) and x.verwijderd_op is null;
  insert into _kopie (tabel, oud, rij) select 'events', x.id, to_jsonb(x) from maps.events x where x.organisatie_id = p_van and x.id in (select (k.rij ->> 'event_id')::uuid from _kopie k where k.tabel = 'plannen' and k.rij ->> 'event_id' is not null);
  insert into _kopie (tabel, oud, rij) select 'bibliotheek', x.id, to_jsonb(x) from maps.bibliotheek x where x.organisatie_id = p_van and (x.plan_id is null or x.plan_id in (select oud from _kopie where tabel = 'plannen'));
  insert into _kopie (tabel, oud, rij) select 'lagen', x.id, to_jsonb(x) from maps.lagen x where x.plan_id in (select oud from _kopie where tabel = 'plannen');
  insert into _kopie (tabel, oud, rij) select 'fasen', x.id, to_jsonb(x) from maps.fasen x where x.plan_id in (select oud from _kopie where tabel = 'plannen');
  insert into _kopie (tabel, oud, rij) select 'items', x.id, to_jsonb(x) from maps.items x where x.plan_id in (select oud from _kopie where tabel = 'plannen');

  foreach t in array tabellen loop
    n := 0;
    for r in select * from _kopie where tabel = t loop
      j := r.rij || jsonb_build_object('organisatie_id', p_naar);
      if t in ('plannen', 'items') then j := j || jsonb_build_object('plek_id', null); end if;
      if t = 'plannen' then j := j || jsonb_build_object('rev', 1); end if;
      tx := j::text;
      -- Elke verwijzing (als hele waarde tussen aanhalingstekens) naar een gekopieerde rij: naar de kopie.
      for m in select distinct k.oud, k.nieuw from _kopie k
        join lateral (select (regexp_matches(tx, '"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"', 'g'))[1] as u) g on g.u = k.oud::text
      loop tx := replace(tx, '"' || m.oud::text || '"', '"' || m.nieuw::text || '"'); end loop;
      execute format('insert into maps.%I select * from jsonb_populate_record(null::maps.%I, $1)', t, t) using tx::jsonb;
      n := n + 1;
    end loop;
    v_tel := v_tel || jsonb_build_object(t, n);
  end loop;
  return v_tel;
end $$;
revoke all on function maps.platform_kopieer_organisatie(uuid, uuid, uuid[]) from public, anon;
grant execute on function maps.platform_kopieer_organisatie(uuid, uuid, uuid[]) to authenticated;
