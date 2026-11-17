-- ============================================================================
-- Toolen · 0045_fiche_sites_vennootschappen.sql
-- Wedstrijddagen per site (plan): eerste en laatste dag. Dagen in de fiche worden
-- bewaard als anker ('start' = eerste wedstrijddag, 'einde' = laatste) plus een verschil.
-- Vennootschappen (kostendragers) per organisatie, en welke er op een site gebruikt worden.
-- Team per site: personen met een vrije rol en een toegang (lid, lezer, deellink, geen).
-- Deellinks kunnen aan een persoon hangen. Plannen onthouden van welk plan ze gekopieerd zijn,
-- items van welk item (om de fiche mee over te nemen naar een volgende editie).
-- ============================================================================

alter table maps.plannen
  add column if not exists wedstrijd_van date,
  add column if not exists wedstrijd_tot date,
  add column if not exists vorig_plan_id uuid references maps.plannen(id) on delete set null;
alter table maps.plannen drop constraint if exists plannen_wedstrijd_volgorde;
alter table maps.plannen add constraint plannen_wedstrijd_volgorde check (wedstrijd_tot is null or wedstrijd_van is null or wedstrijd_tot >= wedstrijd_van);

update maps.plannen p set wedstrijd_van = e.datum, wedstrijd_tot = coalesce(e.einddatum, e.datum)
  from maps.events e
 where e.id = p.event_id and p.wedstrijd_van is null and e.datum is not null;

alter table maps.items add column if not exists bron_item_id uuid;
comment on column maps.items.bron_item_id is 'Item waarvan dit item gekopieerd is (nieuwe editie). Geen sleutel: het bronitem mag verdwijnen.';
create index if not exists items_bron on maps.items (bron_item_id) where bron_item_id is not null;

create table if not exists maps.vennootschappen (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  naam           text not null,
  btw            text,
  adres          text,
  factuur_email  text,
  opmerking      text,
  actief         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (organisatie_id, naam)
);
select maps.fiche_tabel('vennootschappen');

create table if not exists maps.plan_vennootschappen (
  id              uuid primary key default gen_random_uuid(),
  organisatie_id  uuid not null references maps.organisaties(id) on delete cascade,
  plan_id         uuid not null references maps.plannen(id) on delete cascade,
  vennootschap_id uuid not null references maps.vennootschappen(id) on delete cascade,
  standaard       boolean not null default false,
  wat             text,                       -- bv. 'Event', 'VIP', 'Drukwerk'
  unique (plan_id, vennootschap_id)
);
create unique index if not exists plan_vennootschappen_standaard on maps.plan_vennootschappen (plan_id) where standaard;
select maps.fiche_tabel('plan_vennootschappen');

create table if not exists maps.site_rollen (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  plan_id        uuid not null references maps.plannen(id) on delete cascade,
  persoon_id     uuid not null references maps.personen(id) on delete cascade,
  rol            text,
  toegang        text not null default 'geen' check (toegang in ('lid', 'lezer', 'deellink', 'geen')),
  volgorde       integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (plan_id, persoon_id)
);
select maps.fiche_tabel('site_rollen');

alter table maps.deel_links add column if not exists persoon_id uuid references maps.personen(id) on delete set null;
