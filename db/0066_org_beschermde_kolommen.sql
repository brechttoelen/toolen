-- Abonnement, modules en fiche-tabs: enkel de platformbeheerder (of de server) wijzigt ze, niet de eigenaar.
create or replace function maps.org_bescherm() returns trigger language plpgsql set search_path = maps, public as $$
begin
  if current_user in ('authenticated', 'anon') and not maps.is_platformbeheerder() and (
    new.pakket is distinct from old.pakket or new.plaatsen is distinct from old.plaatsen or new.lezers_max is distinct from old.lezers_max
    or new.modules is distinct from old.modules or new.status is distinct from old.status or new.status_sinds is distinct from old.status_sinds
    or new.proef_tot is distinct from old.proef_tot or new.limieten is distinct from old.limieten or new.sso is distinct from old.sso
    or new.sso_verplicht is distinct from old.sso_verplicht or new.slug is distinct from old.slug
    or new.stripe_klant_id is distinct from old.stripe_klant_id or new.stripe_abonnement_id is distinct from old.stripe_abonnement_id
    or new.fiche_tabs_uit is distinct from old.fiche_tabs_uit or new.created_at is distinct from old.created_at or new.id is distinct from old.id
  ) then
    raise exception 'Abonnement, modules en instellingen van het platform wijzigt enkel de platformbeheerder.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists org_bescherm on maps.organisaties;
create trigger org_bescherm before update on maps.organisaties for each row execute function maps.org_bescherm();
