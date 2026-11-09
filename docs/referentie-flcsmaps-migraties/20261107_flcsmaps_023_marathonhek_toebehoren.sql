-- FLCS Maps 023: marathonhek (2,5 m, platte voet) en toebehoren per hektype.
-- Nadar (dranghek, schuin dranghek) krijgt nooit een klem; zijn steundriehoek is een nadardriehoek
-- (twee dranghekken als benen, getekend als hek). Bouwhek (heras) houdt klem, schoor, herasdriehoek, wiel.

insert into flcsmaps.bibliotheek (id, naam, categorie, tekenwijze, eenheid_m, hoogte_m, stijl, eigenschappen, plan_id)
values (
  'a3d2c9f1-5b7e-4c1a-9e2d-7f8b6a4c3d21', 'Marathonhek 2,5 m (platte voet)', 'Hekken en afsluitingen', 'lijn', 2.5, 1.1,
  '{"dikte": 2, "kleur": "#15803D"}'::jsonb,
  '{"tags": ["afsluiting", "crowd control", "dranghek", "hek", "marathonhek", "platte voet", "nadar"],
    "tekening_ref": "hk-marathonhek-2-5",
    "toebehoren": [
      {"k": "schoor", "naam": "Schoren", "soort": "schoor"},
      {"k": "paal", "om": 2, "naam": "Paal (verstevigen)", "soort": "paal", "lengte": 1.6},
      {"k": "driehoek", "om": 4, "naam": "Nadardriehoek (2 hekken)", "soort": "driehoek", "hek": true},
      {"k": "zandzak", "om": 1, "per": 2, "naam": "Zandzakken", "soort": "blok"}
    ],
    "omschrijving": "Marathonhek van 2,5 m: zoals een dranghek, maar met een platte voet (voetplaat) in plaats van pootjes. Groen op het plan, met een voetplaatje bij elke naad. De stuklijst telt de hekken per recht stuk."
  }'::jsonb,
  null)
on conflict (id) do update set naam = excluded.naam, stijl = excluded.stijl, eigenschappen = excluded.eigenschappen, hoogte_m = excluded.hoogte_m;

-- Nadar: geen klem; driehoek wordt een nadardriehoek.
update flcsmaps.bibliotheek
set eigenschappen = jsonb_set(eigenschappen, '{toebehoren}', '[
  {"k": "schoor", "naam": "Schoren", "soort": "schoor"},
  {"k": "wiel", "naam": "Wielen", "soort": "wiel"},
  {"k": "paal", "om": 2, "naam": "Paal (verstevigen)", "soort": "paal", "lengte": 1.6},
  {"k": "driehoek", "om": 4, "naam": "Nadardriehoek (2 dranghekken)", "soort": "driehoek", "hek": true},
  {"k": "zandzak", "om": 1, "per": 2, "naam": "Zandzakken", "soort": "blok"}
]'::jsonb), rev = coalesce(rev, 1) + 1
where id in ('ea4e47e2-dc67-479d-baba-74f5262fb338', 'ea7bf3dc-1fbe-4399-b015-e0ff523cab7a');

-- Dranghek 1,1 m hoog (voor de kijkhoek van camera's).
update flcsmaps.bibliotheek set hoogte_m = 1.1 where id in ('ea4e47e2-dc67-479d-baba-74f5262fb338', 'ea7bf3dc-1fbe-4399-b015-e0ff523cab7a') and hoogte_m is null;
