-- ============================================================================
-- Toolen · 0046_fiche_site_leveranciers.sql
-- Per site: welke leveranciers, hun status en aanspreekpunt; leveringen en ophalingen
-- (dag tegenover de wedstrijd, uurvenster, leverpunt op de kaart); offertes, facturen
-- en budgetposten. Facturen en offertes horen bij één site. Geld enkel met het recht financieel.
-- ============================================================================

create table if not exists maps.site_leveranciers (
  id              uuid primary key default gen_random_uuid(),
  organisatie_id  uuid not null references maps.organisaties(id) on delete cascade,
  plan_id         uuid not null references maps.plannen(id) on delete cascade,
  leverancier_id  uuid not null references maps.leveranciers(id) on delete restrict,
  status          text not null default 'nog_niets'
                  check (status in ('nog_niets', 'inschatting', 'offerte_gevraagd', 'offerte', 'bevestigd', 'gefactureerd', 'afgesloten')),
  aanspreekpunt_id uuid references maps.personen(id) on delete set null,
  wat             text,          -- korte omschrijving: 'toiletten', 'hekken en trailers'
  materiaal       text,          -- vrije lijst naast wat uit het plan komt
  opmerking       text,
  volgorde        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (plan_id, leverancier_id)
);
create index if not exists site_leveranciers_lev on maps.site_leveranciers (leverancier_id);
select maps.fiche_tabel('site_leveranciers');

create table if not exists maps.leveringen (
  id                  uuid primary key default gen_random_uuid(),
  organisatie_id      uuid not null references maps.organisaties(id) on delete cascade,
  plan_id             uuid not null references maps.plannen(id) on delete cascade,
  site_leverancier_id uuid not null references maps.site_leveranciers(id) on delete cascade,
  soort               text not null default 'levering' check (soort in ('levering', 'ophaling')),
  anker               text not null default 'start' check (anker in ('start', 'einde')),
  dag                 integer not null default 0,
  uur_van             time,
  uur_tot             time,
  leverpunt_item_id   uuid references maps.items(id) on delete set null,
  leverpunt_tekst     text,
  wat                 text,
  status              text not null default 'open' check (status in ('open', 'bevestigd', 'klaar')),
  opmerking           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists leveringen_plan on maps.leveringen (plan_id);
create index if not exists leveringen_sl on maps.leveringen (site_leverancier_id);
select maps.fiche_tabel('leveringen');

create table if not exists maps.offertes (
  id                  uuid primary key default gen_random_uuid(),
  organisatie_id      uuid not null references maps.organisaties(id) on delete cascade,
  plan_id             uuid not null references maps.plannen(id) on delete cascade,
  site_leverancier_id uuid not null references maps.site_leveranciers(id) on delete cascade,
  vennootschap_id     uuid references maps.vennootschappen(id) on delete set null,
  nummer              text,
  datum               date,
  bedrag_excl         numeric(12, 2),
  link                text,
  bestand_pad         text,
  status              text not null default 'ontvangen' check (status in ('gevraagd', 'ontvangen', 'goedgekeurd', 'afgewezen')),
  opmerking           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists offertes_sl on maps.offertes (site_leverancier_id);
select maps.fiche_tabel('offertes', true);

create table if not exists maps.facturen (
  id                  uuid primary key default gen_random_uuid(),
  organisatie_id      uuid not null references maps.organisaties(id) on delete cascade,
  plan_id             uuid not null references maps.plannen(id) on delete cascade,
  site_leverancier_id uuid not null references maps.site_leveranciers(id) on delete cascade,
  vennootschap_id     uuid references maps.vennootschappen(id) on delete set null,
  offerte_id          uuid references maps.offertes(id) on delete set null,
  nummer              text,
  datum               date,
  vervaldatum         date,
  bedrag_excl         numeric(12, 2),
  bedrag_incl         numeric(12, 2),
  link                text,
  bestand_pad         text,
  status              text not null default 'ontvangen' check (status in ('ontvangen', 'goedgekeurd', 'betaald', 'betwist')),
  opmerking           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists facturen_sl on maps.facturen (site_leverancier_id);
select maps.fiche_tabel('facturen', true);

create table if not exists maps.budgetposten (
  id                  uuid primary key default gen_random_uuid(),
  organisatie_id      uuid not null references maps.organisaties(id) on delete cascade,
  plan_id             uuid not null references maps.plannen(id) on delete cascade,
  site_leverancier_id uuid references maps.site_leveranciers(id) on delete set null,
  vennootschap_id     uuid references maps.vennootschappen(id) on delete set null,
  omschrijving        text not null,
  budget              numeric(12, 2),
  vorig_jaar          numeric(12, 2),
  opmerking           text,
  volgorde            integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists budgetposten_plan on maps.budgetposten (plan_id);
select maps.fiche_tabel('budgetposten', true);
