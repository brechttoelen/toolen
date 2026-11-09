// Net geplaatst bouw-element (truss, B-matrix wand): de bouwer meteen openen zodra het zijpaneel er is.
let wacht = null;
export const vraagBouwer = (id) => { wacht = id; };
export const neemBouwer = (id) => { if (wacht && wacht === id) { wacht = null; return true; } return false; };
// Truss of frame-wand die je met één klik zet en daarna in de bouwer opbouwt.
export const isBouwElement = (el) => !!el && el.tekenwijze === 'lijn' && (!!el.eigenschappen?.wand || !!el.eigenschappen?.stelling || /truss/i.test(el.categorie || ''));
