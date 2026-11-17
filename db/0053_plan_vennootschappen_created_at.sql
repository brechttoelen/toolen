-- ============================================================================
-- Toolen · 0053_plan_vennootschappen_created_at.sql
-- De fiche sorteert elke tabel van een site op created_at; plan_vennootschappen had die kolom niet,
-- waardoor het laden van de fiche een fout gaf.
-- ============================================================================
alter table maps.plan_vennootschappen add column if not exists created_at timestamptz not null default now();
