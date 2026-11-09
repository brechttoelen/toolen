-- Deellink: kabelcam (verreikers aan de uiteinden) en camerakranen tekenen ook in de deelweergave.
-- Velden 'kabelcam' en 'tvkabel' mee; eigenschappen 'kabelcam', 'kraan' en 'tvcamera' mee;
-- de verreiker van een kabelcam (item of element) komt bij de elementen.
do $do$
declare d text;
begin
  d := pg_get_functiondef('flcsmaps.deel_link_lezen'::regproc);
  if position('''kabelcam''' in d) > 0 then return; end if;
  d := replace(d, '''tent'', ''licht'')', '''tent'', ''licht'', ''kabelcam'', ''tvkabel'')');
  d := replace(d, '''stelling'', ''stelling3d'', ''familie'', ''licht'')', '''stelling'', ''stelling3d'', ''familie'', ''licht'', ''kabelcam'', ''kraan'', ''tvcamera'', ''subgroep'')');
  d := replace(d, '                               or b.id::text in (select z.velden->''meubel''->>''stoel_huis'' from zicht z)',
    '                               or b.id::text in (select z.velden->''meubel''->>''stoel_huis'' from zicht z)
                               -- verreikers van een kabelcam: per item gekozen of de standaard van het element
                               or b.id::text in (select z.velden->''kabelcam''->>''verreiker'' from zicht z)
                               or b.id::text in (select b2.eigenschappen->''kabelcam''->>''verreiker'' from flcsmaps.bibliotheek b2 where b2.id in (select z.element_id from zicht z))');
  if position('''kabelcam''' in d) = 0 or position('''kraan''' in d) = 0 or position('b2.eigenschappen' in d) = 0 then raise exception 'deel_link_lezen: vervangen mislukt'; end if;
  execute d;
end $do$;
