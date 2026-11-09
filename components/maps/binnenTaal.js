// Teksten van het binnenscherm in een deel-link (Nederlands, Frans, Engels).
const T = {
  nl: {
    ruimtes: 'Ruimtes', op: 'Op', eigen: 'Eigen materiaal', huis: 'Van het huis', leeg: 'Nog niets geplaatst.', zitpl: 'zitpl.', items: 'items',
    selecteren: 'Selecteren', meten: 'Meten', passend: 'Passend', detail: 'Klik een zaal of een object voor de details.',
    zitplaatsen: 'zitplaatsen', functie: 'Functie', functies: 'Functies', fotos: "Foto's", fotosGebouw: "Foto's van het gebouw", maxPers: 'max. personen',
    zaal: 'zaal', zalen: 'zalen', moment: 'Moment', alles: 'Alles', fasen: 'Fasen', dagen: 'Dagen', doeken: 'Branding', gordijn: 'gordijn',
    opmerking: 'Opmerking', eerste: 'Klik het eerste punt', tweede: 'Klik het tweede punt', opnieuw: 'klik om opnieuw te meten', geenPlan: 'Nog geen grondplan',
    Voorkant: 'Voorkant', Achterkant: 'Achterkant', Rechts: 'Rechts', Links: 'Links', sectie: 'Sectie', altijd: 'Altijd', tot: 'tot', in: 'in',
    vorige: 'Vorige', volgende: 'Volgende', openen: 'Openen', sluiten: 'Sluiten', Gelijkvloers: 'Gelijkvloers',
  },
  fr: {
    ruimtes: 'Salles', op: 'Au', eigen: 'Matériel propre', huis: 'Matériel de la salle', leeg: 'Rien de placé.', zitpl: 'places', items: 'éléments',
    selecteren: 'Sélectionner', meten: 'Mesurer', passend: 'Ajuster', detail: 'Cliquez sur une salle ou un objet pour les détails.',
    zitplaatsen: 'places assises', functie: 'Fonction', functies: 'Fonctions', fotos: 'Photos', fotosGebouw: 'Photos du bâtiment', maxPers: 'pers. max.',
    zaal: 'salle', zalen: 'salles', moment: 'Moment', alles: 'Tout', fasen: 'Phases', dagen: 'Jours', doeken: 'Branding', gordijn: 'rideau',
    opmerking: 'Remarque', eerste: 'Cliquez le premier point', tweede: 'Cliquez le deuxième point', opnieuw: 'cliquez pour mesurer à nouveau', geenPlan: 'Pas encore de plan',
    Voorkant: 'Face avant', Achterkant: 'Face arrière', Rechts: 'Droite', Links: 'Gauche', sectie: 'Section', altijd: 'Toujours', tot: 'au', in: 'dans',
    vorige: 'Précédente', volgende: 'Suivante', openen: 'Ouvrir', sluiten: 'Fermer', Gelijkvloers: 'Rez-de-chaussée',
  },
  en: {
    ruimtes: 'Rooms', op: 'On', eigen: 'Own equipment', huis: 'Venue equipment', leeg: 'Nothing placed yet.', zitpl: 'seats', items: 'items',
    selecteren: 'Select', meten: 'Measure', passend: 'Fit', detail: 'Click a room or an object for details.',
    zitplaatsen: 'seats', functie: 'Function', functies: 'Functions', fotos: 'Photos', fotosGebouw: 'Photos of the building', maxPers: 'max. persons',
    zaal: 'room', zalen: 'rooms', moment: 'Moment', alles: 'All', fasen: 'Phases', dagen: 'Days', doeken: 'Branding', gordijn: 'curtain',
    opmerking: 'Note', eerste: 'Click the first point', tweede: 'Click the second point', opnieuw: 'click to measure again', geenPlan: 'No floor plan yet',
    Voorkant: 'Front', Achterkant: 'Back', Rechts: 'Right', Links: 'Left', sectie: 'Section', altijd: 'Always', tot: 'to', in: 'in',
    vorige: 'Previous', volgende: 'Next', openen: 'Open', sluiten: 'Close', Gelijkvloers: 'Ground floor',
  },
};
export const binnenTekst = (taal = 'nl') => T[taal] || T.nl;

// Benamingen van meubels en punten vertalen (de namen zelf blijven Nederlands bewaard).
const WOORDEN = {
  fr: [['Ronde tafel', 'Table ronde'], ['Ovale tafel', 'Table ovale'], ['Halfronde tafel', 'Table demi-lune'], ['Tafel', 'Table'], ['stoelen', 'chaises'], ['Stoelenrijen', 'Rangées de chaises'], ['Klasopstelling', 'Disposition en classe'], ['Stoel', 'Chaise'], ['Podium', 'Podium'], ['Buffet', 'Buffet'], ['Dubbele deur', 'Porte double'], ['Deur', 'Porte'], ['Raam', 'Fenêtre'], ['Stekkerblok', 'Multiprise'], ['Stekkerdoos', 'Multiprise'], ['Stroominvoer (kabel van buiten)', 'Arrivée électrique (câble extérieur)'], ['Stroomaansluiting (vast)', 'Raccordement électrique (fixe)'], ['Wateraansluiting (vast)', 'Raccordement d\'eau (fixe)'], ['Netwerk / internet', 'Réseau / internet'], ['Brandblusser', 'Extincteur'], ['EHBO', 'Premiers secours'], ['Statafel', 'Mange-debout']],
  en: [['Ronde tafel', 'Round table'], ['Ovale tafel', 'Oval table'], ['Halfronde tafel', 'Half-round table'], ['Tafel', 'Table'], ['stoelen', 'chairs'], ['Stoelenrijen', 'Rows of chairs'], ['Klasopstelling', 'Classroom layout'], ['Stoel', 'Chair'], ['Podium', 'Stage'], ['Buffet', 'Buffet'], ['Dubbele deur', 'Double door'], ['Deur', 'Door'], ['Raam', 'Window'], ['Stekkerblok', 'Power strip'], ['Stekkerdoos', 'Power strip'], ['Stroominvoer (kabel van buiten)', 'Power entry (cable from outside)'], ['Stroomaansluiting (vast)', 'Power connection (fixed)'], ['Wateraansluiting (vast)', 'Water connection (fixed)'], ['Netwerk / internet', 'Network / internet'], ['Brandblusser', 'Fire extinguisher'], ['EHBO', 'First aid'], ['Statafel', 'Standing table']],
};
export function vertaalNaam(naam, taal = 'nl') {
  const l = WOORDEN[taal]; if (!l || !naam) return naam;
  let s = String(naam);
  for (const [a, b] of l) s = s.split(a).join(b);
  return s;
}
