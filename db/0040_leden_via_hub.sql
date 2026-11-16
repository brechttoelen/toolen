-- 0040 · Leden: tonen wie via het toegangsbeheer van de organisatie (de brug) binnenkomt
--
-- leden.brug_op = laatste aanmelding via de brug. Zolang die ingevuld is, komen rol en toegang van dit lid uit
-- het toegangsbeheer van de organisatie (bv. de hub) en worden ze bij elke aanmelding daar gelezen.
-- leden_van geeft dat mee als kolom 'hub'.

alter table maps.leden add column if not exists brug_op timestamptz;

update maps.leden l set brug_op = s.laatst
  from (select user_id, organisatie_id, max(sinds) laatst from maps.brug_sessies group by 1, 2) s
 where s.user_id = l.user_id and s.organisatie_id = l.organisatie_id and l.brug_op is null;

create or replace function maps.brug_lid_zetten(p_email text, p_slug text, p_rol text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o record; v_user uuid; v_email text; l record;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Enkel voor de server.' using errcode = '42501';
  end if;
  if p_rol not in ('beheerder', 'bewerker', 'lezer') then raise exception 'Onbekende rol.' using errcode = '22023'; end if;
  select id, naam into o from maps.organisaties
   where slug = lower(btrim(p_slug)) and 'brug' = any (sso) and status in ('proef','actief','achterstallig','alleen_lezen');
  if o.id is null then return null; end if;
  select id, email into v_user, v_email from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
  -- Nog geen account: de server maakt er een en roept dit opnieuw aan.
  if v_user is null then return jsonb_build_object('user_id', null, 'organisatie_id', o.id, 'naam', o.naam); end if;
  select rol, actief into l from maps.leden where organisatie_id = o.id and user_id = v_user;
  if not found then
    insert into maps.leden (organisatie_id, user_id, rol, actief, brug_op) values (o.id, v_user, p_rol, true, now());
  elsif l.rol <> 'eigenaar' and (l.rol <> p_rol or not l.actief) then
    update maps.leden set rol = p_rol, actief = true, brug_op = now() where organisatie_id = o.id and user_id = v_user;
  else
    update maps.leden set actief = true, brug_op = now() where organisatie_id = o.id and user_id = v_user;
  end if;
  return jsonb_build_object('user_id', v_user, 'email', v_email, 'organisatie_id', o.id, 'naam', o.naam);
end $$;
revoke all on function maps.brug_lid_zetten(text, text, text) from public, anon, authenticated;
grant execute on function maps.brug_lid_zetten(text, text, text) to service_role;

drop function if exists maps.leden_van(uuid);
create function maps.leden_van(p_org uuid)
returns table(user_id uuid, email text, naam text, rol text, actief boolean, sinds timestamptz, laatste_login timestamptz, ik boolean, event_ids uuid[], mfa boolean, werkplekken text[], hub timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.user_id, p.email, p.naam, l.rol, l.actief, l.sinds, l.laatste_login, l.user_id = auth.uid(), l.event_ids,
         exists (select 1 from auth.mfa_factors f where f.user_id = l.user_id and f.status = 'verified'), l.werkplekken, l.brug_op
    from maps.leden l left join maps.profielen p on p.id = l.user_id
   where l.organisatie_id = p_org
     and (p_org = any (maps.lid_van()) or maps.is_platformbeheerder())
   order by maps.rol_rang(l.rol) desc, coalesce(p.naam, p.email);
$$;
revoke all on function maps.leden_van(uuid) from public, anon;
grant execute on function maps.leden_van(uuid) to authenticated;
