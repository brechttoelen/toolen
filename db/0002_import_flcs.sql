-- ============================================================================
-- Toolen · 0002_import_flcs.sql
-- Project: toolen (hlpurcdeouegvphvwygu). Draai dit in de SQL Editor van TOOLEN.
--
-- Kopieert FLCS Maps uit het Publitool-project (vojkrpenkqsphaflsdfh, schema flcsmaps)
-- naar de organisatie flcs in Toolen. De FLCS-databank wordt enkel gelezen: Publitool
-- blijft gewoon werken.
--
-- Vooraf:
--   * 0001_basis.sql is uitgevoerd en de organisatie flcs bestaat, met jou als eigenaar.
--   * In het Publitool-project: Connect → Session pooler → host en gebruiker overnemen
--     (host bv. aws-0-eu-central-1.pooler.supabase.com, gebruiker postgres.vojkrpenkqsphaflsdfh).
--   * Het databankwachtwoord van het Publitool-project (Database settings).
--
-- Vul hieronder HOST en WACHTWOORD in (stap 1). Het wachtwoord wordt in stap 4 weer
-- verwijderd, samen met de verbinding.
--
-- Mag opnieuw gedraaid worden: stap 2 wist eerst wat een vorige import van flcs neerzette.
-- ============================================================================

-- 1. Tijdelijke verbinding met de FLCS-databank ---------------------------------
create extension if not exists postgres_fdw;
drop server if exists flcs_bron cascade;
create server flcs_bron foreign data wrapper postgres_fdw
  options (host 'HOST', port '5432', dbname 'postgres', sslmode 'require');
create user mapping for current_user server flcs_bron
  options (user 'postgres.vojkrpenkqsphaflsdfh', password 'WACHTWOORD');

drop schema if exists flcs_bron cascade;
create schema flcs_bron;
import foreign schema flcsmaps from server flcs_bron into flcs_bron;
create foreign table flcs_bron.opslag (name text, bucket_id text)
  server flcs_bron options (schema_name 'storage', table_name 'objects');

-- 2. Import ---------------------------------------------------------------------
begin;

create temp table imp_org on commit drop as select id from maps.organisaties where slug = 'flcs';
do $$ begin
  if (select count(*) from imp_org) <> 1 then raise exception 'Organisatie flcs bestaat niet: eerst aanmaken (zie LEESMIJ).'; end if;
end $$;

-- Oude gebruikers → nieuwe: op e-mailadres; beide accounts van Brecht naar zijn Toolen-account.
create temp table imp_wie (oud uuid primary key, nieuw uuid) on commit drop;
insert into imp_wie
select t.user_id, u.id from flcs_bron.toegang t join auth.users u on lower(u.email) = lower(t.email)
on conflict do nothing;
insert into imp_wie
select t.user_id, (select id from auth.users where lower(email) = 'brecht.toelen@start-box.be')
  from flcs_bron.toegang t where lower(t.email) in ('brecht.toelen@flandersclassics.be', 'brecht.toelen@start-box.be')
on conflict (oud) do update set nieuw = excluded.nieuw;

create function pg_temp.wie(u uuid) returns uuid language sql stable as
  $$ select coalesce((select nieuw from imp_wie where oud = u), u) $$;
-- Volledige adressen naar de FLCS-opslag → Toolen-opslag.
create function pg_temp.url(j jsonb) returns jsonb language sql immutable as
  $$ select replace(j::text, 'https://vojkrpenkqsphaflsdfh.supabase.co/storage/v1/object/public/flcsmaps/',
                              'https://hlpurcdeouegvphvwygu.supabase.co/storage/v1/object/public/maps/')::jsonb $$;

-- Een vorige import van flcs opruimen (alles van de organisatie flcs in de Maps-tabellen).
alter table maps.items disable trigger user;
alter table maps.plannen disable trigger user;
delete from maps.feedback            where organisatie_id = (select id from imp_org);
delete from maps.items_prullenbak    where organisatie_id = (select id from imp_org);
delete from maps.vaste_aansluitingen where organisatie_id = (select id from imp_org);
delete from maps.leveranciers        where organisatie_id = (select id from imp_org);
delete from maps.items               where organisatie_id = (select id from imp_org);
delete from maps.bibliotheek         where organisatie_id = (select id from imp_org);
delete from maps.plannen             where organisatie_id = (select id from imp_org);
delete from maps.plekken             where organisatie_id = (select id from imp_org);
delete from maps.wijzigingen         where organisatie_id = (select id from imp_org);

-- Triggers uit tijdens de import (organisatie, rev, logboek, nummering en prullenbak
-- worden hier rechtstreeks overgenomen).
alter table maps.plekken disable trigger user;
alter table maps.bibliotheek disable trigger user;
alter table maps.lagen disable trigger user;
alter table maps.fasen disable trigger user;
alter table maps.versies disable trigger user;
alter table maps.deel_links disable trigger user;
alter table maps.opmerkingen disable trigger user;
alter table maps.bestanden disable trigger user;
alter table maps.leveranciers disable trigger user;
alter table maps.vaste_aansluitingen disable trigger user;
alter table maps.feedback disable trigger user;

insert into maps.plekken (organisatie_id, id, naam, kader, contacten, created_at)
select (select id from imp_org), id, naam, kader, contacten, created_at from flcs_bron.plekken;

insert into maps.plannen (organisatie_id, id, naam, editie_naam, edition_id, plek_id, locatie, centrum, zoom, basiskaart, status, versie,
                          titelblok, instellingen, aangemaakt_door, bewerkt_door, created_at, updated_at, rev, verwijderd_op, verwijderd_door)
select (select id from imp_org), id, naam, editie_naam, edition_id, plek_id, locatie, centrum, zoom, basiskaart, status, versie,
       pg_temp.url(titelblok), pg_temp.url(instellingen), pg_temp.wie(aangemaakt_door), pg_temp.wie(bewerkt_door), created_at, updated_at, rev,
       verwijderd_op, pg_temp.wie(verwijderd_door)
  from flcs_bron.plannen;

insert into maps.bibliotheek (organisatie_id, id, naam, categorie, tekenwijze, breedte_m, diepte_m, eenheid_m, hoogte_m, omtrek, stijl, icoon,
                              standaardlaag, leverancier, leverancier_id, artikel_id, eigenschappen, varianten, actief, created_at, updated_at,
                              plan_id, rev, familie)
select (select id from imp_org), id, naam, categorie, tekenwijze, breedte_m, diepte_m, eenheid_m, hoogte_m, omtrek, stijl, icoon,
       standaardlaag, leverancier, leverancier_id, artikel_id, pg_temp.url(eigenschappen), varianten, actief, created_at, updated_at,
       plan_id, rev, familie
  from flcs_bron.bibliotheek;

insert into maps.lagen (organisatie_id, id, plan_id, naam, kleur, stijl, zichtbaar, vergrendeld, printbaar, volgorde, rev, updated_at, map)
select (select id from imp_org), id, plan_id, naam, kleur, stijl, zichtbaar, vergrendeld, printbaar, volgorde, rev, updated_at, map
  from flcs_bron.lagen;

insert into maps.fasen (organisatie_id, id, plan_id, naam, van, tot, volgorde)
select (select id from imp_org), id, plan_id, naam, van, tot, volgorde from flcs_bron.fasen;

insert into maps.items (organisatie_id, id, plan_id, plek_id, laag_id, element_id, groep_id, soort, geometrie, parameters, stijl, naam, notitie,
                        velden, fase_ids, vergrendeld, verborgen, volgorde, geplaatst_op, geplaatst_door, bewerkt_door, created_at, updated_at, rev)
select (select id from imp_org), id, plan_id, plek_id, laag_id, element_id, groep_id, soort, geometrie, parameters, stijl, naam, notitie,
       pg_temp.url(velden), fase_ids, vergrendeld, verborgen, volgorde, geplaatst_op, pg_temp.wie(geplaatst_door), pg_temp.wie(bewerkt_door),
       created_at, updated_at, rev
  from flcs_bron.items;

insert into maps.items_prullenbak (organisatie_id, id, plan_id, plek_id, laag_id, element_id, groep_id, soort, geometrie, parameters, stijl, naam,
                                   notitie, velden, fase_ids, vergrendeld, verborgen, volgorde, geplaatst_op, geplaatst_door, bewerkt_door,
                                   created_at, updated_at, rev, verwijderd_op, verwijderd_door, teruggezet_op)
select (select id from imp_org), id, plan_id, plek_id, laag_id, element_id, groep_id, soort, geometrie, parameters, stijl, naam,
       notitie, pg_temp.url(velden), fase_ids, vergrendeld, verborgen, volgorde, geplaatst_op, pg_temp.wie(geplaatst_door), pg_temp.wie(bewerkt_door),
       created_at, updated_at, rev, verwijderd_op, pg_temp.wie(verwijderd_door), teruggezet_op
  from flcs_bron.items_prullenbak;

insert into maps.versies (organisatie_id, id, plan_id, versie, momentopname, opmerking, door, created_at)
select (select id from imp_org), id, plan_id, versie, pg_temp.url(momentopname), opmerking, pg_temp.wie(door), created_at
  from flcs_bron.versies;

insert into maps.deel_links (organisatie_id, id, plan_id, token, naam, laag_ids, fase_ids, opties, geldig_tot, ingetrokken_op, keer_geopend,
                             created_at, live, versie_id)
select (select id from imp_org), id, plan_id, token, naam, laag_ids, fase_ids, opties, geldig_tot, ingetrokken_op, keer_geopend,
       created_at, live, versie_id
  from flcs_bron.deel_links;

insert into maps.opmerkingen (organisatie_id, id, item_id, auteur_id, auteur_naam, deel_link_id, tekst, status, created_at, plan_id, punt)
select (select id from imp_org), o.id, o.item_id, pg_temp.wie(o.auteur_id), o.auteur_naam, o.deel_link_id, o.tekst, o.status, o.created_at, o.plan_id, o.punt
  from flcs_bron.opmerkingen o
 where o.item_id is null or exists (select 1 from maps.items i where i.id = o.item_id);

insert into maps.bestanden (organisatie_id, id, plan_id, item_id, soort, pad, meta, created_at)
select (select id from imp_org), b.id, b.plan_id, b.item_id, b.soort, b.pad, b.meta, b.created_at
  from flcs_bron.bestanden b
 where b.item_id is null or exists (select 1 from maps.items i where i.id = b.item_id);

insert into maps.leveranciers (organisatie_id, id, naam, soort, categorieen, regios, gemeente, contactpersoon, email, email2, telefoon, projecten,
                               opmerkingen, actief, created_at, updated_at)
select (select id from imp_org), id, naam, soort, categorieen, regios, gemeente, contactpersoon, email, email2, telefoon, projecten,
       opmerkingen, actief, created_at, updated_at
  from flcs_bron.leveranciers;

insert into maps.vaste_aansluitingen (organisatie_id, id, naam, soort, beheerder, gemeente, adres, geometrie, uitgangen, max_ampere, kva, sleutel,
                                      contact, ean, foto, opmerking, laatst_gecontroleerd, actief, bron_item_id, aangemaakt_door, bewerkt_door,
                                      created_at, updated_at)
select (select id from imp_org), id, naam, soort, beheerder, gemeente, adres, geometrie, uitgangen, max_ampere, kva, sleutel,
       contact, ean, foto, opmerking, laatst_gecontroleerd, actief, bron_item_id, pg_temp.wie(aangemaakt_door), pg_temp.wie(bewerkt_door),
       created_at, updated_at
  from flcs_bron.vaste_aansluitingen;

insert into maps.feedback (organisatie_id, id, created_at, auteur_id, auteur_naam, soort, tekst, status, plan_id, item_id, deel_link_id, context,
                           schermafdruk, antwoord, afgehandeld_door, afgehandeld_op)
select (select id from imp_org), id, created_at, pg_temp.wie(auteur_id), auteur_naam, soort, tekst, status, plan_id, item_id, deel_link_id, context,
       schermafdruk, antwoord, pg_temp.wie(afgehandeld_door), afgehandeld_op
  from flcs_bron.feedback;

insert into maps.wijzigingen (organisatie_id, plan_id, tabel, rij_id, actie, rev, velden, door, op)
select (select id from imp_org), plan_id, tabel, rij_id, actie, rev, velden, pg_temp.wie(door), op
  from flcs_bron.wijzigingen order by id;

-- Triggers terug aan
alter table maps.plekken enable trigger user;
alter table maps.plannen enable trigger user;
alter table maps.bibliotheek enable trigger user;
alter table maps.lagen enable trigger user;
alter table maps.fasen enable trigger user;
alter table maps.items enable trigger user;
alter table maps.versies enable trigger user;
alter table maps.deel_links enable trigger user;
alter table maps.opmerkingen enable trigger user;
alter table maps.bestanden enable trigger user;
alter table maps.leveranciers enable trigger user;
alter table maps.vaste_aansluitingen enable trigger user;
alter table maps.feedback enable trigger user;

-- Lijst van de bestanden die nog gekopieerd moeten worden (beheerpagina /maps/beheer/import).
create table if not exists maps.import_bestanden (
  naam          text primary key,
  bron          text not null default 'flcs',
  gekopieerd_op timestamptz,
  fout          text
);
alter table maps.import_bestanden enable row level security;
drop policy if exists platform on maps.import_bestanden;
create policy platform on maps.import_bestanden for all to authenticated
  using (maps.is_platformbeheerder()) with check (maps.is_platformbeheerder());
grant select, update on maps.import_bestanden to authenticated;
insert into maps.import_bestanden (naam)
select name from flcs_bron.opslag where bucket_id = 'flcsmaps'
on conflict (naam) do nothing;

commit;

-- 3. Controle: aantallen FLCS (bron) tegenover Toolen ---------------------------
select t, bron, toolen, case when bron = toolen then 'ok' else 'VERSCHIL' end as stand from (
  select 'plannen' t, (select count(*) from flcs_bron.plannen) bron, (select count(*) from maps.plannen where organisatie_id = (select id from maps.organisaties where slug = 'flcs')) toolen
  union all select 'items', (select count(*) from flcs_bron.items), (select count(*) from maps.items where organisatie_id = (select id from maps.organisaties where slug = 'flcs'))
  union all select 'lagen', (select count(*) from flcs_bron.lagen), (select count(*) from maps.lagen where organisatie_id = (select id from maps.organisaties where slug = 'flcs'))
  union all select 'bibliotheek', (select count(*) from flcs_bron.bibliotheek), (select count(*) from maps.bibliotheek where organisatie_id = (select id from maps.organisaties where slug = 'flcs'))
  union all select 'versies', (select count(*) from flcs_bron.versies), (select count(*) from maps.versies where organisatie_id = (select id from maps.organisaties where slug = 'flcs'))
  union all select 'deel_links', (select count(*) from flcs_bron.deel_links), (select count(*) from maps.deel_links where organisatie_id = (select id from maps.organisaties where slug = 'flcs'))
  union all select 'leveranciers', (select count(*) from flcs_bron.leveranciers), (select count(*) from maps.leveranciers where organisatie_id = (select id from maps.organisaties where slug = 'flcs'))
  union all select 'bestanden_te_kopieren', (select count(*) from flcs_bron.opslag where bucket_id = 'flcsmaps'), (select count(*) from maps.import_bestanden)
) s;

-- 4. Verbinding en wachtwoord weer weg -------------------------------------------
drop schema flcs_bron cascade;
drop user mapping for current_user server flcs_bron;
drop server flcs_bron;
