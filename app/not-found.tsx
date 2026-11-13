import type { Metadata } from "next";
import { PlanScene } from "@/components/Inlogkader";
import { ToolenWoordmerk } from "@/components/ToolenLogo";

export const metadata: Metadata = { title: "Niet gevonden · Toolen" };

// 404: dezelfde navy wereld als het inlogscherm, met het plan dat zich opbouwt op de achtergrond.
export default function NotFound() {
  return (
    <div className="t-404">
      <header className="t-404-kop"><a href="/" aria-label="Toolen"><ToolenWoordmerk op="navy" product="maps" /></a></header>
      <main className="t-404-hoofd">
        <div className="t-404-tekst">
          <p className="t-404-code">404</p>
          <h1>Dit staat niet op het plan.</h1>
          <p>De pagina bestaat niet (meer), het adres is verkeerd getypt, of je hebt er geen toegang toe. Een plan of deellink kan ook verwijderd of ingetrokken zijn.</p>
          <div className="t-404-knoppen">
            <a className="t-knop hoofd" href="/maps">Naar mijn plannen</a>
            <a className="t-knop t-404-licht" href="/">Naar de startpagina</a>
          </div>
        </div>
        <PlanScene className="t-404-scene" />
      </main>
    </div>
  );
}
