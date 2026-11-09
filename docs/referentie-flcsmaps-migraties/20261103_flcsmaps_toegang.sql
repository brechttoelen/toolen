-- Eigen toegang voor FLCS Maps (toegepast via MCP op 2026-11-03). Zie flcsmaps.toegang, flcsmaps.ik(),
-- flcsmaps.mag_lezen/mag_schrijven/mag_beheren en de edge function sync-maps.
create table if not exists flcsmaps.toegang (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null, naam text,
  rol text not null check (rol in ('admin', 'editor', 'viewer')),
  bron text not null default 'hub' check (bron in ('hub', 'publitool', 'lokaal')),
  synced_at timestamptz not null default now(), created_at timestamptz not null default now()
);
alter table flcsmaps.toegang enable row level security;
insert into flcsmaps.toegang (user_id, email, naam, rol, bron)
select a.user_id, a.email, a.display_name, case when a.rol in ('admin', 'editor') then a.rol else 'viewer' end, 'publitool' from publitool.access a
on conflict (user_id) do nothing;
create or replace function flcsmaps.mag_lezen() returns boolean language sql stable security definer set search_path to 'flcsmaps', 'public' as $$ select exists (select 1 from flcsmaps.toegang t where t.user_id = auth.uid()); $$;
create or replace function flcsmaps.mag_schrijven() returns boolean language sql stable security definer set search_path to 'flcsmaps', 'public' as $$ select exists (select 1 from flcsmaps.toegang t where t.user_id = auth.uid() and t.rol in ('admin', 'editor')); $$;
create or replace function flcsmaps.mag_beheren() returns boolean language sql stable security definer set search_path to 'flcsmaps', 'public' as $$ select exists (select 1 from flcsmaps.toegang t where t.user_id = auth.uid() and t.rol = 'admin'); $$;
create or replace function flcsmaps.ik() returns jsonb language sql stable security definer set search_path to 'flcsmaps', 'public' as $$
  select jsonb_build_object('id', t.user_id, 'email', t.email, 'display_name', coalesce(t.naam, split_part(t.email, '@', 1)), 'role', t.rol, 'bron', t.bron, 'synced_at', t.synced_at)
  from flcsmaps.toegang t where t.user_id = auth.uid(); $$;
revoke all on function flcsmaps.ik() from public;
grant execute on function flcsmaps.ik() to authenticated;
create policy toegang_lezen on flcsmaps.toegang for select to authenticated using (user_id = auth.uid() or flcsmaps.mag_lezen());
grant select on flcsmaps.toegang to authenticated;
grant all on flcsmaps.toegang to service_role;
