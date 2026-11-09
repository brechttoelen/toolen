-- FLCS Maps 024: familie per bibliotheek-element (welk detailscherm en welke tab in de bibliotheek).
-- Waarden: hekken · bouwers · units · stroom · schermen · vloeren · branding · veiligheid.
alter table flcsmaps.bibliotheek add column if not exists familie text;

update flcsmaps.bibliotheek set familie = case
  when categorie ~* 'hek|afsluit|barrier|fietsenstalling' then 'hekken'
  when categorie ~* 'tent|stellingbouw|truss' then 'bouwers'
  when categorie ~* 'elektric|verlichting|verwarming|stroom' then 'stroom'
  when categorie ~* 'grondbescherming|vloer|podium' then 'vloeren'
  when categorie ~* 'scherm|^led' then 'schermen'
  when categorie ~* 'doek|communicatie|branding|signal' then 'branding'
  when categorie ~* 'veiligheid|binnenruimte|meubilair|huismateriaal' then 'veiligheid'
  when tekenwijze = 'lijn' then 'hekken'
  else 'units' end
where familie is null;
-- Wanden (B-matrix, pipe & drape) horen bij de bouwers.
update flcsmaps.bibliotheek set familie = 'bouwers' where eigenschappen ? 'wand';
