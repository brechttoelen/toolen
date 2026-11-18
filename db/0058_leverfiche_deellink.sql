-- ============================================================================
-- Toolen · 0058_leverfiche_deellink.sql
-- Leverfiche voor de leverancier zonder login: een token per leverancier op de site. De link toont enkel
-- een vastgezette bestelling (aantal, wat, groep, locatie, levering, ophaling, opmerking); geen bedragen,
-- geen interne opmerking van de leverancier, geen andere leveranciers. Token leegmaken trekt de link in.
-- ============================================================================
alter table maps.site_leveranciers add column if not exists deel_token text unique;

create or replace function maps.leverfiche(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with s as (
    select sl.* from maps.site_leveranciers sl
     where p_token is not null and length(p_token) >= 24 and sl.deel_token = p_token and maps.org_deelbaar(sl.organisatie_id))
  select jsonb_build_object(
    'leverancier', (select l.naam from maps.leveranciers l where l.id = s.leverancier_id),
    'organisatie', (select coalesce(nullif(o.kort, ''), o.naam) from maps.organisaties o where o.id = s.organisatie_id),
    'plan', pl.naam, 'locatie', pl.locatie, 'wedstrijd_van', pl.wedstrijd_van, 'wedstrijd_tot', pl.wedstrijd_tot,
    'wat', s.wat, 'vastgezet_op', s.vastgezet_op,
    'regels', case when s.vastgezet_op is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'aantal', r.aantal, 'eenheid', r.eenheid, 'wat', r.wat, 'groep', r.groep, 'opmerking', r.opmerking,
               'locatie', coalesce(lg.naam, r.locatie_tekst),
               'lev', case when lv.id is not null then jsonb_build_object('anker', lv.anker, 'dag', lv.dag, 'uur_van', lv.uur_van, 'uur_tot', lv.uur_tot) end,
               'oph', case when op.id is not null then jsonb_build_object('anker', op.anker, 'dag', op.dag, 'uur_van', op.uur_van, 'uur_tot', op.uur_tot) end)
             order by r.volgorde, r.created_at)
        from maps.bestelregels r
        left join maps.lagen lg on lg.id = r.locatie_laag_id
        left join maps.leveringen lv on lv.id = r.levering_id
        left join maps.leveringen op on op.id = r.ophaling_id
       where r.site_leverancier_id = s.id), '[]'::jsonb) end)
    from s join maps.plannen pl on pl.id = s.plan_id;
$$;
revoke execute on function maps.leverfiche(text) from public;
grant execute on function maps.leverfiche(text) to anon, authenticated;
