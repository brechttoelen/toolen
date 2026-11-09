'use client';

import { setOrganisatie } from './merk';

// Zet de actieve organisatie voor de modules die buiten React lezen (PDF, titelblok).
export default function OrganisatieZetter({ organisatie }) {
  setOrganisatie(organisatie);
  return null;
}
