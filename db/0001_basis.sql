-- ============================================================================
-- Toolen · 0001_basis.sql
-- Project: toolen (hlpurcdeouegvphvwygu) — NIET op het Publitool-project draaien.
--
-- Basis van Toolen Maps, multi-tenant:
--   * organisaties, leden, uitnodigingen, profielen, platformbeheerders
--   * alle tabellen van FLCS Maps (eindtoestand van flcsmaps_001 … 032) in het
--     schema maps, met organisatie_id op elke tabel
--   * rechten per organisatie en per status van het abonnement (RLS)
--   * deellinks (zonder login) via security-definer-functies
--
-- De actieve organisatie komt uit de header x-organisatie (slug), die de app
-- meestuurt. Zonder header: alle organisaties waarvan je lid bent.
--
-- Na het uitvoeren: Project Settings → Data API → Exposed schemas: maps toevoegen.
--
-- Terugdraaien (enkel op een leeg project, wist alles van Toolen Maps):
--   drop schema maps cascade;
--   drop trigger if exists maps_profiel on auth.users;
--   delete from storage.objects where bucket_id = 'maps';
--   delete from storage.buckets where id = 'maps';
-- ============================================================================

create schema if not exists maps;

-- ----------------------------------------------------------------------------
-- 1. Organisaties, leden, profielen
-- ----------------------------------------------------------------------------

create table maps.organisaties (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  naam                text not null,
  kort                text,                                   -- korte naam in titelblok en deellink (bv. FLCS)
  logo_pad            text,
  adres               text,
  ondernemingsnummer  text,
  land                text not null default 'BE',
  status              text not null default 'proef'
                      check (status in ('proef','actief','achterstallig','alleen_lezen','geblokkeerd','verwijderd')),
  status_sinds        timestamptz not null default now(),
  proef_tot           timestamptz,
  pakket              text not null default 'proef',
  plaatsen            integer not null default 5 check (plaatsen >= 1),
  lezers_max          integer not null default 25 check (lezers_max >= 0),
  modules             text[] not null default '{}',
  limieten            jsonb not null default '{}',
  sso_verplicht       boolean not null default false,
  stripe_klant_id     text,
  stripe_abonnement_id text,
  created_at          timestamptz not null default now(),
  constraint organisaties_slug_vorm check (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  constraint organisaties_slug_vrij check (slug <> all (array[
    'www','app','login','api','admin','beheer','status','docs','help','mail','d',
    'maps','stock','cdn','static','demo','test','staging','auth','m','_next']))
);

create table maps.profielen (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  naam       text,
  created_at timestamptz not null default now()
);

create table maps.leden (
  organisatie_id   uuid not null references maps.organisaties(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  rol              text not null check (rol in ('eigenaar','beheerder','bewerker','lezer')),
  actief           boolean not null default true,
  uitgenodigd_door uuid,
  sinds            timestamptz not null default now(),
  laatste_login    timestamptz,
  primary key (organisatie_id, user_id)
);
create index leden_user on maps.leden (user_id);

create table maps.uitnodigingen (
  id               uuid primary key default gen_random_uuid(),
  organisatie_id   uuid not null references maps.organisaties(id) on delete cascade,
  email            text not null,
  rol              text not null check (rol in ('beheerder','bewerker','lezer')),
  token            text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  geldig_tot       timestamptz not null default now() + interval '14 days',
  uitgenodigd_door uuid default auth.uid(),
  aanvaard_op      timestamptz,
  created_at       timestamptz not null default now()
);
create index uitnodigingen_org on maps.uitnodigingen (organisatie_id);
create unique index uitnodigingen_open on maps.uitnodigingen (organisatie_id, lower(email)) where aanvaard_op is null;

create table maps.platform_beheerders (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table maps.logboek_organisatie (
  id             bigint generated always as identity primary key,
  organisatie_id uuid references maps.organisaties(id) on delete cascade,
  door           uuid default auth.uid(),
  actie          text not null,
  details        jsonb not null default '{}',
  op             timestamptz not null default now()
);
create index logboek_organisatie_org on maps.logboek_organisatie (organisatie_id, op desc);

-- ----------------------------------------------------------------------------
-- 2. Hulpfuncties voor rechten
-- ----------------------------------------------------------------------------

create function maps.rol_rang(r text) returns int
language sql immutable set search_path = '' as $$
  select case r when 'eigenaar' then 4 when 'beheerder' then 3 when 'bewerker' then 2 when 'lezer' then 1 else 0 end;
$$;

-- Organisatie uit de header x-organisatie (slug). Onbekende slug: een id die niets
-- matcht, zodat je dan niets ziet in plaats van alles.
create function maps.actieve_organisatie() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare s text; v uuid;
begin
  begin
    s := lower(nullif(current_setting('request.headers', true)::json ->> 'x-organisatie', ''));
  exception when others then s := null;
  end;
  if s is null then return null; end if;
  select id into v from maps.organisaties where slug = s;
  return coalesce(v, '00000000-0000-0000-0000-000000000000'::uuid);
end $$;

-- Organisaties waar de gebruiker minstens p_min is, en waar de status dat toelaat.
--   lezer:            proef, actief, achterstallig, alleen_lezen (geblokkeerd: enkel de eigenaar)
--   bewerker of meer: proef, actief, achterstallig
-- Met een actieve organisatie (header) enkel die.
create function maps.mijn_organisaties(p_min text default 'lezer') returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(o.id), '{}')
    from maps.leden l
    join maps.organisaties o on o.id = l.organisatie_id
   where l.user_id = auth.uid()
     and l.actief
     and maps.rol_rang(l.rol) >= maps.rol_rang(p_min)
     and (maps.actieve_organisatie() is null or o.id = maps.actieve_organisatie())
     and case when maps.rol_rang(p_min) >= 2
              then o.status in ('proef','actief','achterstallig')
              else o.status in ('proef','actief','achterstallig','alleen_lezen')
                   or (o.status = 'geblokkeerd' and l.rol = 'eigenaar') end;
$$;

-- Bij nieuwe rijen zonder header: de enige organisatie waar je kan schrijven.
create function maps.enige_organisatie() returns uuid
language sql stable security definer set search_path = '' as $$
  select case when cardinality(a) = 1 then a[1] end from (select maps.mijn_organisaties('bewerker') a) s;
$$;

create function maps.mag_lezen() returns boolean
language sql stable security definer set search_path = '' as $$
  select cardinality(maps.mijn_organisaties('lezer')) > 0;
$$;

create function maps.mag_schrijven() returns boolean
language sql stable security definer set search_path = '' as $$
  select cardinality(maps.mijn_organisaties('bewerker')) > 0;
$$;

create function maps.mag_beheren() returns boolean
language sql stable security definer set search_path = '' as $$
  select cardinality(maps.mijn_organisaties('beheerder')) > 0;
$$;

-- Organisaties waar je actief lid bent, ongeacht de status (voor policies op leden,
-- organisaties en profielen, zonder dat leden zichzelf leest).
create function maps.lid_van() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(organisatie_id), '{}') from maps.leden where user_id = auth.uid() and actief;
$$;

create function maps.is_platformbeheerder() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from maps.platform_beheerders where user_id = auth.uid());
$$;

-- Deellinks werken zolang de organisatie niet geblokkeerd of verwijderd is.
create function maps.org_deelbaar(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from maps.organisaties where id = p_org and status in ('proef','actief','achterstallig','alleen_lezen'));
$$;

-- ----------------------------------------------------------------------------
-- 3. Tabellen van Toolen Maps (eindtoestand FLCS Maps + organisatie_id)
-- ----------------------------------------------------------------------------

create table maps.plekken (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  naam           text not null,
  kader          jsonb,
  contacten      jsonb not null default '[]',
  created_at     timestamptz not null default now()
);

create table maps.plannen (
  id              uuid primary key default gen_random_uuid(),
  organisatie_id  uuid not null references maps.organisaties(id) on delete cascade,
  naam            text not null,
  editie_naam     text,
  edition_id      text,
  plek_id         uuid references maps.plekken(id) on delete set null,
  locatie         text,
  centrum         jsonb,
  zoom            numeric,
  basiskaart      text not null default 'luchtfoto',
  status          text not null default 'concept',
  versie          integer not null default 1,
  titelblok       jsonb not null default '{}',
  instellingen    jsonb not null default '{}',
  aangemaakt_door uuid,
  bewerkt_door    uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  rev             bigint not null default 1,
  verwijderd_op   timestamptz,
  verwijderd_door uuid
);
create index plannen_org on maps.plannen (organisatie_id);
create index plannen_verwijderd_op on maps.plannen (verwijderd_op) where verwijderd_op is not null;

-- organisatie_id leeg = publieke catalogus (leveranciers, door Toolen beheerd)
create table maps.bibliotheek (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid references maps.organisaties(id) on delete cascade,
  naam           text not null,
  categorie      text not null default 'Overig',
  tekenwijze     text not null default 'schaal',
  breedte_m      numeric,
  diepte_m       numeric,
  eenheid_m      numeric,
  hoogte_m       numeric,
  omtrek         jsonb,
  stijl          jsonb not null default '{}',
  icoon          text,
  standaardlaag  text,
  leverancier    text,
  leverancier_id uuid,
  artikel_id     uuid,
  eigenschappen  jsonb not null default '{}',
  varianten      jsonb not null default '[]',
  actief         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  plan_id        uuid references maps.plannen(id) on delete cascade,
  rev            bigint not null default 1,
  familie        text
);
create index bibliotheek_org on maps.bibliotheek (organisatie_id);
create index bibliotheek_plan_id_idx on maps.bibliotheek (plan_id);

create table maps.lagen (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  plan_id        uuid not null references maps.plannen(id) on delete cascade,
  naam           text not null,
  kleur          text not null default '#2563EB',
  stijl          jsonb not null default '{}',
  zichtbaar      boolean not null default true,
  vergrendeld    boolean not null default false,
  printbaar      boolean not null default true,
  volgorde       integer not null default 0,
  rev            bigint not null default 1,
  updated_at     timestamptz not null default now(),
  map            text
);
create index lagen_plan on maps.lagen (plan_id);

create table maps.fasen (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  plan_id        uuid not null references maps.plannen(id) on delete cascade,
  naam           text not null,
  van            timestamptz,
  tot            timestamptz,
  volgorde       integer not null default 0
);
create index fasen_plan on maps.fasen (plan_id);

create table maps.items (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  plan_id        uuid references maps.plannen(id) on delete cascade,
  plek_id        uuid references maps.plekken(id) on delete cascade,
  laag_id        uuid references maps.lagen(id) on delete set null,
  element_id     uuid references maps.bibliotheek(id) on delete set null,
  groep_id       uuid,
  soort          text not null,
  geometrie      jsonb not null,
  parameters     jsonb not null default '{}',
  stijl          jsonb not null default '{}',
  naam           text,
  notitie        text,
  velden         jsonb not null default '{}',
  fase_ids       uuid[],
  vergrendeld    boolean not null default false,
  verborgen      boolean not null default false,
  volgorde       integer not null default 0,
  geplaatst_op   timestamptz,
  geplaatst_door uuid,
  bewerkt_door   uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  rev            bigint not null default 1,
  constraint items_plan_of_plek check (plan_id is not null or plek_id is not null)
);
create index items_plan on maps.items (plan_id);
create index items_plek on maps.items (plek_id);
create index items_org on maps.items (organisatie_id);

create table maps.items_prullenbak (
  id              uuid primary key default gen_random_uuid(),
  organisatie_id  uuid not null references maps.organisaties(id) on delete cascade,
  plan_id         uuid,
  plek_id         uuid,
  laag_id         uuid,
  element_id      uuid,
  groep_id        uuid,
  soort           text not null,
  geometrie       jsonb not null,
  parameters      jsonb not null default '{}',
  stijl           jsonb not null default '{}',
  naam            text,
  notitie         text,
  velden          jsonb not null default '{}',
  fase_ids        uuid[],
  vergrendeld     boolean not null default false,
  verborgen       boolean not null default false,
  volgorde        integer not null default 0,
  geplaatst_op    timestamptz,
  geplaatst_door  uuid,
  bewerkt_door    uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  rev             bigint not null default 1,
  verwijderd_op   timestamptz not null default now(),
  verwijderd_door uuid,
  teruggezet_op   timestamptz
);
create index items_prullenbak_plan on maps.items_prullenbak (plan_id, verwijderd_op desc);

create table maps.versies (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  plan_id        uuid not null references maps.plannen(id) on delete cascade,
  versie         integer not null,
  momentopname   jsonb not null,
  opmerking      text,
  door           uuid,
  created_at     timestamptz not null default now()
);
create index versies_plan on maps.versies (plan_id);

create table maps.deel_links (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  plan_id        uuid not null references maps.plannen(id) on delete cascade,
  token          text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  naam           text not null,
  laag_ids       uuid[] not null default '{}',
  fase_ids       uuid[],
  opties         jsonb not null default '{}',
  geldig_tot     timestamptz,
  ingetrokken_op timestamptz,
  keer_geopend   integer not null default 0,
  created_at     timestamptz not null default now(),
  live           boolean not null default true,
  versie_id      uuid references maps.versies(id) on delete set null
);
create index deel_links_plan on maps.deel_links (plan_id);

create table maps.opmerkingen (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  item_id        uuid references maps.items(id) on delete cascade,
  auteur_id      uuid,
  auteur_naam    text,
  deel_link_id   uuid,
  tekst          text not null,
  status         text not null default 'open',
  created_at     timestamptz not null default now(),
  plan_id        uuid references maps.plannen(id) on delete cascade,
  punt           jsonb,
  constraint opmerkingen_item_of_punt check (item_id is not null or (plan_id is not null and jsonb_typeof(punt) = 'array' and jsonb_array_length(punt) = 2))
);
create index opmerkingen_item on maps.opmerkingen (item_id);
create index opmerkingen_plan_punt on maps.opmerkingen (plan_id) where punt is not null;

create table maps.bestanden (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  plan_id        uuid references maps.plannen(id) on delete cascade,
  item_id        uuid references maps.items(id) on delete cascade,
  soort          text not null,
  pad            text not null,
  meta           jsonb not null default '{}',
  created_at     timestamptz not null default now()
);
create index bestanden_plan on maps.bestanden (plan_id);

create table maps.leveranciers (
  id             uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references maps.organisaties(id) on delete cascade,
  naam           text not null check (length(btrim(naam)) between 1 and 120),
  soort          text not null default 'extern' check (soort in ('extern','eigen','stad')),
  categorieen    text[] not null default '{}',
  regios         text[] not null default '{}',
  gemeente       text,
  contactpersoon text,
  email          text,
  email2         text,
  telefoon       text,
  projecten      text,
  opmerkingen    text,
  actief         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (organisatie_id, naam)
);

create table maps.vaste_aansluitingen (
  id                  uuid primary key default gen_random_uuid(),
  organisatie_id      uuid not null references maps.organisaties(id) on delete cascade,
  naam                text not null,
  soort               text not null default 'straatkast',
  beheerder           text,
  gemeente            text,
  adres               text,
  geometrie           jsonb not null,
  uitgangen           jsonb not null default '[]',
  max_ampere          numeric,
  kva                 numeric,
  sleutel             text,
  contact             text,
  ean                 text,
  foto                text,
  opmerking           text,
  laatst_gecontroleerd date,
  actief              boolean not null default true,
  bron_item_id        uuid,
  aangemaakt_door     uuid,
  bewerkt_door        uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index vaste_aansluitingen_actief on maps.vaste_aansluitingen (actief);
create index vaste_aansluitingen_gemeente on maps.vaste_aansluitingen (gemeente);

create table maps.feedback (
  id               uuid primary key default gen_random_uuid(),
  organisatie_id   uuid not null references maps.organisaties(id) on delete cascade,
  created_at       timestamptz not null default now(),
  auteur_id        uuid default auth.uid(),
  auteur_naam      text,
  soort            text not null default 'probleem' check (soort in ('probleem','idee','vraag')),
  tekst            text not null check (length(tekst) between 1 and 5000),
  status           text not null default 'nieuw' check (status in ('nieuw','bekeken','gepland','opgelost','niet')),
  plan_id          uuid,
  item_id          uuid,
  deel_link_id     uuid,
  context          jsonb not null default '{}',
  schermafdruk     text,
  antwoord         text,
  afgehandeld_door uuid,
  afgehandeld_op   timestamptz
);
create index feedback_plan on maps.feedback (plan_id);
create index feedback_tijd on maps.feedback (created_at desc);

create table maps.wijzigingen (
  id             bigint generated always as identity primary key,
  organisatie_id uuid,
  plan_id        uuid,
  tabel          text not null,
  rij_id         uuid not null,
  actie          text not null,
  rev            bigint,
  velden         text[] not null default '{}',
  door           uuid,
  op             timestamptz not null default now()
);
create index wijzigingen_plan on maps.wijzigingen (plan_id, op desc);
create index wijzigingen_rij on maps.wijzigingen (rij_id, rev);

-- Namen van collega's (vroeger flcsmaps.toegang): enkel binnen je eigen organisaties.
create view maps.toegang as
  select l.user_id, p.email, p.naam,
         case l.rol when 'eigenaar' then 'admin' when 'beheerder' then 'admin' when 'bewerker' then 'editor' else 'viewer' end as rol,
         l.organisatie_id
    from maps.leden l join maps.profielen p on p.id = l.user_id
   where l.organisatie_id = any (maps.mijn_organisaties('lezer'));

-- ----------------------------------------------------------------------------
-- 4. Triggers: organisatie invullen en vasthouden
-- ----------------------------------------------------------------------------

-- Nieuwe rij zonder organisatie: van het plan, het item of de plek, anders de actieve
-- organisatie (header), anders de enige organisatie waar je kan schrijven.
create function maps.org_vullen() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb := to_jsonb(new); v uuid;
begin
  if j ? 'plan_id' and j ->> 'plan_id' is not null then
    select organisatie_id into v from maps.plannen where id = (j ->> 'plan_id')::uuid;
  end if;
  if v is null and j ? 'item_id' and j ->> 'item_id' is not null then
    select organisatie_id into v from maps.items where id = (j ->> 'item_id')::uuid;
  end if;
  if v is null and j ? 'plek_id' and j ->> 'plek_id' is not null then
    select organisatie_id into v from maps.plekken where id = (j ->> 'plek_id')::uuid;
  end if;
  if new.organisatie_id is not null and v is not null and new.organisatie_id <> v then
    raise exception 'Deze rij hoort bij een andere organisatie dan het plan.' using errcode = '42501';
  end if;
  if new.organisatie_id is null then
    new.organisatie_id := coalesce(v, nullif(maps.actieve_organisatie(), '00000000-0000-0000-0000-000000000000'::uuid), maps.enige_organisatie());
  end if;
  return new;
end $$;

-- Een rij verhuist nooit naar een andere organisatie.
create function maps.org_vast() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.organisatie_id is distinct from old.organisatie_id then
    raise exception 'De organisatie van een rij kan niet wijzigen.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['plekken','plannen','bibliotheek','lagen','fasen','items','versies','deel_links',
                           'opmerkingen','bestanden','leveranciers','vaste_aansluitingen','feedback'] loop
    execute format('create trigger %I before insert on maps.%I for each row execute function maps.org_vullen()', t || '_org', t);
    execute format('create trigger %I before update on maps.%I for each row execute function maps.org_vast()', t || '_org_vast', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 5. Functies van Toolen Maps (overgenomen, binnen de eigen organisatie)
-- ----------------------------------------------------------------------------

create function maps.zet_updated_at() returns trigger
language plpgsql set search_path = 'maps', 'public' as $$
begin new.updated_at = now(); return new; end $$;

create function maps.rev_ophogen() returns trigger
language plpgsql set search_path = 'maps', 'public' as $$
begin
  new.rev := coalesce(old.rev, 0) + 1;
  return new;
end $$;

create function maps.jsonb_samenvoegen(a jsonb, b jsonb) returns jsonb
language sql immutable as $$
  select (coalesce(case when jsonb_typeof(a) = 'object' then a end, '{}'::jsonb)
          || coalesce((select jsonb_object_agg(key, value) from jsonb_each(b) where value <> 'null'::jsonb), '{}'::jsonb))
         - coalesce(array(select key from jsonb_each(b) where value = 'null'::jsonb), '{}'::text[]);
$$;

create function maps.jsonb_zet_pad(doc jsonb, pad text[], waarde jsonb) returns jsonb
language plpgsql immutable as $$
declare basis jsonb := case when jsonb_typeof(doc) = 'object' then doc else '{}'::jsonb end;
begin
  if cardinality(pad) = 0 then return waarde; end if;
  if cardinality(pad) = 1 then
    if waarde is null or waarde = 'null'::jsonb then return basis - pad[1]; end if;
    return basis || jsonb_build_object(pad[1], waarde);
  end if;
  return basis || jsonb_build_object(pad[1], maps.jsonb_zet_pad(basis -> pad[1], pad[2:], waarde));
end $$;

create function maps.paden_raken(a text[], b text[]) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct x), '{}') from unnest(a) x, unnest(b) y
   where x = y or x like y || '.%' or y like x || '.%';
$$;

create function maps.verschil_paden(o jsonb, n jsonb) returns text[]
language plpgsql immutable set search_path = 'maps', 'public' as $$
declare
  k text; sk text; r text[] := '{}';
  ov jsonb; nv jsonb;
begin
  for k in select distinct key from (select jsonb_object_keys(coalesce(o, '{}')) key union select jsonb_object_keys(coalesce(n, '{}'))) s loop
    if k in ('rev', 'updated_at', 'created_at', 'bewerkt_door', 'centrum', 'zoom') then continue; end if;
    ov := o -> k; nv := n -> k;
    if ov is not distinct from nv then continue; end if;
    if k in ('velden', 'stijl', 'parameters', 'instellingen')
       and coalesce(jsonb_typeof(ov), 'object') = 'object' and coalesce(jsonb_typeof(nv), 'object') = 'object' and jsonb_typeof(coalesce(ov, nv)) = 'object' then
      for sk in select distinct key from (select jsonb_object_keys(coalesce(ov, '{}')) key union select jsonb_object_keys(coalesce(nv, '{}'))) s2 loop
        if (ov -> sk) is distinct from (nv -> sk) then r := r || (k || '.' || sk); end if;
      end loop;
    else
      r := r || k;
    end if;
  end loop;
  return r;
end $$;

create function maps.log_wijziging() returns trigger
language plpgsql security definer set search_path = 'maps', 'public' as $$
declare
  paden text[];
  plan uuid;
  wie uuid;
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb;
begin
  r := coalesce(n, o);
  plan := case when tg_table_name = 'plannen' then (r->>'id')::uuid else coalesce((n->>'plan_id')::uuid, (o->>'plan_id')::uuid) end;
  wie := coalesce(auth.uid(), (r->>'bewerkt_door')::uuid);
  if tg_op = 'INSERT' then
    insert into maps.wijzigingen (organisatie_id, plan_id, tabel, rij_id, actie, rev, door)
    values ((r->>'organisatie_id')::uuid, plan, tg_table_name, (n->>'id')::uuid, 'nieuw', (n->>'rev')::bigint, wie);
    return new;
  elsif tg_op = 'UPDATE' then
    paden := maps.verschil_paden(o, n);
    if cardinality(paden) = 0 then return new; end if;
    insert into maps.wijzigingen (organisatie_id, plan_id, tabel, rij_id, actie, rev, velden, door)
    values ((r->>'organisatie_id')::uuid, plan, tg_table_name, (n->>'id')::uuid, 'wijzig', (n->>'rev')::bigint, paden, wie);
    return new;
  else
    insert into maps.wijzigingen (organisatie_id, plan_id, tabel, rij_id, actie, rev, door)
    values ((r->>'organisatie_id')::uuid, plan, tg_table_name, (o->>'id')::uuid, 'verwijder', (o->>'rev')::bigint, auth.uid());
    return old;
  end if;
end $$;

create function maps.naar_prullenbak() returns trigger
language plpgsql security definer set search_path = 'maps', 'public' as $$
begin
  insert into maps.items_prullenbak
  select (jsonb_populate_record(null::maps.items_prullenbak,
           to_jsonb(old) || jsonb_build_object('verwijderd_op', now(), 'verwijderd_door', auth.uid(), 'teruggezet_op', null))).*
  on conflict (id) do update set verwijderd_op = excluded.verwijderd_op, verwijderd_door = excluded.verwijderd_door, teruggezet_op = null,
    geometrie = excluded.geometrie, velden = excluded.velden, stijl = excluded.stijl, parameters = excluded.parameters,
    laag_id = excluded.laag_id, naam = excluded.naam, rev = excluded.rev;
  return old;
end $$;

create function maps.uit_prullenbak() returns trigger
language plpgsql security definer set search_path = 'maps', 'public' as $$
begin
  update maps.items_prullenbak set teruggezet_op = now() where id = new.id and teruggezet_op is null;
  return new;
end $$;

create function maps.plan_wissen_bewaken() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.verwijderd_op is null then
    raise exception 'Plan staat niet in de prullenbak: zet het eerst in de prullenbak.' using errcode = 'P0001';
  end if;
  if old.verwijderd_op > now() - interval '90 days' then
    raise exception 'Definitief verwijderen kan pas 90 dagen na het weggooien (vanaf %).', to_char(old.verwijderd_op + interval '90 days', 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  return old;
end $$;

create function maps.sign_nummer() returns trigger
language plpgsql security definer set search_path = 'maps', 'public' as $$
declare nr int; hoogste int;
begin
  if new.velden is null or not (new.velden ? 'sign') or new.plan_id is null then return new; end if;
  if exists (select 1 from maps.items where id = new.id) then return new; end if;
  nr := nullif(new.velden -> 'sign' ->> 'nr', '')::int;
  perform pg_advisory_xact_lock(hashtext('maps-sign:' || new.plan_id::text || ':' || coalesce(new.laag_id::text, '-')));
  if nr is not null and not exists (
       select 1 from maps.items i
        where i.plan_id = new.plan_id and i.laag_id is not distinct from new.laag_id and i.id <> new.id
          and i.velden ? 'sign' and (i.velden -> 'sign' ->> 'nr') = nr::text) then
    return new;
  end if;
  select coalesce(max(nullif(i.velden -> 'sign' ->> 'nr', '')::int), 0) into hoogste
    from maps.items i
   where i.plan_id = new.plan_id and i.laag_id is not distinct from new.laag_id and i.id <> new.id and i.velden ? 'sign'
     and (i.velden -> 'sign' ->> 'nr') ~ '^\d+$';
  new.velden := jsonb_set(new.velden, '{sign,nr}', to_jsonb(hoogste + 1));
  return new;
exception when invalid_text_representation then
  return new;
end $$;

-- Triggers op de tabellen
create trigger bibliotheek_rev before update on maps.bibliotheek for each row execute function maps.rev_ophogen();
create trigger bibliotheek_updated before update on maps.bibliotheek for each row execute function maps.zet_updated_at();
create trigger items_log after insert or delete or update on maps.items for each row execute function maps.log_wijziging();
create trigger items_prullenbak after delete on maps.items for each row execute function maps.naar_prullenbak();
create trigger items_rev before update on maps.items for each row execute function maps.rev_ophogen();
create trigger items_sign_nummer before insert on maps.items for each row execute function maps.sign_nummer();
create trigger items_uit_prullenbak before insert on maps.items for each row execute function maps.uit_prullenbak();
create trigger items_updated before update on maps.items for each row execute function maps.zet_updated_at();
create trigger lagen_log after insert or delete or update on maps.lagen for each row execute function maps.log_wijziging();
create trigger lagen_rev before update on maps.lagen for each row execute function maps.rev_ophogen();
create trigger lagen_updated before update on maps.lagen for each row execute function maps.zet_updated_at();
create trigger leveranciers_updated before update on maps.leveranciers for each row execute function maps.zet_updated_at();
create trigger plan_wissen_bewaken before delete on maps.plannen for each row execute function maps.plan_wissen_bewaken();
create trigger plannen_log after update on maps.plannen for each row execute function maps.log_wijziging();
create trigger plannen_rev before update on maps.plannen for each row execute function maps.rev_ophogen();
create trigger plannen_updated before update on maps.plannen for each row execute function maps.zet_updated_at();
create trigger vaste_aansluitingen_updated before update on maps.vaste_aansluitingen for each row execute function maps.zet_updated_at();

-- RPC's van de editor (security invoker: RLS beperkt tot de eigen organisatie)

create function maps.item_wijzig(p_id uuid, p_rev bigint, p_patch jsonb) returns jsonb
language plpgsql set search_path = 'maps', 'public' as $$
declare
  cur maps.items%rowtype;
  nieuw maps.items%rowtype;
  cj jsonb;
  mijn text[] := '{}';
  hun text[];
  raak text[];
  hun_door uuid;
  k text; s text; w jsonb;
  totaal jsonb;
  status text := 'ok';
  pb record;
begin
  if not maps.mag_schrijven() then raise exception 'geen rechten' using errcode = '42501'; end if;
  p_patch := p_patch - 'id' - 'rev' - 'created_at' - 'updated_at' - 'geplaatst_op' - 'geplaatst_door' - 'organisatie_id';

  select * into cur from maps.items where id = p_id for update;
  if not found then
    select verwijderd_op, verwijderd_door into pb from maps.items_prullenbak where id = p_id and teruggezet_op is null;
    if found then
      return jsonb_build_object('status', 'verwijderd', 'door', pb.verwijderd_door, 'op', pb.verwijderd_op);
    end if;
    return jsonb_build_object('status', 'weg');
  end if;
  cj := to_jsonb(cur);

  for k in select jsonb_object_keys(p_patch) loop
    if k in ('velden', 'stijl', 'parameters') and jsonb_typeof(p_patch -> k) = 'object' then
      for s in select jsonb_object_keys(p_patch -> k) loop
        w := p_patch -> k -> s;
        if (cj -> k -> s) is distinct from (case when w = 'null'::jsonb then null else w end) then
          mijn := mijn || (k || '.' || s);
        end if;
      end loop;
    elsif coalesce(cj -> k, 'null'::jsonb) is distinct from coalesce(p_patch -> k, 'null'::jsonb) then
      mijn := mijn || k;
    end if;
  end loop;
  if cardinality(mijn) = 0 then
    return jsonb_build_object('status', 'ok', 'item', cj);
  end if;

  if p_rev is not null and cur.rev <> p_rev then
    select coalesce(array_agg(distinct p), '{}') into hun
      from maps.wijzigingen w2, unnest(w2.velden) p
     where w2.tabel = 'items' and w2.rij_id = p_id and w2.rev > p_rev and w2.door is distinct from auth.uid();
    raak := maps.paden_raken(mijn, hun);
    if cardinality(raak) > 0 then
      select w2.door into hun_door from maps.wijzigingen w2
       where w2.tabel = 'items' and w2.rij_id = p_id and w2.rev > p_rev and w2.door is distinct from auth.uid()
         and cardinality(maps.paden_raken(raak, w2.velden)) > 0
       order by w2.rev desc limit 1;
      return jsonb_build_object('status', 'botsing', 'item', cj, 'door', hun_door, 'paden', to_jsonb(raak));
    end if;
    status := 'samengevoegd';
  end if;

  totaal := cj;
  for k in select jsonb_object_keys(p_patch) loop
    if k in ('velden', 'stijl', 'parameters') and jsonb_typeof(p_patch -> k) = 'object' then
      totaal := totaal || jsonb_build_object(k, maps.jsonb_samenvoegen(totaal -> k, p_patch -> k));
    else
      totaal := totaal || jsonb_build_object(k, p_patch -> k);
    end if;
  end loop;
  nieuw := jsonb_populate_record(cur, totaal);

  update maps.items set
    plan_id = nieuw.plan_id, plek_id = nieuw.plek_id, laag_id = nieuw.laag_id, element_id = nieuw.element_id,
    groep_id = nieuw.groep_id, soort = nieuw.soort, geometrie = nieuw.geometrie, parameters = nieuw.parameters,
    stijl = nieuw.stijl, naam = nieuw.naam, notitie = nieuw.notitie, velden = nieuw.velden, fase_ids = nieuw.fase_ids,
    vergrendeld = nieuw.vergrendeld, verborgen = nieuw.verborgen, volgorde = nieuw.volgorde, bewerkt_door = auth.uid()
  where id = p_id
  returning * into nieuw;

  return jsonb_build_object('status', status, 'item', to_jsonb(nieuw));
end $$;

create function maps.items_terugzetten(p_ids uuid[]) returns setof maps.items
language plpgsql set search_path = 'maps', 'public' as $$
begin
  if not maps.mag_schrijven() then raise exception 'geen rechten' using errcode = '42501'; end if;
  return query
  insert into maps.items
  select (jsonb_populate_record(null::maps.items,
           to_jsonb(p) - 'verwijderd_op' - 'verwijderd_door' - 'teruggezet_op' || jsonb_build_object('bewerkt_door', auth.uid()))).*
    from maps.items_prullenbak p
   where p.id = any(p_ids) and p.teruggezet_op is null
     and (p.plan_id is null or exists (select 1 from maps.plannen pl where pl.id = p.plan_id))
  on conflict (id) do nothing
  returning *;
end $$;

create function maps.plan_instelling(p_plan uuid, p_pad text[], p_waarde jsonb) returns jsonb
language plpgsql set search_path = 'maps', 'public' as $$
declare r maps.plannen%rowtype;
begin
  if not maps.mag_schrijven() then raise exception 'geen rechten' using errcode = '42501'; end if;
  if p_pad is null or cardinality(p_pad) = 0 then raise exception 'pad ontbreekt'; end if;
  update maps.plannen
     set instellingen = maps.jsonb_zet_pad(coalesce(instellingen, '{}'::jsonb), p_pad, p_waarde),
         bewerkt_door = auth.uid()
   where id = p_plan
  returning * into r;
  if not found then raise exception 'plan niet gevonden'; end if;
  return jsonb_build_object('instellingen', r.instellingen, 'rev', r.rev);
end $$;

create function maps.plan_lijst(p_plan uuid, p_pad text[], p_bij jsonb, p_weg jsonb) returns jsonb
language plpgsql set search_path = 'maps', 'public' as $$
declare r maps.plannen%rowtype; huidig jsonb; nieuw jsonb;
begin
  if not maps.mag_schrijven() then raise exception 'geen rechten' using errcode = '42501'; end if;
  select * into r from maps.plannen where id = p_plan for update;
  if not found then raise exception 'plan niet gevonden'; end if;
  huidig := coalesce(r.instellingen #> p_pad, '[]'::jsonb);
  if jsonb_typeof(huidig) <> 'array' then huidig := '[]'::jsonb; end if;
  select coalesce(jsonb_agg(distinct v), '[]'::jsonb) into nieuw from (
    select v from jsonb_array_elements(huidig) v
     where not (v = any(array(select jsonb_array_elements(coalesce(p_weg, '[]'::jsonb)))))
    union
    select v from jsonb_array_elements(coalesce(p_bij, '[]'::jsonb)) v
  ) s;
  update maps.plannen set instellingen = maps.jsonb_zet_pad(coalesce(instellingen, '{}'::jsonb), p_pad, nieuw), bewerkt_door = auth.uid()
   where id = p_plan returning * into r;
  return jsonb_build_object('instellingen', r.instellingen, 'rev', r.rev);
end $$;

create function maps.plan_lijst_id(p_plan uuid, p_pad text[], p_zet jsonb, p_weg jsonb, p_volgorde jsonb) returns jsonb
language plpgsql set search_path = 'maps', 'public' as $$
declare r maps.plannen%rowtype; huidig jsonb; obj jsonb; nieuw jsonb; i int;
begin
  if not maps.mag_schrijven() then raise exception 'geen rechten' using errcode = '42501'; end if;
  select * into r from maps.plannen where id = p_plan for update;
  if not found then raise exception 'plan niet gevonden'; end if;
  huidig := coalesce(r.instellingen #> p_pad, '[]'::jsonb);
  if jsonb_typeof(huidig) <> 'array' then huidig := '[]'::jsonb; end if;
  select coalesce(jsonb_agg(e order by n), '[]'::jsonb) into huidig
    from jsonb_array_elements(huidig) with ordinality t(e, n)
   where not ((e ->> 'id') in (select jsonb_array_elements_text(coalesce(p_weg, '[]'::jsonb))));
  for obj in select jsonb_array_elements(coalesce(p_zet, '[]'::jsonb)) loop
    select (n - 1)::int into i from jsonb_array_elements(huidig) with ordinality t(e, n) where e ->> 'id' = obj ->> 'id' limit 1;
    if i is not null then huidig := jsonb_set(huidig, array[i::text], obj);
    else huidig := huidig || jsonb_build_array(obj); end if;
    i := null;
  end loop;
  if p_volgorde is not null and jsonb_typeof(p_volgorde) = 'array' then
    select coalesce(jsonb_agg(e order by coalesce(v.pos, 100000 + t.n)), '[]'::jsonb) into nieuw
      from jsonb_array_elements(huidig) with ordinality t(e, n)
      left join (select x, p as pos from jsonb_array_elements_text(p_volgorde) with ordinality v(x, p)) v on v.x = t.e ->> 'id';
    huidig := nieuw;
  end if;
  update maps.plannen set instellingen = maps.jsonb_zet_pad(coalesce(instellingen, '{}'::jsonb), p_pad, huidig), bewerkt_door = auth.uid()
   where id = p_plan returning * into r;
  return jsonb_build_object('instellingen', r.instellingen, 'rev', r.rev);
end $$;

create function maps.sign_hernummer(p_plan uuid, p_laag uuid, p_volgorde uuid[]) returns integer
language plpgsql set search_path = 'maps', 'public' as $$
declare i int := 0; id_ uuid;
begin
  if not maps.mag_schrijven() then raise exception 'geen rechten' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('maps-sign:' || p_plan::text || ':' || coalesce(p_laag::text, '-')));
  foreach id_ in array p_volgorde loop
    i := i + 1;
    update maps.items set velden = jsonb_set(velden, '{sign,nr}', to_jsonb(i)), bewerkt_door = auth.uid()
     where id = id_ and plan_id = p_plan and velden ? 'sign' and (velden -> 'sign' ->> 'nr') is distinct from i::text;
  end loop;
  return i;
end $$;

-- Hernoemen binnen de organisatie van die leverancier.
create function maps.leverancier_hernoem(p_oud text, p_nieuw text) returns integer
language plpgsql security definer set search_path = 'maps', 'public' as $$
declare n integer := 0; k integer; org uuid;
begin
  select organisatie_id into org from maps.leveranciers
   where naam = p_oud and organisatie_id = any (maps.mijn_organisaties('bewerker')) limit 1;
  if org is null then raise exception 'Geen schrijfrechten'; end if;
  p_nieuw := btrim(p_nieuw);
  if coalesce(p_nieuw, '') = '' or p_oud = p_nieuw then return 0; end if;
  if exists (select 1 from maps.leveranciers where organisatie_id = org and naam = p_nieuw) then raise exception 'Er bestaat al een leverancier "%"', p_nieuw; end if;
  update maps.leveranciers set naam = p_nieuw where organisatie_id = org and naam = p_oud;
  update maps.bibliotheek set leverancier = p_nieuw where organisatie_id = org and leverancier = p_oud; get diagnostics k = row_count; n := n + k;
  update maps.items set velden = jsonb_set(velden, '{herkomst}', to_jsonb(p_nieuw)) where organisatie_id = org and velden->>'herkomst' = p_oud; get diagnostics k = row_count; n := n + k;
  update maps.plannen p set instellingen = jsonb_set(p.instellingen, '{leveranciers}',
    (select jsonb_object_agg(e.key, case when e.value #>> '{}' = p_oud then to_jsonb(p_nieuw) else e.value end) from jsonb_each(p.instellingen->'leveranciers') e))
   where p.organisatie_id = org and jsonb_typeof(p.instellingen->'leveranciers') = 'object'
     and exists (select 1 from jsonb_each_text(p.instellingen->'leveranciers') e where e.value = p_oud);
  return n;
end $$;

create function maps.entry_zones(p_edition_id text) returns jsonb
language sql stable security definer set search_path = 'maps', 'public' as $$
  select jsonb_build_object('type', 'FeatureCollection', 'features', coalesce(jsonb_agg(jsonb_build_object(
           'type', 'Feature', 'geometry', i.geometrie,
           'properties', jsonb_build_object('id', i.id, 'naam', i.naam, 'soort', i.velden->'entry'->>'soort',
                                            'niveau', i.velden->'entry'->>'niveau', 'plan', p.naam, 'plan_id', p.id,
                                            'fasen', (select coalesce(jsonb_agg(f.naam), '[]'::jsonb) from maps.fasen f where f.id = any(i.fase_ids))))), '[]'::jsonb))
    from maps.items i
    join maps.plannen p on p.id = i.plan_id
   where p.edition_id = p_edition_id
     and i.velden ? 'entry'
     and not i.verborgen
     and p.organisatie_id = any (maps.mijn_organisaties('lezer'));
$$;

-- Wie ben ik in de actieve organisatie. 'role' blijft admin/editor/viewer voor de app;
-- bij een organisatie die enkel nog gelezen mag worden: viewer.
create function maps.ik() returns jsonb
language sql stable security definer set search_path = '' as $$
  with org as (
    select coalesce(nullif(maps.actieve_organisatie(), '00000000-0000-0000-0000-000000000000'::uuid),
                    (select case when count(*) = 1 then min(l.organisatie_id::text)::uuid end
                       from maps.leden l where l.user_id = auth.uid() and l.actief)) as id
  )
  select jsonb_build_object(
    'id', auth.uid(),
    'email', p.email,
    'display_name', coalesce(p.naam, split_part(p.email, '@', 1)),
    'rol', l.rol,
    'role', case when o.status not in ('proef','actief','achterstallig') then 'viewer'
                 when l.rol in ('eigenaar','beheerder') then 'admin'
                 when l.rol = 'bewerker' then 'editor' else 'viewer' end,
    'organisatie', jsonb_build_object('id', o.id, 'slug', o.slug, 'naam', o.naam, 'kort', o.kort, 'logo_pad', o.logo_pad,
                                      'status', o.status, 'pakket', o.pakket, 'modules', o.modules, 'proef_tot', o.proef_tot),
    'organisaties', (select coalesce(jsonb_agg(jsonb_build_object('slug', o2.slug, 'naam', o2.naam, 'rol', l2.rol) order by o2.naam), '[]'::jsonb)
                       from maps.leden l2 join maps.organisaties o2 on o2.id = l2.organisatie_id
                      where l2.user_id = auth.uid() and l2.actief and o2.status <> 'verwijderd'))
  from org
  join maps.leden l on l.organisatie_id = org.id and l.user_id = auth.uid() and l.actief
  join maps.organisaties o on o.id = l.organisatie_id
  left join maps.profielen p on p.id = auth.uid()
  where o.status in ('proef','actief','achterstallig','alleen_lezen') or (o.status = 'geblokkeerd' and l.rol = 'eigenaar');
$$;

-- ----------------------------------------------------------------------------
-- 6. Deellinks (zonder login)
-- ----------------------------------------------------------------------------

create function maps.deel_link_kop(p_token text) returns jsonb
language sql stable security definer set search_path = 'maps', 'public' as $$
  select jsonb_build_object(
    'naam', d.naam, 'plan', p.naam, 'editie', p.editie_naam, 'locatie', p.locatie,
    'taal', coalesce(d.opties->>'taal', 'nl'),
    'organisatie', o.naam,
    'binnen', (select i.naam from maps.items i where i.plan_id = p.id and i.id::text = nullif(d.opties->>'binnen', '')))
  from maps.deel_links d
  join maps.plannen p on p.id = d.plan_id
  join maps.organisaties o on o.id = d.organisatie_id
  where p_token is not null and length(p_token) >= 20 and d.token = p_token
    and d.ingetrokken_op is null and (d.geldig_tot is null or d.geldig_tot > now())
    and maps.org_deelbaar(d.organisatie_id);
$$;

create function maps.deel_link_lezen(p_token text) returns jsonb
language plpgsql security definer set search_path = 'maps', 'public' as $$
declare
  dl maps.deel_links%rowtype;
  pl maps.plannen%rowtype;
  org maps.organisaties%rowtype;
  met_notities boolean;
  lev text;
  met_attesten boolean;
  verb_el text[];
  verb_it text[];
  verb_soort text[];
  snap jsonb := null;
  v_versie integer; v_op timestamptz;
  v_host text;
  v_drie text;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select * into dl from maps.deel_links
   where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found then return null; end if;
  if not maps.org_deelbaar(dl.organisatie_id) then return null; end if;
  select * into org from maps.organisaties where id = dl.organisatie_id;
  select * into pl from maps.plannen where id = dl.plan_id;
  if not found then return null; end if;

  if not dl.live and dl.versie_id is not null then
    select v.momentopname, v.versie, v.created_at into snap, v_versie, v_op from maps.versies v where v.id = dl.versie_id;
    if not found then snap := null; end if;
  end if;

  update maps.deel_links set keer_geopend = keer_geopend + 1 where id = dl.id;
  met_notities := coalesce((dl.opties->>'notities')::boolean, false);
  lev := coalesce(dl.opties->>'leverancier', '');
  met_attesten := coalesce((dl.opties->>'attesten')::boolean, true);
  v_host := nullif(dl.opties->>'binnen', '');
  v_drie := nullif(dl.opties->>'drie', '');
  verb_el := array(select jsonb_array_elements_text(coalesce(pl.instellingen->'verborgen_elementen', '[]'::jsonb))
                   union select jsonb_array_elements_text(coalesce(dl.opties->'verberg_elementen', '[]'::jsonb)));
  verb_it := array(select jsonb_array_elements_text(coalesce(dl.opties->'verberg_items', '[]'::jsonb)));
  verb_soort := array(select jsonb_array_elements_text(coalesce(dl.opties->'verberg_soorten', '[]'::jsonb)));

  return (
    with bron as (
      select i.* from maps.items i where snap is null and i.plan_id = pl.id
      union all
      select s.* from jsonb_populate_recordset(null::maps.items, coalesce(snap->'items', '[]'::jsonb)) s where snap is not null
    ), bron_lagen as (
      select l.* from maps.lagen l where snap is null and l.plan_id = pl.id
      union all
      select s.* from jsonb_populate_recordset(null::maps.lagen, coalesce(snap->'lagen', '[]'::jsonb)) s where snap is not null
    ), met_herkomst as (
      select i.*, coalesce(nullif(btrim(i.velden->>'herkomst'), ''), b.leverancier, pl.instellingen->'leveranciers'->>b.categorie, '') as herkomst
        from bron i left join maps.bibliotheek b on b.id = i.element_id
    ), zicht as (
      select i.* from met_herkomst i
       where not coalesce(i.verborgen, false)
         and (case when v_drie is not null then i.id::text = v_drie
                   when v_host is not null
                   then (i.id::text = v_host or i.velden->'binnen'->>'host' = v_host)
                   else (i.laag_id = any(dl.laag_ids)
                         or i.velden->'binnen'->>'host' in (select h.id::text from met_herkomst h where h.laag_id = any(dl.laag_ids) and not coalesce(h.verborgen, false))) end)
         and (lev = '' or (i.element_id is not null and i.herkomst = lev))
         and (dl.fase_ids is null or cardinality(dl.fase_ids) = 0 or i.fase_ids is null or i.fase_ids && dl.fase_ids)
         and not (i.id::text = any(verb_it))
         and not (i.element_id is not null and i.element_id::text = any(verb_el))
         and not (i.element_id is null and i.soort = any(verb_soort))
    )
    select jsonb_build_object(
      'organisatie', jsonb_build_object('slug', org.slug, 'naam', org.naam, 'kort', org.kort, 'logo_pad', org.logo_pad),
      'link', jsonb_build_object('id', dl.id, 'naam', dl.naam, 'opties', dl.opties, 'live', dl.live,
                                 'stand', case when snap is not null then jsonb_build_object('versie', v_versie, 'op', v_op) end),
      'plan', jsonb_build_object('id', pl.id, 'naam', pl.naam, 'editie_naam', pl.editie_naam,
                                 'locatie', pl.locatie, 'centrum', pl.centrum, 'zoom', pl.zoom,
                                 'basiskaart', pl.basiskaart, 'versie', coalesce(v_versie, pl.versie),
                                 'titelblok', pl.titelblok, 'updated_at', case when snap is not null then v_op else pl.updated_at end,
                                 'instellingen', jsonb_build_object('stroom', case when coalesce((dl.opties->>'stroom')::boolean, false) then pl.instellingen->'stroom' end, 'verborgen_elementen', to_jsonb(verb_el),
                                   'onderleggers', case when v_host is not null then coalesce((select jsonb_agg(o) from jsonb_array_elements(coalesce(pl.instellingen->'onderleggers', '[]'::jsonb)) o where o->'binnen'->>'host' = v_host), '[]'::jsonb) else coalesce((select jsonb_agg(o) from jsonb_array_elements(coalesce(pl.instellingen->'onderleggers', '[]'::jsonb)) o where o->'binnen'->>'host' in (select z.id::text from zicht z)), '[]'::jsonb) end)),
      'lagen', coalesce((select jsonb_agg(to_jsonb(l) order by l.volgorde) from bron_lagen l where l.id = any(dl.laag_ids) or l.id in (select z.laag_id from zicht z)), '[]'),
      'items', coalesce((select jsonb_agg(jsonb_build_object(
                           'id', i.id, 'laag_id', i.laag_id, 'element_id', i.element_id,
                           'soort', i.soort, 'geometrie', i.geometrie, 'parameters', i.parameters,
                           'stijl', i.stijl, 'naam', i.naam, 'herkomst', nullif(i.herkomst, ''), 'fase_ids', i.fase_ids,
                           'notitie', case when met_notities then i.notitie end,
                           'velden', case when met_notities then i.velden
                                          else coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(i.velden, '{}'::jsonb)) e
                                                          where e.key in ('binnen', 'binnenplan', 'meubel', 'punt', 'ruimte', 'functie', 'functies', 'max_personen', 'doeken', 'vlaggen', 'paneel_1', 'paneel_2', 'paneel_3', 'paneel_4', 'ontwerp', 'wand', 'truss', 'vloer', 'montage', 'doek_naam', 'verdieping', 'toebehoren', 'fracties', 'dichtheid', 'nr', 'camera', 'tvcamera', 'stelling', 'tent', 'licht', 'kabelcam', 'tvkabel')
                                                             or (met_attesten and e.key = 'attesten') or (coalesce((dl.opties->>'stroom')::boolean, false) and e.key = 'stroom')), '{}'::jsonb) end))
                         from zicht i), '[]'),
      'elementen', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'naam', b.naam, 'categorie', b.categorie,
                           'tekenwijze', b.tekenwijze, 'breedte_m', b.breedte_m, 'diepte_m', b.diepte_m,
                           'eenheid_m', b.eenheid_m, 'hoogte_m', b.hoogte_m, 'stijl', b.stijl, 'icoon', b.icoon,
                           'eigenschappen', coalesce((select jsonb_object_agg(e.key, case when e.key = 'wand' and jsonb_typeof(e.value) = 'object' then e.value - 'voorraad' else e.value end) from jsonb_each(b.eigenschappen) e
                                                       where e.key in ('tekening_ref', 'tekening', 'doek', 'doek_kleur', 'totem', 'vlag', 'kleur', 'afmeting', 'beeld', 'drager', 'fietsen_per_stuk', 'module', 'veiligheid', 'vluchtweg', 'frame', 'drape', 'meubel', 'tafel', 'huis', 'zitplaatsen', 'binnenlocatie', 'wand', 'truss_doek', 'rijen_standaard', 'tekening_rekken', 'montages', 'banen', 'helling', 'materiaal', 'paal_naam', 'stapelbaar', 'strak', 'toebehoren', 'verspring_m', 'verspringend_standaard', 'vlaghouder', 'vloer', 'fracties', 'stekkerdoos', 'generator', 'stelling', 'stelling3d', 'familie', 'licht', 'kabelcam', 'kraan', 'tvcamera', 'subgroep') or (coalesce((dl.opties->>'stroom')::boolean, false) and e.key in ('kva', 'uitgangen', 'ampere', 'kabeltype', 'kabel_lengtes', 'tank_l', 'liter_per_uur', 'aansluitingen', 'ingang', 'kw', 'rol', 'fase', 'afzekering', 'rolstoel', 'eigen_kabel_m'))), '{}'::jsonb)))
                         from maps.bibliotheek b
                        where not (b.id::text = any(verb_el))
                          and (b.organisatie_id is null or b.organisatie_id = dl.organisatie_id)
                          and (b.id in (select z.element_id from zicht z)
                               or b.id::text in (select jsonb_array_elements_text(case when jsonb_typeof(z.velden->'doeken') = 'array' then z.velden->'doeken' else '[]'::jsonb end) from zicht z)
                               or b.id::text in (select jsonb_array_elements_text(case when jsonb_typeof(z.velden->'vlaggen') = 'array' then z.velden->'vlaggen' else '[]'::jsonb end) from zicht z)
                               or b.id::text in (select z.velden->>k from zicht z, unnest(array['paneel_1','paneel_2','paneel_3','paneel_4','ontwerp']) k)
                               or b.id::text in (select z.velden->'meubel'->>'stoel_huis' from zicht z)
                               or b.id::text in (select z.velden->'kabelcam'->>'verreiker' from zicht z)
                               or b.id::text in (select b2.eigenschappen->'kabelcam'->>'verreiker' from maps.bibliotheek b2 where b2.id in (select z.element_id from zicht z))
                               or b.id::text in (select v->>k from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->'wand'->'vrij') = 'array' then z.velden->'wand'->'vrij' else '[]'::jsonb end) v, unnest(array['voor','achter']) k)
                               or b.id::text in (select v->>k from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->'truss'->'doeken') = 'array' then z.velden->'truss'->'doeken' else '[]'::jsonb end) v, unnest(array['voor','achter']) k)
                               or b.id::text in (select v->>'voor' from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->'stelling'->'doeken') = 'array' then z.velden->'stelling'->'doeken' else '[]'::jsonb end) v)
                               or b.id::text in (select e.value #>> '{}' from zicht z, jsonb_each(case when jsonb_typeof(z.velden->'tent'->'doeken') = 'object' then z.velden->'tent'->'doeken' else '{}'::jsonb end) e)
                               or b.id::text in (select e.value #>> '{}' from zicht z, unnest(array['voor','achter']) k, jsonb_each(case when jsonb_typeof(z.velden->'wand'->k) = 'object' then z.velden->'wand'->k else '{}'::jsonb end) e)
                               or b.id::text in (select e #>> '{}' from zicht z, unnest(array['voor','achter']) k, jsonb_array_elements(case when jsonb_typeof(z.velden->'wand'->k) = 'array' then z.velden->'wand'->k else '[]'::jsonb end) e))), '[]'),
      'fotos', case when v_host is not null then coalesce((select jsonb_agg(jsonb_build_object('item_id', f.item_id, 'pad', f.pad, 'mini', f.meta->>'mini') order by f.created_at) from maps.bestanden f where f.soort = 'foto' and f.item_id in (select z.id from zicht z)), '[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('item_id', f.item_id, 'pad', f.pad, 'mini', f.meta->>'mini') order by f.created_at) from maps.bestanden f where f.soort = 'foto' and f.item_id in (select z.id from zicht z where z.velden ? 'binnen')), '[]'::jsonb) end,
      'stellingplannen', coalesce((select jsonb_agg(jsonb_build_object('item_id', f.item_id, 'pad', f.pad, 'naam', f.meta->>'naam') order by f.created_at) from maps.bestanden f where f.soort = 'stellingplan' and f.item_id in (select z.id from zicht z)), '[]'::jsonb),
      'vast', case when coalesce((dl.opties->>'stroom')::boolean, false) then
                 coalesce((select jsonb_agg(to_jsonb(v) - 'sleutel' - 'contact' - 'ean' - 'aangemaakt_door' - 'bewerkt_door' - 'organisatie_id')
                             from maps.vaste_aansluitingen v
                            where v.organisatie_id = dl.organisatie_id
                              and ('va:' || v.id::text) in (select z.velden->'stroom'->>'voeding' from zicht z
                                                             union select z.velden->'stroom'->>'van' from zicht z
                                                             union select a->>'voeding' from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->'stroom'->'aansluitingen') = 'array' then z.velden->'stroom'->'aansluitingen' else '[]'::jsonb end) a)), '[]'::jsonb)
               else '[]'::jsonb end,
      'veldpunten', case when coalesce((dl.opties->>'opmerkingen')::boolean, false) then
                       coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'punt', o.punt, 'auteur', coalesce(o.auteur_naam, org.kort, org.naam),
                                                                     'tekst', o.tekst, 'status', o.status, 'op', o.created_at, 'eigen', o.deel_link_id = dl.id) order by o.created_at)
                                   from maps.opmerkingen o where o.plan_id = pl.id and o.punt is not null and o.item_id is null and o.status = 'open'), '[]')
                     else '[]'::jsonb end,
      'opmerkingen', case when coalesce((dl.opties->>'opmerkingen')::boolean, false) then
                       coalesce((select jsonb_agg(jsonb_build_object('item_id', o.item_id, 'auteur', coalesce(o.auteur_naam, org.kort, org.naam),
                                                                     'tekst', o.tekst, 'status', o.status, 'op', o.created_at)
                                                  order by o.created_at)
                                   from maps.opmerkingen o
                                   join zicht i on i.id = o.item_id), '[]')
                     else '[]'::jsonb end
    )
  );
end $$;

create function maps.deel_link_opmerking(p_token text, p_item uuid, p_naam text, p_tekst text) returns boolean
language plpgsql security definer set search_path = 'maps', 'public' as $$
declare dl maps.deel_links%rowtype;
begin
  if p_token is null or length(p_token) < 20 or coalesce(trim(p_tekst), '') = '' then return false; end if;
  select * into dl from maps.deel_links
   where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found or not coalesce((dl.opties->>'opmerkingen')::boolean, false) then return false; end if;
  if not maps.org_deelbaar(dl.organisatie_id) then return false; end if;
  if not exists (select 1 from maps.items i where i.id = p_item and i.plan_id = dl.plan_id and i.laag_id = any(dl.laag_ids)) then
    return false;
  end if;
  insert into maps.opmerkingen (organisatie_id, item_id, auteur_naam, deel_link_id, tekst)
  values (dl.organisatie_id, p_item, left(coalesce(nullif(trim(p_naam), ''), dl.naam), 80), dl.id, left(trim(p_tekst), 2000));
  return true;
end $$;

create function maps.deel_link_punt(p_token text, p_lng double precision, p_lat double precision, p_naam text, p_tekst text) returns uuid
language plpgsql security definer set search_path = 'maps', 'public' as $$
declare dl maps.deel_links%rowtype; pl maps.plannen%rowtype; v_id uuid;
begin
  if p_token is null or length(p_token) < 20 or coalesce(trim(p_tekst), '') = '' then return null; end if;
  if p_lng is null or p_lat is null or p_lng < -180 or p_lng > 180 or p_lat < -85 or p_lat > 85 then return null; end if;
  select * into dl from maps.deel_links
   where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found or not coalesce((dl.opties->>'opmerkingen')::boolean, false) then return null; end if;
  if not maps.org_deelbaar(dl.organisatie_id) then return null; end if;
  select * into pl from maps.plannen where id = dl.plan_id; if not found then return null; end if;
  if pl.centrum is not null and jsonb_typeof(to_jsonb(pl.centrum)) = 'array'
     and (abs((to_jsonb(pl.centrum)->>0)::float - p_lng) > 0.3 or abs((to_jsonb(pl.centrum)->>1)::float - p_lat) > 0.2) then return null; end if;
  insert into maps.opmerkingen (organisatie_id, item_id, plan_id, punt, auteur_naam, deel_link_id, tekst)
  values (dl.organisatie_id, null, dl.plan_id, jsonb_build_array(round(p_lng::numeric, 7), round(p_lat::numeric, 7)), left(coalesce(nullif(trim(p_naam), ''), dl.naam), 80), dl.id, left(trim(p_tekst), 2000))
  returning id into v_id;
  return v_id;
end $$;

create function maps.deel_link_punt_wijzig(p_token text, p_id uuid, p_lng double precision, p_lat double precision, p_tekst text, p_weg boolean default false) returns boolean
language plpgsql security definer set search_path = 'maps', 'public' as $$
declare dl maps.deel_links%rowtype; pl maps.plannen%rowtype; o maps.opmerkingen%rowtype;
begin
  if p_token is null or length(p_token) < 20 or p_id is null then return false; end if;
  select * into dl from maps.deel_links where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found or not coalesce((dl.opties->>'opmerkingen')::boolean, false) then return false; end if;
  if not maps.org_deelbaar(dl.organisatie_id) then return false; end if;
  select * into o from maps.opmerkingen where id = p_id and deel_link_id = dl.id and plan_id = dl.plan_id and punt is not null and item_id is null and status = 'open';
  if not found then return false; end if;
  if p_weg then delete from maps.opmerkingen where id = o.id; return true; end if;
  select * into pl from maps.plannen where id = dl.plan_id;
  if p_lng is not null and p_lat is not null then
    if p_lng < -180 or p_lng > 180 or p_lat < -85 or p_lat > 85 then return false; end if;
    if pl.centrum is not null and jsonb_typeof(to_jsonb(pl.centrum)) = 'array'
       and (abs((to_jsonb(pl.centrum)->>0)::float - p_lng) > 0.3 or abs((to_jsonb(pl.centrum)->>1)::float - p_lat) > 0.2) then return false; end if;
  end if;
  update maps.opmerkingen set
    punt = case when p_lng is not null and p_lat is not null then jsonb_build_array(round(p_lng::numeric, 7), round(p_lat::numeric, 7)) else punt end,
    tekst = case when coalesce(trim(p_tekst), '') <> '' then left(trim(p_tekst), 2000) else tekst end
  where id = o.id;
  return true;
end $$;

create function maps.deel_link_feedback(p_token text, p_naam text, p_soort text, p_tekst text, p_context jsonb) returns boolean
language plpgsql security definer set search_path = 'maps', 'public' as $$
declare dl maps.deel_links%rowtype;
begin
  if p_token is null or length(p_token) < 20 then return false; end if;
  select * into dl from maps.deel_links where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found then return false; end if;
  if not maps.org_deelbaar(dl.organisatie_id) then return false; end if;
  if coalesce(length(trim(p_tekst)), 0) = 0 then return false; end if;
  insert into maps.feedback (organisatie_id, auteur_id, auteur_naam, soort, tekst, plan_id, deel_link_id, context)
  values (dl.organisatie_id, null, left(nullif(trim(p_naam), ''), 120), case when p_soort in ('probleem', 'idee', 'vraag') then p_soort else 'probleem' end,
          left(p_tekst, 5000), dl.plan_id, dl.id, coalesce(p_context, '{}'::jsonb) || jsonb_build_object('bron', 'deellink'));
  return true;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Leden, plaatsen, uitnodigingen
-- ----------------------------------------------------------------------------

-- Plaatsen: eigenaar, beheerder en bewerker tellen (ook openstaande uitnodigingen
-- voor zo'n rol). Lezers apart, tot lezers_max.
create function maps.plaatsen_in_gebruik(p_org uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plaatsen', (select count(*) from maps.leden where organisatie_id = p_org and actief and rol <> 'lezer')
              + (select count(*) from maps.uitnodigingen where organisatie_id = p_org and aanvaard_op is null and geldig_tot > now() and rol <> 'lezer'),
    'lezers',   (select count(*) from maps.leden where organisatie_id = p_org and actief and rol = 'lezer')
              + (select count(*) from maps.uitnodigingen where organisatie_id = p_org and aanvaard_op is null and geldig_tot > now() and rol = 'lezer'),
    'plaatsen_max', o.plaatsen, 'lezers_max', o.lezers_max)
  from maps.organisaties o where o.id = p_org;
$$;

create function maps.plaatsen_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  g jsonb;
  betalend boolean := (n ->> 'rol') <> 'lezer';
  telde_al boolean := false;   -- telt deze rij al mee in plaatsen_in_gebruik (oude toestand)?
begin
  if tg_table_name = 'uitnodigingen' and n ->> 'aanvaard_op' is not null then return new; end if;
  if tg_table_name = 'leden' and not coalesce((n ->> 'actief')::boolean, true) then return new; end if;
  if o is not null then
    if coalesce((o ->> 'actief')::boolean, false) and (o ->> 'rol') = (n ->> 'rol') then return new; end if;
    telde_al := coalesce((o ->> 'actief')::boolean, false) and (((o ->> 'rol') <> 'lezer') = betalend);
  end if;
  if telde_al then return new; end if;
  g := maps.plaatsen_in_gebruik((n ->> 'organisatie_id')::uuid);
  if betalend and (g ->> 'plaatsen')::int + 1 > (g ->> 'plaatsen_max')::int then
    raise exception 'Alle % plaatsen zijn in gebruik. Koop plaatsen bij of maak iemand lezer.', g ->> 'plaatsen_max' using errcode = 'P0001';
  end if;
  if not betalend and (g ->> 'lezers')::int + 1 > (g ->> 'lezers_max')::int then
    raise exception 'Het maximum van % lezers is bereikt.', g ->> 'lezers_max' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger leden_plaatsen before insert or update on maps.leden for each row execute function maps.plaatsen_bewaken();
create trigger uitnodigingen_plaatsen before insert on maps.uitnodigingen for each row execute function maps.plaatsen_bewaken();

-- Eigenaars beschermen: enkel een eigenaar maakt of wijzigt een eigenaar, en er blijft er altijd één.
create function maps.eigenaar_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  org uuid := coalesce((n ->> 'organisatie_id')::uuid, (o ->> 'organisatie_id')::uuid);
  ik_eigenaar boolean;
begin
  if auth.uid() is not null then  -- zonder gebruiker: service role of SQL Editor
    select exists (select 1 from maps.leden where organisatie_id = org and user_id = auth.uid() and rol = 'eigenaar' and actief) into ik_eigenaar;
    -- De eerste eigenaar van een nieuwe organisatie mag zichzelf toevoegen.
    if tg_op = 'INSERT' and (n ->> 'user_id')::uuid = auth.uid()
       and not exists (select 1 from maps.leden where organisatie_id = org and rol = 'eigenaar') then
      ik_eigenaar := true;
    end if;
    if not ik_eigenaar and ((n ->> 'rol') = 'eigenaar' or (o ->> 'rol') = 'eigenaar') then
      raise exception 'Enkel een eigenaar kan eigenaars toevoegen, wijzigen of verwijderen.' using errcode = '42501';
    end if;
  end if;
  if (o ->> 'rol') = 'eigenaar' and coalesce((o ->> 'actief')::boolean, false)
     and (n is null or (n ->> 'rol') <> 'eigenaar' or not coalesce((n ->> 'actief')::boolean, false))
     and not exists (select 1 from maps.leden where organisatie_id = org and rol = 'eigenaar' and actief and user_id <> (o ->> 'user_id')::uuid)
     and exists (select 1 from maps.organisaties where id = org) then  -- niet bij het wissen van de hele organisatie
    raise exception 'Er moet minstens één eigenaar blijven.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger leden_eigenaar before insert or update or delete on maps.leden for each row execute function maps.eigenaar_bewaken();

-- Pakket, plaatsen, modules en status wijzigen enkel via Toolen (platform of Stripe-webhook).
create function maps.organisatie_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or maps.is_platformbeheerder() then return new; end if;
  if (new.status, new.pakket, new.plaatsen, new.lezers_max, new.modules, new.limieten, new.proef_tot, new.slug,
      new.stripe_klant_id, new.stripe_abonnement_id, new.status_sinds)
     is distinct from
     (old.status, old.pakket, old.plaatsen, old.lezers_max, old.modules, old.limieten, old.proef_tot, old.slug,
      old.stripe_klant_id, old.stripe_abonnement_id, old.status_sinds) then
    raise exception 'Pakket, plaatsen, modules, status en adres wijzig je via het abonnement.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger organisaties_bewaken before update on maps.organisaties for each row execute function maps.organisatie_bewaken();

-- Uitnodiging aanvaarden: het e-mailadres van de uitnodiging moet dat van de ingelogde gebruiker zijn.
create function maps.uitnodiging_aanvaarden(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u maps.uitnodigingen%rowtype; mijn_email text; o maps.organisaties%rowtype;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd' using errcode = '42501'; end if;
  select email into mijn_email from auth.users where id = auth.uid();
  select * into u from maps.uitnodigingen where token = p_token and aanvaard_op is null and geldig_tot > now();
  if not found then raise exception 'Deze uitnodiging is niet (meer) geldig.' using errcode = 'P0001'; end if;
  if lower(u.email) <> lower(mijn_email) then
    raise exception 'Deze uitnodiging is voor %. Log in met dat adres.', u.email using errcode = '42501';
  end if;
  update maps.uitnodigingen set aanvaard_op = now() where id = u.id;
  insert into maps.leden (organisatie_id, user_id, rol, uitgenodigd_door)
  values (u.organisatie_id, auth.uid(), u.rol, u.uitgenodigd_door)
  on conflict (organisatie_id, user_id) do update set actief = true, rol = excluded.rol;
  insert into maps.logboek_organisatie (organisatie_id, actie, details) values (u.organisatie_id, 'uitnodiging_aanvaard', jsonb_build_object('email', u.email, 'rol', u.rol));
  select * into o from maps.organisaties where id = u.organisatie_id;
  return jsonb_build_object('slug', o.slug, 'naam', o.naam);
end $$;

-- Nieuwe organisatie: wie ze maakt wordt eigenaar; proefperiode van 30 dagen.
create function maps.organisatie_aanmaken(p_naam text, p_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd' using errcode = '42501'; end if;
  if coalesce(btrim(p_naam), '') = '' then raise exception 'Naam ontbreekt' using errcode = 'P0001'; end if;
  insert into maps.organisaties (naam, slug, kort, proef_tot)
  values (btrim(p_naam), lower(btrim(p_slug)), left(btrim(p_naam), 24), now() + interval '30 days')
  returning id into v_id;
  insert into maps.leden (organisatie_id, user_id, rol) values (v_id, auth.uid(), 'eigenaar');
  insert into maps.logboek_organisatie (organisatie_id, actie, details) values (v_id, 'organisatie_aangemaakt', jsonb_build_object('naam', p_naam, 'slug', p_slug));
  return jsonb_build_object('id', v_id, 'slug', lower(btrim(p_slug)));
exception when unique_violation then
  raise exception 'Het adres %.toolen.be is al in gebruik.', lower(btrim(p_slug)) using errcode = 'P0001';
end $$;

-- Profiel bijhouden bij aanmaken en wijzigen van een gebruiker.
create function maps.profiel_bijwerken() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into maps.profielen (id, email, naam)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do update set email = excluded.email, naam = coalesce(excluded.naam, maps.profielen.naam);
  return new;
end $$;

create trigger maps_profiel after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function maps.profiel_bijwerken();

insert into maps.profielen (id, email, naam)
select id, coalesce(email, ''), coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name') from auth.users
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 8. Row level security
-- ----------------------------------------------------------------------------

alter table maps.organisaties        enable row level security;
alter table maps.profielen           enable row level security;
alter table maps.leden               enable row level security;
alter table maps.uitnodigingen       enable row level security;
alter table maps.platform_beheerders enable row level security;
alter table maps.logboek_organisatie enable row level security;
alter table maps.plekken             enable row level security;
alter table maps.plannen             enable row level security;
alter table maps.bibliotheek         enable row level security;
alter table maps.lagen               enable row level security;
alter table maps.fasen               enable row level security;
alter table maps.items               enable row level security;
alter table maps.items_prullenbak    enable row level security;
alter table maps.versies             enable row level security;
alter table maps.deel_links          enable row level security;
alter table maps.opmerkingen         enable row level security;
alter table maps.bestanden           enable row level security;
alter table maps.leveranciers        enable row level security;
alter table maps.vaste_aansluitingen enable row level security;
alter table maps.feedback            enable row level security;
alter table maps.wijzigingen         enable row level security;

-- Organisaties: leden zien hun organisatie, eigenaars passen naam/logo/adres aan.
create policy lezen on maps.organisaties for select to authenticated
  using (id in (select unnest(maps.lid_van())) or maps.is_platformbeheerder());
create policy wijzigen on maps.organisaties for update to authenticated
  using (id in (select unnest(maps.mijn_organisaties('eigenaar'))) or maps.is_platformbeheerder())
  with check (id in (select unnest(maps.mijn_organisaties('eigenaar'))) or maps.is_platformbeheerder());
create policy platform on maps.organisaties for all to authenticated
  using (maps.is_platformbeheerder()) with check (maps.is_platformbeheerder());

-- Profielen: je eigen profiel, en dat van collega's in een gemeenschappelijke organisatie.
create policy lezen on maps.profielen for select to authenticated
  using (id = auth.uid() or id in (select user_id from maps.leden where organisatie_id in (select unnest(maps.lid_van()))));
create policy eigen on maps.profielen for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Leden: zichtbaar voor alle leden van de organisatie; beheren door beheerders.
create policy lezen on maps.leden for select to authenticated
  using (user_id = auth.uid() or organisatie_id in (select unnest(maps.lid_van())));
create policy beheren on maps.leden for all to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))))
  with check (organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))));

create policy beheren on maps.uitnodigingen for all to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))))
  with check (organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))));

create policy lezen on maps.platform_beheerders for select to authenticated using (user_id = auth.uid());

create policy lezen on maps.logboek_organisatie for select to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))) or maps.is_platformbeheerder());

-- Gewone tabellen: lezen voor lezers, schrijven voor bewerkers van de organisatie.
do $$
declare t text;
begin
  foreach t in array array['plekken','plannen','lagen','fasen','items','versies','deel_links','bestanden','vaste_aansluitingen'] loop
    execute format('create policy lezen on maps.%I for select to authenticated using (organisatie_id in (select unnest(maps.mijn_organisaties(''lezer''))))', t);
    execute format('create policy schrijven on maps.%I for all to authenticated using (organisatie_id in (select unnest(maps.mijn_organisaties(''bewerker'')))) with check (organisatie_id in (select unnest(maps.mijn_organisaties(''bewerker''))))', t);
  end loop;
end $$;

create policy lezen on maps.items_prullenbak for select to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('lezer'))));
create policy lezen on maps.wijzigingen for select to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('lezer'))));

-- Bibliotheek: publieke catalogus voor iedereen; eigen bibliotheek beheren door beheerders,
-- elementen van één plan, sjablonen en snelstijlen ook door bewerkers.
create policy lezen on maps.bibliotheek for select to authenticated
  using (organisatie_id is null or organisatie_id in (select unnest(maps.mijn_organisaties('lezer'))));
create policy schrijven on maps.bibliotheek for all to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('beheerder')))
         or (organisatie_id in (select unnest(maps.mijn_organisaties('bewerker'))) and (plan_id is not null or categorie in ('Sjablonen', 'Snelstijlen'))))
  with check (organisatie_id in (select unnest(maps.mijn_organisaties('beheerder')))
         or (organisatie_id in (select unnest(maps.mijn_organisaties('bewerker'))) and (plan_id is not null or categorie in ('Sjablonen', 'Snelstijlen'))));

create policy lezen on maps.leveranciers for select to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('lezer'))));
create policy maken on maps.leveranciers for insert to authenticated
  with check (organisatie_id in (select unnest(maps.mijn_organisaties('bewerker'))));
create policy wijzigen on maps.leveranciers for update to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('bewerker'))))
  with check (organisatie_id in (select unnest(maps.mijn_organisaties('bewerker'))));
create policy wissen on maps.leveranciers for delete to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))));

create policy lezen on maps.opmerkingen for select to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('lezer'))));
create policy plaatsen on maps.opmerkingen for insert to authenticated
  with check (organisatie_id in (select unnest(maps.mijn_organisaties('lezer'))) and auteur_id = auth.uid());
create policy schrijven on maps.opmerkingen for all to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('bewerker'))))
  with check (organisatie_id in (select unnest(maps.mijn_organisaties('bewerker'))));

create policy lezen on maps.feedback for select to authenticated
  using (auteur_id = auth.uid() or organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))) or maps.is_platformbeheerder());
create policy geven on maps.feedback for insert to authenticated
  with check (organisatie_id in (select unnest(maps.mijn_organisaties('lezer'))) and auteur_id = auth.uid());
create policy behandelen on maps.feedback for update to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))) or maps.is_platformbeheerder())
  with check (organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))) or maps.is_platformbeheerder());
create policy wissen on maps.feedback for delete to authenticated
  using (organisatie_id in (select unnest(maps.mijn_organisaties('beheerder'))));

-- ----------------------------------------------------------------------------
-- 9. Rechten op schema, tabellen en functies
-- ----------------------------------------------------------------------------

grant usage on schema maps to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema maps to authenticated;
revoke insert, update, delete on maps.items_prullenbak, maps.wijzigingen, maps.logboek_organisatie, maps.platform_beheerders from authenticated;
revoke insert, delete on maps.organisaties, maps.profielen from authenticated;
grant select on maps.toegang to authenticated;
grant all on all tables in schema maps to service_role;
grant usage, select on all sequences in schema maps to authenticated, service_role;

-- Functies: standaard voor niemand, daarna gericht.
revoke execute on all functions in schema maps from public, anon, authenticated;
grant execute on all functions in schema maps to service_role;
grant execute on function
  maps.ik(), maps.mag_lezen(), maps.mag_schrijven(), maps.mag_beheren(),
  maps.mijn_organisaties(text), maps.actieve_organisatie(), maps.enige_organisatie(), maps.is_platformbeheerder(), maps.lid_van(),
  maps.rol_rang(text), maps.org_deelbaar(uuid), maps.plaatsen_in_gebruik(uuid),
  maps.item_wijzig(uuid, bigint, jsonb), maps.items_terugzetten(uuid[]),
  maps.plan_instelling(uuid, text[], jsonb), maps.plan_lijst(uuid, text[], jsonb, jsonb),
  maps.plan_lijst_id(uuid, text[], jsonb, jsonb, jsonb), maps.sign_hernummer(uuid, uuid, uuid[]),
  maps.leverancier_hernoem(text, text), maps.entry_zones(text),
  maps.jsonb_samenvoegen(jsonb, jsonb), maps.jsonb_zet_pad(jsonb, text[], jsonb),
  maps.paden_raken(text[], text[]), maps.verschil_paden(jsonb, jsonb),
  maps.uitnodiging_aanvaarden(text), maps.organisatie_aanmaken(text, text)
  to authenticated;
grant execute on function
  maps.deel_link_kop(text), maps.deel_link_lezen(text), maps.deel_link_opmerking(text, uuid, text, text),
  maps.deel_link_punt(text, double precision, double precision, text, text),
  maps.deel_link_punt_wijzig(text, uuid, double precision, double precision, text, boolean),
  maps.deel_link_feedback(text, text, text, text, jsonb),
  maps.actieve_organisatie(), maps.org_deelbaar(uuid), maps.rol_rang(text)
  to anon, authenticated;

alter default privileges in schema maps revoke execute on functions from public;

-- ----------------------------------------------------------------------------
-- 10. Opslag (bucket maps) en realtime
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('maps', 'maps', true)
on conflict (id) do nothing;

-- Lezen is publiek (deellinks en pdf's gebruiken de publieke URL).
-- Opladen: wie in een organisatie mag schrijven. Wijzigen en wissen: wie het bestand
-- opleverde, of een beheerder. Volgende stap: paden per organisatie (<organisatie_id>/…).
create policy maps_opladen on storage.objects for insert to authenticated
  with check (bucket_id = 'maps' and (maps.mag_schrijven() or (name like 'feedback/%' and maps.mag_lezen())));
create policy maps_wijzigen on storage.objects for update to authenticated
  using (bucket_id = 'maps' and (owner_id = auth.uid()::text or maps.mag_beheren()));
create policy maps_wissen on storage.objects for delete to authenticated
  using (bucket_id = 'maps' and (owner_id = auth.uid()::text or maps.mag_beheren()));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table maps.items, maps.items_prullenbak, maps.lagen, maps.opmerkingen, maps.plannen;
  end if;
end $$;
