-- ============================================================================
-- FLCS MAPS — 001: fundament
-- Project: Publitool (flcs-pub, vojkrpenkqsphaflsdfh). Eigen schema `flcsmaps`.
--
-- FLCS Maps deelt het project en de login met Publitool, maar niet zijn data:
--   * alles zit in schema flcsmaps (niets in publitool of public);
--   * geen foreign keys naar Publitool-tabellen, enkel losse id's;
--   * RLS op elke tabel via flcsmaps.mag_lezen() / flcsmaps.mag_schrijven(),
--     die de rol uit publitool.access lezen (één plek voor rechten);
--   * deel-links zonder login enkel via flcsmaps.deel_link_lezen(token);
--   * eigen storage-bucket 'flcsmaps'.
--
-- NA HET DRAAIEN, EENMALIG IN HET DASHBOARD:
--   Project Settings -> Data API -> Exposed schemas: 'flcsmaps' toevoegen.
--
-- TERUGDRAAIEN (enkel als er nog geen echte plannen in staan):
--   drop schema flcsmaps cascade;
--   delete from storage.objects where bucket_id = 'flcsmaps';
--   delete from storage.buckets where id = 'flcsmaps';
-- ============================================================================

create schema if not exists flcsmaps;
grant usage on schema flcsmaps to anon, authenticated, service_role;

-- ---------- Rechten ----------
create or replace function flcsmaps.mag_lezen()
returns boolean
language sql stable security definer
set search_path = publitool, public
as $$
  select exists (select 1 from publitool.access a where a.user_id = auth.uid() and a.rol is not null);
$$;

create or replace function flcsmaps.mag_schrijven()
returns boolean
language sql stable security definer
set search_path = publitool, public
as $$
  select exists (select 1 from publitool.access a where a.user_id = auth.uid() and a.rol in ('admin', 'editor'));
$$;

revoke all on function flcsmaps.mag_lezen() from public;
revoke all on function flcsmaps.mag_schrijven() from public;
grant execute on function flcsmaps.mag_lezen() to authenticated, service_role;
grant execute on function flcsmaps.mag_schrijven() to authenticated, service_role;

-- ---------- Plaatsfiche ----------
create table if not exists flcsmaps.plekken (
  id          uuid primary key default gen_random_uuid(),
  naam        text not null,
  kader       jsonb,
  contacten   jsonb not null default '[]',
  created_at  timestamptz not null default now()
);

-- ---------- Plannen ----------
create table if not exists flcsmaps.plannen (
  id            uuid primary key default gen_random_uuid(),
  naam          text not null,
  editie_naam   text,                 -- bv. 'Ronde van Vlaanderen 2027'
  edition_id    text,                 -- optioneel: toolkit season_event (los)
  plek_id       uuid references flcsmaps.plekken(id) on delete set null,
  locatie       text,                 -- adres of plaats zoals gezocht
  centrum       jsonb,                -- [lng, lat]
  zoom          numeric,
  basiskaart    text not null default 'luchtfoto',
  status        text not null default 'concept',   -- 'concept' | 'definitief'
  versie        integer not null default 1,
  titelblok     jsonb not null default '{}',       -- organisatie, tekenaar, ...
  instellingen  jsonb not null default '{}',
  aangemaakt_door uuid,
  bewerkt_door  uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists flcsmaps.fasen (
  id        uuid primary key default gen_random_uuid(),
  plan_id   uuid not null references flcsmaps.plannen(id) on delete cascade,
  naam      text not null,
  van       timestamptz,
  tot       timestamptz,
  volgorde  integer not null default 0
);
create index if not exists fasen_plan on flcsmaps.fasen(plan_id);

create table if not exists flcsmaps.lagen (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references flcsmaps.plannen(id) on delete cascade,
  naam        text not null,
  kleur       text not null default '#2563EB',
  stijl       jsonb not null default '{}',
  zichtbaar   boolean not null default true,
  vergrendeld boolean not null default false,
  printbaar   boolean not null default true,
  volgorde    integer not null default 0
);
create index if not exists lagen_plan on flcsmaps.lagen(plan_id);

-- ---------- Bibliotheek ----------
create table if not exists flcsmaps.bibliotheek (
  id             uuid primary key default gen_random_uuid(),
  naam           text not null,
  categorie      text not null default 'Overig',
  tekenwijze     text not null default 'schaal',   -- 'punt' | 'lijn' | 'schaal'
  breedte_m      numeric,
  diepte_m       numeric,
  eenheid_m      numeric,                -- lijn: lengte per stuk
  hoogte_m       numeric,
  omtrek         jsonb,                  -- eigen vorm: [[x,y], ...] in meter t.o.v. midden
  stijl          jsonb not null default '{}',
  icoon          text,
  standaardlaag  text,
  leverancier    text,
  leverancier_id uuid,                   -- publitool.leveranciers (los, alleen lezen)
  artikel_id     uuid,                   -- publitool.artikels (los, alleen lezen)
  eigenschappen  jsonb not null default '{}',
  varianten      jsonb not null default '[]',
  actief         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- Items ----------
create table if not exists flcsmaps.items (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid references flcsmaps.plannen(id) on delete cascade,   -- leeg = item van een plaatsfiche
  plek_id      uuid references flcsmaps.plekken(id) on delete cascade,
  laag_id      uuid references flcsmaps.lagen(id) on delete set null,
  element_id   uuid references flcsmaps.bibliotheek(id) on delete set null,
  groep_id     uuid,
  soort        text not null,          -- 'punt' | 'lijn' | 'vlak' | 'rechthoek' | 'cirkel' | 'tekst' | 'element'
  geometrie    jsonb not null,         -- GeoJSON geometry (WGS84)
  parameters   jsonb not null default '{}',
  stijl        jsonb not null default '{}',
  naam         text,
  notitie      text,
  velden       jsonb not null default '{}',
  fase_ids     uuid[],
  vergrendeld  boolean not null default false,
  verborgen    boolean not null default false,
  volgorde     integer not null default 0,
  geplaatst_op timestamptz,
  geplaatst_door uuid,
  bewerkt_door uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint items_plan_of_plek check (plan_id is not null or plek_id is not null)
);
create index if not exists items_plan on flcsmaps.items(plan_id);
create index if not exists items_plek on flcsmaps.items(plek_id);

create table if not exists flcsmaps.opmerkingen (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references flcsmaps.items(id) on delete cascade,
  auteur_id    uuid,
  auteur_naam  text,
  deel_link_id uuid,
  tekst        text not null,
  status       text not null default 'open',   -- 'open' | 'opgelost'
  created_at   timestamptz not null default now()
);
create index if not exists opmerkingen_item on flcsmaps.opmerkingen(item_id);

create table if not exists flcsmaps.bestanden (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid references flcsmaps.plannen(id) on delete cascade,
  item_id    uuid references flcsmaps.items(id) on delete cascade,
  soort      text not null,            -- 'foto' | 'onderlegger' | 'export' | 'paneel'
  pad        text not null,            -- in bucket 'flcsmaps'
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists flcsmaps.deel_links (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references flcsmaps.plannen(id) on delete cascade,
  token          text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  naam           text not null,
  laag_ids       uuid[] not null default '{}',
  fase_ids       uuid[],
  opties         jsonb not null default '{}',   -- notities, opmerkingen, pdf, stuklijst, taal
  geldig_tot     timestamptz,
  ingetrokken_op timestamptz,
  keer_geopend   integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists deel_links_plan on flcsmaps.deel_links(plan_id);

create table if not exists flcsmaps.versies (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references flcsmaps.plannen(id) on delete cascade,
  versie       integer not null,
  momentopname jsonb not null,
  opmerking    text,
  door         uuid,
  created_at   timestamptz not null default now()
);
create index if not exists versies_plan on flcsmaps.versies(plan_id);

-- ---------- RLS + grants ----------
do $$
declare t text;
begin
  foreach t in array array['plekken','plannen','fasen','lagen','bibliotheek','items','opmerkingen','bestanden','deel_links','versies'] loop
    execute format('alter table flcsmaps.%I enable row level security', t);
    execute format('drop policy if exists lezen on flcsmaps.%I', t);
    execute format('drop policy if exists schrijven on flcsmaps.%I', t);
    execute format('create policy lezen on flcsmaps.%I for select to authenticated using (flcsmaps.mag_lezen())', t);
    execute format('create policy schrijven on flcsmaps.%I for all to authenticated using (flcsmaps.mag_schrijven()) with check (flcsmaps.mag_schrijven())', t);
    execute format('grant select, insert, update, delete on flcsmaps.%I to authenticated', t);
    execute format('grant select, insert, update, delete on flcsmaps.%I to service_role', t);
  end loop;
end $$;

-- Iedere lezer mag een opmerking plaatsen (ook tv/viewer), en de eigen opmerking.
drop policy if exists opmerking_plaatsen on flcsmaps.opmerkingen;
create policy opmerking_plaatsen on flcsmaps.opmerkingen
  for insert to authenticated with check (flcsmaps.mag_lezen() and auteur_id = auth.uid());

-- updated_at bijhouden
create or replace function flcsmaps.zet_updated_at()
returns trigger language plpgsql set search_path = flcsmaps, public as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists plannen_updated on flcsmaps.plannen;
create trigger plannen_updated before update on flcsmaps.plannen for each row execute function flcsmaps.zet_updated_at();
drop trigger if exists items_updated on flcsmaps.items;
create trigger items_updated before update on flcsmaps.items for each row execute function flcsmaps.zet_updated_at();
drop trigger if exists bibliotheek_updated on flcsmaps.bibliotheek;
create trigger bibliotheek_updated before update on flcsmaps.bibliotheek for each row execute function flcsmaps.zet_updated_at();

-- ---------- Deel-links zonder login ----------
create or replace function flcsmaps.deel_link_lezen(p_token text)
returns jsonb
language plpgsql security definer
set search_path = flcsmaps, public
as $$
declare
  dl flcsmaps.deel_links%rowtype;
  pl flcsmaps.plannen%rowtype;
  met_notities boolean;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select * into dl from flcsmaps.deel_links
   where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found then return null; end if;
  select * into pl from flcsmaps.plannen where id = dl.plan_id;
  if not found then return null; end if;

  update flcsmaps.deel_links set keer_geopend = keer_geopend + 1 where id = dl.id;
  met_notities := coalesce((dl.opties->>'notities')::boolean, false);

  return jsonb_build_object(
    'link', jsonb_build_object('id', dl.id, 'naam', dl.naam, 'opties', dl.opties),
    'plan', jsonb_build_object('id', pl.id, 'naam', pl.naam, 'editie_naam', pl.editie_naam,
                               'locatie', pl.locatie, 'centrum', pl.centrum, 'zoom', pl.zoom,
                               'basiskaart', pl.basiskaart, 'versie', pl.versie,
                               'titelblok', pl.titelblok, 'updated_at', pl.updated_at),
    'lagen', coalesce((select jsonb_agg(to_jsonb(l) order by l.volgorde)
                         from flcsmaps.lagen l
                        where l.plan_id = pl.id and l.id = any(dl.laag_ids)), '[]'),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                           'id', i.id, 'laag_id', i.laag_id, 'element_id', i.element_id,
                           'soort', i.soort, 'geometrie', i.geometrie, 'parameters', i.parameters,
                           'stijl', i.stijl, 'naam', i.naam,
                           'notitie', case when met_notities then i.notitie end,
                           'velden', case when met_notities then i.velden else '{}'::jsonb end))
                         from flcsmaps.items i
                        where i.plan_id = pl.id and not i.verborgen
                          and i.laag_id = any(dl.laag_ids)
                          and (dl.fase_ids is null or cardinality(dl.fase_ids) = 0
                               or i.fase_ids is null or i.fase_ids && dl.fase_ids)), '[]'),
    'elementen', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'naam', b.naam, 'categorie', b.categorie,
                           'tekenwijze', b.tekenwijze, 'breedte_m', b.breedte_m, 'diepte_m', b.diepte_m,
                           'eenheid_m', b.eenheid_m, 'stijl', b.stijl, 'icoon', b.icoon))
                         from flcsmaps.bibliotheek b
                        where b.id in (select i.element_id from flcsmaps.items i
                                        where i.plan_id = pl.id and i.laag_id = any(dl.laag_ids))), '[]'),
    'opmerkingen', case when coalesce((dl.opties->>'opmerkingen')::boolean, false) then
                     coalesce((select jsonb_agg(jsonb_build_object('item_id', o.item_id, 'auteur', coalesce(o.auteur_naam, 'FLCS'),
                                                                   'tekst', o.tekst, 'status', o.status, 'op', o.created_at)
                                                order by o.created_at)
                                 from flcsmaps.opmerkingen o
                                 join flcsmaps.items i on i.id = o.item_id
                                where i.plan_id = pl.id and i.laag_id = any(dl.laag_ids)), '[]')
                   else '[]'::jsonb end
  );
end $$;

create or replace function flcsmaps.deel_link_opmerking(p_token text, p_item uuid, p_naam text, p_tekst text)
returns boolean
language plpgsql security definer
set search_path = flcsmaps, public
as $$
declare dl flcsmaps.deel_links%rowtype;
begin
  if p_token is null or length(p_token) < 20 or coalesce(trim(p_tekst), '') = '' then return false; end if;
  select * into dl from flcsmaps.deel_links
   where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found or not coalesce((dl.opties->>'opmerkingen')::boolean, false) then return false; end if;
  if not exists (select 1 from flcsmaps.items i where i.id = p_item and i.plan_id = dl.plan_id and i.laag_id = any(dl.laag_ids)) then
    return false;
  end if;
  insert into flcsmaps.opmerkingen (item_id, auteur_naam, deel_link_id, tekst)
  values (p_item, left(coalesce(nullif(trim(p_naam), ''), dl.naam), 80), dl.id, left(trim(p_tekst), 2000));
  return true;
end $$;

revoke all on function flcsmaps.deel_link_lezen(text) from public;
revoke all on function flcsmaps.deel_link_opmerking(text, uuid, text, text) from public;
grant execute on function flcsmaps.deel_link_lezen(text) to anon, authenticated, service_role;
grant execute on function flcsmaps.deel_link_opmerking(text, uuid, text, text) to anon, authenticated, service_role;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public)
values ('flcsmaps', 'flcsmaps', true)
on conflict (id) do nothing;

drop policy if exists flcsmaps_lezen on storage.objects;
create policy flcsmaps_lezen on storage.objects
  for select to authenticated using (bucket_id = 'flcsmaps');
drop policy if exists flcsmaps_schrijven on storage.objects;
create policy flcsmaps_schrijven on storage.objects
  for insert to authenticated with check (bucket_id = 'flcsmaps' and flcsmaps.mag_schrijven());
drop policy if exists flcsmaps_wijzigen on storage.objects;
create policy flcsmaps_wijzigen on storage.objects
  for update to authenticated using (bucket_id = 'flcsmaps' and flcsmaps.mag_schrijven());
drop policy if exists flcsmaps_verwijderen on storage.objects;
create policy flcsmaps_verwijderen on storage.objects
  for delete to authenticated using (bucket_id = 'flcsmaps' and flcsmaps.mag_schrijven());

-- ---------- Startbibliotheek ----------
-- Alleen standaardmaten die vastliggen. Generatoren en kasten van Intermetal
-- komen als punt tot hun technische fiches (maten) binnen zijn.
insert into flcsmaps.bibliotheek (naam, categorie, tekenwijze, breedte_m, diepte_m, eenheid_m, stijl, standaardlaag, leverancier, eigenschappen)
select * from (values
  ('Heras 3,5 m',          'Hekken en afsluitingen', 'lijn',   null::numeric, null::numeric, 3.5::numeric, '{"kleur":"#D97706","dikte":4,"streep":"vol"}'::jsonb,   'Afsluitingen en hekken', null::text, '{}'::jsonb),
  ('Nadar 2,5 m',          'Hekken en afsluitingen', 'lijn',   null, null, 2.5, '{"kleur":"#D97706","dikte":4,"streep":"streep"}'::jsonb, 'Afsluitingen en hekken', null, '{}'::jsonb),
  ('Tent 3×3 m',           'Tenten en structuren',   'schaal', 3,   3,   null, '{"kleur":"#2563EB","vulkleur":"#2563EB","vuldekking":0.15}'::jsonb, 'Hospitality', null, '{}'::jsonb),
  ('Tent 5×5 m',           'Tenten en structuren',   'schaal', 5,   5,   null, '{"kleur":"#2563EB","vulkleur":"#2563EB","vuldekking":0.15}'::jsonb, 'Hospitality', null, '{}'::jsonb),
  ('Tent 6×12 m',          'Tenten en structuren',   'schaal', 6,   12,  null, '{"kleur":"#2563EB","vulkleur":"#2563EB","vuldekking":0.15}'::jsonb, 'Hospitality', null, '{}'::jsonb),
  ('Podium 8×6 m',         'Tenten en structuren',   'schaal', 8,   6,   null, '{"kleur":"#1d1d1b","vulkleur":"#ffffff","vuldekking":0.6}'::jsonb, null, null, '{}'::jsonb),
  ('Teambus 12 m',         'Voertuigen',             'schaal', 2.55, 12, null, '{"kleur":"#16865C","vulkleur":"#16865C","vuldekking":0.35}'::jsonb, 'Teams en parking', null, '{}'::jsonb),
  ('Kabelgoot 90 cm',      'Stroom',                 'lijn',   null, null, 0.9, '{"kleur":"#5B21B6","dikte":6,"streep":"vol"}'::jsonb, 'Stroom', 'Intermetal Motor', '{}'::jsonb),
  ('Generator 60 kVA',     'Stroom',                 'punt',   null, null, null, '{"kleur":"#1d1d1b"}'::jsonb, 'Stroom', 'Intermetal Motor', '{"kva":60}'::jsonb),
  ('Generator 100 kVA',    'Stroom',                 'punt',   null, null, null, '{"kleur":"#1d1d1b"}'::jsonb, 'Stroom', 'Intermetal Motor', '{"kva":100}'::jsonb),
  ('Verdeelkast 63A',      'Stroom',                 'punt',   null, null, null, '{"kleur":"#1d1d1b"}'::jsonb, 'Stroom', 'Intermetal Motor', '{"ampere":63}'::jsonb),
  ('EHBO-post',            'Veiligheid',             'punt',   null, null, null, '{"kleur":"#0F766E"}'::jsonb, 'Veiligheid en EHBO', null, '{}'::jsonb)
) as v(naam, categorie, tekenwijze, breedte_m, diepte_m, eenheid_m, stijl, standaardlaag, leverancier, eigenschappen)
where not exists (select 1 from flcsmaps.bibliotheek b where b.naam = v.naam);
