-- Rechtentest voor de projectfiche (0043–0050). Draait volledig in één DO-blok en eindigt
-- met een fout 'RAPPORT: …', zodat niets bewaard blijft. Verwacht: tien keer ok, geen FOUT.
-- Gebruikt een eigenaar en een tweede lid van flcs; die krijgt tijdelijk bewerker en lezer.
-- 'aal2' in de claims omdat mijn_organisaties MFA controleert.
do $$
declare r text := ''; pid uuid; org uuid; n int; tid uuid; did uuid; slid uuid; lev uuid; pers uuid; ok boolean; st text;
  eig text; ander text;
begin
  select id into org from maps.organisaties where slug = 'flcs';
  select user_id::text into eig from maps.leden where organisatie_id = org and rol = 'eigenaar' and actief limit 1;
  select user_id::text into ander from maps.leden where organisatie_id = org and rol = 'beheerder' and actief limit 1;
  select id into pid from maps.plannen where organisatie_id = org and event_id is not null limit 1;
  select id into lev from maps.leveranciers where organisatie_id = org limit 1;
  perform set_config('request.headers', '{"x-organisatie":"flcs"}', true);

  perform set_config('request.jwt.claims', json_build_object('sub', eig, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  begin insert into maps.taken (plan_id, titel) values (pid, 'x'); r := r || '1 FOUT taak zonder module | ';
  exception when others then r := r || '1 ok zonder module geweigerd | '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{}', true);
  update maps.organisaties set modules = array_append(modules, 'fiche') where id = org and not ('fiche' = any (modules));
  perform set_config('request.jwt.claims', json_build_object('sub', eig, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  execute 'set local role authenticated';
  insert into maps.taken (plan_id, titel) values (pid, 'test') returning id into tid;
  insert into maps.taak_dagen (taak_id, dag) values (tid, -2) returning id into did;
  select count(*) into n from maps.taak_dagen where id = did and plan_id = pid and organisatie_id = org;
  r := r || '2 taak+dag ' || case when n = 1 then 'ok (plan en org gevuld)' else 'FOUT' end || ' | ';
  insert into maps.site_leveranciers (plan_id, leverancier_id) values (pid, lev) returning id into slid;
  insert into maps.offertes (site_leverancier_id, bedrag_excl) values (slid, 100);
  select count(*) into n from maps.offertes where site_leverancier_id = slid;
  r := r || '3 eigenaar ziet offerte: ' || n || ' | ';
  execute 'reset role';

  perform set_config('request.jwt.claims', '{}', true);
  update maps.leden set rol = 'bewerker', financieel = false where user_id = ander::uuid and organisatie_id = org;
  perform set_config('request.jwt.claims', json_build_object('sub', ander, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from maps.offertes where site_leverancier_id = slid; r := r || '4 bewerker zonder financieel ziet offertes: ' || n || ' (0 verwacht) | ';
  begin insert into maps.offertes (site_leverancier_id, bedrag_excl) values (slid, 5); r := r || '5 FOUT bewerker maakt offerte | ';
  exception when others then r := r || '5 ok offerte geweigerd | '; end;
  select count(*) into n from maps.taken where id = tid; r := r || '6 bewerker ziet taak: ' || n || ' | ';
  execute 'reset role';
  perform set_config('request.jwt.claims', '{}', true);
  update maps.leden set financieel = true where user_id = ander::uuid and organisatie_id = org;
  perform set_config('request.jwt.claims', json_build_object('sub', ander, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from maps.offertes where site_leverancier_id = slid; r := r || '7 met financieel: ' || n || ' | ';
  execute 'reset role';

  perform set_config('request.jwt.claims', '{}', true);
  update maps.leden set rol = 'lezer', financieel = false where user_id = ander::uuid and organisatie_id = org;
  perform set_config('request.jwt.claims', json_build_object('sub', ander, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  begin insert into maps.taken (plan_id, titel) values (pid, 'y'); r := r || '8 FOUT lezer maakt taak | ';
  exception when others then r := r || '8 ok lezer geweigerd | '; end;
  begin perform maps.taakdag_status(did, 'klaar'); r := r || '9 FOUT lezer vinkt andermans taak af | ';
  exception when others then r := r || '9 ok andermans taak geweigerd | '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{}', true);
  insert into maps.personen (organisatie_id, user_id, naam) values (org, ander::uuid, 'Test') returning id into pers;
  update maps.taak_dagen set uitvoerder_persoon_id = pers where id = did;
  perform set_config('request.jwt.claims', json_build_object('sub', ander, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  ok := maps.taakdag_status(did, 'klaar');
  execute 'reset role';
  select status into st from maps.taak_dagen where id = did;
  r := r || '10 lezer eigen taak: ' || ok || ', status ' || st;
  raise exception 'RAPPORT: %', r;
end $$;
