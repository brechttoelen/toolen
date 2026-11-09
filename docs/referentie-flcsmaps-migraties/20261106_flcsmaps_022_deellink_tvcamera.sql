-- Deellink: velden.tvcamera (type camera en opstelling op een camerastelling) mee tonen.
do $do$
declare d text;
begin
  d := pg_get_functiondef('flcsmaps.deel_link_lezen'::regproc);
  if position('''tvcamera''' in d) = 0 then
    d := replace(d, $r$'nr', 'camera', 'stelling'$r$, $r$'nr', 'camera', 'tvcamera', 'stelling'$r$);
    if position('''tvcamera''' in d) = 0 then raise exception 'aanpassing mislukt'; end if;
    execute d;
  end if;
end $do$;
