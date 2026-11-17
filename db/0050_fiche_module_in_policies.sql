-- ============================================================================
-- Toolen · 0050_fiche_module_in_policies.sql
-- De policies van de fiche controleren de module met maps.org_heeft_module.
-- Die functie was enkel bruikbaar in triggers; ingelogde gebruikers moeten ze kunnen uitvoeren.
-- ============================================================================
grant execute on function maps.org_heeft_module(uuid, text) to authenticated;
