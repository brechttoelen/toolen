-- ============================================================================
-- 0010 · Inloggen, limieten per pakket en systeemcijfers
-- ============================================================================
-- 1. MFA. Wie met een wachtwoord inlogt, moet ook een code uit een app geven (aal2).
--    Platformbeheer vraagt altijd aal2, ook na inloggen via Microsoft, Google of e-mailcode.
--    De databank controleert dit zelf: zonder code geen gegevens, ook niet via de API.
-- 2. Maximaal twee apparaten per account. Een derde aanmelding meldt het oudste apparaat af.
-- 3. Limieten per pakket: events per jaar (plannen zonder event tellen elk als één event),
--    actieve deellinks en opslag (opslag enkel ter info op de systeempagina).
--    Leeg = onbeperkt. Per organisatie af te wijken (organisaties.limieten).
-- 4. Cijfers voor de systeempagina (/beheer?blad=systeem).
-- Mag opnieuw gedraaid worden.
-- ============================================================================

-- 1. MFA ----------------------------------------------------------------------

-- In orde: niet met een wachtwoord ingelogd, of wel en dan met de tweede stap (aal2).
-- Zonder JWT (service_role, SQL Editor, tests) in orde.
create or replace function maps.mfa_in_orde() returns boolean
language sql stable set search_path = '' as $$
  select case
    when auth.jwt() is null or auth.jwt() = '{}'::jsonb then true
    when coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then true
    else not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
                      where a ->> 'method' = 'password')
  end;
$$;

create or replace function maps.mfa_volledig() returns boolean
language sql stable set search_path = '' as $$
  select auth.jwt() is null or auth.jwt() = '{}'::jsonb or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function maps.mijn_organisaties(p_min text default 'lezer') returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(o.id), '{}')
    from maps.leden l
    join maps.organisaties o on o.id = l.organisatie_id
   where l.user_id = auth.uid()
     and maps.mfa_in_orde()
     and l.actief
     and maps.rol_rang(l.rol) >= maps.rol_rang(p_min)
     and (maps.actieve_organisatie() is null or o.id = maps.actieve_organisatie())
     and case when maps.rol_rang(p_min) >= 2
              then o.status in ('proef','actief','achterstallig')
              else o.status in ('proef','actief','achterstallig','alleen_lezen')
                   or (o.status = 'geblokkeerd' and l.rol = 'eigenaar') end;
$$;

create or replace function maps.lid_van() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(organisatie_id), '{}') from maps.leden where user_id = auth.uid() and actief and maps.mfa_in_orde();
$$;

create or replace function maps.is_platformbeheerder() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from maps.platform_beheerders where user_id = auth.uid()) and maps.mfa_volledig();
$$;

-- Platformbeheerder, ook zonder tweede stap (om te tonen dat die nog moet).
create or replace function maps.is_platformbeheerder_zonder_mfa() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from maps.platform_beheerders where user_id = auth.uid());
$$;
revoke execute on function maps.is_platformbeheerder_zonder_mfa() from public, anon;
grant execute on function maps.is_platformbeheerder_zonder_mfa() to authenticated;

-- 2. Twee apparaten ----------------------------------------------------------

create table if not exists maps.sessie_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null,
  op         timestamptz not null default now(),
  afgemeld   integer not null,
  user_agent text
);
create index if not exists sessie_log_user on maps.sessie_log (user_id, op desc);
alter table maps.sessie_log enable row level security;
drop policy if exists platform on maps.sessie_log;
create policy platform on maps.sessie_log for select to authenticated using (maps.is_platformbeheerder());
grant select on maps.sessie_log to authenticated;

create or replace function maps.sessies_beperken() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with weg as (
    select s.id from auth.sessions s
     where s.user_id = new.user_id and s.id <> new.id
     order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc
     offset 1)
  delete from auth.sessions s using weg where s.id = weg.id;
  get diagnostics n = row_count;
  if n > 0 then insert into maps.sessie_log (user_id, afgemeld, user_agent) values (new.user_id, n, new.user_agent); end if;
  return new;
exception when others then
  return new; -- nooit het inloggen zelf blokkeren
end $$;
drop trigger if exists toolen_twee_apparaten on auth.sessions;
create trigger toolen_twee_apparaten after insert on auth.sessions for each row execute function maps.sessies_beperken();

-- Bestaat de sessie van deze aanmelding nog? (Het oudste apparaat checkt dit en meldt zich af.)
create or replace function maps.sessie_geldig() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.jwt() ->> 'session_id' is null
      or exists (select 1 from auth.sessions s where s.id::text = auth.jwt() ->> 'session_id');
$$;
revoke execute on function maps.sessie_geldig() from public, anon;
grant execute on function maps.sessie_geldig() to authenticated;

-- 3. Limieten per pakket -----------------------------------------------------

alter table maps.pakketten add column if not exists max_events_jaar integer check (max_events_jaar is null or max_events_jaar >= 0);
alter table maps.pakketten add column if not exists max_deellinks   integer check (max_deellinks is null or max_deellinks >= 0);
alter table maps.pakketten add column if not exists max_opslag_mb   integer check (max_opslag_mb is null or max_opslag_mb >= 0);
-- Afwijkingen per organisatie, bv. {"max_events_jaar": 10}. Leeg = die van het pakket.
alter table maps.organisaties add column if not exists limieten jsonb not null default '{}';

update maps.pakketten set max_events_jaar = 3,  max_deellinks = 10,  max_opslag_mb = 1000  where id = 'proef' and max_events_jaar is null;
update maps.pakketten set max_events_jaar = 3,  max_deellinks = 25,  max_opslag_mb = 2000  where id = 'event' and max_events_jaar is null;
update maps.pakketten set max_events_jaar = 15, max_deellinks = 100, max_opslag_mb = 10000 where id = 'pro'   and max_events_jaar is null;

create or replace function maps.limiet(p_org uuid, p_sleutel text) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((o.limieten ->> p_sleutel)::integer,
                  case p_sleutel when 'max_events_jaar' then p.max_events_jaar when 'max_deellinks' then p.max_deellinks when 'max_opslag_mb' then p.max_opslag_mb end)
    from maps.organisaties o left join maps.pakketten p on p.id = o.pakket
   where o.id = p_org;
$$;

-- Events van een jaar: echte events plus plannen zonder event (die tellen elk als één).
create or replace function maps.events_in_jaar(p_org uuid, p_jaar integer) returns integer
language sql stable security definer set search_path = '' as $$
  select (select count(*) from maps.events e where e.organisatie_id = p_org and extract(year from coalesce(e.datum, e.created_at::date)) = p_jaar)::integer
       + (select count(*) from maps.plannen p where p.organisatie_id = p_org and p.event_id is null and p.verwijderd_op is null
            and extract(year from p.created_at) = p_jaar)::integer;
$$;

create or replace function maps.deellinks_actief(p_org uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from maps.deel_links d
   where d.organisatie_id = p_org and d.ingetrokken_op is null and (d.geldig_tot is null or d.geldig_tot > now());
$$;

create or replace function maps.opslag_mb(p_org uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select round(coalesce(sum((o.metadata ->> 'size')::bigint), 0) / 1048576.0, 1)
    from storage.objects o
   where o.bucket_id = 'maps'
     and (split_part(o.name, '/', 1) = p_org::text
          or o.name in (select b.pad from maps.bestanden b where b.organisatie_id = p_org)
          or (p_org = (select id from maps.organisaties where slug = 'flcs') and split_part(o.name, '/', 1) !~ '^[0-9a-f-]{36}$'));
$$;

create or replace function maps.events_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m integer; n integer; j integer;
begin
  if maps.is_platformbeheerder() then return new; end if;
  if tg_table_name = 'plannen' and to_jsonb(new) ->> 'event_id' is not null then return new; end if;
  j := extract(year from coalesce((to_jsonb(new) ->> 'datum')::date, current_date));
  m := maps.limiet(new.organisatie_id, 'max_events_jaar');
  if m is null then return new; end if;
  n := maps.events_in_jaar(new.organisatie_id, j);
  if n >= m then
    raise exception 'Je pakket laat % events per jaar toe en die zijn voor % op. Kies een bestaand event of vraag een groter pakket.', m, j using errcode = 'P0001';
  end if;
  return new;
end $$;
-- Namen met zz: na de trigger die organisatie_id invult.
drop trigger if exists events_limiet on maps.events;
drop trigger if exists events_zz_limiet on maps.events;
create trigger events_zz_limiet before insert on maps.events for each row execute function maps.events_bewaken();
drop trigger if exists plannen_limiet on maps.plannen;
drop trigger if exists plannen_zz_limiet on maps.plannen;
create trigger plannen_zz_limiet before insert on maps.plannen for each row execute function maps.events_bewaken();

create or replace function maps.deellinks_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m integer;
begin
  if maps.is_platformbeheerder() then return new; end if;
  if new.ingetrokken_op is not null or (new.geldig_tot is not null and new.geldig_tot <= now()) then return new; end if;
  if tg_op = 'UPDATE' and old.ingetrokken_op is null and (old.geldig_tot is null or old.geldig_tot > now()) then return new; end if;
  m := maps.limiet(new.organisatie_id, 'max_deellinks');
  if m is not null and maps.deellinks_actief(new.organisatie_id) >= m then
    raise exception 'Je pakket laat % actieve deellinks toe. Zet een oude link uit of vraag een groter pakket.', m using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists deellinks_limiet on maps.deel_links;
drop trigger if exists deel_links_zz_limiet on maps.deel_links;
create trigger deel_links_zz_limiet before insert or update on maps.deel_links for each row execute function maps.deellinks_bewaken();

-- Gebruik tegenover het pakket (voor de organisatie zelf en het platform).
create or replace function maps.gebruik(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (p_org = any (maps.lid_van()) or maps.is_platformbeheerder()) then return null; end if;
  return jsonb_build_object(
    'events_jaar', maps.events_in_jaar(p_org, extract(year from current_date)::integer), 'max_events_jaar', maps.limiet(p_org, 'max_events_jaar'),
    'deellinks', maps.deellinks_actief(p_org), 'max_deellinks', maps.limiet(p_org, 'max_deellinks'),
    'opslag_mb', maps.opslag_mb(p_org), 'max_opslag_mb', maps.limiet(p_org, 'max_opslag_mb'));
end $$;
revoke execute on function maps.gebruik(uuid) from public, anon;
grant execute on function maps.gebruik(uuid) to authenticated;

revoke execute on function maps.limiet(uuid, text) from public, anon;
revoke execute on function maps.events_in_jaar(uuid, integer) from public, anon;
revoke execute on function maps.deellinks_actief(uuid) from public, anon;
revoke execute on function maps.opslag_mb(uuid) from public, anon;
grant execute on function maps.limiet(uuid, text), maps.events_in_jaar(uuid, integer), maps.deellinks_actief(uuid), maps.opslag_mb(uuid) to authenticated;

-- 4. Systeemcijfers ----------------------------------------------------------

create or replace function maps.platform_systeem() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not maps.is_platformbeheerder() then raise exception 'Enkel voor platformbeheerders' using errcode = '42501'; end if;
  return jsonb_build_object(
    'databank_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'opslag_mb', (select round(coalesce(sum((metadata ->> 'size')::bigint), 0) / 1048576.0, 1) from storage.objects where bucket_id = 'maps'),
    'bestanden', (select count(*) from storage.objects where bucket_id = 'maps'),
    'gebruikers', (select count(*) from auth.users),
    'actief_24u', (select count(distinct user_id) from auth.sessions where coalesce(refreshed_at, updated_at, created_at) > now() - interval '24 hours'),
    'actief_7d', (select count(distinct user_id) from auth.sessions where coalesce(refreshed_at, updated_at, created_at) > now() - interval '7 days'),
    'zonder_mfa_wachtwoord', (select count(*) from auth.users u where u.encrypted_password is not null and u.encrypted_password <> ''
                                and not exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified')),
    'migraties', coalesce((select jsonb_agg(coalesce(name, version) order by version) from supabase_migrations.schema_migrations), '[]'::jsonb),
    'wissels', coalesce((select jsonb_agg(jsonb_build_object('email', u.email, 'aantal', x.n, 'laatst', x.laatst) order by x.n desc)
                           from (select user_id, sum(afgemeld) n, max(op) laatst from maps.sessie_log where op > now() - interval '30 days' group by user_id) x
                           join auth.users u on u.id = x.user_id), '[]'::jsonb),
    'feedback_open', (select count(*) from maps.feedback where status is distinct from 'afgehandeld'),
    'organisaties', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'naam', o.naam, 'slug', o.slug, 'pakket', o.pakket, 'status', o.status,
        'plannen', (select count(*) from maps.plannen p where p.organisatie_id = o.id and p.verwijderd_op is null),
        'items', (select count(*) from maps.items i where i.organisatie_id = o.id),
        'leden', (select count(*) from maps.leden l where l.organisatie_id = o.id and l.actief),
        'plaatsen', o.plaatsen,
        'gebruik', maps.gebruik(o.id),
        'laatst_actief', (select max(p.updated_at) from maps.plannen p where p.organisatie_id = o.id)) order by o.naam)
      from maps.organisaties o), '[]'::jsonb));
end $$;
revoke execute on function maps.platform_systeem() from public, anon;
grant execute on function maps.platform_systeem() to authenticated;
