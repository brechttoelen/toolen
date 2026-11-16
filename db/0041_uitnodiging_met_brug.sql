-- 0041 · Uitnodiging: ook aanmelden via de brug (Microsoft van de eigen organisatie)
--
-- uitnodiging_info geeft de SSO van de organisatie mee, zodat de pagina van de uitnodiging "Verder met Microsoft"
-- kan tonen. Wie zich via de brug aanmeldt, heeft zijn uitnodiging niet meer nodig: brug_lid_zetten sluit ze af.

create or replace function maps.uitnodiging_info(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('email', u.email, 'naam', u.naam, 'rol', u.rol, 'organisatie', o.naam, 'slug', o.slug,
                            'geldig', u.aanvaard_op is null and u.geldig_tot > now(), 'aanvaard', u.aanvaard_op is not null,
                            'account', exists (select 1 from auth.users a where lower(a.email) = lower(u.email)),
                            'door', (select coalesce(p.naam, p.email) from maps.profielen p where p.id = u.uitgenodigd_door),
                            'sso', to_jsonb(o.sso))
    from maps.uitnodigingen u join maps.organisaties o on o.id = u.organisatie_id
   where p_token is not null and length(p_token) >= 20 and u.token_hash = maps.token_hash(p_token);
$$;

-- brug_lid_zetten: zoals in 0040, en sluit openstaande uitnodigingen voor dit adres af.
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
  if v_user is null then return jsonb_build_object('user_id', null, 'organisatie_id', o.id, 'naam', o.naam); end if;
  select rol, actief into l from maps.leden where organisatie_id = o.id and user_id = v_user;
  if not found then
    insert into maps.leden (organisatie_id, user_id, rol, actief, brug_op) values (o.id, v_user, p_rol, true, now());
  elsif l.rol <> 'eigenaar' and (l.rol <> p_rol or not l.actief) then
    update maps.leden set rol = p_rol, actief = true, brug_op = now() where organisatie_id = o.id and user_id = v_user;
  else
    update maps.leden set actief = true, brug_op = now() where organisatie_id = o.id and user_id = v_user;
  end if;
  update maps.uitnodigingen set aanvaard_op = now()
   where organisatie_id = o.id and lower(email) = lower(btrim(p_email)) and aanvaard_op is null;
  return jsonb_build_object('user_id', v_user, 'email', v_email, 'organisatie_id', o.id, 'naam', o.naam);
end $$;
revoke all on function maps.brug_lid_zetten(text, text, text) from public, anon, authenticated;
grant execute on function maps.brug_lid_zetten(text, text, text) to service_role;
