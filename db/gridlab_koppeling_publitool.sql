-- ============================================================================
-- GridLab → Toolen Maps · plakken in de SQL Editor van het PUBLITOOL-project (flcs-pub) → Run
-- ============================================================================
-- Maakt een functie die Toolen alleen laat LEZEN: de GridLab-ontwerpen, de logo-overrides en de logoversies.
-- Schrijven kan Toolen niet. De sleutel wordt hier willekeurig gemaakt; in de databank staat enkel de hash.
-- Het resultaat toont de sleutel één keer: kopieer hem naar Vercel (project toolen) als
--   TOOLEN_GRIDLAB_SLEUTEL   (Production én Preview, type Secret)
-- en rol daarna opnieuw uit (Redeploy). Opnieuw draaien maakt een nieuwe sleutel en schrapt de oude.
-- Intrekken: delete from gridlab.toolen_koppeling;
-- ============================================================================

create table if not exists gridlab.toolen_koppeling (
  hash text primary key,
  naam text not null default 'Toolen Maps',
  aangemaakt timestamptz not null default now()
);
alter table gridlab.toolen_koppeling enable row level security;
revoke all on gridlab.toolen_koppeling from anon, authenticated;

create or replace function gridlab.toolen_lezen(p_sleutel text, p_ids uuid[] default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if p_sleutel is null or length(p_sleutel) < 32
     or not exists (select 1 from gridlab.toolen_koppeling k where k.hash = encode(extensions.digest(p_sleutel, 'sha256'), 'hex')) then
    return null;
  end if;
  return jsonb_build_object(
    'ontwerpen', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'event', d.event, 'season', d.season, 'edition', d.edition,
                   'version', d.version, 'approval_locked', d.approval_locked, 'updated_at', d.updated_at, 'format_code', d.format_code,
                   'folder', d.folder, 'canvases', d.canvases) order by d.updated_at desc)
                 from gridlab.designs d where p_ids is null or d.id = any(p_ids)), '[]'::jsonb),
    'overrides', coalesce((select jsonb_agg(jsonb_build_object('sponsor_name', o.sponsor_name, 'logo_data_url', o.logo_data_url)) from gridlab.logo_overrides o), '[]'::jsonb),
    'logos', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 't', coalesce(s.updated_at, s.created_at)))
                 from storage.objects s where s.bucket_id = 'gridlab-logos' and s.name not like '%/%'), '[]'::jsonb));
end $$;
revoke execute on function gridlab.toolen_lezen(text, uuid[]) from public;
grant execute on function gridlab.toolen_lezen(text, uuid[]) to anon, authenticated;

-- Nieuwe sleutel maken en één keer tonen.
delete from gridlab.toolen_koppeling;
with s as (select encode(extensions.gen_random_bytes(32), 'hex') as sleutel)
insert into gridlab.toolen_koppeling (hash) select encode(extensions.digest(sleutel, 'sha256'), 'hex') from s
returning (select sleutel from s) as kopieer_naar_vercel;
