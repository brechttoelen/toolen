-- Deellink "Enkel een 3D" (opties.drie = item-id): enkel dat element (stelling, wand, truss, tent), ongeacht de laag.
-- De ontvanger ziet meteen de 3D over het hele scherm, zonder kaart (zoals opties.binnen voor een binnenplan).
do $do$
declare d text;
begin
  d := pg_get_functiondef('flcsmaps.deel_link_lezen'::regproc);
  if position('v_drie' in d) > 0 then return; end if;
  d := replace(d, '  v_host text; -- enkel het binnenplan van dit gebouw (opties.binnen)',
                  '  v_host text; -- enkel het binnenplan van dit gebouw (opties.binnen)
  v_drie text; -- enkel dit element in 3D (opties.drie)');
  d := replace(d, '  v_host := nullif(dl.opties->>''binnen'', '''');',
                  '  v_host := nullif(dl.opties->>''binnen'', '''');
  v_drie := nullif(dl.opties->>''drie'', '''');');
  d := replace(d, '         and (case when v_host is not null',
                  '         and (case when v_drie is not null then i.id::text = v_drie
                   when v_host is not null');
  if position('v_drie := ' in d) = 0 or position('when v_drie is not null' in d) = 0 or position('v_drie text;' in d) = 0 then
    raise exception 'deel_link_lezen: vervangen mislukt';
  end if;
  execute d;
end $do$;
