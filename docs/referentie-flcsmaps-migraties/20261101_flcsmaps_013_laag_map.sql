-- FLCS Maps: lagen in mappen groeperen (bv. map "Evenementieel" met de lagen die erbij horen).
alter table flcsmaps.lagen add column if not exists map text;
