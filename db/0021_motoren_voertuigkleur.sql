-- Motoren (met en zonder cameraman) en kleur per voertuig.
update maps.bibliotheek set eigenschappen = eigenschappen || '{"kleurbaar": true}'::jsonb
where categorie = 'Vervoer' and (
  naam in ('Wagen SUV 4,95 m', 'Bestelwagen Sprinter 5,9 m', 'Camper integraal 7,6 m', 'Mecaniciensvrachtwagen 10 m',
           'Ploegwagen met fietsen op het dak 4,9 m', 'Shuttlebus 12 m (MAN Lion''s City 12)', 'Shuttlebus geleed 18 m (MAN Lion''s City 18 G)',
           'Teambus (reisbus) 13,4 m')
  or eigenschappen->>'tekening_ref' in ('vt-vw-transporter', 'vt-meubelbak-35t', 'vt-trekker', 'vt-combi-bak', 'vt-combi-zeil', 'vt-combi-plateau', 'vt-oplegger-bak', 'vt-oplegger-zeil')
);

insert into maps.bibliotheek (organisatie_id, naam, categorie, tekenwijze, breedte_m, diepte_m, hoogte_m, stijl, icoon, standaardlaag, familie, eigenschappen)
select b.organisatie_id, v.naam, 'Vervoer', 'schaal', v.l, v.br, v.h, b.stijl, b.icoon, b.standaardlaag, b.familie,
  jsonb_build_object('subgroep', 'Motoren', 'kleurbaar', true, 'tekening_ref', v.ref, 'tags', v.tags, 'omschrijving', v.oms)
from maps.bibliotheek b
cross join (values
  ('Motor 2,2 m', 'vt-motor', 2.2, 0.86, 1.3, '["motor","moto","motorfiets","voertuig","parking"]'::jsonb,
   'Motorfiets, bovenaanzicht: ± 2,2 m lang, 0,86 m breed over stuur en spiegels, hoogte ± 1,3 m. Voorkant rechts bij draaiing 0.'),
  ('Motor met cameraman 2,4 m', 'vt-motor-camera', 2.36, 0.86, 1.9, '["motor","moto","camera","cameraman","tv","televisie","koers","voertuig"]'::jsonb,
   'TV-motor met piloot en cameraman achterop, achterstevoren met de camera op de schouder: ± 2,4 m lang met camera, 0,86 m breed, hoogte ± 1,9 m. Voorkant rechts bij draaiing 0.')
) as v(naam, ref, l, br, h, tags, oms)
where b.naam = 'Wagen SUV 4,95 m' and b.categorie = 'Vervoer'
  and not exists (select 1 from maps.bibliotheek x where x.eigenschappen->>'tekening_ref' = v.ref);
