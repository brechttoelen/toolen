-- ============================================================================
-- Toolen · 0048_fiche_laadlijst_catering_notities.sql
-- Laadlijst: vrije regels per site, gegroepeerd per bron (magazijn, opslag bij ET,
-- gemeente). Los van Publitool. Pakketten: vaste sets regels om in één keer toe te voegen.
-- Catering: één regel per product, voor wie, dag en leverplaats; drie weergaven in de app.
-- Prijzen apart (recht financieel). Notities per site, aan een tab of een object.
-- ============================================================================

create table if not exists maps.laad_bronnen (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  naam           text not null,                  -- 'Magazijn Vilvoorde', 'Opslag bij ET'
  leverancier_id uuid references maps.leveranciers(id) on delete set null,  -- wie het brengt
  brengt_tekst   text,                           -- 'Eigen bus'
  uitleg         text,
  volgorde       integer not null default 0,
  actief         boolean not null default true,
  unique (organisatie_id, naam)
);
select maps.fiche_tabel('laad_bronnen');

create table if not exists maps.laadpakketten (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  naam           text not null,
  regels         jsonb not null default '[]',    -- [{aantal, eenheid, wat, bron_id, opmerking}]
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (organisatie_id, naam)
);
select maps.fiche_tabel('laadpakketten');

create table if not exists maps.laadregels (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  plan_id        uuid not null references maps.plannen(id) on delete cascade,
  bron_id        uuid references maps.laad_bronnen(id) on delete set null,
  aantal         numeric(10, 2),
  eenheid        text,
  wat            text not null,
  waar_item_id   uuid references maps.items(id) on delete set null,
  waar_tekst     text,
  status         text not null default 'te_pakken' check (status in ('te_pakken', 'gepakt', 'op_site', 'terug')),
  opmerking      text,
  pakket_id      uuid references maps.laadpakketten(id) on delete set null,
  volgorde       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists laadregels_plan on maps.laadregels (plan_id, bron_id);
select maps.fiche_tabel('laadregels');

create table if not exists maps.cateringregels (
  id                  uuid primary key default gen_random_uuid(),
  organisatie_id      uuid not null references maps.organisaties(id) on delete cascade,
  plan_id             uuid not null references maps.plannen(id) on delete cascade,
  leverancier_id      uuid references maps.leveranciers(id) on delete set null,
  soort               text not null default 'wedstrijddag' check (soort in ('crew', 'wedstrijddag', 'aankoop')),
  product             text not null,
  eenheid             text not null default 'st',
  voor_tekst          text,
  voor_leverancier_id uuid references maps.leveranciers(id) on delete set null,
  groep               text,                 -- 'Organisatie', 'Vrijwilligers'
  anker               text not null default 'start' check (anker in ('start', 'einde')),
  dag                 integer not null default 0,
  uur                 time,
  leverplaats_item_id uuid references maps.items(id) on delete set null,
  leverplaats_tekst   text,
  aantal              numeric(10, 2),
  vennootschap_id     uuid references maps.vennootschappen(id) on delete set null,
  rechtstreeks        boolean not null default false,  -- telt mee voor de keuken, niet voor het budget
  opmerking           text,
  volgorde            integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists cateringregels_plan on maps.cateringregels (plan_id, anker, dag);
select maps.fiche_tabel('cateringregels');

create table if not exists maps.catering_prijzen (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  plan_id        uuid not null references maps.plannen(id) on delete cascade,
  leverancier_id uuid references maps.leveranciers(id) on delete cascade,
  product        text not null,
  eenheid        text not null default 'st',
  prijs          numeric(10, 2),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists catering_prijzen_uniek on maps.catering_prijzen (plan_id, coalesce(leverancier_id, '00000000-0000-0000-0000-000000000000'::uuid), product, eenheid);
select maps.fiche_tabel('catering_prijzen', true);

create table if not exists maps.notities (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  plan_id        uuid not null references maps.plannen(id) on delete cascade,
  tekst          text not null,
  auteur_id      uuid default auth.uid(),
  auteur_naam    text,
  klaar          boolean not null default false,
  klaar_op       timestamptz,
  tab            text,                -- 'catering', 'mobiliteit', …
  object_soort   text,                -- 'taak', 'site_leverancier', 'item', …
  object_id      uuid,
  meenemen       boolean not null default false,  -- tonen bij het overnemen naar een volgende editie
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists notities_plan on maps.notities (plan_id);
select maps.fiche_tabel('notities');
