-- Deellink: "geleverd door" valt terug op de standaardleverancier van het plan per categorie
-- (plannen.instellingen.leveranciers), zoals in de editor.
do $do$
declare d text;
begin
  d := pg_get_functiondef('flcsmaps.deel_link_lezen'::regproc);
  if position('''leveranciers''' in d) > 0 then return; end if;
  d := replace(d, 'coalesce(nullif(btrim(i.velden->>''herkomst''), ''''), b.leverancier, '''') as herkomst',
                  'coalesce(nullif(btrim(i.velden->>''herkomst''), ''''), b.leverancier, pl.instellingen->''leveranciers''->>b.categorie, '''') as herkomst');
  if position('''leveranciers''' in d) = 0 then raise exception 'deel_link_lezen: vervangen mislukt'; end if;
  execute d;
end $do$;
