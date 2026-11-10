-- Branding in drie categorieën, omdat doeken, vlaggen en frames van verschillende leveranciers komen.
update maps.bibliotheek set categorie = 'Vlaggen'
  where categorie = 'Doeken en drukwerk' and (naam ~* '(^|[ ·])vlag' or naam ~* 'beachvlag|vlaggenmast');
update maps.bibliotheek set categorie = 'Totems en frames'
  where categorie = 'Doeken en drukwerk' and tekenwijze <> 'doek' and naam ~* 'totem|frame|pipe & drape';
update maps.leveranciers set categorieen = array_append(categorieen, 'Totems en frames')
  where naam = 'Wentex' and not ('Totems en frames' = any(categorieen));
