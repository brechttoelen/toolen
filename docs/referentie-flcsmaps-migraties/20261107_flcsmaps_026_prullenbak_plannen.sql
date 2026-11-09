-- Plannen gaan eerst naar de prullenbak (verwijderd_op). Definitief verwijderen kan pas
-- als een plan minstens 90 dagen in de prullenbak ligt; de database bewaakt dat zelf.
alter table flcsmaps.plannen add column if not exists verwijderd_op timestamptz;
alter table flcsmaps.plannen add column if not exists verwijderd_door uuid;
create index if not exists plannen_verwijderd_op on flcsmaps.plannen (verwijderd_op) where verwijderd_op is not null;

create or replace function flcsmaps.plan_wissen_bewaken() returns trigger
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

drop trigger if exists plan_wissen_bewaken on flcsmaps.plannen;
create trigger plan_wissen_bewaken before delete on flcsmaps.plannen for each row execute function flcsmaps.plan_wissen_bewaken();
