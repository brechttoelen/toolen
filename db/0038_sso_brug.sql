-- 0038 · Aanmelden via de Microsoft-koppeling van een andere omgeving (brug)
--
-- Een organisatie die al een eigen omgeving met Microsoft-aanmelding heeft (een ander Supabase-project), kan haar
-- leden daarmee in Toolen laten aanmelden zonder een eigen registratie bij Microsoft. Toolen start de aanmelding
-- bij dat project, controleert op de server wie er aangemeld is en maakt dan zelf een sessie voor dat e-mailadres
-- (enkel voor wie al actief lid is). Zie app/auth/brug en lib/ssoBrug.ts.
--
-- Zo'n sessie komt van Microsoft (met de tweede stap van dat bedrijf) maar is in Toolen geen gewone SSO-sessie.
-- Daarom onthoudt de server per sessie dat ze via de brug kwam; die sessies hoeven geen code uit de app te geven.
-- organisaties.sso krijgt de waarde 'brug' (zet het platform).

alter table maps.organisaties drop constraint if exists organisaties_sso_check;
alter table maps.organisaties add constraint organisaties_sso_check check (sso <@ array['azure','google','brug']::text[]);

create table if not exists maps.brug_sessies (
  session_id uuid primary key,
  user_id uuid not null,
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  sinds timestamptz not null default now()
);
alter table maps.brug_sessies enable row level security;
revoke all on maps.brug_sessies from public, anon, authenticated;

-- Is de huidige sessie via de brug gemaakt? (De sessie-id staat in het ondertekende token.)
create or replace function maps.is_brug_sessie() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from maps.brug_sessies b
     where b.user_id = auth.uid()
       and b.session_id::text = coalesce(auth.jwt() ->> 'session_id', ''));
$$;
revoke all on function maps.is_brug_sessie() from public, anon;
grant execute on function maps.is_brug_sessie() to authenticated;

create or replace function maps.mfa_in_orde_voor(p_sso text[]) returns boolean
language sql stable set search_path = '' as $$
  select case
    when auth.jwt() is null or auth.jwt() = '{}'::jsonb then true
    when coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then true
    when exists (select 1 from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
                  where a ->> 'method' = 'oauth')
      then coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = any (coalesce(p_sso, '{}'))
    -- Via de brug aangemeld, en deze organisatie laat de brug toe.
    when 'brug' = any (coalesce(p_sso, '{}')) then maps.is_brug_sessie()
    else false
  end;
$$;

create or replace function maps.mfa_in_orde() returns boolean
language sql stable set search_path = '' as $$
  select case
    when auth.jwt() is null or auth.jwt() = '{}'::jsonb then true
    when coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then true
    when exists (select 1 from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
                  where a ->> 'method' = 'oauth') then true
    else maps.is_brug_sessie()
  end;
$$;

-- Server (geheime sleutel): is dit e-mailadres een actief lid van deze organisatie, en laat ze de brug toe?
create or replace function maps.brug_lid(p_email text, p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id', u.id, 'email', u.email, 'organisatie_id', o.id, 'naam', o.naam)
    from maps.organisaties o
    join maps.leden l on l.organisatie_id = o.id and l.actief
    join auth.users u on u.id = l.user_id
   where o.slug = lower(btrim(p_slug)) and 'brug' = any (o.sso)
     and o.status in ('proef','actief','achterstallig','alleen_lezen')
     and lower(u.email) = lower(btrim(p_email))
   limit 1;
$$;
revoke all on function maps.brug_lid(text, text) from public, anon, authenticated;
grant execute on function maps.brug_lid(text, text) to service_role;

create or replace function maps.brug_sessie_bewaren(p_session uuid, p_user uuid, p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Enkel voor de server.' using errcode = '42501';
  end if;
  insert into maps.brug_sessies (session_id, user_id, organisatie_id) values (p_session, p_user, p_org)
    on conflict (session_id) do nothing;
  -- Sessies verlopen vanzelf; oude rijen hoeven niet te blijven.
  delete from maps.brug_sessies where sinds < now() - interval '120 days';
end $$;
revoke all on function maps.brug_sessie_bewaren(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function maps.brug_sessie_bewaren(uuid, uuid, uuid) to service_role;
