import { redirect } from "next/navigation";

// Startpagina van een organisatie: zolang Maps de enige tool is, meteen naar Maps.
// Intern is het pad /<org>/maps; in de browser staat <org>.toolen.be/maps.
export default function OrgStart() {
  redirect("/maps");
}
