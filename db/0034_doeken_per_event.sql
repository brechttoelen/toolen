-- 0034 · Doeken (banners, vlaggen, panelen) per event in plaats van per plan.
-- Bereik van een doek: event_id gezet = enkel in de plannen van dat event; anders de hele organisatie.
-- (plan_id blijft bestaan voor andere plan-eigen elementen, maar een doek met een event heeft nooit een plan_id.)
alter table maps.bibliotheek add column if not exists event_id uuid references maps.events(id) on delete set null;
create index if not exists bibliotheek_event_idx on maps.bibliotheek(event_id) where event_id is not null;

create or replace function maps.bibliotheek_event_bewaken() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_id is not null then
    if not exists (select 1 from maps.events e where e.id = new.event_id and e.organisatie_id = new.organisatie_id) then
      raise exception 'Dit event hoort niet bij deze organisatie.';
    end if;
    new.plan_id := null;
  end if;
  return new;
end $$;
revoke execute on function maps.bibliotheek_event_bewaken() from public, anon, authenticated;
drop trigger if exists bibliotheek_zevent on maps.bibliotheek;
create trigger bibliotheek_zevent before insert or update of event_id, plan_id, organisatie_id on maps.bibliotheek
  for each row execute function maps.bibliotheek_event_bewaken();

update maps.bibliotheek b set event_id = p.event_id, plan_id = null
  from maps.plannen p where p.id = b.plan_id and b.tekenwijze = 'doek' and p.event_id is not null;
update maps.bibliotheek b set plan_id = null
 where b.tekenwijze = 'doek' and b.plan_id is not null;
