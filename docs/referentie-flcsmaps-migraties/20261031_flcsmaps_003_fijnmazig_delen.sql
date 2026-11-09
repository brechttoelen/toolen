-- ============================================================================
-- FLCS Maps 003: fijnmazig delen
-- deel_link_lezen houdt nu ook rekening met:
--   * plan.instellingen.verborgen_elementen (in het plan verborgen soorten)
--   * opties.verberg_elementen  (soorten elementen die deze link niet toont)
--   * opties.verberg_soorten    (eigen tekeningen zonder element: lijn, vlak, tekst, ...)
--   * opties.verberg_items      (losse items die deze link niet toont)
--   * opties.attesten           (attesten ook zonder notities meesturen)
-- Terugdraaien: 002 opnieuw uitvoeren.
-- ============================================================================

create or replace function flcsmaps.deel_link_lezen(p_token text)
returns jsonb
language plpgsql security definer
set search_path = flcsmaps, public
as $$
declare
  dl flcsmaps.deel_links%rowtype;
  pl flcsmaps.plannen%rowtype;
  met_notities boolean;
  lev text;
  met_attesten boolean;
  verb_el text[];   -- verborgen bibliotheek-elementen (plan + link)
  verb_it text[];   -- verborgen losse items (link)
  verb_soort text[]; -- verborgen soorten eigen tekeningen zonder element (link)
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select * into dl from flcsmaps.deel_links
   where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found then return null; end if;
  select * into pl from flcsmaps.plannen where id = dl.plan_id;
  if not found then return null; end if;

  update flcsmaps.deel_links set keer_geopend = keer_geopend + 1 where id = dl.id;
  met_notities := coalesce((dl.opties->>'notities')::boolean, false);
  lev := coalesce(dl.opties->>'leverancier', '');
  met_attesten := coalesce((dl.opties->>'attesten')::boolean, true);
  verb_el := array(select jsonb_array_elements_text(coalesce(pl.instellingen->'verborgen_elementen', '[]'::jsonb))
                   union select jsonb_array_elements_text(coalesce(dl.opties->'verberg_elementen', '[]'::jsonb)));
  verb_it := array(select jsonb_array_elements_text(coalesce(dl.opties->'verberg_items', '[]'::jsonb)));
  verb_soort := array(select jsonb_array_elements_text(coalesce(dl.opties->'verberg_soorten', '[]'::jsonb)));

  return jsonb_build_object(
    'link', jsonb_build_object('id', dl.id, 'naam', dl.naam, 'opties', dl.opties),
    'plan', jsonb_build_object('id', pl.id, 'naam', pl.naam, 'editie_naam', pl.editie_naam,
                               'locatie', pl.locatie, 'centrum', pl.centrum, 'zoom', pl.zoom,
                               'basiskaart', pl.basiskaart, 'versie', pl.versie,
                               'titelblok', pl.titelblok, 'updated_at', pl.updated_at,
                               'instellingen', jsonb_build_object('verborgen_elementen', to_jsonb(verb_el))),
    'lagen', coalesce((select jsonb_agg(to_jsonb(l) order by l.volgorde)
                         from flcsmaps.lagen l
                        where l.plan_id = pl.id and l.id = any(dl.laag_ids)), '[]'),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                           'id', i.id, 'laag_id', i.laag_id, 'element_id', i.element_id,
                           'soort', i.soort, 'geometrie', i.geometrie, 'parameters', i.parameters,
                           'stijl', i.stijl, 'naam', i.naam,
                           'notitie', case when met_notities then i.notitie end,
                           'velden', case when met_notities then i.velden
                                          when met_attesten and i.velden ? 'attesten' then jsonb_build_object('attesten', i.velden->'attesten')
                                          else '{}'::jsonb end))
                         from flcsmaps.items i
                        where i.plan_id = pl.id and not i.verborgen
                          and i.laag_id = any(dl.laag_ids)
                          and (lev = '' or exists (select 1 from flcsmaps.bibliotheek b2 where b2.id = i.element_id and b2.leverancier = lev))
                          and (dl.fase_ids is null or cardinality(dl.fase_ids) = 0
                               or i.fase_ids is null or i.fase_ids && dl.fase_ids)
                          and not (i.id::text = any(verb_it))
                          and not (i.element_id is not null and i.element_id::text = any(verb_el))
                          and not (i.element_id is null and i.soort = any(verb_soort))), '[]'),
    'elementen', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'naam', b.naam, 'categorie', b.categorie,
                           'tekenwijze', b.tekenwijze, 'breedte_m', b.breedte_m, 'diepte_m', b.diepte_m,
                           'eenheid_m', b.eenheid_m, 'stijl', b.stijl, 'icoon', b.icoon))
                         from flcsmaps.bibliotheek b
                        where not (b.id::text = any(verb_el)) and b.id in (select i.element_id from flcsmaps.items i
                                        where i.plan_id = pl.id and i.laag_id = any(dl.laag_ids)
                                          and (lev = '' or exists (select 1 from flcsmaps.bibliotheek b2 where b2.id = i.element_id and b2.leverancier = lev)))), '[]'),
    'opmerkingen', case when coalesce((dl.opties->>'opmerkingen')::boolean, false) then
                     coalesce((select jsonb_agg(jsonb_build_object('item_id', o.item_id, 'auteur', coalesce(o.auteur_naam, 'FLCS'),
                                                                   'tekst', o.tekst, 'status', o.status, 'op', o.created_at)
                                                order by o.created_at)
                                 from flcsmaps.opmerkingen o
                                 join flcsmaps.items i on i.id = o.item_id
                                where i.plan_id = pl.id and i.laag_id = any(dl.laag_ids) and not i.verborgen
                                  and not (i.id::text = any(verb_it))
                                  and not (i.element_id is not null and i.element_id::text = any(verb_el))), '[]')
                   else '[]'::jsonb end
  );
end $$;


revoke all on function flcsmaps.deel_link_lezen(text) from public;
grant execute on function flcsmaps.deel_link_lezen(text) to anon, authenticated, service_role;
