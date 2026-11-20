-- Kleuren per soort in de planning, voor alle sites van een event: { "<soort>": { "kleur": "#hex", "regel": bool } }.
alter table maps.events add column if not exists soortkleuren jsonb not null default '{}'::jsonb;
