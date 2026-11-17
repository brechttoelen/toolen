-- ============================================================================
-- Toolen · 0047_fiche_taken.sql
-- Planning van een site. Een taak heeft één of meer dagen (taak_dagen), elk met
-- eigen uur, status en uitvoerder. Taken zonder dag zijn voorbereiding (optioneel
-- met een deadline). Een taak kan hangen aan een levering (plaatsing na levering)
-- of aan een andere taak (afbraak, vervolg), en aan dingen op de kaart.
-- Lezers wijzigen enkel de status van hun eigen taakdagen, via maps.taakdag_status.
-- ============================================================================

create table if not exists maps.taken (
  id                 uuid primary key default gen_random_uuid(),
  organisatie_id     uuid not null references maps.organisaties(id) on delete cascade,
  plan_id            uuid not null references maps.plannen(id) on delete cascade,
  titel              text not null,
  soort              text,                 -- vrij per event, bv. 'Levering', 'Gemeente', 'Tv'
  info               text,
  waar_tekst         text,
  wie_persoon_id     uuid references maps.personen(id) on delete set null,
  wie_leverancier_id uuid references maps.leveranciers(id) on delete set null,
  wie_tekst          text,                 -- 'Team Wevelgem', 'Siegfried, 4 CW'
  ouder_id           uuid references maps.taken(id) on delete set null,
  relatie            text check (relatie in ('afbraak', 'plaatsing', 'vervolg')),
  levering_id        uuid references maps.leveringen(id) on delete set null,
  voorbereiding      boolean not null default false,
  deadline_anker     text check (deadline_anker in ('start', 'einde')),
  deadline_dag       integer,
  status             text not null default 'open' check (status in ('open', 'bevestigd', 'klaar')),  -- voor voorbereiding
  volgorde           integer not null default 0,
  aangemaakt_door    uuid default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists taken_plan on maps.taken (plan_id);
create index if not exists taken_ouder on maps.taken (ouder_id) where ouder_id is not null;
create index if not exists taken_levering on maps.taken (levering_id) where levering_id is not null;
select maps.fiche_tabel('taken');

create table if not exists maps.taak_dagen (
  id                    uuid primary key default gen_random_uuid(),
  organisatie_id        uuid not null references maps.organisaties(id) on delete cascade,
  plan_id               uuid not null references maps.plannen(id) on delete cascade,
  taak_id               uuid not null references maps.taken(id) on delete cascade,
  anker                 text not null default 'start' check (anker in ('start', 'einde')),
  dag                   integer not null default 0,
  uur_van               time,
  uur_tot               time,
  status                text not null default 'open' check (status in ('open', 'bevestigd', 'klaar')),
  uitvoerder_persoon_id uuid references maps.personen(id) on delete set null,
  opmerking             text,
  klaar_op              timestamptz,
  klaar_door            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (taak_id, anker, dag)
);
create index if not exists taak_dagen_plan on maps.taak_dagen (plan_id, anker, dag);
select maps.fiche_tabel('taak_dagen');

create table if not exists maps.taak_koppelingen (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  plan_id        uuid not null references maps.plannen(id) on delete cascade,
  taak_id        uuid not null references maps.taken(id) on delete cascade,
  soort          text not null check (soort in ('item', 'groep', 'laag', 'laaggroep')),
  item_id        uuid references maps.items(id) on delete set null,
  groep_id       uuid,
  laag_id        uuid references maps.lagen(id) on delete set null,
  laaggroep      text,
  label          text,          -- naam op het moment van koppelen, blijft leesbaar als het doel verdwijnt
  created_at     timestamptz not null default now()
);
create index if not exists taak_koppelingen_taak on maps.taak_koppelingen (taak_id);
create index if not exists taak_koppelingen_item on maps.taak_koppelingen (item_id) where item_id is not null;
create index if not exists taak_koppelingen_laag on maps.taak_koppelingen (laag_id) where laag_id is not null;
select maps.fiche_tabel('taak_koppelingen');

create table if not exists maps.programma (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  plan_id        uuid not null references maps.plannen(id) on delete cascade,
  anker          text not null default 'start' check (anker in ('start', 'einde')),
  dag            integer not null default 0,
  uur_van        time,
  uur_tot        time,
  wat            text not null,
  volgorde       integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists programma_plan on maps.programma (plan_id);
select maps.fiche_tabel('programma');

-- Status van een taakdag wijzigen. Bewerkers altijd; lezers enkel voor taken waar zij
-- (als persoon) uitvoerder of verantwoordelijke zijn.
create or replace function maps.taakdag_status(p_id uuid, p_status text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare d maps.taak_dagen; t maps.taken; mag boolean;
begin
  if p_status not in ('open', 'bevestigd', 'klaar') then raise exception 'Onbekende status %', p_status; end if;
  select * into d from maps.taak_dagen where id = p_id;
  if not found then return false; end if;
  select * into t from maps.taken where id = d.taak_id;
  if not maps.plan_toegestaan(d.plan_id) or not maps.org_heeft_module(d.organisatie_id, 'fiche') then return false; end if;
  mag := d.organisatie_id = any (maps.mijn_organisaties('bewerker'))
      or (d.organisatie_id = any (maps.mijn_organisaties('lezer'))
          and exists (select 1 from maps.personen p
                       where p.user_id = auth.uid() and p.organisatie_id = d.organisatie_id
                         and (p.id = d.uitvoerder_persoon_id or p.id = t.wie_persoon_id)));
  if not mag then raise exception 'Geen rechten op deze taak.' using errcode = '42501'; end if;
  update maps.taak_dagen
     set status = p_status,
         klaar_op = case when p_status = 'klaar' then now() end,
         klaar_door = case when p_status = 'klaar' then auth.uid() end
   where id = p_id;
  return true;
end $$;
revoke execute on function maps.taakdag_status(uuid, text) from public, anon;
grant execute on function maps.taakdag_status(uuid, text) to authenticated;
