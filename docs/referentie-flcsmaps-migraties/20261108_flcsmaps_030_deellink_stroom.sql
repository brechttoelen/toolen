-- Deellink "Stroom" (opties.stroom): de stroomgegevens mee, zodat de link per stroompunt toont wat er moet staan,
-- hoe het aangesloten wordt en wat mee moet (zoals het stroomdossier).
--  * items: velden.stroom (rol, voeding, kabels) ook zonder notities;
--  * elementen: de stroomeigenschappen (kVA, uitgangen, ampère, kabeltype en -lengtes, tank, verbruik);
--  * plan: instellingen.stroom (gelijktijdigheid);
--  * vast: de vaste aansluitingen (stad, Fluvius) waar items op aangesloten zijn, zonder sleutel en contact.
do $do$
declare d text;
begin
  d := pg_get_functiondef('flcsmaps.deel_link_lezen'::regproc);
  if position('''vast''' in d) > 0 then return; end if;
  d := replace(d, 'or (met_attesten and e.key = ''attesten'')',
                  'or (met_attesten and e.key = ''attesten'') or (coalesce((dl.opties->>''stroom'')::boolean, false) and e.key = ''stroom'')');
  d := replace(d, '''kraan'', ''tvcamera'', ''subgroep''))',
                  '''kraan'', ''tvcamera'', ''subgroep'') or (coalesce((dl.opties->>''stroom'')::boolean, false) and e.key in (''kva'', ''uitgangen'', ''ampere'', ''kabeltype'', ''kabel_lengtes'', ''tank_l'', ''liter_per_uur'', ''aansluitingen'', ''ingang'', ''kw'', ''rol'', ''fase'', ''afzekering'', ''rolstoel'')))');
  d := replace(d, '''instellingen'', jsonb_build_object(''verborgen_elementen'', to_jsonb(verb_el),',
                  '''instellingen'', jsonb_build_object(''stroom'', case when coalesce((dl.opties->>''stroom'')::boolean, false) then pl.instellingen->''stroom'' end, ''verborgen_elementen'', to_jsonb(verb_el),');
  d := replace(d, '      ''veldpunten'', case when',
                  '      ''vast'', case when coalesce((dl.opties->>''stroom'')::boolean, false) then
                 coalesce((select jsonb_agg(to_jsonb(v) - ''sleutel'' - ''contact'' - ''ean'' - ''aangemaakt_door'' - ''bewerkt_door'')
                             from flcsmaps.vaste_aansluitingen v
                            where (''va:'' || v.id::text) in (select z.velden->''stroom''->>''voeding'' from zicht z
                                                             union select z.velden->''stroom''->>''van'' from zicht z
                                                             union select a->>''voeding'' from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->''stroom''->''aansluitingen'') = ''array'' then z.velden->''stroom''->''aansluitingen'' else ''[]''::jsonb end) a)), ''[]''::jsonb)
               else ''[]''::jsonb end,
      ''veldpunten'', case when');
  if position('''vast''' in d) = 0 or position('''kabel_lengtes''' in d) = 0 or position('e.key = ''stroom''' in d) = 0 or position('''stroom'', case when' in d) = 0 then
    raise exception 'deel_link_lezen: vervangen mislukt';
  end if;
  execute d;
end $do$;
