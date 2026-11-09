-- FLCS Maps 029: één lijst met categorieën (bibliotheek = leveranciers) en een centrale leverancierslijst.
-- Bron: Flanders_Classics_Leverancierslijst.xlsx (71 rijen, 69 leveranciers). Een leverancier heeft één of meer
-- categorieën uit dezelfde lijst als de bibliotheek. Bibliotheek en items verwijzen op naam (uniek).

-- 1. Categorieën van de bibliotheek gelijkgetrokken met de leverancierslijst.
update flcsmaps.bibliotheek set categorie = 'Tenten en vloeren' where categorie = 'Tenten';
update flcsmaps.bibliotheek set categorie = 'Doeken en drukwerk' where categorie in ('Doeken', 'Communicatie');
update flcsmaps.bibliotheek set categorie = 'Data en telecom' where categorie = 'Telecom';
update flcsmaps.bibliotheek set categorie = 'Licht en geluid' where categorie = 'Verlichting';
update flcsmaps.bibliotheek set categorie = 'Vervoer' where categorie = 'Voertuigen';

-- 2. Leverancierslijst.
create table if not exists flcsmaps.leveranciers (
  id           uuid primary key default gen_random_uuid(),
  naam         text not null unique check (length(btrim(naam)) between 1 and 120),
  soort        text not null default 'extern' check (soort in ('extern', 'eigen', 'stad')),
  categorieen  text[] not null default '{}',
  regios       text[] not null default '{}',
  gemeente     text,
  contactpersoon text,
  email        text,
  email2       text,
  telefoon     text,
  projecten    text,
  opmerkingen  text,
  actief       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table flcsmaps.leveranciers enable row level security;
grant select, insert, update, delete on flcsmaps.leveranciers to authenticated;
grant select, insert, update, delete on flcsmaps.leveranciers to service_role;
drop policy if exists leveranciers_lezen on flcsmaps.leveranciers;
create policy leveranciers_lezen on flcsmaps.leveranciers for select to authenticated using (flcsmaps.mag_lezen());
drop policy if exists leveranciers_maken on flcsmaps.leveranciers;
create policy leveranciers_maken on flcsmaps.leveranciers for insert to authenticated with check (flcsmaps.mag_schrijven());
drop policy if exists leveranciers_wijzigen on flcsmaps.leveranciers;
create policy leveranciers_wijzigen on flcsmaps.leveranciers for update to authenticated using (flcsmaps.mag_schrijven()) with check (flcsmaps.mag_schrijven());
drop policy if exists leveranciers_wissen on flcsmaps.leveranciers;
create policy leveranciers_wissen on flcsmaps.leveranciers for delete to authenticated using (flcsmaps.mag_beheren());
drop trigger if exists leveranciers_updated on flcsmaps.leveranciers;
create trigger leveranciers_updated before update on flcsmaps.leveranciers for each row execute function flcsmaps.zet_updated_at();

-- 3. Namen gelijkgetrokken (dubbels en tikfouten).
update flcsmaps.bibliotheek set leverancier = 'Vidi Square' where leverancier = 'Vidisquare';
update flcsmaps.bibliotheek set leverancier = 'SportLED' where leverancier = 'Sportled';
update flcsmaps.bibliotheek set leverancier = 'Nima Rent' where leverancier = 'NIMA Rent';
update flcsmaps.items set velden = jsonb_set(velden, '{herkomst}', '"D&D"') where velden->>'herkomst' = 'D&';

-- 4. Leveranciers uit de Excel.
insert into flcsmaps.leveranciers (naam, categorieen, regios, gemeente, contactpersoon, email, email2, telefoon, projecten, opmerkingen)
values
('Vanheede',array['Afval']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Diverse',null,'sales.services@vanheede.com',null,null,'IFF',null),
('GRCT',array['Afval']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Herenthout',null,'Info@grct.be',null,'+32 14 25 50 15','RVV',null),
('BERT Containers',array['Afval']::text[],array['O-VL','W-VL']::text[],'Oudenaarde',null,'verkoop@devreese-recycling.be','sander@devreese-recycling.be','055/33 48 11 (alg. nr > vragen naar Sander)','RVV',null),
('De Bree Solutions',array['Afval']::text[],array['O-VL','W-VL']::text[],'Maldegem',null,'info@debree.be',null,'050 72 87 30','IFF',null),
('Remondis West-Vlaanderen',array['Afval']::text[],array['O-VL','W-VL']::text[],'Oostende','Thiery Lefevere','Thierry.lefevere@remondis.com',null,'+ 32 491 37 13 30','Wevelgem',null),
('Movico',array['Mobiele structuren']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Deurne (NL)','Stan Koolen','stan.koolen@movico.n',null,null,'Road',null),
('Eurotech',array['Mobiele structuren']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Maasbree (NL)','Wim Noorman','noorman@noorhold.nl',null,null,'Road',null),
('EasyPayment',array['Andere']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Denderhoutem','Fredrik Van Hulle','fredrik@easypayments.be',null,'+32 93 94 13 94','UCI Cyclo-Cross World Cup',null),
('De Wilg',array['Vervoer']::text[],array['LIM']::text[],'Bree','Julie Gourmand','offerte@dewilg.be',null,'089 480 880','CX Zonhoven','Shuttle bussen publiek, type De Lijn'),
('De Zigeuner',array['Vervoer']::text[],array['LIM']::text[],'Diepenbeek','Laurens Geraerts','z-coach@dezigeuner.com',null,'011 35 04 04','CX Zonhoven, RVL',null),
('Mebis De Lijn',array['Vervoer']::text[],array['LIM']::text[],'Hasselt','Katrien','mebis.delijn@hansea.be',null,'011/293073','CX Zonhoven','Shuttle bussen publiek, type De Lijn'),
('Umami',array['Catering']::text[],array['ANT','VB','LIM']::text[],'Genk','Guy Winten','Guy.Winten@Umamicatering.be',null,'+32 475 80 69 13','EK, Zonhoven, Maasmechelen, RVL','Lunchpakketjes, warme catering'),
('SafetyCom',array['Data en telecom']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Genk','Sam Broux','info@safetycom.be',null,'+32 497 45 60 40','CX',null),
('CityMesh',array['Data en telecom']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Oostkamp','Julie Mestdagh','julie.mestdagh@citymesh.com',null,'+32 477 92 94 82','CX, Road',null),
('Proximus lijnen',array['Data en telecom']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Diverse','Katleen De Schepper','cso.katleen.de.schepper@proximus.com',null,'+ 32 2 819 33 32','CX, Road',null),
('UNIT-T / Telenet lijnen',array['Data en telecom']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Mechelen','Danny Buelens','events@unit-t.eu',null,'+32 497514009','Zonhoven',null),
('M Janssens',array['Doeken en drukwerk']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Melsele','Marc Janssens','marc@drukkerij-mjanssens.be',null,null,'CX','Parkingkaarten, badges, stickers'),
('MPH',array['Doeken en drukwerk']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Evergem','Stefaan Van De Wiele','stefaan@mph.eu',null,'+32 (0)472 94 19 19',null,null),
('Creafor',array['Doeken en drukwerk']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Lokeren','Andreas Foriers','andreas@creafor.be',null,null,null,'Parkingkaarten, badges, stickers'),
('Intermetal Motor',array['Elektriciteit','Verwarming']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Wielsbeke','Dédé Vandekerckhove','sales@intermetal-motor.be',null,'+32 56 67 10 35','GW, CX',null),
('Gijsels',array['Elektriciteit']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Lier','Amber Gijsels','info@aggregaten-verhuur.be',null,null,'EK, WK Ronse, CX',null),
('Boldt',array['Elektriciteit']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Heusden-Zolder','Jeffrey Timmermans','jeffrey@boldt.tech',null,'011 28 77 34','CX, RVL',null),
('The Powershop',array['Elektriciteit']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Rotselaar',null,'rental@thepowershop.eu',null,null,'RVV',null),
('Engelen Events',array['Hekken en afsluitingen']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Nederlands Limburg','Arnaud Drehmanns','info@engelenevents.com',null,'+31 475 46 84 18','CX',null),
('Onsite',array['Hekken en afsluitingen']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],null,null,'steven@onsitegroup.be',null,'+32 38 87 30 88',null,null),
('Dreamsupport',array['Hekken en afsluitingen','Toiletten']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Rijkevorsel','Ann','info@dreamsupport.be',null,'+32 32 91 78 51','Overijse, Antwerpen',null),
('Levi',array['Meubilair']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Merelbeke','Stephanie Van Duerm','info@levipartyrental.be',null,null,null,null),
('Nima Rent',array['Meubilair','Toiletten']::text[],array['O-VL','W-VL','ANT']::text[],'Ieper','Nicolas Six','nicolas@nimarent.be',null,'+32 497 44 83 86','GW',null),
('SVH',array['Meubilair']::text[],array['ANT','VB','LIM']::text[],'Mol','Steven Van Hoolst','steven@svh-productions.be',null,'+32 473 52 56 59','CX',null),
('AV Engineering',array['Podium']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Lanaken','Antoine Verhoeven','info@avgroep.be',null,null,'CX',null),
('SDL',array['Podium']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Hooglede',null,'info@sdl-event-trailer.be',null,'+32 477 50 69 08','BP, DDV',null),
('D-plates',array['Grondbescherming']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Waregem','Hélène Dobbels','helene@d-plates.be',null,'+32 478 61 12 19','GW, RVV, WK Ronse',null),
('Platex',array['Grondbescherming']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Beveren','Peggy Lambin','peggy@platex.be',null,'037756083','CX, RVV',null),
('Gova Trading',array['Grondbescherming']::text[],array['O-VL','W-VL']::text[],'Kruisem','Mathieu-Maxim Goossens','verhuur@govatrading.be',null,'+32 479 57 94 19',null,null),
('Rob Verhuur',array['Machines']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Diverse','Jurgen Huylebroeck','jurgen@robverhuur.be',null,'+32 478 93 90 37','CX, Road',null),
('TVH',array['Machines']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Diverse','Kurt Vaneeckhoute','kurt.vaneeckhoute@tvhequipment.com',null,'+32 471 65 20 15','EK, CX',null),
('Vidi Square',array['Schermen']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Zandhoven','Pascal Willekens','pascal.willekens@vidisquare.be',null,null,'Road, 1000 km',null),
('Triledgy',array['Schermen']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Hoogstraten','Reinaart Moorkens','Reinaart@triledgy.com',null,'+32 472 24 59 04','CX',null),
('ACEG',array['Schermen']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Grimbergen','Maxim Engels','maxim@aceg.be',null,'+32 471 51 23 18','Diverse',null),
('Mundo Security',array['Beveiliging']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Brugge','Sven De Weger','Sven@Mundo-security.be',null,'+32 469 15 21 23','CX, Voorjaar',null),
('G4S',array['Beveiliging']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Vilvoorde','David Vandenhaesevelde','david.vandenhaesevelde@be.g4s.com',null,'+32 479 71 47 37','CX, Voorjaar',null),
('Maat Security',array['Beveiliging']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Lummen','Kathy Borgonjon','Borgonjon@maatsecurity.be',null,'+32 2 486 03 30','CX, Voorjaar',null),
('VestaGuard Security',array['Beveiliging']::text[],array['O-VL','W-VL']::text[],'Izegem','Jorn Dauwens','jorn@vestaguard.be',null,'+32 489 90 58 30','WK G-wielrennen',null),
('Gigant',array['Stellingbouw']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Eersel (NL)','Tom Tops','tomtops@gigantinternational.com',null,'+32 (0)476 269 290','CX, EK, WK',null),
('VSS',array['Stellingbouw']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Lummen','Kevin Vanhaeren','kevin@vss-lummen.be',null,'+32 473 34 11 63','CX',null),
('Sky Steigers',array['Stellingbouw']::text[],array['O-VL','W-VL']::text[],'Aartrijke','Romy Decoster','info@skysteigers.be',null,'+32 050 95 02 00','RVV',null),
('EFC',array['Tenten en vloeren']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Zwevegem','Nico Huygelier','nico@expofloorcoverings.com',null,null,'RVV, GW',null),
('Cover Flooring',array['Tenten en vloeren']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Dendermonde','Wannes De Ridder','wannes@coverflooring.com',null,'+32 (0) 474 54 57 60','RVV, GW',null),
('Eventfloors',array['Tenten en vloeren']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Zaventem','Tim Fontaine','timfontaine3@hotmail.com',null,null,'Zonhoven','Geen plaatsing'),
('Atention bv.',array['Tenten en vloeren']::text[],array['O-VL','W-VL']::text[],'Waregem','Jan De Frenne','jan@atention.be',null,'0475/61 98 79','RVV',null),
('Delta Tenten',array['Tenten en vloeren']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Kessel','Ariane','info@deltatenten.be',null,'034 81 93 32','CX',null),
('BHV Tenten',array['Tenten en vloeren']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Wernhout (NL)',null,'info@bhvexpo.com',null,'+32 3 22 73 161','VIP''s',null),
('Party Professionals bv',array['Tenten en vloeren']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Holsbeek','David Decuber','david@decuber.be',null,'+32 16 29 15 47','RVV',null),
('Theybers',array['Tenten en vloeren']::text[],array['ANT','VB','LIM']::text[],'Kinrooi','Danny Theybers','danny.theybers@telenet.be',null,null,'CX',null),
('Tenten Vannieuwenhuyse',array['Tenten en vloeren']::text[],array['O-VL','W-VL']::text[],'Ingelmunster','Jeroen Vannieuwenhuyse','jeroen@tentenvannieuwenhuyze.be',null,'+32 477 80 57 52','WK G-wielrennen','zeer flexibel en ons uit de nood geholpen'),
('Eventinators',array['Tenten en vloeren']::text[],array['O-VL','W-VL']::text[],'Brugge','Natasja','info@eventinators.be',null,'+32 494 62 00 75','GW',null),
('Sesam Events',array['Tenten en vloeren']::text[],array['ANT','VB','LIM']::text[],'Westerlo','Jan Caers','jan.junior@sesam.events',null,null,'CX Stretch tent De Ceuster',null),
('Chris Tentenverhuur',array['Tenten en vloeren']::text[],array['O-VL']::text[],'Grembergen',null,'info@christentenverhuur.be',null,'+32(0)477 67 13 71',null,null),
('GSV Verhuur',array['Toiletten']::text[],array['ANT','VB','LIM']::text[],'Dessel','Sim Helsen','sim@g-s-v.be',null,null,'CX',null),
('Toiletwereld',array['Toiletten']::text[],array['ANT','VB','LIM']::text[],'Kalmthout','Hans Antonissen','info@toiletwereld.be',null,null,null,null),
('Toekoer Toilets',array['Toiletten']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Eernegem',null,'info@toekoertoilets.be',null,'+32 494 12 15 56','Gavere, Best of Limburg',null),
('Dixi',array['Toiletten']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Diverse',null,'info@dixi.be',null,null,null,null),
('Liekens',array['Toiletten']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Arendonk',null,'info@liekens.be',null,null,null,null),
('Boels',array['Toiletten']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Diverse',null,null,null,null,null,null),
('SOS Renting',array['Toiletten']::text[],array['O-VL','W-VL']::text[],'Zeebrugge','Nicola Dobbelaere','info@sosrenting.be',null,'050 67 34 70','RVV Cyclo',null),
('Warsco',array['Units en containers']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Diverse','Geert Hoste','geert.hoste@warsco.eu',null,null,'RVV, GW, OHN',null),
('Algeco',array['Units en containers']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Diverse','Ilse Cruysberghs','ilse.cruysberghs@algeco.com',null,null,'RVV','Prijs is vaak hoog'),
('Rob Units',array['Units en containers']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Lochristi',null,'Info@robverhuur.be',null,null,'GW, OHN',null),
('Remotec',array['Wegmarkering']::text[],array['O-VL','W-VL','ANT','VB','LIM']::text[],'Deinze','Darcey Verheuge','darcey.verheuge@remotec.be',null,null,'Road','Finishlijn en logo''s')
on conflict (naam) do nothing;

-- 5. Wie in de bibliotheek of op een item staat maar niet in de Excel: enkel de naam.
insert into flcsmaps.leveranciers (naam, soort)
select distinct n, case when n ~* '^(stad|gemeente)( |$)' then 'stad' else 'extern' end from (
  select btrim(leverancier) n from flcsmaps.bibliotheek where coalesce(btrim(leverancier), '') <> ''
  union select btrim(velden->>'herkomst') from flcsmaps.items where coalesce(btrim(velden->>'herkomst'), '') <> ''
) x on conflict (naam) do nothing;
insert into flcsmaps.leveranciers (naam, soort, opmerkingen) values
  ('FLCS', 'eigen', 'Eigen materiaal uit het magazijn'),
  ('Gemeente', 'stad', 'Materiaal van de stad of gemeente')
on conflict (naam) do nothing;

-- Categorieën aanvullen met wat ze in de bibliotheek leveren.
update flcsmaps.leveranciers l set categorieen = (
  select array(select distinct c from unnest(l.categorieen || coalesce((select array_agg(distinct b.categorie) from flcsmaps.bibliotheek b
    where b.leverancier = l.naam and b.actief and b.categorie not in ('Binnenruimte', 'Huismateriaal', 'Sjablonen')), '{}')) c order by c));

-- 6. Hernoemen: lijst, bibliotheek, items en standaardleveranciers van plannen in één keer.
create or replace function flcsmaps.leverancier_hernoem(p_oud text, p_nieuw text) returns integer
language plpgsql security definer set search_path = flcsmaps, public as $$
declare n integer := 0; k integer;
begin
  if not flcsmaps.mag_schrijven() then raise exception 'Geen schrijfrechten'; end if;
  p_nieuw := btrim(p_nieuw);
  if coalesce(p_nieuw, '') = '' or p_oud = p_nieuw then return 0; end if;
  if exists (select 1 from flcsmaps.leveranciers where naam = p_nieuw) then raise exception 'Er bestaat al een leverancier "%"', p_nieuw; end if;
  update flcsmaps.leveranciers set naam = p_nieuw where naam = p_oud;
  update flcsmaps.bibliotheek set leverancier = p_nieuw where leverancier = p_oud; get diagnostics k = row_count; n := n + k;
  update flcsmaps.items set velden = jsonb_set(velden, '{herkomst}', to_jsonb(p_nieuw)) where velden->>'herkomst' = p_oud; get diagnostics k = row_count; n := n + k;
  update flcsmaps.plannen p set instellingen = jsonb_set(p.instellingen, '{leveranciers}',
    (select jsonb_object_agg(e.key, case when e.value #>> '{}' = p_oud then to_jsonb(p_nieuw) else e.value end) from jsonb_each(p.instellingen->'leveranciers') e))
   where jsonb_typeof(p.instellingen->'leveranciers') = 'object' and exists (select 1 from jsonb_each_text(p.instellingen->'leveranciers') e where e.value = p_oud);
  return n;
end $$;
revoke all on function flcsmaps.leverancier_hernoem(text, text) from public;
grant execute on function flcsmaps.leverancier_hernoem(text, text) to authenticated;
