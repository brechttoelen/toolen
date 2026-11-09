-- ============================================================================
-- FLCS MAPS — 002: deel-link per leverancier en zones voor Entry
-- Project: Publitool (flcs-pub, vojkrpenkqsphaflsdfh). Enkel schema flcsmaps.
--
-- 1. deel_link_lezen: als opties.leverancier gezet is, ziet de ontvanger enkel
--    de items van die leverancier (bibliotheek.leverancier), binnen de gekozen lagen.
-- 2. flcsmaps.entry_zones(edition_id): zones en parkings (items.velden.entry) van
--    de plannen van een editie, als GeoJSON. Voor Entry (lezen, met login).
--
-- Terugdraaien: 001 opnieuw uitvoeren voor deel_link_lezen;
--   drop function flcsmaps.entry_zones(text);
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

  return jsonb_build_object(
    'link', jsonb_build_object('id', dl.id, 'naam', dl.naam, 'opties', dl.opties),
    'plan', jsonb_build_object('id', pl.id, 'naam', pl.naam, 'editie_naam', pl.editie_naam,
                               'locatie', pl.locatie, 'centrum', pl.centrum, 'zoom', pl.zoom,
                               'basiskaart', pl.basiskaart, 'versie', pl.versie,
                               'titelblok', pl.titelblok, 'updated_at', pl.updated_at),
    'lagen', coalesce((select jsonb_agg(to_jsonb(l) order by l.volgorde)
                         from flcsmaps.lagen l
                        where l.plan_id = pl.id and l.id = any(dl.laag_ids)), '[]'),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                           'id', i.id, 'laag_id', i.laag_id, 'element_id', i.element_id,
                           'soort', i.soort, 'geometrie', i.geometrie, 'parameters', i.parameters,
                           'stijl', i.stijl, 'naam', i.naam,
                           'notitie', case when met_notities then i.notitie end,
                           'velden', case when met_notities then i.velden else '{}'::jsonb end))
                         from flcsmaps.items i
                        where i.plan_id = pl.id and not i.verborgen
                          and i.laag_id = any(dl.laag_ids)
                          and (lev = '' or exists (select 1 from flcsmaps.bibliotheek b2 where b2.id = i.element_id and b2.leverancier = lev))
                          and (dl.fase_ids is null or cardinality(dl.fase_ids) = 0
                               or i.fase_ids is null or i.fase_ids && dl.fase_ids)), '[]'),
    'elementen', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'naam', b.naam, 'categorie', b.categorie,
                           'tekenwijze', b.tekenwijze, 'breedte_m', b.breedte_m, 'diepte_m', b.diepte_m,
                           'eenheid_m', b.eenheid_m, 'stijl', b.stijl, 'icoon', b.icoon))
                         from flcsmaps.bibliotheek b
                        where b.id in (select i.element_id from flcsmaps.items i
                                        where i.plan_id = pl.id and i.laag_id = any(dl.laag_ids)
                                          and (lev = '' or exists (select 1 from flcsmaps.bibliotheek b2 where b2.id = i.element_id and b2.leverancier = lev)))), '[]'),
    'opmerkingen', case when coalesce((dl.opties->>'opmerkingen')::boolean, false) then
                     coalesce((select jsonb_agg(jsonb_build_object('item_id', o.item_id, 'auteur', coalesce(o.auteur_naam, 'FLCS'),
                                                                   'tekst', o.tekst, 'status', o.status, 'op', o.created_at)
                                                order by o.created_at)
                                 from flcsmaps.opmerkingen o
                                 join flcsmaps.items i on i.id = o.item_id
                                where i.plan_id = pl.id and i.laag_id = any(dl.laag_ids)), '[]')
                   else '[]'::jsonb end
  );
end $$;


revoke all on function flcsmaps.deel_link_lezen(text) from public;
grant execute on function flcsmaps.deel_link_lezen(text) to anon, authenticated, service_role;

create or replace function flcsmaps.entry_zones(p_edition_id text)
returns jsonb
language sql stable security definer
set search_path = flcsmaps, public
as $$
  select jsonb_build_object('type', 'FeatureCollection', 'features', coalesce(jsonb_agg(jsonb_build_object(
           'type', 'Feature', 'geometry', i.geometrie,
           'properties', jsonb_build_object('id', i.id, 'naam', i.naam, 'soort', i.velden->'entry'->>'soort',
                                            'niveau', i.velden->'entry'->>'niveau', 'plan', p.naam, 'plan_id', p.id,
                                            'fasen', (select coalesce(jsonb_agg(f.naam), '[]'::jsonb) from flcsmaps.fasen f where f.id = any(i.fase_ids))))), '[]'::jsonb))
    from flcsmaps.items i
    join flcsmaps.plannen p on p.id = i.plan_id
   where p.edition_id = p_edition_id
     and i.velden ? 'entry'
     and not i.verborgen
     and flcsmaps.mag_lezen();
$$;
revoke all on function flcsmaps.entry_zones(text) from public;
grant execute on function flcsmaps.entry_zones(text) to authenticated, service_role;
