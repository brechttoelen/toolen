-- Test van 0013_huisstijl.sql (na test_0012). Rolt terug.
\set QUIET on
begin;
create or replace function pg_temp.ok(voorwaarde boolean, wat text) returns void language plpgsql as $$
begin if voorwaarde is not true then raise exception 'MISLUKT: %', wat; end if; raise notice 'ok  %', wat; end $$;
create or replace function pg_temp.als(u text, claims jsonb) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u, ''), false);
  perform set_config('request.jwt.claims', (coalesce(claims, '{}')::jsonb || jsonb_build_object('sub', u))::text, false);
  perform set_config('request.headers', '{}', false);
end $$;
update maps.organisaties set huisstijl = '{"primair":"#E30613","accent":"#E30613","logo_licht":"https://x.supabase.co/a.png"}', modules = modules || '{huisstijl}' where slug = 'flcs';
select pg_temp.ok((maps.huisstijl('FLCS') ->> 'primair') = '#E30613', 'huisstijl per bedrijfscode');
select pg_temp.ok(maps.huisstijl('vrt') is null, 'zonder huisstijl: null');
update maps.organisaties set modules = array_remove(modules, 'huisstijl') where slug = 'flcs';
select pg_temp.ok(maps.huisstijl('flcs') is null, 'zonder module: niets');
-- Eigenaar mag de huisstijl niet wijzigen.
select pg_temp.als('00000000-0000-0000-0000-00000000000a', '{"aal":"aal2"}');
set role authenticated;
do $$ begin
  update maps.organisaties set huisstijl = '{"primair":"#000000"}' where slug = 'flcs';
  if exists (select 1 from maps.organisaties where slug = 'flcs' and huisstijl ->> 'primair' = '#000000') then raise exception 'MISLUKT: eigenaar wijzigde de huisstijl'; end if;
  raise notice 'ok  eigenaar wijzigt de huisstijl niet';
exception when others then if sqlerrm like 'MISLUKT%' then raise; end if; raise notice 'ok  eigenaar wijzigt de huisstijl niet';
end $$;
reset role;
select pg_temp.als(null, null);
do $$ begin
  update maps.organisaties set huisstijl = '{"primair":"rood"}' where slug = 'flcs';
  raise exception 'MISLUKT: foute kleur aanvaard';
exception when others then if sqlerrm like 'MISLUKT%' then raise; end if; raise notice 'ok  foute kleur geweigerd';
end $$;
rollback;
