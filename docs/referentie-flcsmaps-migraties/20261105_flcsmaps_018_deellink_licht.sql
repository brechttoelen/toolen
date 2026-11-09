-- Deellink: stand van de lichtmasten (velden.licht) en de lichtgegevens van het element (eigenschappen.licht).
do $mig$
declare d text;
begin
  select pg_get_functiondef('flcsmaps.deel_link_lezen(text)'::regprocedure) into d;
  if position('''stelling'', ''tent'')' in d) = 0 or position('''stelling3d'', ''familie'')' in d) = 0 then raise exception 'lijsten niet gevonden'; end if;
  d := replace(d, '''stelling'', ''tent'')', '''stelling'', ''tent'', ''licht'')');
  d := replace(d, '''stelling3d'', ''familie'')', '''stelling3d'', ''familie'', ''licht'')');
  execute d;
end $mig$;
