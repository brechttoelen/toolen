-- 0033 · Deellink: units en containers in 3D. Leverancier (schakelunits) en gevel (deuren, ramen) gaan mee.
do $m$
declare d text;
begin
  d := pg_get_functiondef('maps.deel_link_lezen(text,text)'::regprocedure);
  d := replace(d, $a$'tekenwijze', b.tekenwijze, 'breedte_m'$a$, $a$'tekenwijze', b.tekenwijze, 'leverancier', b.leverancier, 'breedte_m'$a$);
  d := replace(d, $a$'kraan', 'tvcamera', 'subgroep')$a$, $a$'kraan', 'tvcamera', 'subgroep', 'gevel')$a$);
  d := replace(d, $a$'kabelcam', 'tvkabel')$a$, $a$'kabelcam', 'tvkabel', 'gevel')$a$);
  execute d;
end $m$;
