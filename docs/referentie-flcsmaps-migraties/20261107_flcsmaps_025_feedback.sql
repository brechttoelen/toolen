-- FLCS Maps 025: feedback van testers (probleem, idee, vraag) met de context waar het over gaat:
-- scherm, werkruimte, gereedschap, geselecteerd item, aangewezen knop of veld, kaartbeeld en een schermafdruk.
create table if not exists flcsmaps.feedback (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  auteur_id     uuid default auth.uid(),
  auteur_naam   text,
  soort         text not null default 'probleem' check (soort in ('probleem', 'idee', 'vraag')),
  tekst         text not null check (length(tekst) between 1 and 5000),
  status        text not null default 'nieuw' check (status in ('nieuw', 'bekeken', 'gepland', 'opgelost', 'niet')),
  plan_id       uuid,          -- losse verwijzing (geen foreign key): feedback blijft als een plan weg is
  item_id       uuid,
  deel_link_id  uuid,
  context       jsonb not null default '{}'::jsonb,
  schermafdruk  text,          -- pad in de bucket 'flcsmaps' (feedback/…)
  antwoord      text,
  afgehandeld_door uuid,
  afgehandeld_op timestamptz
);
create index if not exists feedback_tijd on flcsmaps.feedback(created_at desc);
create index if not exists feedback_plan on flcsmaps.feedback(plan_id);

alter table flcsmaps.feedback enable row level security;
grant select, insert, update, delete on flcsmaps.feedback to authenticated;
grant select, insert, update, delete on flcsmaps.feedback to service_role;

-- Iedereen met toegang (ook lezers) mag feedback geven en de eigen feedback zien; beheerders zien en behandelen alles.
drop policy if exists feedback_geven on flcsmaps.feedback;
create policy feedback_geven on flcsmaps.feedback for insert to authenticated
  with check (flcsmaps.mag_lezen() and auteur_id = auth.uid());
drop policy if exists feedback_lezen on flcsmaps.feedback;
create policy feedback_lezen on flcsmaps.feedback for select to authenticated
  using (auteur_id = auth.uid() or flcsmaps.mag_beheren());
drop policy if exists feedback_behandelen on flcsmaps.feedback;
create policy feedback_behandelen on flcsmaps.feedback for update to authenticated
  using (flcsmaps.mag_beheren()) with check (flcsmaps.mag_beheren());
drop policy if exists feedback_wissen on flcsmaps.feedback;
create policy feedback_wissen on flcsmaps.feedback for delete to authenticated
  using (flcsmaps.mag_beheren());

-- Schermafdrukken: ook lezers mogen in de map feedback/ opladen.
drop policy if exists flcsmaps_feedback_opladen on storage.objects;
create policy flcsmaps_feedback_opladen on storage.objects for insert to authenticated
  with check (bucket_id = 'flcsmaps' and name like 'feedback/%' and flcsmaps.mag_lezen());

-- Feedback vanuit een deellink (zonder login).
create or replace function flcsmaps.deel_link_feedback(p_token text, p_naam text, p_soort text, p_tekst text, p_context jsonb)
returns boolean language plpgsql security definer set search_path = flcsmaps, public as $$
declare dl flcsmaps.deel_links%rowtype;
begin
  if p_token is null or length(p_token) < 20 then return false; end if;
  select * into dl from flcsmaps.deel_links where token = p_token and ingetrokken_op is null and (geldig_tot is null or geldig_tot > now());
  if not found then return false; end if;
  if coalesce(length(trim(p_tekst)), 0) = 0 then return false; end if;
  insert into flcsmaps.feedback (auteur_id, auteur_naam, soort, tekst, plan_id, deel_link_id, context)
  values (null, left(nullif(trim(p_naam), ''), 120), case when p_soort in ('probleem', 'idee', 'vraag') then p_soort else 'probleem' end,
          left(p_tekst, 5000), dl.plan_id, dl.id, coalesce(p_context, '{}'::jsonb) || jsonb_build_object('bron', 'deellink'));
  return true;
end $$;
revoke all on function flcsmaps.deel_link_feedback(text, text, text, text, jsonb) from public;
grant execute on function flcsmaps.deel_link_feedback(text, text, text, text, jsonb) to anon, authenticated, service_role;
