-- Deellink: de tentbouwer (velden.tent), de familie van een tent en de bedrukte doeken op de tentwanden.
do $mig$
declare d text;
begin
  select pg_get_functiondef('flcsmaps.deel_link_lezen(text)'::regprocedure) into d;
  if position('''camera'', ''stelling'')' in d) = 0 then raise exception 'velden-lijst niet gevonden'; end if;
  d := replace(d, '''camera'', ''stelling'')', '''camera'', ''stelling'', ''tent'')');
  d := replace(d, '''stelling'', ''stelling3d'')', '''stelling'', ''stelling3d'', ''familie'')');
  d := replace(d, $r$or b.id::text in (select v->>'voor' from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->'stelling'->'doeken') = 'array' then z.velden->'stelling'->'doeken' else '[]'::jsonb end) v)$r$,
    $r$or b.id::text in (select v->>'voor' from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->'stelling'->'doeken') = 'array' then z.velden->'stelling'->'doeken' else '[]'::jsonb end) v)
                               or b.id::text in (select e.value #>> '{}' from zicht z, jsonb_each(case when jsonb_typeof(z.velden->'tent'->'doeken') = 'object' then z.velden->'tent'->'doeken' else '{}'::jsonb end) e)$r$);
  if position('''tent'')' in d) = 0 or position('''familie'')' in d) = 0 or position($r$z.velden->'tent'->'doeken'$r$ in d) = 0 then raise exception 'aanpassing mislukt'; end if;
  execute d;
end $mig$;
