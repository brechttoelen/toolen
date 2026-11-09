-- ============================================================================
-- Toolen · 0005_pakketten.sql
-- Project: toolen (hlpurcdeouegvphvwygu). Na 0001, 0003 en 0004.
--
-- 1. Pakketten als tabel (maps.pakketten), te beheren in /beheer → Pakketten.
--    Een pakket geeft standaardwaarden: plaatsen, lezers, modules. Per organisatie kan je
--    daarvan afwijken (organisaties.plaatsen, lezers_max, modules blijven de waarheid).
-- 2. Enkel gekende modules in organisaties.modules en pakketten.modules.
-- 3. Nieuwe organisatie: lege velden nemen de waarden van het pakket over.
-- 4. Modulebewaking op items verfijnd (zelfde sleutels als components/maps/modules.js):
--    enkel wie de gegevens van een module toevoegt of wijzigt, wordt geweigerd. Een bestaand
--    item met stroom of doeken verplaatsen, hernoemen of wissen blijft kunnen, net als de
--    gegevens van die module eraf halen.
--
-- Terugdraaien: drop table maps.pakketten cascade; 0004 opnieuw uitvoeren.
-- ============================================================================

-- Gekende modules (koppelingen stock en gridlab staan ook in organisaties.modules).
create or replace function maps.module_ids() returns text[]
language sql immutable as $$
  select array['stroom','signalisatie','stelling','branding','veiligheid','binnen','groot','terrein','leveranciers','integraties','stock','gridlab'];
$$;

create table if not exists maps.pakketten (
  id            text primary key check (id ~ '^[a-z0-9_]{2,30}$'),
  naam          text not null,
  omschrijving  text,
  plaatsen      integer not null default 5 check (plaatsen >= 1),
  lezers        integer not null default 25 check (lezers >= 0),
  modules       text[] not null default '{}' check (modules <@ maps.module_ids()),
  modules_keuze integer not null default 0 check (modules_keuze >= 0),   -- "2 naar keuze" bovenop de vaste modules
  prijs_jaar    numeric(10,2),                                           -- excl. btw, per organisatie
  prijs_plaats  numeric(10,2),                                           -- extra plaats per jaar
  prijs_module  numeric(10,2),                                           -- extra module per jaar
  proef_dagen   integer check (proef_dagen is null or proef_dagen between 1 and 365),
  sso           boolean not null default false,
  actief        boolean not null default true,                           -- uit = niet meer te kiezen voor nieuwe organisaties
  volgorde      integer not null default 0,
  bijgewerkt    timestamptz not null default now()
);

insert into maps.pakketten (id, naam, omschrijving, plaatsen, lezers, modules, modules_keuze, proef_dagen, sso, volgorde) values
  ('proef', 'Proef', 'Alles behalve Integraties, voor een beperkte tijd', 5, 25,
     array['stroom','signalisatie','stelling','branding','veiligheid','binnen','groot','terrein','leveranciers'], 0, 30, false, 10),
  ('event', 'Event', 'Basis met 2 modules naar keuze', 5, 25, '{}', 2, null, false, 20),
  ('pro', 'Pro', 'Basis met 2 modules naar keuze, extra plaatsen bij te kopen', 5, 25, '{}', 2, null, false, 30),
  ('organisatie', 'Organisatie', 'Alle modules behalve Integraties, SSO', 20, 100,
     array['stroom','signalisatie','stelling','branding','veiligheid','binnen','groot','terrein','leveranciers'], 0, null, true, 40),
  ('maatwerk', 'Maatwerk', 'Alles, op offerte', 50, 1000,
     array['stroom','signalisatie','stelling','branding','veiligheid','binnen','groot','terrein','leveranciers','integraties'], 0, null, true, 50)
on conflict (id) do nothing;

create or replace function maps.pakket_bijgewerkt() returns trigger language plpgsql as $$
begin new.bijgewerkt := now(); return new; end $$;
drop trigger if exists pakketten_bijgewerkt on maps.pakketten;
create trigger pakketten_bijgewerkt before update on maps.pakketten for each row execute function maps.pakket_bijgewerkt();

alter table maps.pakketten enable row level security;
drop policy if exists pakketten_lezen on maps.pakketten;
drop policy if exists pakketten_platform on maps.pakketten;
create policy pakketten_lezen on maps.pakketten for select to authenticated using (true);
create policy pakketten_platform on maps.pakketten for all to authenticated
  using (maps.is_platformbeheerder()) with check (maps.is_platformbeheerder());
grant select, insert, update, delete on maps.pakketten to authenticated;

-- Organisaties: pakket moet bestaan, modules moeten gekend zijn. "not valid": bestaande rijen worden
-- niet opnieuw nagekeken, elke nieuwe of gewijzigde rij wel.
alter table maps.organisaties drop constraint if exists organisaties_pakket_fk;
alter table maps.organisaties add constraint organisaties_pakket_fk
  foreign key (pakket) references maps.pakketten (id) on update cascade not valid;
alter table maps.organisaties drop constraint if exists organisaties_modules_gekend;
alter table maps.organisaties add constraint organisaties_modules_gekend
  check (modules <@ maps.module_ids()) not valid;

-- Een pakket dat nog gebruikt wordt, kan niet weg (de foreign key weigert); zet het dan op niet actief.

-- Nieuwe organisatie: lege waarden uit het pakket.
create or replace function maps.platform_organisatie_aanmaken(
  p_naam text, p_slug text, p_kort text, p_pakket text, p_plaatsen integer, p_lezers integer,
  p_modules text[], p_status text, p_proef_tot timestamptz, p_eigenaar_email text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_user uuid; v_token text; p maps.pakketten;
begin
  if not maps.is_platformbeheerder() then raise exception 'Enkel voor platformbeheerders' using errcode = '42501'; end if;
  select * into p from maps.pakketten where id = coalesce(p_pakket, 'proef');
  if p.id is null then raise exception 'Onbekend pakket: %', p_pakket using errcode = 'P0001'; end if;
  insert into maps.organisaties (naam, slug, kort, pakket, plaatsen, lezers_max, modules, status, proef_tot)
  values (btrim(p_naam), lower(btrim(p_slug)), nullif(btrim(p_kort), ''), p.id, coalesce(p_plaatsen, p.plaatsen),
          coalesce(p_lezers, p.lezers), coalesce(p_modules, p.modules), coalesce(p_status, 'proef'),
          coalesce(p_proef_tot, case when coalesce(p_status, 'proef') = 'proef' and p.proef_dagen is not null then now() + make_interval(days => p.proef_dagen) end))
  returning id into v_org;
  insert into maps.logboek_organisatie (organisatie_id, actie, details)
  values (v_org, 'organisatie_aangemaakt', jsonb_build_object('naam', p_naam, 'slug', p_slug, 'pakket', p.id, 'door', 'platform'));
  if coalesce(btrim(p_eigenaar_email), '') <> '' then
    select id into v_user from auth.users where lower(email) = lower(btrim(p_eigenaar_email));
    if v_user is not null then
      insert into maps.leden (organisatie_id, user_id, rol) values (v_org, v_user, 'eigenaar');
    else
      insert into maps.uitnodigingen (organisatie_id, email, rol) values (v_org, p_eigenaar_email, 'eigenaar') returning token into v_token;
    end if;
  end if;
  return jsonb_build_object('id', v_org, 'slug', lower(btrim(p_slug)), 'eigenaar_lid', v_user is not null, 'token', v_token);
exception when unique_violation then
  raise exception 'Het adres %.toolen.be is al in gebruik.', lower(btrim(p_slug)) using errcode = 'P0001';
end $$;

-- Pakket toepassen op een bestaande organisatie: pakket, plaatsen, lezers en modules uit het pakket.
-- Afwijken kan daarna gewoon met een update op organisaties.
create or replace function maps.platform_pakket_toepassen(p_org uuid, p_pakket text) returns void
language plpgsql security definer set search_path = '' as $$
declare p maps.pakketten;
begin
  if not maps.is_platformbeheerder() then raise exception 'Enkel voor platformbeheerders' using errcode = '42501'; end if;
  select * into p from maps.pakketten where id = p_pakket;
  if p.id is null then raise exception 'Onbekend pakket: %', p_pakket using errcode = 'P0001'; end if;
  -- Koppelingen (stock, gridlab) horen niet bij een pakket en blijven staan.
  update maps.organisaties
     set pakket = p.id, plaatsen = p.plaatsen, lezers_max = p.lezers,
         modules = p.modules || array(select m from unnest(modules) m where m in ('stock', 'gridlab') and not m = any (p.modules))
   where id = p_org;
end $$;
revoke execute on function maps.platform_pakket_toepassen(uuid, text) from public, anon;
grant execute on function maps.platform_pakket_toepassen(uuid, text) to authenticated;

-- Modulebewaking op items: zelfde sleutels als het register in de editor.
create or replace function maps.items_module_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  k text; m text;
  nv jsonb := coalesce(new.velden, '{}');
  ov jsonb := case when tg_op = 'UPDATE' then coalesce(old.velden, '{}') else '{}' end;
  regels constant jsonb := '{"sign":"signalisatie","verkeer":"signalisatie","stroom":"stroom","stelling":"stelling",
                             "binnen":"binnen","binnenplan":"binnen",
                             "doeken":"branding","vlaggen":"branding","ontwerp":"branding",
                             "paneel_1":"branding","paneel_2":"branding","paneel_3":"branding","paneel_4":"branding"}';
  namen constant jsonb := '{"signalisatie":"Signalisatie","stroom":"Stroom","stelling":"Stellingbouwer 3D","binnen":"Binnenplan","branding":"Branding"}';
begin
  if auth.uid() is null then return new; end if;  -- import, service role, SQL Editor
  for k, m in select key, value #>> '{}' from jsonb_each(regels) loop
    -- Enkel als de gegevens van de module zelf toegevoegd of gewijzigd worden; weghalen mag.
    if nv ? k and jsonb_typeof(nv -> k) <> 'null' and (nv -> k) is distinct from (ov -> k)
       and not maps.org_heeft_module(new.organisatie_id, m) then
      raise exception '% zit niet in het pakket van deze organisatie.', namen ->> m using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
