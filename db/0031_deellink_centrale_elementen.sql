-- 0031 · Deellinks tonen ook elementen uit de centrale bibliotheek (organisatie toolen).
-- Sinds 0026 staan de meeste elementen bij Toolen; deel_link_lezen gaf enkel die van de eigen organisatie mee,
-- waardoor tenten, hekken, wagens … op een deellink als gewone vorm of niet verschenen.
do $m$
declare d text;
begin
  d := pg_get_functiondef('maps.deel_link_lezen(text,text)'::regprocedure);
  d := replace(d, 'and (b.organisatie_id is null or b.organisatie_id = dl.organisatie_id)',
                  'and (b.organisatie_id is null or b.organisatie_id = dl.organisatie_id or b.organisatie_id = maps.centrale_organisatie())');
  if position('maps.centrale_organisatie()' in d) = 0 then raise exception 'vervanging mislukt'; end if;
  execute d;
end $m$;
