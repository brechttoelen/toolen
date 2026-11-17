-- ============================================================================
-- Toolen · 0043_fiche_basis.sql
-- Basis voor de projectfiche per site (zie docs/BOUWPLAN-projectfiche.md):
--   * module 'fiche' (nog bij geen enkele organisatie aan)
--   * recht 'financieel' per lid (offertes, facturen, budget, prijzen)
--   * maps.fiche_tabel(): standaard RLS, rechten en triggers voor de nieuwe tabellen
--   * maps.fiche_plan_vullen(): plan_id overnemen van de ouderrij
-- Terugdraaien: 'fiche' uit module_ids, kolom leden.financieel en de functies wissen.
-- ============================================================================

create or replace function maps.module_ids() returns text[]
language sql immutable set search_path = '' as $$
  select array['stroom','signalisatie','stelling','branding','veiligheid','binnen','groot','terrein','leveranciers','integraties','huisstijl','feedback','mobiel','fiche','stock','gridlab'];
$$;

alter table maps.leden add column if not exists financieel boolean not null default false;
comment on column maps.leden.financieel is 'Mag offertes, facturen, budget en prijzen zien. Eigenaars en beheerders mogen het altijd.';

-- Financiële gegevens: eigenaar en beheerder altijd, anderen enkel met leden.financieel.
create or replace function maps.mag_financieel(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is null
      or maps.is_platformbeheerder()
      or exists (select 1 from maps.leden l
                  where l.user_id = auth.uid() and l.organisatie_id = p_org and l.actief
                    and (maps.rol_rang(l.rol) >= 3 or l.financieel)
                    and p_org = any (maps.mijn_organisaties('lezer')));
$$;
revoke execute on function maps.mag_financieel(uuid) from public, anon;
grant execute on function maps.mag_financieel(uuid) to authenticated;

-- plan_id van een rij overnemen van de ouder (site_leverancier, taak), zodat RLS per plan werkt.
create or replace function maps.fiche_plan_vullen() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb := to_jsonb(new); v uuid;
begin
  if j ? 'site_leverancier_id' and j ->> 'site_leverancier_id' is not null then
    select plan_id into v from maps.site_leveranciers where id = (j ->> 'site_leverancier_id')::uuid;
  elsif j ? 'taak_id' and j ->> 'taak_id' is not null then
    select plan_id into v from maps.taken where id = (j ->> 'taak_id')::uuid;
  end if;
  if v is not null then
    if new.plan_id is not null and new.plan_id <> v then
      raise exception 'Deze rij hoort bij een ander plan dan haar ouder.' using errcode = '42501';
    end if;
    new.plan_id := v;
  end if;
  return new;
end $$;
revoke execute on function maps.fiche_plan_vullen() from public, anon, authenticated;

-- Standaard voor elke tabel van de fiche:
--   lezen: lezer van de organisatie; schrijven: bewerker; plannen binnen de events van het lid;
--   schrijven enkel met p_module (standaard 'fiche'; null = geen module nodig);
--   p_fin: lezen en schrijven ook enkel met het recht financieel.
create or replace function maps.fiche_tabel(p_tabel text, p_fin boolean default false, p_module text default 'fiche') returns void
language plpgsql set search_path = '' as $$
declare
  heeft_plan boolean := exists (select 1 from information_schema.columns where table_schema = 'maps' and table_name = p_tabel and column_name = 'plan_id');
  heeft_upd boolean := exists (select 1 from information_schema.columns where table_schema = 'maps' and table_name = p_tabel and column_name = 'updated_at');
  heeft_ouder boolean := exists (select 1 from information_schema.columns where table_schema = 'maps' and table_name = p_tabel and column_name in ('site_leverancier_id', 'taak_id'));
  fin text := case when p_fin then ' and maps.mag_financieel(organisatie_id)' else '' end;
  p record;
begin
  execute format('alter table maps.%I enable row level security', p_tabel);
  execute format('grant select, insert, update, delete on maps.%I to authenticated', p_tabel);
  execute format('grant all on maps.%I to service_role', p_tabel);

  if heeft_ouder then
    execute format('drop trigger if exists %I on maps.%I', p_tabel || '_aplan', p_tabel);
    execute format('create trigger %I before insert or update on maps.%I for each row execute function maps.fiche_plan_vullen()', p_tabel || '_aplan', p_tabel);
  end if;
  execute format('drop trigger if exists %I on maps.%I', p_tabel || '_org', p_tabel);
  execute format('create trigger %I before insert on maps.%I for each row execute function maps.org_vullen()', p_tabel || '_org', p_tabel);
  execute format('drop trigger if exists %I on maps.%I', p_tabel || '_org_vast', p_tabel);
  execute format('create trigger %I before update on maps.%I for each row execute function maps.org_vast()', p_tabel || '_org_vast', p_tabel);
  if heeft_upd then
    execute format('drop trigger if exists %I on maps.%I', p_tabel || '_updated', p_tabel);
    execute format('create trigger %I before update on maps.%I for each row execute function maps.zet_updated_at()', p_tabel || '_updated', p_tabel);
  end if;

  for p in select policyname from pg_policies where schemaname = 'maps' and tablename = p_tabel loop
    execute format('drop policy %I on maps.%I', p.policyname, p_tabel);
  end loop;
  execute format('create policy lezen on maps.%I for select to authenticated using (organisatie_id in (select unnest(maps.mijn_organisaties(''lezer''))) %s)', p_tabel, fin);
  execute format('create policy schrijven on maps.%I for all to authenticated using (organisatie_id in (select unnest(maps.mijn_organisaties(''bewerker''))) %s) with check (organisatie_id in (select unnest(maps.mijn_organisaties(''bewerker''))) %s)', p_tabel, fin, fin);
  if heeft_plan then
    execute format('create policy evenementen on maps.%I as restrictive for all to authenticated using (maps.plan_toegestaan(plan_id)) with check (maps.plan_toegestaan(plan_id))', p_tabel);
  end if;
  if p_module is not null then
    execute format('create policy module_maken on maps.%I as restrictive for insert to authenticated with check (maps.org_heeft_module(organisatie_id, %L))', p_tabel, p_module);
    execute format('create policy module_wijzigen on maps.%I as restrictive for update to authenticated using (maps.org_heeft_module(organisatie_id, %L))', p_tabel, p_module);
    execute format('create policy module_wissen on maps.%I as restrictive for delete to authenticated using (maps.org_heeft_module(organisatie_id, %L))', p_tabel, p_module);
  end if;
end $$;
revoke execute on function maps.fiche_tabel(text, boolean, text) from public, anon, authenticated;
