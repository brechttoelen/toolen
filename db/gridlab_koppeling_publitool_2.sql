-- GridLab → Toolen Maps · aanvulling · plakken in de SQL Editor van het PUBLITOOL-project (flcs-pub) → Run
-- Het schema gridlab is niet open voor bezoekers zonder login (goed zo). Daarom een doorgeefluik in public,
-- dat enkel gridlab.toolen_lezen aanroept (die controleert de sleutel). De sleutel blijft dezelfde.
create or replace function public.toolen_gridlab_lezen(p_sleutel text, p_ids uuid[] default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select gridlab.toolen_lezen(p_sleutel, p_ids);
$$;
revoke execute on function public.toolen_gridlab_lezen(text, uuid[]) from public;
grant execute on function public.toolen_gridlab_lezen(text, uuid[]) to anon, authenticated;
notify pgrst, 'reload schema';
