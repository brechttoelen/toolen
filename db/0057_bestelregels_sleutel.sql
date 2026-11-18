-- ============================================================================
-- Toolen · 0057_bestelregels_sleutel.sql
-- Een bestelregel hangt aan de kaart via een vaste sleutel (element-id en variant) in plaats van de naam:
-- een element hernoemen breekt de koppeling niet meer. kaart_naam blijft als leesbare naam en als
-- terugval voor regels zonder element (afgeleide regels in de materiaallijst).
-- ============================================================================
alter table maps.bestelregels add column if not exists kaart_sleutel text;

do $do$
declare d text;
begin
  select pg_get_functiondef('maps.fiche_overnemen(uuid,uuid)'::regprocedure) into d;
  if position('kaart_sleutel' in d) = 0 then
    d := replace(d, 'eenheid, wat, kaart_naam, groep,', 'eenheid, wat, kaart_naam, kaart_sleutel, groep,');
    d := replace(d, 'r.eenheid, r.wat, r.kaart_naam, r.groep,', 'r.eenheid, r.wat, r.kaart_naam, r.kaart_sleutel, r.groep,');
    d := replace(d, 'case when r.kaart_naam is null then r.aantal end', 'case when r.kaart_naam is null and r.kaart_sleutel is null then r.aantal end');
    if position('kaart_sleutel' in d) = 0 then raise exception 'fiche_overnemen niet aangepast'; end if;
    execute d;
  end if;
end $do$;
