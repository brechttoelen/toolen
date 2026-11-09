import { Suspense } from "react";
import InlogScherm from "@/components/InlogScherm";

export const metadata = { title: "Inloggen" };

// Centraal inloggen (login.toolen.be). Na het inloggen terug naar ?verder=.
export default function Login() {
  return (
    <Suspense>
      <InlogScherm />
    </Suspense>
  );
}
