-- Stellingbouwer: bibliotheekelement en deellink (velden.stelling, eigenschappen.stelling, doeken op stellingen).
-- Toegepast op 2026-11-03 via replace op de bestaande functie.
insert into flcsmaps.bibliotheek (naam, categorie, leverancier, tekenwijze, stijl, eigenschappen, actief)
select 'Stellingconstructie (bouwer: brug, podium, tribune)', 'Stellingbouw', 'Gigant', 'lijn', '{"kleur":"#6B4423","dikte":1}'::jsonb,
 '{"stelling": true, "subgroep": "Bruggen"}'::jsonb, true
where not exists (select 1 from flcsmaps.bibliotheek where eigenschappen->>'stelling' = 'true');
do $$
declare d text := pg_get_functiondef('flcsmaps.deel_link_lezen(text)'::regprocedure); n text;
begin
  if position('''camera'', ''stelling''' in d) > 0 then return; end if;
  n := replace(d, $a$'dichtheid', 'nr', 'camera')$a$, $a$'dichtheid', 'nr', 'camera', 'stelling')$a$);
  n := replace(n, $a$'stekkerdoos', 'generator')$a$, $a$'stekkerdoos', 'generator', 'stelling')$a$);
  execute n;
end $$;
-- (+ doeken uit velden.stelling.doeken[].voor bij de elementen, zie de toegepaste functie)
-- Deellink: ook eigenschappen.stelling3d (3D-voorbeeld van vaste stellingen uit de bibliotheek).
do $$
declare d text := pg_get_functiondef('flcsmaps.deel_link_lezen(text)'::regprocedure); n text;
begin
  if position('''stelling3d''' in d) > 0 then return; end if;
  n := replace(d, $a$'stekkerdoos', 'generator', 'stelling')$a$, $a$'stekkerdoos', 'generator', 'stelling', 'stelling3d')$a$);
  execute n;
end $$;
