-- 0027 · Collecties per verhuurder
--
-- Meubilair opgesplitst per verhuurder ("Meubilair · Levi", "Meubilair · Nima Rent"); zonder verhuurder blijft "Meubilair".
-- Algemeen: bestaat er een collectie "<categorie> · <leverancier>", dan komt een nieuw centraal element met die
-- leverancier daar vanzelf in; anders in de collectie van zijn categorie.

create or replace function maps.bibliotheek_collectie() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.organisatie_id is distinct from maps.centrale_organisatie() or new.plan_id is not null then
    new.collectie_id := null;
  elsif new.collectie_id is null and coalesce(btrim(new.categorie), '') <> '' then
    select id into new.collectie_id from maps.collecties where naam = btrim(new.categorie) || ' · ' || btrim(coalesce(new.leverancier, ''));
    if new.collectie_id is null then
      insert into maps.collecties (naam) values (btrim(new.categorie)) on conflict (naam) do nothing;
      select id into new.collectie_id from maps.collecties where naam = btrim(new.categorie);
    end if;
  end if;
  return new;
end $$;

insert into maps.collecties (naam, standaard)
select distinct 'Meubilair · ' || btrim(b.leverancier), false from maps.bibliotheek b
where b.organisatie_id = maps.centrale_organisatie() and b.categorie = 'Meubilair' and coalesce(btrim(b.leverancier), '') <> ''
on conflict (naam) do nothing;

-- Wie Meubilair had, houdt alles: ook de nieuwe collecties.
insert into maps.organisatie_collecties (organisatie_id, collectie_id)
select oc.organisatie_id, n.id from maps.organisatie_collecties oc
join maps.collecties m on m.id = oc.collectie_id and m.naam = 'Meubilair'
join maps.collecties n on n.naam like 'Meubilair · %'
on conflict do nothing;

update maps.bibliotheek b set collectie_id = c.id from maps.collecties c
where b.organisatie_id = maps.centrale_organisatie() and b.categorie = 'Meubilair' and coalesce(btrim(b.leverancier), '') <> ''
  and c.naam = 'Meubilair · ' || btrim(b.leverancier);
