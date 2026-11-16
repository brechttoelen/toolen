-- 0039 · Brug met rollen uit de omgeving van de organisatie
--
-- Bij een organisatie met een eigen toegangsbeheer (bv. een hub met apps en rollen) bepaalt dat beheer wie in Toolen
-- binnen mag en met welke rol. De server leest de rol bij het aanmelden via de brug (app/auth/brug) en zet het lid hier
-- klaar: nieuw lid, andere rol, of terug actief. Een eigenaar blijft eigenaar. Wie daar geen rol (meer) heeft en zich
-- via de brug aanmeldt, wordt hier op niet-actief gezet (een eigenaar niet).

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
    insert into maps.leden (organisatie_id, user_id, rol, actief) values (o.id, v_user, p_rol, true);
  elsif l.rol <> 'eigenaar' and (l.rol <> p_rol or not l.actief) then
    update maps.leden set rol = p_rol, actief = true where organisatie_id = o.id and user_id = v_user;
  elsif l.rol = 'eigenaar' and not l.actief then
    update maps.leden set actief = true where organisatie_id = o.id and user_id = v_user;
  end if;
  return jsonb_build_object('user_id', v_user, 'email', v_email, 'organisatie_id', o.id, 'naam', o.naam);
end $$;
revoke all on function maps.brug_lid_zetten(text, text, text) from public, anon, authenticated;
grant execute on function maps.brug_lid_zetten(text, text, text) to service_role;

create or replace function maps.brug_lid_uit(p_email text, p_slug text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Enkel voor de server.' using errcode = '42501';
  end if;
  update maps.leden l set actief = false
    from maps.organisaties o, auth.users u
   where o.slug = lower(btrim(p_slug)) and 'brug' = any (o.sso) and l.organisatie_id = o.id
     and u.id = l.user_id and lower(u.email) = lower(btrim(p_email))
     and l.actief and l.rol <> 'eigenaar';
end $$;
revoke all on function maps.brug_lid_uit(text, text) from public, anon, authenticated;
grant execute on function maps.brug_lid_uit(text, text) to service_role;
