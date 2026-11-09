-- Deellink "Stroom": ook de eigen kabel van een verbruiker (eigenschappen.eigen_kabel_m) mee.
do $do$
declare d text;
begin
  d := pg_get_functiondef('flcsmaps.deel_link_lezen'::regproc);
  if position('''eigen_kabel_m''' in d) > 0 then return; end if;
  d := replace(d, '''afzekering'', ''rolstoel'')', '''afzekering'', ''rolstoel'', ''eigen_kabel_m'')');
  if position('''eigen_kabel_m''' in d) = 0 then raise exception 'deel_link_lezen: vervangen mislukt'; end if;
  execute d;
end $do$;
