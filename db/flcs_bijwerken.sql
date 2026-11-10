-- ============================================================================
-- FLCS bijwerken · plakken in de SQL Editor van TOOLEN → Run
-- ============================================================================
-- Haalt de laatste stand van FLCS Maps (Publitool-project, schema flcsmaps) op.
-- De eerste keer is dit de volledige import; daarna enkel wat in FLCS veranderde.
-- Wat in Toolen gemaakt werd (ontvangers, events, eigen plannen) blijft staan.
-- Zie db/0009_flcs_bijwerken.sql voor de regels.
--
-- Vul HOST en WACHTWOORD in:
--   Publitool-project → Connect → Session pooler: host (bv. aws-0-eu-central-1.pooler.supabase.com)
--   Publitool-project → Database settings: databankwachtwoord
-- Het wachtwoord staat enkel tijdens deze run in de databank en wordt op het einde verwijderd.
--
-- Gewijzigd in FLCS én in Toolen? Dan wordt dat plan overgeslagen (conflict).
-- Wil je dat FLCS toch wint: vervang hieronder flcs_bijwerken() door flcs_bijwerken(true).
-- ============================================================================

create extension if not exists postgres_fdw;
drop server if exists flcs_bron cascade;
create server flcs_bron foreign data wrapper postgres_fdw
  options (host 'HOST', port '5432', dbname 'postgres', sslmode 'require');
create user mapping for current_user server flcs_bron
  options (user 'postgres.vojkrpenkqsphaflsdfh', password 'WACHTWOORD');
-- Ook bij een fout (bv. verkeerd wachtwoord) loopt het script door tot de verbinding weer weg is.
drop table if exists pg_temp.bijgewerkt;
create temp table bijgewerkt (wat text, plan text, stand text);
drop schema if exists flcs_bron cascade;
create schema flcs_bron;
do $$
begin
  import foreign schema flcsmaps from server flcs_bron into flcs_bron;
  create foreign table flcs_bron.opslag (name text, bucket_id text)
    server flcs_bron options (schema_name 'storage', table_name 'objects');
  insert into bijgewerkt select * from maps.flcs_bijwerken();
exception when others then
  insert into bijgewerkt values ('FOUT', null, sqlerrm);
end $$;

drop schema flcs_bron cascade;
drop user mapping for current_user server flcs_bron;
drop server flcs_bron;

select * from bijgewerkt;
