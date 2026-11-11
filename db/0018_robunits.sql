-- Rob Units: deuren en ramen uit de grondplannen op robunits.be (gemeten op het plan, ± 5 cm), en de schakelreeks
-- 6500 (eind, open rechts) · 6600 (midden) · 6550 (eind, open links) voor blokken van 6 × 6, 6 × 9, 6 × 12 m …
-- Zijden zoals in 0017: V (y = 0), A (y = diepte), L (x = 0), R (x = breedte); van = vanaf de linkerhoek, van buiten bekeken.
with g(code, gevel) as (values
 ('Rob 6000', '[{"zijde":"L","soort":"deur","van":0.15,"breedte":0.9},{"zijde":"L","soort":"raam","van":1.25,"breedte":1.2},{"zijde":"R","soort":"raam","van":0.45,"breedte":2.1}]'::jsonb),
 ('Rob 6100', '[{"zijde":"L","soort":"deur","van":1.95,"breedte":0.9},{"zijde":"L","soort":"raam","van":0.2,"breedte":1.2},{"zijde":"R","soort":"raam","van":0.35,"breedte":2.2}]'::jsonb),
 ('Rob 8000', '[{"zijde":"R","soort":"deur","van":0.1,"breedte":0.9},{"zijde":"V","soort":"raam","van":0.9,"breedte":2.1},{"zijde":"V","soort":"raam","van":3.95,"breedte":2.1},{"zijde":"L","soort":"raam","van":0.3,"breedte":2.3}]'::jsonb),
 ('Rob 8100', '[{"zijde":"R","soort":"deur","van":0.1,"breedte":0.9},{"zijde":"V","soort":"raam","van":1.0,"breedte":1.5},{"zijde":"V","soort":"raam","van":5.0,"breedte":1.5},{"zijde":"L","soort":"raam","van":0.3,"breedte":2.3}]'::jsonb),
 ('Rob 8150', '[{"zijde":"V","soort":"deur","van":3.35,"breedte":0.9},{"zijde":"V","soort":"raam","van":1.0,"breedte":1.2},{"zijde":"V","soort":"raam","van":5.4,"breedte":1.5},{"zijde":"L","soort":"raam","van":0.5,"breedte":2.0},{"zijde":"R","soort":"raam","van":0.5,"breedte":2.0}]'::jsonb))
update maps.bibliotheek b set eigenschappen = coalesce(b.eigenschappen, '{}'::jsonb) || jsonb_build_object('gevel', g.gevel)
from g where b.leverancier = 'Rob Units' and b.naam like '%(' || g.code || ')%' and b.plan_id is null;

-- Schakelreeks: 3 m breed (x), 6 m diep (y), zoals de Warsco-schakelunits; open zijde L of R.
insert into maps.bibliotheek (organisatie_id, naam, categorie, tekenwijze, breedte_m, diepte_m, eenheid_m, hoogte_m, omtrek, stijl, icoon, standaardlaag, leverancier, leverancier_id, eigenschappen, varianten, actief, familie)
select b.organisatie_id, n.naam, b.categorie, b.tekenwijze, 3, 6, b.eenheid_m, b.hoogte_m, null, b.stijl, b.icoon, b.standaardlaag, b.leverancier, b.leverancier_id,
  (b.eigenschappen - 'gevel' - 'tekening_ref' - 'inrichting') || jsonb_build_object('gevel', n.gevel, 'omschrijving', n.oms), b.varianten, true, b.familie
from maps.bibliotheek b, (values
 ('Schakelcontainer 6 × 3 m · eind, deur links (Rob 6500)', 'Rob Units schakelcontainer 6500: open ruimte, open aan één lange zijde. Koppelen met 6600 en 6550 tot een blok van 6 × 6, 6 × 9, 6 × 12 m.',
  '[{"zijde":"L","soort":"deur","van":4.9,"breedte":0.9},{"zijde":"V","soort":"raam","van":0.3,"breedte":2.4},{"zijde":"A","soort":"raam","van":0.3,"breedte":2.4}]'::jsonb),
 ('Schakelcontainer 6 × 3 m · midden (Rob 6600)', 'Rob Units schakelcontainer 6600: middenruimte met twee open lange zijden, tussen 6500 en 6550.',
  '[{"zijde":"V","soort":"raam","van":0.3,"breedte":2.4},{"zijde":"A","soort":"raam","van":0.3,"breedte":2.4}]'::jsonb),
 ('Schakelcontainer 6 × 3 m · eind, deur rechts (Rob 6550)', 'Rob Units schakelcontainer 6550: open ruimte, open aan één lange zijde. Koppelen met 6600 en 6500.',
  '[{"zijde":"V","soort":"deur","van":0.05,"breedte":0.9},{"zijde":"V","soort":"raam","van":1.3,"breedte":1.5},{"zijde":"A","soort":"raam","van":0.45,"breedte":2.1}]'::jsonb)
) as n(naam, oms, gevel)
where b.naam like '%(Rob 6000)%' and b.plan_id is null
  and not exists (select 1 from maps.bibliotheek x where x.naam = n.naam);
