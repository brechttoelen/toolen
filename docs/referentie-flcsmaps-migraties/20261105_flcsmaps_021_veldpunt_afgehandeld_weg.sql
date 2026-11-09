-- Een veldpunt dat in de editor afgehandeld (of ingetekend) is, verdwijnt ook uit alle deellinks.
do $do$
declare d text;
begin
  d := pg_get_functiondef('flcsmaps.deel_link_lezen'::regproc);
  if position('o.item_id is null and o.status = ''open''' in d) = 0 then
    d := replace(d, $r$o.plan_id = pl.id and o.punt is not null and o.item_id is null$r$, $r$o.plan_id = pl.id and o.punt is not null and o.item_id is null and o.status = 'open'$r$);
    if position('o.item_id is null and o.status = ''open''' in d) = 0 then raise exception 'aanpassing mislukt'; end if;
    execute d;
  end if;
end $do$;
