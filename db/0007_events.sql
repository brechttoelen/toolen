-- ============================================================================
-- Toolen · 0007_events.sql
-- Project: toolen (hlpurcdeouegvphvwygu). Na 0006. Uitgevoerd op 9 nov 2026.
--
-- Events: het overzicht groepeert plannen per event (datum, kleur, plek).
-- Een plan hoort bij hoogstens één event (plannen.event_id). Een event weg = de
-- plannen blijven, zonder event.
-- Bestaande plannen met een editie_naam krijgen automatisch een event (zonder datum).
-- Mag opnieuw gedraaid worden.
-- ============================================================================

create table if not exists maps.events (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  naam           text not null check (length(btrim(naam)) between 1 and 120),
  datum          date,
  einddatum      date check (einddatum is null or datum is null or einddatum >= datum),
  kleur          text not null default '#108AED' check (kleur ~ '^#[0-9A-Fa-f]{6}$'),
  plek           text,
  edition_id     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists events_org_datum on maps.events (organisatie_id, datum);

alter table maps.plannen add column if not exists event_id uuid references maps.events(id) on delete set null;
create index if not exists plannen_event on maps.plannen (event_id);

-- Organisatie invullen en vastzetten, zoals bij de andere tabellen.
drop trigger if exists events_org on maps.events;
drop trigger if exists events_org_vast on maps.events;
drop trigger if exists events_updated on maps.events;
create trigger events_org before insert on maps.events for each row execute function maps.org_vullen();
create trigger events_org_vast before update on maps.events for each row execute function maps.org_vast();
create trigger events_updated before update on maps.events for each row execute function maps.zet_updated_at();

-- Een plan en zijn event horen bij dezelfde organisatie.
create or replace function maps.plan_event_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_id is not null and not exists (
    select 1 from maps.events e where e.id = new.event_id and e.organisatie_id = new.organisatie_id) then
    raise exception 'Dit event hoort bij een andere organisatie.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists plannen_zz_event on maps.plannen;
create trigger plannen_zz_event before insert or update of event_id on maps.plannen
  for each row execute function maps.plan_event_bewaken();
revoke execute on function maps.plan_event_bewaken() from public, anon, authenticated;

alter table maps.events enable row level security;
drop policy if exists lezen on maps.events;
drop policy if exists schrijven on maps.events;
create policy lezen on maps.events for select to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('lezer'))));
create policy schrijven on maps.events for all to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('bewerker'))))
  with check (organisatie_id in (select unnest(maps.mijn_organisaties('bewerker'))));
revoke all on maps.events from anon;
grant select, insert, update, delete on maps.events to authenticated;
grant all on maps.events to service_role;

-- Bestaande plannen: per organisatie en editie_naam één event.
insert into maps.events (organisatie_id, naam, edition_id)
select distinct on (p.organisatie_id, btrim(p.editie_naam)) p.organisatie_id, btrim(p.editie_naam), p.edition_id
  from maps.plannen p
 where coalesce(btrim(p.editie_naam), '') <> '' and p.event_id is null
   and not exists (select 1 from maps.events e where e.organisatie_id = p.organisatie_id and e.naam = btrim(p.editie_naam))
 order by p.organisatie_id, btrim(p.editie_naam), p.updated_at desc;
update maps.plannen p set event_id = e.id
  from maps.events e
 where p.event_id is null and e.organisatie_id = p.organisatie_id and e.naam = btrim(p.editie_naam);
