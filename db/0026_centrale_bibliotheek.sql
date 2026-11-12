-- 0026 · Centrale bibliotheek met collecties
--
-- De bibliotheek van Toolen staat in een eigen organisatie ("Toolen bibliotheek", adres toolen.toolen.be) en wordt
-- daar beheerd met het gewone bibliotheekscherm. Elk element zit in een collectie (standaard: zijn categorie).
-- Per klant kiest het platform welke collecties hij krijgt. De klant ziet die elementen tussen de zijne (alleen lezen)
-- en kan er een eigen kopie van maken. Eigen elementen van de klant blijven van de klant.
-- Bestaande elementen van Flanders Classics verhuizen met behoud van hun id; plannen merken er niets van.

-- 1. De organisatie van de centrale bibliotheek, met de platformbeheerders als eigenaar.
insert into maps.organisaties (naam, slug, kort, land, status, pakket, plaatsen, lezers_max, modules, limieten)
select 'Toolen bibliotheek', 'toolen', 'Toolen', o.land, 'actief', o.pakket, o.plaatsen, o.lezers_max, o.modules, o.limieten
from maps.organisaties o where o.slug = 'flcs' and not exists (select 1 from maps.organisaties where slug = 'toolen');
insert into maps.leden (organisatie_id, user_id, rol)
select o.id, p.user_id, 'eigenaar' from maps.organisaties o, maps.platform_beheerders p
where o.slug = 'toolen' and not exists (select 1 from maps.leden l where l.organisatie_id = o.id and l.user_id = p.user_id);

create or replace function maps.centrale_organisatie() returns uuid
language sql stable security definer set search_path = '' as $$ select id from maps.organisaties where slug = 'toolen' $$;
revoke all on function maps.centrale_organisatie() from public;
grant execute on function maps.centrale_organisatie() to anon, authenticated, service_role;

-- 2. Collecties en wie ze krijgt.
create table if not exists maps.collecties (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique,
  volgorde integer not null default 0,
  standaard boolean not null default true,   -- nieuwe klanten krijgen deze collectie vanzelf
  created_at timestamptz not null default now()
);
create table if not exists maps.organisatie_collecties (
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  collectie_id uuid not null references maps.collecties(id) on delete cascade,
  primary key (organisatie_id, collectie_id)
);
alter table maps.bibliotheek add column if not exists collectie_id uuid references maps.collecties(id) on delete set null;
create index if not exists bibliotheek_collectie on maps.bibliotheek (collectie_id) where collectie_id is not null;

alter table maps.collecties enable row level security;
alter table maps.organisatie_collecties enable row level security;
grant select, insert, update, delete on maps.collecties, maps.organisatie_collecties to authenticated;
drop policy if exists lezen on maps.collecties;
create policy lezen on maps.collecties for select to authenticated using (true);
drop policy if exists beheren on maps.collecties;
create policy beheren on maps.collecties for all to authenticated using (maps.is_platformbeheerder()) with check (maps.is_platformbeheerder());
drop policy if exists lezen on maps.organisatie_collecties;
create policy lezen on maps.organisatie_collecties for select to authenticated
  using (maps.is_platformbeheerder() or organisatie_id in (select unnest(maps.mijn_organisaties('lezer'))));
drop policy if exists beheren on maps.organisatie_collecties;
create policy beheren on maps.organisatie_collecties for all to authenticated using (maps.is_platformbeheerder()) with check (maps.is_platformbeheerder());

-- 3. Een centraal element krijgt vanzelf de collectie van zijn categorie; elementen van klanten hebben geen collectie.
create or replace function maps.bibliotheek_collectie() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.organisatie_id is distinct from maps.centrale_organisatie() or new.plan_id is not null then
    new.collectie_id := null;
  elsif new.collectie_id is null and coalesce(btrim(new.categorie), '') <> '' then
    insert into maps.collecties (naam) values (btrim(new.categorie)) on conflict (naam) do nothing;
    select id into new.collectie_id from maps.collecties where naam = btrim(new.categorie);
  end if;
  return new;
end $$;
drop trigger if exists bibliotheek_zcollectie on maps.bibliotheek;
create trigger bibliotheek_zcollectie before insert or update on maps.bibliotheek for each row execute function maps.bibliotheek_collectie();

-- Nieuwe klant: de standaardcollecties.
create or replace function maps.organisatie_collecties_start() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.slug <> 'toolen' then
    insert into maps.organisatie_collecties (organisatie_id, collectie_id) select new.id, c.id from maps.collecties c where c.standaard on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists organisaties_collecties on maps.organisaties;
create trigger organisaties_collecties after insert on maps.organisaties for each row execute function maps.organisatie_collecties_start();

-- 4. Lezen: de eigen bibliotheek, plus de centrale elementen uit de collecties van de organisatie.
drop policy if exists lezen on maps.bibliotheek;
create policy lezen on maps.bibliotheek for select using (
  organisatie_id in (select unnest(maps.mijn_organisaties('lezer')))
  or (plan_id is null and organisatie_id = maps.centrale_organisatie()
      and collectie_id in (select oc.collectie_id from maps.organisatie_collecties oc where oc.organisatie_id in (select unnest(maps.mijn_organisaties('lezer')))))
);

-- Hoe vaak een element in plannen staat, over alle organisaties heen (enkel het aantal): voor wie het element beheert.
create or replace function maps.element_gebruik(p_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when maps.is_platformbeheerder() or exists (select 1 from maps.bibliotheek b where b.id = p_id and b.organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))))
    then (select count(*)::int from maps.items i where i.element_id = p_id) else null end;
$$;
revoke all on function maps.element_gebruik(uuid) from public, anon;
grant execute on function maps.element_gebruik(uuid) to authenticated;

-- Overzicht voor platformbeheer: collecties met hun aantal elementen, en per klant wat hij heeft.
create or replace function maps.platform_collecties() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not maps.is_platformbeheerder() then null else jsonb_build_object(
    'collecties', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'naam', c.naam, 'standaard', c.standaard,
        'elementen', (select count(*) from maps.bibliotheek b where b.collectie_id = c.id)) order by c.volgorde, c.naam) from maps.collecties c), '[]'::jsonb),
    'organisaties', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'naam', o.naam, 'slug', o.slug,
        'eigen', (select count(*) from maps.bibliotheek b where b.organisatie_id = o.id and b.plan_id is null),
        'collecties', coalesce((select jsonb_agg(oc.collectie_id) from maps.organisatie_collecties oc where oc.organisatie_id = o.id), '[]'::jsonb)) order by o.naam)
      from maps.organisaties o where o.slug <> 'toolen' and o.status <> 'verwijderd'), '[]'::jsonb)) end;
$$;
revoke all on function maps.platform_collecties() from public, anon;
grant execute on function maps.platform_collecties() to authenticated;

-- 5. Verhuizen: alles van Flanders Classics behalve wat typisch van hen is.
alter table maps.bibliotheek disable trigger bibliotheek_org_vast;
update maps.bibliotheek b set organisatie_id = maps.centrale_organisatie()
where b.organisatie_id = (select id from maps.organisaties where slug = 'flcs') and b.plan_id is null
  and coalesce(b.categorie, '') not in ('Doeken en drukwerk', 'Vlaggen', 'Huismateriaal', 'Sjablonen', 'Snelstijlen');
alter table maps.bibliotheek enable trigger bibliotheek_org_vast;

-- Bestaande klanten krijgen alle collecties.
insert into maps.organisatie_collecties (organisatie_id, collectie_id)
select o.id, c.id from maps.organisaties o, maps.collecties c where o.slug <> 'toolen' on conflict do nothing;

-- 6. De proeftuin opnieuw opbouwen zonder dubbele bibliotheek: eigen elementen van FLCS als kopie, de rest centraal.
-- (De bewaking "pas na 90 dagen in de prullenbak" geldt hier niet: het zijn kopieën van een uur oud.)
alter table maps.plannen disable trigger plan_wissen_bewaken;
delete from maps.plannen where organisatie_id = (select id from maps.organisaties where slug = 'proeftuin');
alter table maps.plannen enable trigger plan_wissen_bewaken;
delete from maps.events where organisatie_id = (select id from maps.organisaties where slug = 'proeftuin');
delete from maps.bibliotheek where organisatie_id = (select id from maps.organisaties where slug = 'proeftuin');
delete from maps.leveranciers where organisatie_id = (select id from maps.organisaties where slug = 'proeftuin');
select maps.platform_kopieer_organisatie((select id from maps.organisaties where slug = 'flcs'), (select id from maps.organisaties where slug = 'proeftuin'),
  array['9a928b8d-4ae3-4a1c-97cd-9a96e9cb32c4', '46ea5a09-190d-4e70-b682-50d373f81b9e']::uuid[])
where exists (select 1 from maps.organisaties where slug = 'proeftuin');
