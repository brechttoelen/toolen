-- Deellink: alles meegeven wat nodig is om wanden, truss, camera's en hekken juist te tekenen
-- (toegepast op 2026-11-03 via een replace op de bestaande functie).
--  * items.velden: ook wand, truss, vloer, montage, doek_naam, verdieping, toebehoren, fracties, dichtheid, nr
--  * elementen: hoogte_m, en eigenschappen wand (zonder voorraad), truss_doek, rijen_standaard, tekening_rekken,
--    montages, banen, helling, materiaal, paal_naam, stapelbaar, strak, toebehoren, verspring_m,
--    verspringend_standaard, vlaghouder, vloer, fracties, stekkerdoos, generator
--  * doeken die op frame-wanden (vrij of per plek) en truss hangen
do $$
declare d text := pg_get_functiondef('flcsmaps.deel_link_lezen(text)'::regprocedure); n text;
begin
  if position('truss_doek' in d) > 0 then return; end if;
  n := replace(d, $a$'paneel_1', 'paneel_2', 'paneel_3', 'paneel_4', 'ontwerp')$a$, $a$'paneel_1', 'paneel_2', 'paneel_3', 'paneel_4', 'ontwerp', 'wand', 'truss', 'vloer', 'montage', 'doek_naam', 'verdieping', 'toebehoren', 'fracties', 'dichtheid', 'nr')$a$);
  n := replace(n, $a$'eenheid_m', b.eenheid_m, 'stijl', b.stijl,$a$, $a$'eenheid_m', b.eenheid_m, 'hoogte_m', b.hoogte_m, 'stijl', b.stijl,$a$);
  n := replace(n, $a$'eigenschappen', coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(b.eigenschappen) e$a$, $a$'eigenschappen', coalesce((select jsonb_object_agg(e.key, case when e.key = 'wand' and jsonb_typeof(e.value) = 'object' then e.value - 'voorraad' else e.value end) from jsonb_each(b.eigenschappen) e$a$);
  n := replace(n, $a$'zitplaatsen', 'binnenlocatie')$a$, $a$'zitplaatsen', 'binnenlocatie', 'wand', 'truss_doek', 'rijen_standaard', 'tekening_rekken', 'montages', 'banen', 'helling', 'materiaal', 'paal_naam', 'stapelbaar', 'strak', 'toebehoren', 'verspring_m', 'verspringend_standaard', 'vlaghouder', 'vloer', 'fracties', 'stekkerdoos', 'generator')$a$);
  n := replace(n, $a$                               or b.id::text in (select z.velden->'meubel'->>'stoel_huis' from zicht z))), '[]'),$a$, $a$                               or b.id::text in (select z.velden->'meubel'->>'stoel_huis' from zicht z)
                               -- doeken op frame-wanden (vrij gebouwd of per plek) en op truss
                               or b.id::text in (select v->>k from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->'wand'->'vrij') = 'array' then z.velden->'wand'->'vrij' else '[]'::jsonb end) v, unnest(array['voor','achter']) k)
                               or b.id::text in (select v->>k from zicht z, jsonb_array_elements(case when jsonb_typeof(z.velden->'truss'->'doeken') = 'array' then z.velden->'truss'->'doeken' else '[]'::jsonb end) v, unnest(array['voor','achter']) k)
                               or b.id::text in (select e.value #>> '{}' from zicht z, unnest(array['voor','achter']) k, jsonb_each(case when jsonb_typeof(z.velden->'wand'->k) = 'object' then z.velden->'wand'->k else '{}'::jsonb end) e)
                               or b.id::text in (select e #>> '{}' from zicht z, unnest(array['voor','achter']) k, jsonb_array_elements(case when jsonb_typeof(z.velden->'wand'->k) = 'array' then z.velden->'wand'->k else '[]'::jsonb end) e))), '[]'),$a$);
  execute n;
end $$;

-- Deellink: ook de camera-instellingen (velden.camera: lenshoogte, zoom, kantelen) voor het camerabeeld.
do $$
declare d text := pg_get_functiondef('flcsmaps.deel_link_lezen(text)'::regprocedure); n text;
begin
  if position('''dichtheid'', ''nr'', ''camera''' in d) > 0 then return; end if;
  n := replace(d, $a$'dichtheid', 'nr')$a$, $a$'dichtheid', 'nr', 'camera')$a$);
  execute n;
end $$;
