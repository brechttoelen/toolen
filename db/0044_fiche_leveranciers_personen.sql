-- ============================================================================
-- Toolen · 0044_fiche_leveranciers_personen.sql
-- Leveranciers met btw, adres en soort (leverancier, gemeente, dienst, partner).
-- Personen: contacten bij een organisatie uit de stamlijst, de eigen ploeg en
-- mensen zonder login (lokale ploeg). Een persoon kan aan een lid (user) hangen.
-- Items krijgen een leverancier als vaste sleutel; zonder overschrijving geldt
-- velden.herkomst of de leverancier van het bibliotheekelement (op naam, per organisatie,
-- want de centrale bibliotheek wordt door alle organisaties gedeeld).
-- ============================================================================

alter table maps.leveranciers
  add column if not exists btw text,
  add column if not exists adres text,
  add column if not exists factuur_email text,
  add column if not exists website text;
comment on column maps.leveranciers.soort is 'leverancier, gemeente, dienst, partner of vrije tekst';

create table if not exists maps.personen (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  leverancier_id uuid references maps.leveranciers(id) on delete set null,  -- null = eigen organisatie
  user_id        uuid references auth.users(id) on delete set null,          -- gezet als de persoon lid is
  naam           text not null,
  functie        text,
  telefoon       text,
  email          text,
  opmerking      text,
  actief         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists personen_org on maps.personen (organisatie_id);
create index if not exists personen_lev on maps.personen (leverancier_id) where leverancier_id is not null;
create unique index if not exists personen_user on maps.personen (organisatie_id, user_id) where user_id is not null;
select maps.fiche_tabel('personen', false, null);  -- contacten horen bij de stamlijst, ook zonder fiche

-- Bestaande contactpersonen van leveranciers worden personen.
insert into maps.personen (organisatie_id, leverancier_id, naam, telefoon, email)
select l.organisatie_id, l.id, btrim(l.contactpersoon), nullif(btrim(l.telefoon), ''), nullif(btrim(l.email), '')
  from maps.leveranciers l
 where coalesce(btrim(l.contactpersoon), '') <> ''
   and not exists (select 1 from maps.personen p where p.leverancier_id = l.id and lower(p.naam) = lower(btrim(l.contactpersoon)));

-- Leverancier per item: overschrijving. Leeg = afgeleid (zie maps.item_leverancier).
alter table maps.items add column if not exists leverancier_id uuid references maps.leveranciers(id) on delete set null;
create index if not exists items_leverancier on maps.items (leverancier_id) where leverancier_id is not null;

-- Eigen bibliotheekelementen van een organisatie: leverancier als sleutel (centrale elementen blijven op naam).
alter table maps.bibliotheek add column if not exists leverancier_id uuid references maps.leveranciers(id) on delete set null;
update maps.bibliotheek b set leverancier_id = l.id
  from maps.leveranciers l
 where b.leverancier_id is null and l.organisatie_id = b.organisatie_id
   and lower(btrim(l.naam)) = lower(btrim(b.leverancier));

-- Leverancier van een item: overschrijving > herkomst > element (op naam binnen de organisatie van het item).
create or replace function maps.item_leverancier(p_item uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(i.leverancier_id,
    (select l.id from maps.leveranciers l
      where l.organisatie_id = i.organisatie_id
        and lower(btrim(l.naam)) = lower(btrim(coalesce(nullif(i.velden ->> 'herkomst', ''), b.leverancier)))
      limit 1))
    from maps.items i left join maps.bibliotheek b on b.id = i.element_id
   where i.id = p_item
     and i.organisatie_id in (select unnest(maps.mijn_organisaties('lezer')));
$$;

-- Leveranciers op een plan, met het aantal items: basis voor de leverancierslijst van de site.
create or replace function maps.plan_leveranciers(p_plan uuid) returns table (leverancier_id uuid, items bigint)
language sql stable security definer set search_path = '' as $$
  with x as (
    select coalesce(i.leverancier_id,
      (select l.id from maps.leveranciers l
        where l.organisatie_id = i.organisatie_id
          and lower(btrim(l.naam)) = lower(btrim(coalesce(nullif(i.velden ->> 'herkomst', ''), b.leverancier)))
        limit 1)) lev
      from maps.items i
      join maps.plannen p on p.id = i.plan_id
      left join maps.bibliotheek b on b.id = i.element_id
     where i.plan_id = p_plan and not coalesce(i.verborgen, false)
       and p.organisatie_id in (select unnest(maps.mijn_organisaties('lezer')))
       and maps.plan_toegestaan(p.id))
  select lev, count(*) from x where lev is not null group by lev;
$$;
grant execute on function maps.item_leverancier(uuid), maps.plan_leveranciers(uuid) to authenticated;
