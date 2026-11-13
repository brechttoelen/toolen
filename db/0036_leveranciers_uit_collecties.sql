-- 0036 · Krijgt een klant een collectie, dan komen de verhuurders van die elementen in zijn leverancierslijst
-- (enkel naam en categorieën; contactgegevens vult de klant zelf aan). Bestaande klanten zijn bijgewerkt.
create or replace function maps.leveranciers_uit_collectie(p_org uuid, p_collectie uuid) returns void
language sql security definer set search_path = '' as $$
  insert into maps.leveranciers (organisatie_id, naam, soort, categorieen)
  select p_org, x.naam, 'extern', x.cats from (
    select btrim(b.leverancier) naam, array_agg(distinct b.categorie) filter (where b.categorie is not null) cats
      from maps.bibliotheek b
     where b.collectie_id = p_collectie and b.plan_id is null and coalesce(btrim(b.leverancier), '') <> ''
     group by btrim(b.leverancier)) x
   where not exists (select 1 from maps.leveranciers l where l.organisatie_id = p_org and lower(btrim(l.naam)) = lower(x.naam));
$$;
revoke execute on function maps.leveranciers_uit_collectie(uuid, uuid) from public, anon, authenticated;
create or replace function maps.organisatie_collecties_leveranciers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform maps.leveranciers_uit_collectie(new.organisatie_id, new.collectie_id); return new; end $$;
revoke execute on function maps.organisatie_collecties_leveranciers() from public, anon, authenticated;
drop trigger if exists organisatie_collecties_lev on maps.organisatie_collecties;
create trigger organisatie_collecties_lev after insert on maps.organisatie_collecties
  for each row execute function maps.organisatie_collecties_leveranciers();
alter table maps.leveranciers disable trigger user;
select maps.leveranciers_uit_collectie(oc.organisatie_id, oc.collectie_id) from maps.organisatie_collecties oc;
alter table maps.leveranciers enable trigger user;
