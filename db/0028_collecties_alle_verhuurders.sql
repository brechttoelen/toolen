-- 0028 · Alle categorieën per verhuurder
--
-- Zoals bij Meubilair: een verhuurder met minstens 5 elementen in een categorie krijgt een eigen collectie
-- "<categorie> · <verhuurder>" (niet standaard voor nieuwe klanten). Kleinere groepjes blijven in de collectie van de categorie.
-- Wie de categorie had, houdt ook de nieuwe collecties.

with paren as (
  select b.categorie, btrim(b.leverancier) lev from maps.bibliotheek b
  where b.organisatie_id = maps.centrale_organisatie() and b.plan_id is null and coalesce(btrim(b.leverancier), '') <> ''
  group by 1, 2 having count(*) >= 5
)
insert into maps.collecties (naam, standaard) select categorie || ' · ' || lev, false from paren on conflict (naam) do nothing;

insert into maps.organisatie_collecties (organisatie_id, collectie_id)
select oc.organisatie_id, n.id from maps.organisatie_collecties oc
join maps.collecties m on m.id = oc.collectie_id
join maps.collecties n on n.naam like m.naam || ' · %'
on conflict do nothing;

update maps.bibliotheek b set collectie_id = c.id from maps.collecties c
where b.organisatie_id = maps.centrale_organisatie() and b.plan_id is null and coalesce(btrim(b.leverancier), '') <> ''
  and c.naam = b.categorie || ' · ' || btrim(b.leverancier) and b.collectie_id is distinct from c.id;
