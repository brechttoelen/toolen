-- Leverancier (velden.herkomst) voor veel items in één keer, vanuit Leveranciers › Toewijzen.
-- Leeg = geen eigen keuze (de vaste leverancier van het element geldt weer). RLS van items geldt (security invoker).
create or replace function maps.items_herkomst(p_ids uuid[], p_herkomst text)
 returns integer
 language sql volatile set search_path to ''
as $$
  with u as (
    update maps.items i
       set velden = case when coalesce(btrim(p_herkomst), '') = '' then coalesce(i.velden, '{}'::jsonb) - 'herkomst'
                         else jsonb_set(coalesce(i.velden, '{}'::jsonb), '{herkomst}', to_jsonb(btrim(p_herkomst))) end,
           bewerkt_door = auth.uid()
     where i.id = any (p_ids)
       and coalesce(btrim(i.velden ->> 'herkomst'), '') is distinct from coalesce(btrim(p_herkomst), '')
    returning 1)
  select count(*)::integer from u;
$$;
grant execute on function maps.items_herkomst(uuid[], text) to authenticated;
