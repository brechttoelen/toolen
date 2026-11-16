-- 0042 · Brug: de hoogste rol in het toegangsbeheer van de organisatie wordt eigenaar
--
-- Rollen uit de hub: viewer = lezer, editor = bewerker, admin = beheerder, superadmin = eigenaar.
-- brug_lid_zetten aanvaardt daarom ook 'eigenaar'. Wie in Toolen al eigenaar is, wordt door de hub nooit verlaagd
-- (er moet altijd een eigenaar blijven); dat doe je zelf bij Leden.

do $do$
declare v text;
begin
  v := replace(pg_get_functiondef('maps.brug_lid_zetten(text,text,text)'::regprocedure),
               $$if p_rol not in ('beheerder', 'bewerker', 'lezer')$$,
               $$if p_rol not in ('eigenaar', 'beheerder', 'bewerker', 'lezer')$$);
  execute v;
end $do$;
