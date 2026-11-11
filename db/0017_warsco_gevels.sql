-- Vaste deuren en ramen van de Warsco-units, uit de grondplannen op warsco.eu (gemeten op het plan, ± 5 cm).
-- Zijden in het assenstelsel van het element: V (y = 0), A (y = diepte), L (x = 0), R (x = breedte);
-- van = afstand vanaf de linkerhoek, van buiten bekeken. Schakelunit CF is opgeslagen zoals ze in de rij staat (open links).
with g(code, gevel) as (values
 ('BU-06-CD', '[{"zijde":"L","soort":"deur","van":4.83,"breedte":0.93},{"zijde":"V","soort":"raam","van":0.7,"breedte":1.6},{"zijde":"A","soort":"raam","van":0.7,"breedte":1.6}]'::jsonb),
 ('BU-06-CE', '[{"zijde":"V","soort":"raam","van":0.7,"breedte":1.6},{"zijde":"A","soort":"raam","van":0.7,"breedte":1.6}]'::jsonb),
 ('BU-06-CF', '[{"zijde":"R","soort":"deur","van":0.22,"breedte":0.95},{"zijde":"V","soort":"raam","van":0.7,"breedte":1.6},{"zijde":"A","soort":"raam","van":0.7,"breedte":1.6}]'::jsonb),
 ('BU-06-02', '[{"zijde":"V","soort":"deur","van":0.23,"breedte":0.92},{"zijde":"V","soort":"raam","van":2.81,"breedte":1.56},{"zijde":"R","soort":"raam","van":0.71,"breedte":1.58}]'::jsonb),
 ('BU-08-02', '[{"zijde":"V","soort":"raam","van":0.53,"breedte":0.98},{"zijde":"V","soort":"deur","van":2.75,"breedte":0.93},{"zijde":"V","soort":"raam","van":5.3,"breedte":1.57},{"zijde":"L","soort":"raam","van":0.7,"breedte":1.56},{"zijde":"R","soort":"raam","van":0.73,"breedte":1.56}]'::jsonb),
 ('SA-04-01', '[{"zijde":"V","soort":"deur","van":0.74,"breedte":0.9},{"zijde":"V","soort":"deur","van":2.15,"breedte":0.9},{"zijde":"A","soort":"raam","van":1.42,"breedte":0.35,"onder":1.8,"hoogte":0.4},{"zijde":"A","soort":"raam","van":2.26,"breedte":0.32,"onder":1.8,"hoogte":0.4},{"zijde":"L","soort":"raam","van":1.49,"breedte":0.6,"onder":1.6,"hoogte":0.5},{"zijde":"R","soort":"raam","van":0.9,"breedte":0.6,"onder":1.6,"hoogte":0.5}]'::jsonb),
 ('MG-06-02', '[{"zijde":"R","soort":"deur2","van":0.43,"breedte":1.57,"hoogte":2.1}]'::jsonb))
update maps.bibliotheek b set eigenschappen = coalesce(b.eigenschappen, '{}'::jsonb) || jsonb_build_object('gevel', g.gevel)
from g where b.leverancier = 'Warsco' and b.naam like '%(Warsco ' || g.code || ')%' and b.plan_id is null;
