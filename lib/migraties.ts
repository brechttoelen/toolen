// Migraties in db/ in volgorde. Bij een nieuwe migratie: hier toevoegen.
// handmatig = ooit in de SQL Editor gedraaid (staat niet in supabase_migrations).
export const MIGRATIES: { naam: string; handmatig?: boolean; vervangen?: boolean }[] = [
  { naam: "0001_basis", handmatig: true },
  { naam: "0002_import_flcs", vervangen: true },
  { naam: "0003_beheer", handmatig: true },
  { naam: "0004_modules", handmatig: true },
  { naam: "0005_pakketten" },
  { naam: "0006_beveiliging" },
  { naam: "0007_events" },
  { naam: "0008_ontvangers" },
  { naam: "0009_flcs_bijwerken" },
  { naam: "0010_inloggen_limieten_systeem" },
  { naam: "0011_toegang" },
];
