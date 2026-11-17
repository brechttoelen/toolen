-- ============================================================================
-- Toolen · 0049_fiche_flcs_start.sql
-- Startgegevens voor Flanders Classics: vennootschappen uit de projectfiches en
-- laadbronnen. De module 'fiche' wordt pas aangezet bij de uitrol van de app.
-- ============================================================================

insert into maps.vennootschappen (organisatie_id, naam, btw, adres, factuur_email)
select o.id, v.naam, v.btw, v.adres, v.mail
  from maps.organisaties o,
       (values ('Flanders Classics NV', 'BE 0818.388.802', 'Harensesteenweg 228, 1800 Vilvoorde', 'facturen@flandersclassics.be'),
               ('Renners in aantocht VZW (RIA)', 'BE 0820.796.578', 'Harensesteenweg 228, 1800 Vilvoorde', 'facturen@rennersinaantocht.be'),
               ('Verenigde Veldritorganisatoren VZW', 'BE 0423.604.245', 'August De Boeckstraat 1/5, 9100 Sint-Niklaas', 'finance@superprestige.org'),
               ('Koninklijke Veloclub Het Vliegend Wiel VZW', 'BE 0458.719.136', 'Vanackerestraat 31, 8560 Wevelgem', 'facturen@gent-wevelgem.be')) v(naam, btw, adres, mail)
 where o.slug = 'flcs'
on conflict (organisatie_id, naam) do nothing;

insert into maps.laad_bronnen (organisatie_id, naam, brengt_tekst, uitleg, volgorde)
select o.id, b.naam, b.brengt, b.uitleg, b.v
  from maps.organisaties o,
       (values ('Magazijn Vilvoorde', 'Eigen bus', 'Pakken in het magazijn', 1),
               ('Kantoor Vilvoorde', 'Eigen bus', null, 2),
               ('Opslag bij ET', 'ET Productions', 'Eigen materiaal dat bij ET ligt', 3),
               ('Gemeente', 'Gemeente', 'Uit het magazijn van de gemeente', 4)) b(naam, brengt, uitleg, v)
 where o.slug = 'flcs'
on conflict (organisatie_id, naam) do nothing;

update maps.laad_bronnen b set leverancier_id = l.id
  from maps.leveranciers l
 where l.organisatie_id = b.organisatie_id and b.naam = 'Opslag bij ET' and b.leverancier_id is null
   and lower(l.naam) in ('et productions', 'et', 'et-productions');
