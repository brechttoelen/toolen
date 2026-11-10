-- Bibliotheek: nieuwe indeling in families. Meubilair stond bij Veiligheid, Units was een verzamelbak,
-- Bouwers mengde tenten met stellingen en truss.
update maps.bibliotheek set familie = case
  when categorie in ('Meubilair', 'Binnenruimte', 'Huismateriaal') then 'meubilair'
  when categorie = 'Tenten en vloeren' then 'tenten'
  when categorie in ('Stellingbouw', 'Truss') then 'structuren'
  when familie = 'bouwers' then 'structuren'
  when categorie in ('TV-compound', 'Data en telecom') then 'tv'
  when categorie in ('Vervoer', 'Machines') then 'voertuigen'
  when categorie = 'Sjablonen' then 'sjablonen'
  when categorie = 'Doeken en drukwerk' and familie is null then 'branding'
  else familie end
where categorie in ('Meubilair', 'Binnenruimte', 'Huismateriaal', 'Tenten en vloeren', 'Stellingbouw', 'Truss',
                    'TV-compound', 'Data en telecom', 'Vervoer', 'Machines', 'Sjablonen', 'Doeken en drukwerk')
   or familie = 'bouwers';
