-- 0032 · Beelden uit FLCS Maps wezen naar /flcsmaps/... (de public-map van Publitool). In Toolen heten die /m/...
-- Sinds Publitool /flcsmaps doorstuurt, laadden die doeken, vlaggen, borden en iconen niet meer.
alter table maps.bibliotheek disable trigger user;
update maps.bibliotheek set eigenschappen = replace(eigenschappen::text, '"/flcsmaps/', '"/m/')::jsonb,
  stijl = case when stijl is null then null else replace(stijl::text, '"/flcsmaps/', '"/m/')::jsonb end,
  icoon = case when icoon like '/flcsmaps/%' then '/m/' || substr(icoon, 11) else icoon end
 where eigenschappen::text like '%"/flcsmaps/%' or stijl::text like '%"/flcsmaps/%' or icoon like '/flcsmaps/%';
alter table maps.bibliotheek enable trigger user;
alter table maps.plannen disable trigger user;
update maps.plannen set instellingen = replace(instellingen::text, '"/flcsmaps/', '"/m/')::jsonb,
  titelblok = case when titelblok is null then null else replace(titelblok::text, '"/flcsmaps/', '"/m/')::jsonb end
 where instellingen::text like '%"/flcsmaps/%' or titelblok::text like '%"/flcsmaps/%';
alter table maps.plannen enable trigger user;
