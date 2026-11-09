-- ============================================================================
-- Toolen · 0006_beveiliging.sql
-- Project: toolen (hlpurcdeouegvphvwygu). Na 0005. Uitgevoerd op 9 nov 2026.
--
-- Opruiming na de beveiligingscontrole van Supabase:
-- 1. View maps.toegang draaide met de rechten van de maker (security definer view).
--    Nu: een security definer functie die zelf filtert op de eigen organisaties, en een
--    view met security_invoker die die functie leest. Zelfde kolommen, zelfde resultaat.
--    De view is enkel nog leesbaar (geen insert/update/delete).
-- 2. Functies die enkel voor ingelogde gebruikers zijn, kunnen niet meer zonder login
--    aangeroepen worden. Deellinks (deel_link_*) en uitnodiging_info blijven open: die
--    zijn net bedoeld voor wie niet ingelogd is.
-- Mag opnieuw gedraaid worden.
-- ============================================================================

-- 1. toegang
create or replace function maps.toegang_rijen()
returns table (user_id uuid, email text, naam text, rol text, organisatie_id uuid)
language sql stable security definer set search_path = '' as $$
  select l.user_id, p.email, p.naam,
         case l.rol when 'eigenaar' then 'admin' when 'beheerder' then 'admin' when 'bewerker' then 'editor' else 'viewer' end,
         l.organisatie_id
    from maps.leden l
    join maps.profielen p on p.id = l.user_id
   where l.organisatie_id = any (maps.mijn_organisaties('lezer'));
$$;
revoke execute on function maps.toegang_rijen() from public, anon;
grant execute on function maps.toegang_rijen() to authenticated, service_role;

create or replace view maps.toegang with (security_invoker = on) as
  select user_id, email, naam, rol, organisatie_id from maps.toegang_rijen();
revoke all on maps.toegang from anon, authenticated;
grant select on maps.toegang to authenticated, service_role;

-- 2. Enkel voor ingelogde gebruikers
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'maps' and p.prosecdef
       and p.proname in ('actieve_organisatie', 'enige_organisatie', 'leden_van', 'org_deelbaar', 'org_heeft_module',
                         'platform_organisatie_aanmaken', 'platform_overzicht', 'platform_pakket_toepassen',
                         'organisatie_aanmaken', 'uitnodiging_aanvaarden', 'plaatsen_in_gebruik', 'ik',
                         'is_platformbeheerder', 'lid_van', 'mag_beheren', 'mag_lezen', 'mag_schrijven',
                         'mijn_organisaties', 'leverancier_hernoem', 'entry_zones')
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  -- Hulpfunctie van Supabase in public: niet via de API aan te roepen.
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- Vaste search_path voor de laatste hulpfuncties.
alter function maps.module_ids() set search_path = '';
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'maps' and p.proname in ('jsonb_zet_pad', 'jsonb_samenvoegen', 'paden_raken')
  loop
    execute format('alter function %s set search_path = %L', f, 'pg_catalog, public');
  end loop;
end $$;
