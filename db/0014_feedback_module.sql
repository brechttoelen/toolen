-- ============================================================================
-- Toolen · 0014_feedback_module.sql
-- Project: toolen (hlpurcdeouegvphvwygu). Na 0013.
--
-- Feedback is een module: de knop "Feedback geven" en de lijst "Alle feedback" zie je enkel
-- als het platform ze aanzet. FLCS (testorganisatie) krijgt ze meteen.
-- Terugdraaien: 'feedback' uit module_ids en uit organisaties.modules halen.
-- ============================================================================

create or replace function maps.module_ids() returns text[]
language sql immutable set search_path = '' as $$
  select array['stroom','signalisatie','stelling','branding','veiligheid','binnen','groot','terrein','leveranciers','integraties','huisstijl','feedback','stock','gridlab'];
$$;

update maps.organisaties set modules = array_append(modules, 'feedback')
 where slug = 'flcs' and not ('feedback' = any (modules));
