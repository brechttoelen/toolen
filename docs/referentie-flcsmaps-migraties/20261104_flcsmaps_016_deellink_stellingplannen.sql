-- Deellink: ook de plannen van de stellingbouwer (bestanden soort 'stellingplan') van de zichtbare items meesturen,
-- zodat wie via een deellink kijkt (bv. de brandweer) de echte plannen bij de 3D kan openen.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'flcsmaps' and p.proname = 'deel_link_lezen';
  if position('''stellingplannen''' in d) = 0 then
    d := replace(d, '''opmerkingen'', case when',
      '''stellingplannen'', coalesce((select jsonb_agg(jsonb_build_object(''item_id'', f.item_id, ''pad'', f.pad, ''naam'', f.meta->>''naam'') order by f.created_at) from flcsmaps.bestanden f where f.soort = ''stellingplan'' and f.item_id in (select z.id from zicht z)), ''[]''::jsonb),
      ''opmerkingen'', case when');
    execute d;
  end if;
end $$;
