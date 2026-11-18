-- ============================================================================
-- Toolen · 0059_opbouw_en_afbraak.sql
-- Een moment van een leverancier is niet altijd een levering: wie zelf opbouwt (stellingen, tenten) heeft
-- een opbouw en een afbraak, vaak over meerdere dagen met vaste uren per dag.
--   werk   = false: levering of ophaling (één tijdslot); true: opbouw of afbraak.
--   dagen  = aantal opeenvolgende dagen vanaf anker + dag; de uren gelden voor elke dag.
-- soort blijft het begin (levering) of het einde (ophaling) van de periode.
-- ============================================================================
alter table maps.leveringen
  add column if not exists werk boolean not null default false,
  add column if not exists dagen integer not null default 1 check (dagen between 1 and 90);

do $do$
declare d text;
begin
  select pg_get_functiondef('maps.fiche_overnemen(uuid,uuid)'::regprocedure) into d;
  if position('l.werk' in d) = 0 then
    d := replace(d, 'wat, opmerking, item_ids, laag_ids)', 'wat, opmerking, item_ids, laag_ids, werk, dagen)');
    d := replace(d, 'x.oud = any (l.laag_ids)), ''{}'')', 'x.oud = any (l.laag_ids)), ''{}''), l.werk, l.dagen');
    if position('l.werk' in d) = 0 or position('laag_ids, werk, dagen)' in d) = 0 then raise exception 'fiche_overnemen niet aangepast'; end if;
    execute d;
  end if;
end $do$;

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
               'lev', case when lv.id is not null then jsonb_build_object('soort', lv.soort, 'anker', lv.anker, 'dag', lv.dag, 'uur_van', lv.uur_van, 'uur_tot', lv.uur_tot, 'werk', lv.werk, 'dagen', lv.dagen) end,
               'oph', case when op.id is not null then jsonb_build_object('soort', op.soort, 'anker', op.anker, 'dag', op.dag, 'uur_van', op.uur_van, 'uur_tot', op.uur_tot, 'werk', op.werk, 'dagen', op.dagen) end)
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
