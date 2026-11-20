-- Fiche-tabs per organisatie uitschakelen (eigenaar). Geldt voor alle plannen; de data blijft staan.
alter table maps.organisaties add column if not exists fiche_tabs_uit text[] not null default '{}';
grant update (fiche_tabs_uit) on maps.organisaties to authenticated;
