-- FLCS Maps 006 – samenwerken zonder elkaar te overschrijven (fase 1, database).
-- * rev per rij (items, lagen, plannen, bibliotheek), verhoogd door een trigger
-- * logboek flcsmaps.wijzigingen: wie, wanneer, welke velden (per item, laag en plan)
-- * prullenbak: verwijderde items 90 dagen terug te zetten, zonder dat lezers moeten filteren
-- * item_wijzig(): enkel gewijzigde velden, met controle op de gekende versie en
--   automatisch samenvoegen als een ander andere velden aanpaste
-- * plan_instelling(): één pad in plannen.instellingen zetten in plaats van het hele blok
-- * bordpuntnummers uniek per laag, ook bij gelijktijdig plaatsen
-- * realtime voor items, prullenbak, lagen, plannen en opmerkingen
-- * bibliotheek (gedeeld, zonder plan): enkel beheerders mogen wijzigen
-- * deel-links: vaste versie of live

-- ---------- rev ----------
alter table flcsmaps.items       add column if not exists rev bigint not null default 1;
alter table flcsmaps.lagen       add column if not exists rev bigint not null default 1;
alter table flcsmaps.lagen       add column if not exists updated_at timestamptz not null default now();
alter table flcsmaps.plannen     add column if not exists rev bigint not null default 1;
alter table flcsmaps.bibliotheek add column if not exists rev bigint not null default 1;

create or replace function flcsmaps.rev_ophogen()
returns trigger language plpgsql set search_path = flcsmaps, public as $$
begin
  new.rev := coalesce(old.rev, 0) + 1;
  return new;
end $$;

create or replace trigger items_rev before update on flcsmaps.items for each row execute function flcsmaps.rev_ophogen();
create or replace trigger lagen_rev before update on flcsmaps.lagen for each row execute function flcsmaps.rev_ophogen();
create or replace trigger lagen_updated before update on flcsmaps.lagen for each row execute function flcsmaps.zet_updated_at();
create or replace trigger plannen_rev before update on flcsmaps.plannen for each row execute function flcsmaps.rev_ophogen();
create or replace trigger bibliotheek_rev before update on flcsmaps.bibliotheek for each row execute function flcsmaps.rev_ophogen();

-- ---------- paden die verschillen ----------
-- Bovenste kolommen; van velden, stijl, parameters en instellingen ook de sleutel eronder
-- ('velden.stroom', 'instellingen.signalisatie').
create or replace function flcsmaps.verschil_paden(o jsonb, n jsonb)
returns text[] language plpgsql immutable set search_path = flcsmaps, public as $$
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

-- Twee lijsten paden raken elkaar als een pad gelijk is aan, of ligt onder, een pad van de andere.
create or replace function flcsmaps.paden_raken(a text[], b text[])
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct x), '{}') from unnest(a) x, unnest(b) y
   where x = y or x like y || '.%' or y like x || '.%';
$$;

-- ---------- logboek ----------
create table if not exists flcsmaps.wijzigingen (
  id      bigint generated always as identity primary key,
  plan_id uuid,
  tabel   text not null,          -- items | lagen | plannen
  rij_id  uuid not null,
  actie   text not null,          -- nieuw | wijzig | verwijder | terug
  rev     bigint,
  velden  text[] not null default '{}',
  door    uuid,
  op      timestamptz not null default now()
);
create index if not exists wijzigingen_rij on flcsmaps.wijzigingen(rij_id, rev);
create index if not exists wijzigingen_plan on flcsmaps.wijzigingen(plan_id, op desc);
alter table flcsmaps.wijzigingen enable row level security;
create policy lezen on flcsmaps.wijzigingen for select to authenticated using (flcsmaps.mag_lezen());
grant select on flcsmaps.wijzigingen to authenticated;
grant all on flcsmaps.wijzigingen to service_role;

create or replace function flcsmaps.log_wijziging()
returns trigger language plpgsql security definer set search_path = flcsmaps, public as $$
declare
  paden text[];
  plan uuid;
  wie uuid;
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb;
begin
  -- via jsonb: niet elke tabel heeft plan_id of bewerkt_door
  r := coalesce(n, o);
  plan := case when tg_table_name = 'plannen' then (r->>'id')::uuid else coalesce((n->>'plan_id')::uuid, (o->>'plan_id')::uuid) end;
  wie := coalesce(auth.uid(), (r->>'bewerkt_door')::uuid);
  if tg_op = 'INSERT' then
    insert into flcsmaps.wijzigingen (plan_id, tabel, rij_id, actie, rev, door)
    values (plan, tg_table_name, (n->>'id')::uuid, 'nieuw', (n->>'rev')::bigint, wie);
    return new;
  elsif tg_op = 'UPDATE' then
    paden := flcsmaps.verschil_paden(o, n);
    if cardinality(paden) = 0 then return new; end if;
    insert into flcsmaps.wijzigingen (plan_id, tabel, rij_id, actie, rev, velden, door)
    values (plan, tg_table_name, (n->>'id')::uuid, 'wijzig', (n->>'rev')::bigint, paden, wie);
    return new;
  else
    insert into flcsmaps.wijzigingen (plan_id, tabel, rij_id, actie, rev, door)
    values (plan, tg_table_name, (o->>'id')::uuid, 'verwijder', (o->>'rev')::bigint, auth.uid());
    return old;
  end if;
end $$;

create or replace trigger items_log after insert or update or delete on flcsmaps.items for each row execute function flcsmaps.log_wijziging();
create or replace trigger lagen_log after insert or update or delete on flcsmaps.lagen for each row execute function flcsmaps.log_wijziging();
create or replace trigger plannen_log after update on flcsmaps.plannen for each row execute function flcsmaps.log_wijziging();

-- ---------- prullenbak ----------
create table if not exists flcsmaps.items_prullenbak (like flcsmaps.items including defaults);
alter table flcsmaps.items_prullenbak add column if not exists verwijderd_op timestamptz not null default now();
alter table flcsmaps.items_prullenbak add column if not exists verwijderd_door uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'items_prullenbak_pkey') then
    alter table flcsmaps.items_prullenbak add primary key (id);
  end if;
end $$;
create index if not exists items_prullenbak_plan on flcsmaps.items_prullenbak(plan_id, verwijderd_op desc);
alter table flcsmaps.items_prullenbak enable row level security;
create policy lezen on flcsmaps.items_prullenbak for select to authenticated using (flcsmaps.mag_lezen());
grant select on flcsmaps.items_prullenbak to authenticated;
grant all on flcsmaps.items_prullenbak to service_role;

alter table flcsmaps.items_prullenbak add column if not exists teruggezet_op timestamptz;

create or replace function flcsmaps.naar_prullenbak()
returns trigger language plpgsql security definer set search_path = flcsmaps, public as $$
begin
  insert into flcsmaps.items_prullenbak
  select (jsonb_populate_record(null::flcsmaps.items_prullenbak,
           to_jsonb(old) || jsonb_build_object('verwijderd_op', now(), 'verwijderd_door', auth.uid(), 'teruggezet_op', null))).*
  on conflict (id) do update set verwijderd_op = excluded.verwijderd_op, verwijderd_door = excluded.verwijderd_door, teruggezet_op = null,
    geometrie = excluded.geometrie, velden = excluded.velden, stijl = excluded.stijl, parameters = excluded.parameters,
    laag_id = excluded.laag_id, naam = excluded.naam, rev = excluded.rev;
  return old;
end $$;
create or replace trigger items_prullenbak after delete on flcsmaps.items for each row execute function flcsmaps.naar_prullenbak();

-- Een item dat (opnieuw) ingevoegd wordt, telt niet meer als verwijderd (ongedaan maken).
create or replace function flcsmaps.uit_prullenbak()
returns trigger language plpgsql security definer set search_path = flcsmaps, public as $$
begin
  update flcsmaps.items_prullenbak set teruggezet_op = now() where id = new.id and teruggezet_op is null;
  return new;
end $$;
create or replace trigger items_uit_prullenbak before insert on flcsmaps.items for each row execute function flcsmaps.uit_prullenbak();

create or replace function flcsmaps.items_terugzetten(p_ids uuid[])
returns setof flcsmaps.items language plpgsql security invoker set search_path = flcsmaps, public as $$
begin
  if not flcsmaps.mag_schrijven() then raise exception 'geen rechten' using errcode = '42501'; end if;
  return query
  insert into flcsmaps.items
  select (jsonb_populate_record(null::flcsmaps.items,
           to_jsonb(p) - 'verwijderd_op' - 'verwijderd_door' - 'teruggezet_op' || jsonb_build_object('bewerkt_door', auth.uid()))).*
    from flcsmaps.items_prullenbak p
   where p.id = any(p_ids) and p.teruggezet_op is null
     and (p.plan_id is null or exists (select 1 from flcsmaps.plannen pl where pl.id = p.plan_id))
  on conflict (id) do nothing
  returning *;
end $$;

-- ---------- jsonb helpers ----------
-- Sleutels samenvoegen; een sleutel met JSON null wordt weggenomen.
create or replace function flcsmaps.jsonb_samenvoegen(a jsonb, b jsonb)
returns jsonb language sql immutable as $$
  select (coalesce(case when jsonb_typeof(a) = 'object' then a end, '{}'::jsonb)
          || coalesce((select jsonb_object_agg(key, value) from jsonb_each(b) where value <> 'null'::jsonb), '{}'::jsonb))
         - coalesce(array(select key from jsonb_each(b) where value = 'null'::jsonb), '{}'::text[]);
$$;

-- Een pad zetten en ontbrekende tussenliggende objecten aanmaken; waarde null = pad wegnemen.
create or replace function flcsmaps.jsonb_zet_pad(doc jsonb, pad text[], waarde jsonb)
returns jsonb language plpgsql immutable as $$
declare basis jsonb := case when jsonb_typeof(doc) = 'object' then doc else '{}'::jsonb end;
begin
  if cardinality(pad) = 0 then return waarde; end if;
  if cardinality(pad) = 1 then
    if waarde is null or waarde = 'null'::jsonb then return basis - pad[1]; end if;
    return basis || jsonb_build_object(pad[1], waarde);
  end if;
  return basis || jsonb_build_object(pad[1], flcsmaps.jsonb_zet_pad(basis -> pad[1], pad[2:], waarde));
end $$;

-- ---------- item_wijzig ----------
-- p_patch: enkel de gewijzigde kolommen. Voor velden, stijl en parameters enkel de gewijzigde
-- sleutels (null = sleutel weg). p_rev = de versie die de gebruiker kende.
-- Antwoord: {status: ok | samengevoegd | botsing | verwijderd | weg, item, door?, paden?}
create or replace function flcsmaps.item_wijzig(p_id uuid, p_rev bigint, p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = flcsmaps, public as $$
declare
  cur flcsmaps.items%rowtype;
  nieuw flcsmaps.items%rowtype;
  mijn text[] := '{}';
  hun text[];
  raak text[];
  hun_door uuid;
  k text;
  totaal jsonb;
  status text := 'ok';
  pb record;
begin
  if not flcsmaps.mag_schrijven() then raise exception 'geen rechten' using errcode = '42501'; end if;
  p_patch := p_patch - 'id' - 'rev' - 'created_at' - 'updated_at' - 'geplaatst_op' - 'geplaatst_door';

  select * into cur from flcsmaps.items where id = p_id for update;
  if not found then
    select verwijderd_op, verwijderd_door into pb from flcsmaps.items_prullenbak where id = p_id and teruggezet_op is null;
    if found then
      return jsonb_build_object('status', 'verwijderd', 'door', pb.verwijderd_door, 'op', pb.verwijderd_op);
    end if;
    return jsonb_build_object('status', 'weg');
  end if;

  for k in select jsonb_object_keys(p_patch) loop
    if k in ('velden', 'stijl', 'parameters') and jsonb_typeof(p_patch -> k) = 'object' then
      mijn := mijn || coalesce(array(select k || '.' || s from jsonb_object_keys(p_patch -> k) s), '{}');
    else
      mijn := mijn || k;
    end if;
  end loop;

  if p_rev is not null and cur.rev <> p_rev then
    select coalesce(array_agg(distinct p), '{}'), (array_agg(w.door order by w.rev desc))[1]
      into hun, hun_door
      from flcsmaps.wijzigingen w, unnest(w.velden) p
     where w.tabel = 'items' and w.rij_id = p_id and w.rev > p_rev;
    raak := flcsmaps.paden_raken(mijn, hun);
    if cardinality(raak) > 0 then
      return jsonb_build_object('status', 'botsing', 'item', to_jsonb(cur), 'door', hun_door, 'paden', to_jsonb(raak));
    end if;
    status := 'samengevoegd';
  end if;

  totaal := to_jsonb(cur);
  for k in select jsonb_object_keys(p_patch) loop
    if k in ('velden', 'stijl', 'parameters') and jsonb_typeof(p_patch -> k) = 'object' then
      totaal := totaal || jsonb_build_object(k, flcsmaps.jsonb_samenvoegen(totaal -> k, p_patch -> k));
    else
      totaal := totaal || jsonb_build_object(k, p_patch -> k);
    end if;
  end loop;
  nieuw := jsonb_populate_record(cur, totaal);

  update flcsmaps.items set
    plan_id = nieuw.plan_id, plek_id = nieuw.plek_id, laag_id = nieuw.laag_id, element_id = nieuw.element_id,
    groep_id = nieuw.groep_id, soort = nieuw.soort, geometrie = nieuw.geometrie, parameters = nieuw.parameters,
    stijl = nieuw.stijl, naam = nieuw.naam, notitie = nieuw.notitie, velden = nieuw.velden, fase_ids = nieuw.fase_ids,
    vergrendeld = nieuw.vergrendeld, verborgen = nieuw.verborgen, volgorde = nieuw.volgorde, bewerkt_door = auth.uid()
  where id = p_id
  returning * into nieuw;

  return jsonb_build_object('status', status, 'item', to_jsonb(nieuw));
end $$;

-- ---------- planinstellingen per pad ----------
create or replace function flcsmaps.plan_instelling(p_plan uuid, p_pad text[], p_waarde jsonb)
returns jsonb language plpgsql security invoker set search_path = flcsmaps, public as $$
declare r flcsmaps.plannen%rowtype;
begin
  if not flcsmaps.mag_schrijven() then raise exception 'geen rechten' using errcode = '42501'; end if;
  if p_pad is null or cardinality(p_pad) = 0 then raise exception 'pad ontbreekt'; end if;
  update flcsmaps.plannen
     set instellingen = flcsmaps.jsonb_zet_pad(coalesce(instellingen, '{}'::jsonb), p_pad, p_waarde),
         bewerkt_door = auth.uid()
   where id = p_plan
  returning * into r;
  if not found then raise exception 'plan niet gevonden'; end if;
  return jsonb_build_object('instellingen', r.instellingen, 'rev', r.rev);
end $$;

-- Een lijst (array) in de instellingen als verzameling aanpassen: toevoegen en wegnemen zonder dubbels.
create or replace function flcsmaps.plan_lijst(p_plan uuid, p_pad text[], p_bij jsonb, p_weg jsonb)
returns jsonb language plpgsql security invoker set search_path = flcsmaps, public as $$
declare r flcsmaps.plannen%rowtype; huidig jsonb; nieuw jsonb;
begin
  if not flcsmaps.mag_schrijven() then raise exception 'geen rechten' using errcode = '42501'; end if;
  select * into r from flcsmaps.plannen where id = p_plan for update;
  if not found then raise exception 'plan niet gevonden'; end if;
  huidig := coalesce(r.instellingen #> p_pad, '[]'::jsonb);
  if jsonb_typeof(huidig) <> 'array' then huidig := '[]'::jsonb; end if;
  select coalesce(jsonb_agg(distinct v), '[]'::jsonb) into nieuw from (
    select v from jsonb_array_elements(huidig) v
     where not (v = any(array(select jsonb_array_elements(coalesce(p_weg, '[]'::jsonb)))))
    union
    select v from jsonb_array_elements(coalesce(p_bij, '[]'::jsonb)) v
  ) s;
  update flcsmaps.plannen set instellingen = flcsmaps.jsonb_zet_pad(coalesce(instellingen, '{}'::jsonb), p_pad, nieuw), bewerkt_door = auth.uid()
   where id = p_plan returning * into r;
  return jsonb_build_object('instellingen', r.instellingen, 'rev', r.rev);
end $$;

-- ---------- bordpuntnummers ----------
-- Een bordpunt met een nummer dat in die laag al bestaat, krijgt het volgende vrije nummer.
create or replace function flcsmaps.sign_nummer()
returns trigger language plpgsql security definer set search_path = flcsmaps, public as $$
declare nr int; hoogste int;
begin
  if new.velden is null or not (new.velden ? 'sign') or new.plan_id is null then return new; end if;
  if exists (select 1 from flcsmaps.items where id = new.id) then return new; end if;  -- upsert van een bestaand item
  nr := nullif(new.velden -> 'sign' ->> 'nr', '')::int;
  perform pg_advisory_xact_lock(hashtext('flcsmaps-sign:' || new.plan_id::text || ':' || coalesce(new.laag_id::text, '-')));
  if nr is not null and not exists (
       select 1 from flcsmaps.items i
        where i.plan_id = new.plan_id and i.laag_id is not distinct from new.laag_id and i.id <> new.id
          and i.velden ? 'sign' and (i.velden -> 'sign' ->> 'nr') = nr::text) then
    return new;
  end if;
  select coalesce(max(nullif(i.velden -> 'sign' ->> 'nr', '')::int), 0) into hoogste
    from flcsmaps.items i
   where i.plan_id = new.plan_id and i.laag_id is not distinct from new.laag_id and i.id <> new.id and i.velden ? 'sign'
     and (i.velden -> 'sign' ->> 'nr') ~ '^\d+$';
  new.velden := jsonb_set(new.velden, '{sign,nr}', to_jsonb(hoogste + 1));
  return new;
exception when invalid_text_representation then
  return new;
end $$;
create or replace trigger items_sign_nummer before insert on flcsmaps.items for each row execute function flcsmaps.sign_nummer();

-- Hernummeren in één stap: p_volgorde = item-ids in de gewenste volgorde.
create or replace function flcsmaps.sign_hernummer(p_plan uuid, p_laag uuid, p_volgorde uuid[])
returns integer language plpgsql security invoker set search_path = flcsmaps, public as $$
declare i int := 0; id_ uuid;
begin
  if not flcsmaps.mag_schrijven() then raise exception 'geen rechten' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('flcsmaps-sign:' || p_plan::text || ':' || coalesce(p_laag::text, '-')));
  foreach id_ in array p_volgorde loop
    i := i + 1;
    update flcsmaps.items set velden = jsonb_set(velden, '{sign,nr}', to_jsonb(i)), bewerkt_door = auth.uid()
     where id = id_ and plan_id = p_plan and velden ? 'sign' and (velden -> 'sign' ->> 'nr') is distinct from i::text;
  end loop;
  return i;
end $$;

-- ---------- rechten op de functies ----------
grant execute on function flcsmaps.item_wijzig(uuid, bigint, jsonb) to authenticated;
grant execute on function flcsmaps.plan_instelling(uuid, text[], jsonb) to authenticated;
grant execute on function flcsmaps.plan_lijst(uuid, text[], jsonb, jsonb) to authenticated;
grant execute on function flcsmaps.items_terugzetten(uuid[]) to authenticated;
grant execute on function flcsmaps.sign_hernummer(uuid, uuid, uuid[]) to authenticated;

-- ---------- bibliotheek: gedeelde elementen enkel door beheerders ----------
create or replace function flcsmaps.mag_beheren()
returns boolean language sql stable security definer set search_path = publitool, public as $$
  select exists (select 1 from publitool.access a where a.user_id = auth.uid() and a.rol = 'admin');
$$;
grant execute on function flcsmaps.mag_beheren() to authenticated;
grant execute on function flcsmaps.mag_bibliotheek(uuid, text) to authenticated;

-- Plan-objecten (CAD), sjablonen en snelstijlen blijven voor editors.
create or replace function flcsmaps.mag_bibliotheek(p_plan uuid, p_categorie text)
returns boolean language sql stable as $$
  select flcsmaps.mag_beheren()
      or (flcsmaps.mag_schrijven() and (p_plan is not null or p_categorie in ('Sjablonen', 'Snelstijlen')));
$$;
alter policy schrijven on flcsmaps.bibliotheek using (flcsmaps.mag_bibliotheek(plan_id, categorie)) with check (flcsmaps.mag_bibliotheek(plan_id, categorie));

-- ---------- deel-links: vaste versie of live ----------
alter table flcsmaps.deel_links add column if not exists live boolean not null default true;
alter table flcsmaps.deel_links add column if not exists versie_id uuid references flcsmaps.versies(id) on delete set null;

-- ---------- realtime ----------
do $$
declare t text;
begin
  foreach t in array array['items', 'items_prullenbak', 'lagen', 'plannen', 'opmerkingen'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'flcsmaps' and tablename = t) then
      execute format('alter publication supabase_realtime add table flcsmaps.%I', t);
    end if;
  end loop;
end $$;
alter table flcsmaps.lagen replica identity full;   -- verwijderde lagen live (klein)

-- ---------- opruimen ----------
-- Apart uit te voeren in de SQL-editor (bevat delete-opdrachten):
-- select cron.schedule('flcsmaps-opruimen', '17 3 * * *', $c$
--   delete from flcsmaps.items_prullenbak where verwijderd_op < now() - interval '90 days' or teruggezet_op is not null;
--   delete from flcsmaps.wijzigingen where op < now() - interval '400 days';
-- $c$);
