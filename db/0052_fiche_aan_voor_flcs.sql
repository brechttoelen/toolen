-- ============================================================================
-- Toolen · 0052_fiche_aan_voor_flcs.sql
-- De projectfiche aanzetten voor Flanders Classics (eerste uitrol). Andere organisaties krijgen
-- de module pas via hun pakket of de beheerder van Toolen.
-- ============================================================================
update maps.organisaties set modules = array_append(modules, 'fiche')
 where slug = 'flcs' and not ('fiche' = any (modules));
