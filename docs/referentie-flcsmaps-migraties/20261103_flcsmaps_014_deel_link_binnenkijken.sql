-- Deellink van de kaart: ook binnenkijken in gebouwen, tenten en containers.
--  * de inrichting van elk zichtbaar gebouw (velden.binnen.host) komt mee, ongeacht de laag
--  * de grondplannen (onderleggers) van die gebouwen
--  * foto's van wat binnen staat
do $$
declare d text := pg_get_functiondef('flcsmaps.deel_link_lezen(text)'::regprocedure); n text;
begin
  if position('binnenkijken' in d) > 0 then return; end if;
  n := replace(d, $a$                   else i.laag_id = any(dl.laag_ids) end)$a$,
$a$                   -- binnenkijken: ook de inrichting van zichtbare gebouwen
                   else (i.laag_id = any(dl.laag_ids)
                         or i.velden->'binnen'->>'host' in (select h.id::text from met_herkomst h where h.laag_id = any(dl.laag_ids) and not coalesce(h.verborgen, false))) end)$a$);
  n := replace(n, $a$o->'binnen'->>'host' = v_host), '[]'::jsonb) else '[]'::jsonb end)),$a$,
$a$o->'binnen'->>'host' = v_host), '[]'::jsonb) else coalesce((select jsonb_agg(o) from jsonb_array_elements(coalesce(pl.instellingen->'onderleggers', '[]'::jsonb)) o where o->'binnen'->>'host' in (select z.id::text from zicht z)), '[]'::jsonb) end)),$a$);
  n := replace(n, $a$f.item_id in (select z.id from zicht z)), '[]'::jsonb) else '[]'::jsonb end,$a$,
$a$f.item_id in (select z.id from zicht z)), '[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('item_id', f.item_id, 'pad', f.pad, 'mini', f.meta->>'mini') order by f.created_at) from flcsmaps.bestanden f where f.soort = 'foto' and f.item_id in (select z.id from zicht z where z.velden ? 'binnen')), '[]'::jsonb) end,$a$);
  if position('binnenkijken' in n) = 0 or position('z.velden ? ''binnen''' in n) = 0 or position('in (select z.id::text from zicht z)' in n) = 0 then raise exception 'replace mislukt'; end if;
  execute n;
end $$;
