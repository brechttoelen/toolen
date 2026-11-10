-- ============================================================================
-- 0008 · Ontvangers: delen en exporteren samen
-- ============================================================================
-- Een ontvanger (tentenbouwer, politie, stad) is een deellink met onderdelen:
--   opties.onderdelen = [{ id, soort: plan|drie|binnen|werkplek, naam, ... }]
--   plan:     laag_ids, mappen (hele mappen, ook later toegevoegde lagen), fase,
--             verberg_elementen / verberg_soorten / verberg_items, beeld, inst (kader, papier, schaal, …)
--   drie:     item (3D van één element)
--   binnen:   item (gebouw met binnenplan)
--   werkplek: werkplek (stroomplan, veiligheidsplan, brandingplan), enkel in de PDF
--   opties.ontvanger = { soort, contact }   opties.laatste_pdf = { pad, versie, op, bladen }
-- De link staat uit zolang ingetrokken_op gevuld is (bv. een ontvanger die enkel een PDF krijgt).
--
-- Deze migratie:
--   1. deel_link_lezen krijgt een tweede parameter p_deel (welk onderdeel). Oude links zonder
--      onderdelen werken zoals voorheen.
--   2. Bestaande PDF-profielen (plannen.instellingen.pdf_profielen / pdf_uitsneden) worden
--      ontvangers met één onderdeel en de link uit. Mag opnieuw gedraaid worden.
-- ============================================================================

drop function if exists maps.deel_link_lezen(text);
drop function if exists maps.deel_link_lezen(text, text);

create function maps.deel_link_lezen(p_token text, p_deel text default null) returns jsonb
language plpgsql security definer set search_path = 'maps', 'public' as $$
declare
  dl maps.deel_links%rowtype;
  pl maps.plannen%rowtype;
  org maps.organisaties%rowtype;
  met_notities boolean;
  lev text;
  met_attesten boolean;
  verb_el text[];
  verb_it text[];
  verb_soort text[];
  snap jsonb := null;
  v_versie integer; v_op timestamptz;
  v_host text;
  v_drie text;
  v_deel jsonb;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select * into dl from maps.deel_links
   where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found then return null; end if;
  if not maps.org_deelbaar(dl.organisatie_id) then return null; end if;
  select * into org from maps.organisaties where id = dl.organisatie_id;
  select * into pl from maps.plannen where id = dl.plan_id;
  if not found then return null; end if;

  if not dl.live and dl.versie_id is not null then
    select v.momentopname, v.versie, v.created_at into snap, v_versie, v_op from maps.versies v where v.id = dl.versie_id;
    if not found then snap := null; end if;
  end if;

  -- Ontvanger met onderdelen: het gevraagde (of het eerste) onderdeel bepaalt wat zichtbaar is.
  if jsonb_typeof(dl.opties->'onderdelen') = 'array' and jsonb_array_length(dl.opties->'onderdelen') > 0 then
    select e into v_deel from jsonb_array_elements(dl.opties->'onderdelen') e
     where e->>'soort' in ('plan', 'drie', 'binnen') and (p_deel is null or e->>'id' = p_deel) limit 1;
    if v_deel is null then return null; end if;
    dl.opties := (dl.opties - 'binnen' - 'drie' - 'verberg_elementen' - 'verberg_soorten' - 'verberg_items' - 'beeld')
      || case v_deel->>'soort'
           when 'drie' then jsonb_build_object('drie', v_deel->>'item')
           when 'binnen' then jsonb_build_object('binnen', v_deel->>'item')
           else jsonb_strip_nulls(jsonb_build_object('verberg_elementen', v_deel->'verberg_elementen', 'verberg_soorten', v_deel->'verberg_soorten',
                                                     'verberg_items', v_deel->'verberg_items', 'beeld', v_deel->'beeld')) end;
    if v_deel->>'soort' = 'plan' then
      -- Gekozen lagen plus alle lagen in de gekozen mappen (ook lagen die er later bijkomen).
      -- Zonder keuze: alle lagen die afgedrukt mogen worden.
      dl.laag_ids := case when jsonb_typeof(v_deel->'laag_ids') = 'array' or jsonb_typeof(v_deel->'mappen') = 'array' then
        array(select l.id from maps.lagen l where l.plan_id = pl.id
                and (l.id::text in (select jsonb_array_elements_text(case when jsonb_typeof(v_deel->'laag_ids') = 'array' then v_deel->'laag_ids' else '[]'::jsonb end))
                     or (l.map is not null and l.map in (select jsonb_array_elements_text(case when jsonb_typeof(v_deel->'mappen') = 'array' then v_deel->'mappen' else '[]'::jsonb end)))))
        else array(select l.id from maps.lagen l where l.plan_id = pl.id and l.printbaar) end;
      dl.fase_ids := case when nullif(v_deel->>'fase', '') is not null then array[(v_deel->>'fase')::uuid] else null end;
    else
      dl.fase_ids := null;
    end if;
  end if;

  -- Wisselen tussen onderdelen telt niet als opnieuw openen.
  if p_deel is null then
    update maps.deel_links set keer_geopend = keer_geopend + 1 where id = dl.id;
  end if;
  met_notities := coalesce((dl.opties->>'notities')::boolean, false);
  lev := coalesce(dl.opties->>'leverancier', '');
  met_attesten := coalesce((dl.opties->>'attesten')::boolean, true);
  v_host := nullif(dl.opties->>'binnen', '');
  v_drie := nullif(dl.opties->>'drie', '');
  verb_el := array(select jsonb_array_elements_text(coalesce(pl.instellingen->'verborgen_elementen', '[]'::jsonb))
                   union select jsonb_array_elements_text(coalesce(dl.opties->'verberg_elementen', '[]'::jsonb)));
  verb_it := array(select jsonb_array_elements_text(coalesce(dl.opties->'verberg_items', '[]'::jsonb)));
  verb_soort := array(select jsonb_array_elements_text(coalesce(dl.opties->'verberg_soorten', '[]'::jsonb)));

  return (
    with bron as (
      select i.* from maps.items i where snap is null and i.plan_id = pl.id
      union all
      select s.* from jsonb_populate_recordset(null::maps.items, coalesce(snap->'items', '[]'::jsonb)) s where snap is not null
    ), bron_lagen as (
      select l.* from maps.lagen l where snap is null and l.plan_id = pl.id
      union all
      select s.* from jsonb_populate_recordset(null::maps.lagen, coalesce(snap->'lagen', '[]'::jsonb)) s where snap is not null
    ), met_herkomst as (
      select i.*, coalesce(nullif(btrim(i.velden->>'herkomst'), ''), b.leverancier, pl.instellingen->'leveranciers'->>b.categorie, '') as herkomst
        from bron i left join maps.bibliotheek b on b.id = i.element_id
    ), zicht as (
      select i.* from met_herkomst i
       where not coalesce(i.verborgen, false)
         and (case when v_drie is not null then i.id::text = v_drie
                   when v_host is not null
                   then (i.id::text = v_host or i.velden->'binnen'->>'host' = v_host)
                   else (i.laag_id = any(dl.laag_ids)
                         or i.velden->'binnen'->>'host' in (select h.id::text from met_herkomst h where h.laag_id = any(dl.laag_ids) and not coalesce(h.verborgen, false))) end)
         and (lev = '' or (i.element_id is not null and i.herkomst = lev))
         and (dl.fase_ids is null or cardinality(dl.fase_ids) = 0 or i.fase_ids is null or i.fase_ids && dl.fase_ids)
         and not (i.id::text = any(verb_it))
         and not (i.element_id is not null and i.element_id::text = any(verb_el))
         and not (i.element_id is null and i.soort = any(verb_soort))
    )
    select jsonb_build_object(
      'organisatie', jsonb_build_object('slug', org.slug, 'naam', org.naam, 'kort', org.kort, 'logo_pad', org.logo_pad),
      'onderdelen', coalesce((select jsonb_agg(jsonb_build_object('id', e->>'id', 'soort', e->>'soort', 'naam', e->>'naam'))
                               from jsonb_array_elements(case when jsonb_typeof(dl.opties->'onderdelen') = 'array' then dl.opties->'onderdelen' else '[]'::jsonb end) e
                              where e->>'soort' in ('plan', 'drie', 'binnen')), '[]'::jsonb),
      'deel', v_deel->>'id',
      'pdf', case when coalesce((dl.opties->>'pdf')::boolean, true) and jsonb_typeof(dl.opties->'laatste_pdf') = 'object'
                  then jsonb_build_object('pad', dl.opties->'laatste_pdf'->>'pad', 'versie', dl.opties->'laatste_pdf'->'versie', 'op', dl.opties->'laatste_pdf'->'op') end,
      'link', jsonb_build_object('id', dl.id, 'naam', dl.naam, 'opties', dl.opties - 'onderdelen' - 'laatste_pdf' - 'vorige_pdf' - 'ontvanger', 'live', dl.live,
                                 'stand', case when snap is not null then jsonb_build_object('versie', v_versie, 'op', v_op) end),
      'plan', jsonb_build_object('id', pl.id, 'naam', pl.naam, 'editie_naam', pl.editie_naam,
                                 'locatie', pl.locatie, 'centrum', pl.centrum, 'zoom', pl.zoom,
                                 'basiskaart', pl.basiskaart, 'versie', coalesce(v_versie, pl.versie),
                                 'titelblok', pl.titelblok, 'updated_at', case when snap is not null then v_op else pl.updated_at end,
                                 'instellingen', jsonb_build_object('stroom', case when coalesce((dl.opties->>'stroom')::boolean, false) then pl.instellingen->'stroom' end, 'verborgen_elementen', to_jsonb(verb_el),
                                   'onderleggers', case when v_host is not null then coalesce((select jsonb_agg(o) from jsonb_array_elements(coalesce(pl.instellingen->'onderleggers', '[]'::jsonb)) o where o->'binnen'->>'host' = v_host), '[]'::jsonb) else coalesce((select jsonb_agg(o) from jsonb_array_elements(coalesce(pl.instellingen->'onderleggers', '[]'::jsonb)) o where o->'binnen'->>'host' in (select z.id::text from zicht z)), '[]'::jsonb) end)),
      'lagen', coalesce((select jsonb_agg(to_jsonb(l) order by l.volgorde) from bron_lagen l where l.id = any(dl.laag_ids) or l.id in (select z.laag_id from zicht z)), '[]'),
      'items', coalesce((select jsonb_agg(jsonb_build_object(
                           'id', i.id, 'laag_id', i.laag_id, 'element_id', i.element_id,
                           'soort', i.soort, 'geometrie', i.geometrie, 'parameters', i.parameters,
                           'stijl', i.stijl, 'naam', i.naam, 'herkomst', nullif(i.herkomst, ''), 'fase_ids', i.fase_ids,
                           'notitie', case when met_notities then i.notitie end,
                           'velden', case when met_notities then i.velden
                                          else coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(i.velden, '{}'::jsonb)) e
                                                          where e.key in ('binnen', 'binnenplan', 'meubel', 'punt', 'ruimte', 'functie', 'functies', 'max_personen', 'doeken', 'vlaggen', 'paneel_1', 'paneel_2', 'paneel_3', 'paneel_4', 'ontwerp', 'wand', 'truss', 'vloer', 'montage', 'doek_naam', 'verdieping', 'toebehoren', 'fracties', 'dichtheid', 'nr', 'camera', 'tvcamera', 'stelling', 'tent', 'licht', 'kabelcam', 'tvkabel')
                                                             or (met_attesten and e.key = 'attesten') or (coalesce((dl.opties->>'stroom')::boolean, false) and e.key = 'stroom')), '{}'::jsonb) end))
                         from zicht i), '[]'),
      'elementen', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'naam', b.naam, 'categorie', b.categorie,
                           'tekenwijze', b.tekenwijze, 'breedte_m', b.breedte_m, 'diepte_m', b.diepte_m,
                           'eenheid_m', b.eenheid_m, 'hoogte_m', b.hoogte_m, 'stijl', b.stijl, 'icoon', b.icoon,
                           'eigenschappen', coalesce((select jsonb_object_agg(e.key, case when e.key = 'wand' and jsonb_typeof(e.value) = 'object' then e.value - 'voorraad' else e.value end) from jsonb_each(b.eigenschappen) e
                                                       where e.key in ('tekening_ref', 'tekening', 'doek', 'doek_kleur', 'totem', 'vlag', 'kleur', 'afmeting', 'beeld', 'drager', 'fietsen_per_stuk', 'module', 'veiligheid', 'vluchtweg', 'frame', 'drape', 'meubel', 'tafel', 'huis', 'zitplaatsen', 'binnenlocatie', 'wand', 'truss_doek', 'rijen_standaard', 'tekening_rekken', 'montages', 'banen', 'helling', 'materiaal', 'paal_naam', 'stapelbaar', 'strak', 'toebehoren', 'verspring_m', 'verspringend_standaard', 'vlaghouder', 'vloer', 'fracties', 'stekkerdoos', 'generator', 'stelling', 'stelling3d', 'familie', 'licht', 'kabelcam', 'kraan', 'tvcamera', 'subgroep') or (coalesce((dl.opties->>'stroom')::boolean, false) and e.key in ('kva', 'uitgangen', 'ampere', 'kabeltype', 'kabel_lengtes', 'tank_l', 'liter_per_uur', 'aansluitingen', 'ingang', 'kw', 'rol', 'fase', 'afzekering', 'rolstoel', 'eigen_kabel_m'))), '{}'::jsonb)))
                         from maps.bibliotheek b
                        where not (b.id::text = any(verb_el))
                          and (b.organisatie_id is null or b.organisatie_id = dl.organisatie_id)
                          and (b.id in (select z.element_id from zicht z)
                               or b.id::text in (select jsonb_array_elements_text(case when jsonb_typeof(z.velden->'doeken') = 'array' then z.velden->'doeken' else '[]'::jsonb end) from zicht z)
                               or b.id::text in (select jsonb_array_elements_text(case when jsonb_typeof(z.velden->'vlaggen') = 'array' then z.velden->'vlaggen' else '[]'::jsonb end) from zicht z)
                               or b.id::text in (select z.velden->>k from zicht z, unnest(array['paneel_1','paneel_2','paneel_3','paneel_4','ontwerp']) k)
                               or b.id::text in (select z.velden->'meubel'->>'stoel_huis' from zicht z)
                               or b.id::text in (select z.velden->'kabelcam'->>'verreiker' from zicht z)
                               or b.id::text in (select b2.eigenschappen->'kabelcam'->>'verreiker' from maps.bibliotheek b2 where b2.id in (select z.element_id from zicht z))
                               or b.id::text in (select v->>k from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->'wand'->'vrij') = 'array' then z.velden->'wand'->'vrij' else '[]'::jsonb end) v, unnest(array['voor','achter']) k)
                               or b.id::text in (select v->>k from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->'truss'->'doeken') = 'array' then z.velden->'truss'->'doeken' else '[]'::jsonb end) v, unnest(array['voor','achter']) k)
                               or b.id::text in (select v->>'voor' from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->'stelling'->'doeken') = 'array' then z.velden->'stelling'->'doeken' else '[]'::jsonb end) v)
                               or b.id::text in (select e.value #>> '{}' from zicht z, jsonb_each(case when jsonb_typeof(z.velden->'tent'->'doeken') = 'object' then z.velden->'tent'->'doeken' else '{}'::jsonb end) e)
                               or b.id::text in (select e.value #>> '{}' from zicht z, unnest(array['voor','achter']) k, jsonb_each(case when jsonb_typeof(z.velden->'wand'->k) = 'object' then z.velden->'wand'->k else '{}'::jsonb end) e)
                               or b.id::text in (select e #>> '{}' from zicht z, unnest(array['voor','achter']) k, jsonb_array_elements(case when jsonb_typeof(z.velden->'wand'->k) = 'array' then z.velden->'wand'->k else '[]'::jsonb end) e))), '[]'),
      'fotos', case when v_host is not null then coalesce((select jsonb_agg(jsonb_build_object('item_id', f.item_id, 'pad', f.pad, 'mini', f.meta->>'mini') order by f.created_at) from maps.bestanden f where f.soort = 'foto' and f.item_id in (select z.id from zicht z)), '[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('item_id', f.item_id, 'pad', f.pad, 'mini', f.meta->>'mini') order by f.created_at) from maps.bestanden f where f.soort = 'foto' and f.item_id in (select z.id from zicht z where z.velden ? 'binnen')), '[]'::jsonb) end,
      'stellingplannen', coalesce((select jsonb_agg(jsonb_build_object('item_id', f.item_id, 'pad', f.pad, 'naam', f.meta->>'naam') order by f.created_at) from maps.bestanden f where f.soort = 'stellingplan' and f.item_id in (select z.id from zicht z)), '[]'::jsonb),
      'vast', case when coalesce((dl.opties->>'stroom')::boolean, false) then
                 coalesce((select jsonb_agg(to_jsonb(v) - 'sleutel' - 'contact' - 'ean' - 'aangemaakt_door' - 'bewerkt_door' - 'organisatie_id')
                             from maps.vaste_aansluitingen v
                            where v.organisatie_id = dl.organisatie_id
                              and ('va:' || v.id::text) in (select z.velden->'stroom'->>'voeding' from zicht z
                                                             union select z.velden->'stroom'->>'van' from zicht z
                                                             union select a->>'voeding' from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->'stroom'->'aansluitingen') = 'array' then z.velden->'stroom'->'aansluitingen' else '[]'::jsonb end) a)), '[]'::jsonb)
               else '[]'::jsonb end,
      'veldpunten', case when coalesce((dl.opties->>'opmerkingen')::boolean, false) then
                       coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'punt', o.punt, 'auteur', coalesce(o.auteur_naam, org.kort, org.naam),
                                                                     'tekst', o.tekst, 'status', o.status, 'op', o.created_at, 'eigen', o.deel_link_id = dl.id) order by o.created_at)
                                   from maps.opmerkingen o where o.plan_id = pl.id and o.punt is not null and o.item_id is null and o.status = 'open'), '[]')
                     else '[]'::jsonb end,
      'opmerkingen', case when coalesce((dl.opties->>'opmerkingen')::boolean, false) then
                       coalesce((select jsonb_agg(jsonb_build_object('item_id', o.item_id, 'auteur', coalesce(o.auteur_naam, org.kort, org.naam),
                                                                     'tekst', o.tekst, 'status', o.status, 'op', o.created_at)
                                                  order by o.created_at)
                                   from maps.opmerkingen o
                                   join zicht i on i.id = o.item_id), '[]')
                     else '[]'::jsonb end
    )
  );
end $$;


revoke execute on function maps.deel_link_lezen(text, text) from public;
grant execute on function maps.deel_link_lezen(text, text) to anon, authenticated, service_role;

-- 2. PDF-profielen worden ontvangers (één per profiel, link uit).
insert into maps.deel_links (organisatie_id, plan_id, naam, laag_ids, fase_ids, live, ingetrokken_op, opties)
select p.organisatie_id, p.id, coalesce(nullif(btrim(e->>'naam'), ''), 'Profiel'),
       coalesce(array(select x::uuid from jsonb_array_elements_text(case when jsonb_typeof(e->'inst'->'lagen') = 'array' then e->'inst'->'lagen' else '[]'::jsonb end) x), '{}'),
       null, true, now(),
       jsonb_build_object(
         'profiel_id', coalesce(e->>'id', e->>'naam'),
         'ontvanger', jsonb_build_object('soort', 'PDF-profiel'),
         'notities', true, 'opmerkingen', false, 'pdf', true, 'attesten', true, 'materialen', true, 'taal', 'nl',
         'onderdelen', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
           'id', coalesce(e->>'id', replace(gen_random_uuid()::text, '-', '')),
           'soort', 'plan',
           'naam', coalesce(nullif(btrim(e->>'naam'), ''), p.naam),
           'laag_ids', case when jsonb_typeof(e->'inst'->'lagen') = 'array' then e->'inst'->'lagen' end,
           'fase', case when jsonb_typeof(e->'fase') = 'string' then e->'fase' end,
           'inst', (case when jsonb_typeof(e->'inst') = 'object' then e->'inst' else '{}'::jsonb end - 'lagen')
                   || jsonb_strip_nulls(jsonb_build_object('papier', e->'papier', 'orientatie', e->'orientatie', 'schaal', e->'schaal',
                                                           'centrum', e->'centrum', 'vrijB', e->'vrijB', 'vrijH', e->'vrijH'))))))
  from maps.plannen p,
       jsonb_array_elements(case when jsonb_typeof(p.instellingen->'pdf_profielen') = 'array' then p.instellingen->'pdf_profielen'
                                 when jsonb_typeof(p.instellingen->'pdf_uitsneden') = 'array' then p.instellingen->'pdf_uitsneden'
                                 else '[]'::jsonb end) e
 where not exists (select 1 from maps.deel_links d where d.plan_id = p.id and d.opties->>'profiel_id' = coalesce(e->>'id', e->>'naam'));
