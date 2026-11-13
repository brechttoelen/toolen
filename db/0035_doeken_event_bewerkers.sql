-- 0035 · Bewerkers mogen doeken voor een event toevoegen en wijzigen (enkel voor events waar ze toegang toe hebben).
-- Organisatiedoeken blijven voor beheerders.
drop policy if exists schrijven on maps.bibliotheek;
create policy schrijven on maps.bibliotheek for all to authenticated
using ((organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))))
    or ((organisatie_id in (select unnest(maps.mijn_organisaties('bewerker'))))
        and ((plan_id is not null) or (categorie = any (array['Sjablonen','Snelstijlen']))
             or (event_id is not null and maps.event_toegestaan(organisatie_id, event_id)))))
with check ((organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))))
    or ((organisatie_id in (select unnest(maps.mijn_organisaties('bewerker'))))
        and ((plan_id is not null) or (categorie = any (array['Sjablonen','Snelstijlen']))
             or (event_id is not null and maps.event_toegestaan(organisatie_id, event_id)))));
