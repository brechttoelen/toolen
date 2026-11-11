-- Algeco Advance: 6 × 3 m units (18 m²) met 4, 3 of 2 buitenwanden om te koppelen, en de kleine 3 × 3 m (FL147).
-- Algeco publiceert geen grondplannen; deuren en ramen kan je bij Algeco verplaatsen, dus per unit aan te passen
-- in de containerbouwer (gevelVrij). Maten van de Advance-reeks (algeco.cz): 6,058 × 2,995 × 2,80 m, stapelbaar tot 3 hoog.
insert into maps.bibliotheek (organisatie_id, naam, categorie, tekenwijze, breedte_m, diepte_m, eenheid_m, hoogte_m, omtrek, stijl, icoon, standaardlaag, leverancier, leverancier_id, eigenschappen, varianten, actief, familie)
select b.organisatie_id, n.naam, b.categorie, b.tekenwijze, n.br, n.di, b.eenheid_m, 2.8, null, b.stijl, b.icoon, b.standaardlaag, 'Algeco', null,
  (b.eigenschappen - 'gevel' - 'tekening_ref' - 'inrichting') || jsonb_build_object('gevel', n.gevel, 'omschrijving', n.oms, 'subgroep', 'Kantoor', 'stapelbaar', 3, 'gevelVrij', true), b.varianten, true, b.familie
from maps.bibliotheek b, (values
 ('Advance 6 × 3 m · 4 buitenwanden', 6.058, 2.995, 'Algeco Advance: losse unit van 18 m². Deuren en ramen zijn te verplaatsen; standaard één dubbel raam met rolluik.',
  '[{"zijde":"V","soort":"deur","van":0.4,"breedte":0.9},{"zijde":"V","soort":"raam","van":2.4,"breedte":1.8}]'::jsonb),
 ('Advance 6 × 3 m · 3 buitenwanden', 2.995, 6.058, 'Algeco Advance: eindunit om te koppelen (één lange zijde open). Aan de andere kant van een blok staat dezelfde unit, gedraaid.',
  '[{"zijde":"L","soort":"raam","van":2.1,"breedte":1.8},{"zijde":"V","soort":"deur","van":1.0,"breedte":0.9}]'::jsonb),
 ('Advance 6 × 3 m · 2 buitenwanden', 2.995, 6.058, 'Algeco Advance: middenunit om te koppelen (beide lange zijden open).',
  '[{"zijde":"V","soort":"raam","van":0.6,"breedte":1.8}]'::jsonb),
 ('Advance 3 × 3 m (FL147)', 3.0, 2.995, 'Algeco Advance FL147: kleine unit van 9 m².',
  '[{"zijde":"V","soort":"deur","van":0.3,"breedte":0.9},{"zijde":"V","soort":"raam","van":1.5,"breedte":1.2}]'::jsonb)
) as n(naam, br, di, oms, gevel)
where b.naam like '%(Rob 6000)%' and b.plan_id is null
  and not exists (select 1 from maps.bibliotheek x where x.naam = n.naam and x.leverancier = 'Algeco');
