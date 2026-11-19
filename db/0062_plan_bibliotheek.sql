-- De elementen uit de bibliotheek die een plan gebruikt (ook de vaste items van de plek), in één vraag naast de rest.
create or replace function maps.plan_bibliotheek(p_plan uuid)
 returns setof maps.bibliotheek
 language sql stable set search_path to ''
as $$
  select b.* from maps.bibliotheek b
   where b.id in (
     select i.element_id from maps.items i where i.plan_id = p_plan and i.element_id is not null
     union
     select i.element_id from maps.items i join maps.plannen p on p.plek_id = i.plek_id
      where p.id = p_plan and i.plan_id is null and i.element_id is not null);
$$;
grant execute on function maps.plan_bibliotheek(uuid) to authenticated;
