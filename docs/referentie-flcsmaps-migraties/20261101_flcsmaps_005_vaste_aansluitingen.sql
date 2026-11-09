-- FLCS Maps 005: vaste aansluitingen (stroomkasten van steden, Fluvius, privé).
-- Register over alle evenementen heen, los van plan of plek: elk plan toont de
-- aansluitingen die in zijn kaartbeeld liggen, en ze tellen als bron in de stroomplanning.
-- Nooit verwijderen: actief = false.

create table if not exists flcsmaps.vaste_aansluitingen (
  id                   uuid primary key default gen_random_uuid(),
  naam                 text not null,
  soort                text not null default 'straatkast',   -- 'putkast' | 'straatkast' | 'losse_aansluiting' | 'gebouw'
  beheerder            text,                                 -- 'stad' | 'fluvius' | 'prive' | vrije tekst
  gemeente             text,
  adres                text,
  geometrie            jsonb not null,                       -- GeoJSON Point (WGS84)
  uitgangen            jsonb not null default '[]',          -- [{ type: 'CEE 32A 3F', aantal: 2 }]
  max_ampere           numeric,                              -- hoofdzekering
  kva                  numeric,                              -- vermogen, anders afgeleid uit max_ampere
  sleutel              text,                                 -- wie heeft de sleutel, code
  contact              text,
  ean                  text,
  foto                 text,                                 -- pad in bucket flcsmaps
  opmerking            text,
  laatst_gecontroleerd date,
  actief               boolean not null default true,
  bron_item_id         uuid,                                 -- plaatsfiche-item waaruit dit omgezet is (los)
  aangemaakt_door      uuid,
  bewerkt_door         uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists vaste_aansluitingen_gemeente on flcsmaps.vaste_aansluitingen(gemeente);
create index if not exists vaste_aansluitingen_actief on flcsmaps.vaste_aansluitingen(actief);

alter table flcsmaps.vaste_aansluitingen enable row level security;
drop policy if exists lezen on flcsmaps.vaste_aansluitingen;
drop policy if exists schrijven on flcsmaps.vaste_aansluitingen;
create policy lezen on flcsmaps.vaste_aansluitingen for select to authenticated using (flcsmaps.mag_lezen());
create policy schrijven on flcsmaps.vaste_aansluitingen for all to authenticated using (flcsmaps.mag_schrijven()) with check (flcsmaps.mag_schrijven());
grant select, insert, update, delete on flcsmaps.vaste_aansluitingen to authenticated;
grant select, insert, update, delete on flcsmaps.vaste_aansluitingen to service_role;

drop trigger if exists vaste_aansluitingen_updated on flcsmaps.vaste_aansluitingen;
create trigger vaste_aansluitingen_updated before update on flcsmaps.vaste_aansluitingen for each row execute function flcsmaps.zet_updated_at();
