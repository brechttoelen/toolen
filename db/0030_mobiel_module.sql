-- ============================================================================
-- Toolen · 0030_mobiel_module.sql
-- De gsm-app (/maps/mobiel) is een module. Zonder module toont de gsm een scherm
-- dat de app niet in het pakket zit. Bestaande organisaties en de pakketten
-- Proef, Organisatie en Maatwerk krijgen ze meteen.
-- Terugdraaien: 'mobiel' uit module_ids, pakketten en organisaties halen.
-- ============================================================================

create or replace function maps.module_ids() returns text[]
language sql immutable set search_path = '' as $$
  select array['stroom','signalisatie','stelling','branding','veiligheid','binnen','groot','terrein','leveranciers','integraties','huisstijl','feedback','mobiel','stock','gridlab'];
$$;

update maps.pakketten set modules = array_append(modules, 'mobiel')
 where id in ('proef', 'organisatie', 'maatwerk') and not ('mobiel' = any (modules));

update maps.organisaties set modules = array_append(modules, 'mobiel')
 where status <> 'verwijderd' and not ('mobiel' = any (modules));
