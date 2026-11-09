'use client';

// Hulp en sneltoetsen (vraagteken in de statusbalk).
export default function HulpMenu() {
  return (
    <div className="fm-menu fm-hulp" style={{ right: 0, bottom: 28 }} onClick={(e) => e.stopPropagation()}>
      <div className="fm-kop">Zo werkt het</div>
      <ul>
        <li>Kies links <strong>Element</strong> en klik op de kaart om een tent, hek of podium te zetten.</li>
        <li>Klik een item om het rechts aan te passen. Sleep het om te verplaatsen, sleep het rondje erboven om te draaien.</li>
        <li><strong>Shift + klik</strong> selecteert meerdere items.</li>
        <li>Tijdens het tekenen: <strong>Laatste punt weg</strong> onderaan (of Backspace). Een punt van een bestaande lijn wis je met een <strong>dubbelklik</strong> op dat punt, of met <strong>Punten wissen</strong> in het balkje.</li>
        <li>Een punt toevoegen: sleep het kleine bolletje midden op een lijnstuk.</li>
        <li>Fout gemaakt? Pijltje terug bovenaan.</li>
      </ul>
      <div className="fm-kop">Sneltoetsen</div>
      <div className="fm-toetsen">
        <span>Selecteren · lijn · veelhoek</span><kbd>V · L · G</kbd>
        <span>Rechthoek · cirkel · punt</span><kbd>R · C · P</kbd>
        <span>Element · tekst · meten</span><kbd>E · T · M</kbd>
        <span>Snel zoeken (acties, elementen, lagen)</span><kbd>Ctrl K</kbd>
        <span>Werkruimte Plan · Signalisatie · Stroom · Veiligheid</span><kbd>Alt 1 · 2 · 3 · 4</kbd>
        <span>Bordpunten: vorige · volgende</span><kbd>PageUp · PageDown</kbd>
        <span>Dupliceren</span><kbd>Ctrl D</kbd>
        <span>Ongedaan · opnieuw</span><kbd>Ctrl Z · Ctrl Shift Z</kbd>
        <span>Draaien bij plaatsen</span><kbd>R</kbd>
        <span>Stoppen</span><kbd>Esc</kbd>
      </div>
    </div>
  );
}
