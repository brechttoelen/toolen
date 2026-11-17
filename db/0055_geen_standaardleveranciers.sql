-- ============================================================================
-- Toolen · 0055_geen_standaardleveranciers.sql
-- Geen standaardleveranciers per categorie meer (plannen.instellingen.leveranciers): te veel uitzonderingen.
-- Wat nu via de standaard geleverd werd, wordt een eigen keuze op het item (velden.herkomst), zodat niets
-- verschuift. Daarna toewijzen per regel of per selectie in de materiaallijst.
-- De oude standaarden blijven bewaard in instellingen.leveranciers_oud (terugdraaien).
-- Uitgevoerd 17 nov 2026: 456 items in WK Oostende (enige plan met standaarden).
-- ============================================================================
with p as (
  select id, instellingen->'leveranciers' std from maps.plannen
   where jsonb_typeof(instellingen->'leveranciers') = 'object' and instellingen->'leveranciers' <> '{}'::jsonb)
update maps.items i
   set velden = jsonb_set(coalesce(i.velden, '{}'::jsonb), '{herkomst}', to_jsonb(p.std->>b.categorie))
  from p, maps.bibliotheek b
 where i.plan_id = p.id and b.id = i.element_id
   and coalesce(btrim(i.velden->>'herkomst'), '') = ''
   and coalesce(btrim(b.leverancier), '') = ''
   and coalesce(p.std->>b.categorie, '') <> '';

update maps.plannen
   set instellingen = (instellingen - 'leveranciers') || jsonb_build_object('leveranciers_oud', instellingen->'leveranciers')
 where jsonb_typeof(instellingen->'leveranciers') = 'object';
