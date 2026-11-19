-- Telling van items per leverancier: toegang één keer nakijken en de leverancier via een hash-join zoeken
-- (was een zoektocht door alle leveranciers per item, ~1 s per fiche).
create or replace function maps.plan_leveranciers(p_plan uuid)
 returns table(leverancier_id uuid, items bigint)
 language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not exists (select 1 from maps.plannen p where p.id = p_plan
      and p.organisatie_id = any (maps.mijn_organisaties('lezer')) and maps.plan_toegestaan(p.id)) then
    return;
  end if;
  return query
  with p as (select pl.organisatie_id, pl.instellingen from maps.plannen pl where pl.id = p_plan),
  lv as (select distinct on (lower(btrim(l.naam))) lower(btrim(l.naam)) n, l.id
           from maps.leveranciers l join p on l.organisatie_id = p.organisatie_id
          order by lower(btrim(l.naam)), l.created_at),
  x as (
    select coalesce(i.leverancier_id, lv.id) lev
      from maps.items i
      cross join p
      left join maps.bibliotheek b on b.id = i.element_id
      left join lv on lv.n = lower(btrim(coalesce(nullif(btrim(i.velden ->> 'herkomst'), ''), nullif(b.leverancier, ''), p.instellingen -> 'leveranciers' ->> b.categorie)))
     where i.plan_id = p_plan and not coalesce(i.verborgen, false))
  select x.lev, count(*)::bigint from x where x.lev is not null group by x.lev;
end;
$function$;
