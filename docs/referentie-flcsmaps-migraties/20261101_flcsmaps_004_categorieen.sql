-- FLCS Maps 004: bibliotheekcategorieën ontdubbeld.
-- "Tenten en structuren" (tenten, pagodes, stretchtenten) -> "Tenten"
-- "Structuren" (podiumwagens, trailers, finishbogen)       -> "Mobiele structuren"
-- Al uitgevoerd op 2026-11-01; dit bestand is de neerslag en is idempotent.
update flcsmaps.bibliotheek set categorie = 'Tenten' where categorie = 'Tenten en structuren';
update flcsmaps.bibliotheek set categorie = 'Mobiele structuren' where categorie = 'Structuren';
