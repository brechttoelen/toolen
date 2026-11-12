import pakket from "@/package.json";
import { supabaseServer } from "@/lib/supabase/server";
import { MIGRATIES } from "@/lib/migraties";
import { adminIngesteld } from "@/lib/supabase/admin";
import { mailDienst } from "@/lib/mail";
import WachtwoordMails from "./WachtwoordMails";
import Vrijgave from "./Vrijgave";
import Fouten, { type FoutGroep } from "./Fouten";
import Backups, { type Backup } from "./Backups";
import { REPO as REPO_NAAM } from "@/lib/vrijgave";
import { HOOFDDOMEIN } from "@/lib/org";

type Org = { id: string; naam: string; slug: string; pakket: string | null; status: string; plannen: number; items: number; leden: number; plaatsen: number;
  gebruik: { events_jaar: number; max_events_jaar: number | null; deellinks: number; max_deellinks: number | null; opslag_mb: number; max_opslag_mb: number | null } | null;
  laatst_actief: string | null };
type Cijfers = { databank_mb: number; opslag_mb: number; bestanden: number; gebruikers: number; actief_24u: number; actief_7d: number; zonder_mfa_wachtwoord: number;
  migraties: string[]; wissels: { email: string; aantal: number; laatst: string }[]; feedback_open: number; organisaties: Org[] };

const REPO = "https://github.com/brechttoelen/toolen";

// Laatste versie van elke plug-in op npm (één keer per dag opgehaald).
async function updates() {
  const deps = { ...pakket.dependencies } as Record<string, string>;
  return Promise.all(Object.entries(deps).map(async ([naam, huidig]) => {
    try {
      const r = await fetch(`https://registry.npmjs.org/${naam}/latest`, { next: { revalidate: 86400 } });
      const nieuw = r.ok ? ((await r.json()) as { version?: string }).version || null : null;
      const nu = huidig.replace(/^[^\d]*/, "");
      // Groot: eerste cijfer anders, of bij 0.x het tweede (daar kan elke stap iets breken).
      const [a1, b1] = nu.split("."); const [a2, b2] = (nieuw || "").split(".");
      const groot = !!nieuw && (a1 !== a2 || (a1 === "0" && b1 !== b2));
      return { naam, nu, nieuw, nieuwer: !!nieuw && nieuw !== nu, groot };
    } catch { return { naam, nu: huidig, nieuw: null, nieuwer: false, groot: false }; }
  }));
}

const datum = (d: string | null) => (d ? new Date(d).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Nooit");
const teller = (n: number, max: number | null, eenheid = "") => `${n}${eenheid} / ${max == null ? "Onbeperkt" : `${max}${eenheid}`}`;
const vol = (n: number, max: number | null) => max != null && n >= max * 0.9;

// Systeempagina voor de platformbeheerder: versie, databank, gebruik per organisatie, signalen en updates.
export default async function Systeem() {
  const supabase = await supabaseServer();
  const [{ data, error }, lijst, { data: zonderWw }, { data: fouten }, { data: backups }] = await Promise.all([supabase.rpc("platform_systeem"), updates(), supabase.rpc("platform_zonder_wachtwoord"), supabase.rpc("platform_fouten"), supabase.rpc("platform_backups")]);
  const zonder = (zonderWw || []) as { user_id: string; email: string; organisatie: string }[];
  const sleutel = adminIngesteld(); const dienst = mailDienst(); const mail = !!dienst;
  const c = data as Cijfers | null;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const gedraaid = new Set(c?.migraties || []);
  const open = MIGRATIES.filter((m) => !m.handmatig && !m.vervangen && !gedraaid.has(m.naam));
  const teUpdaten = lijst.filter((x) => x.nieuwer);

  return (
    <main className="t-inhoud">
      <h1 className="t-titel">Systeem</h1>
      <p className="t-sub">Versie, gebruik en wat aandacht vraagt.</p>
      {error && <p className="t-melding fout">{error.message}</p>}

      <div className="t-sys-raster">
        <Vrijgave repo={REPO_NAAM} testAdres={process.env.NEXT_PUBLIC_TEST_ADRES || `https://login.test.${HOOFDDOMEIN.replace(/^test\./, "")}`} />
        <Fouten begin={(fouten as FoutGroep[] | null) || []} />
        <Backups begin={(backups as Backup[] | null) || []} />
        <section className="t-kaart t-sys-vak">
          <h2>Versie</h2>
          <dl className="t-sys-feiten">
            <dt>App</dt><dd>{sha ? <a href={`${REPO}/commit/${sha}`} target="_blank" rel="noreferrer"><code>{sha.slice(0, 7)}</code></a> : "Lokaal"}{process.env.VERCEL_GIT_COMMIT_MESSAGE ? ` · ${process.env.VERCEL_GIT_COMMIT_MESSAGE.split("\n")[0].slice(0, 80)}` : ""}</dd>
            <dt>Omgeving</dt><dd>{process.env.VERCEL_ENV === "production" ? "Productie (klanten)" : process.env.VERCEL_GIT_COMMIT_REF === "test" ? "Testomgeving" : process.env.VERCEL_ENV === "preview" ? "Preview" : "Ontwikkeling"}</dd>
            <dt>Migraties</dt><dd>{open.length ? <span className="t-pil let-op" style={{ whiteSpace: "normal", height: "auto", lineHeight: 1.4, padding: "3px 10px" }}>{open.length} nog te draaien: {open.map((m) => m.naam).join(", ")}</span> : <span className="t-pil ok">Alles gedraaid</span>}</dd>
          </dl>
          <div className="t-rij" style={{ gap: 8, flexWrap: "wrap" }}>
            <a className="t-knop klein" href={`${REPO}/commits/main`} target="_blank" rel="noreferrer">Wijzigingen</a>
            <a className="t-knop klein" href={`${REPO}/actions`} target="_blank" rel="noreferrer">Build-controles</a>
            <a className="t-knop klein" href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">Vercel</a>
            <a className="t-knop klein" href="https://supabase.com/dashboard/project/hlpurcdeouegvphvwygu" target="_blank" rel="noreferrer">Supabase</a>
          </div>
        </section>

        <section className="t-kaart t-sys-vak">
          <h2>Gebruik</h2>
          <div className="t-sys-cijfers">
            <div><b>{c?.actief_24u ?? "–"}</b><span>Actief vandaag</span></div>
            <div><b>{c?.actief_7d ?? "–"}</b><span>Actief deze week</span></div>
            <div><b>{c?.gebruikers ?? "–"}</b><span>Accounts</span></div>
            <div><b>{c ? `${Math.round(c.databank_mb)} MB` : "–"}</b><span>Databank</span></div>
            <div><b>{c ? `${Math.round(c.opslag_mb)} MB` : "–"}</b><span>Opslag ({c?.bestanden ?? 0} bestanden)</span></div>
          </div>
        </section>

        <section className="t-kaart t-sys-vak">
          <h2>Vraagt aandacht</h2>
          <ul className="t-sys-lijst">
            {(c?.wissels || []).length > 0
              ? c!.wissels.map((w) => <li key={w.email}><b>{w.email}</b> werd {w.aantal}× afgemeld door een derde apparaat (laatst {datum(w.laatst)}). Mogelijk een gedeeld account.</li>)
              : <li className="t-stil">Geen accounts die op meer dan twee apparaten tegelijk gebruikt worden (30 dagen).</li>}
            {(c?.zonder_mfa_wachtwoord || 0) > 0 && <li>{c!.zonder_mfa_wachtwoord} account{c!.zonder_mfa_wachtwoord === 1 ? "" : "s"} met een wachtwoord en nog zonder tweestapsverificatie. Die moeten ze instellen bij de volgende aanmelding.</li>}
            {(c?.feedback_open || 0) > 0 && <li>{c!.feedback_open} open feedback.</li>}
            {(c?.organisaties || []).filter((o) => o.gebruik && (vol(o.gebruik.events_jaar, o.gebruik.max_events_jaar) || vol(o.gebruik.deellinks, o.gebruik.max_deellinks) || vol(o.gebruik.opslag_mb, o.gebruik.max_opslag_mb)))
              .map((o) => <li key={o.id}><b>{o.naam}</b> zit aan of bijna aan de limiet van zijn pakket.</li>)}
          </ul>
        </section>
      </div>

      <section className="t-kaart t-sys-vak" style={{ marginTop: 20 }}>
        <h2>Inloggen</h2>
        <dl className="t-sys-feiten">
          <dt>Geheime sleutel Supabase</dt><dd>{sleutel ? <span className="t-pil ok">Ingesteld</span> : <span className="t-pil let-op">Ontbreekt: zet SUPABASE_SERVICE_ROLE_KEY in Vercel</span>}</dd>
          <dt>Mails</dt><dd>{mail ? <span className="t-pil ok">Via {dienst}</span> : <span className="t-pil let-op">Ontbreekt: zet RESEND_API_KEY en MAIL_VAN in Vercel</span>}</dd>
          <dt>Zonder wachtwoord</dt><dd>{zonder.length ? `${zonder.length} account${zonder.length === 1 ? "" : "s"}: ${zonder.slice(0, 5).map((z) => z.email).join(", ")}${zonder.length > 5 ? " …" : ""}` : "Iedereen heeft een wachtwoord."}</dd>
        </dl>
        {zonder.length > 0 && sleutel && mail && <WachtwoordMails aantal={zonder.length} />}
      </section>

      <section className="t-kaart" style={{ overflowX: "auto", marginTop: 20 }}>
        <h2 className="t-sys-kop">Organisaties</h2>
        <table className="t-tabel">
          <thead><tr><th>Organisatie</th><th>Pakket</th><th>Leden</th><th>Plannen</th><th>Items</th><th>Events dit jaar</th><th>Deellinks</th><th>Opslag</th><th>Laatst gewijzigd</th></tr></thead>
          <tbody>
            {(c?.organisaties || []).map((o) => (
              <tr key={o.id}>
                <td><b>{o.naam}</b><div className="t-stil" style={{ fontSize: 12.5 }}>{o.slug}.toolen.be</div></td>
                <td>{o.pakket || "–"}</td>
                <td>{o.leden} / {o.plaatsen}</td>
                <td>{o.plannen}</td>
                <td>{o.items.toLocaleString("nl-BE")}</td>
                <td className={o.gebruik && vol(o.gebruik.events_jaar, o.gebruik.max_events_jaar) ? "t-sys-vol" : ""}>{o.gebruik ? teller(o.gebruik.events_jaar, o.gebruik.max_events_jaar) : "–"}</td>
                <td className={o.gebruik && vol(o.gebruik.deellinks, o.gebruik.max_deellinks) ? "t-sys-vol" : ""}>{o.gebruik ? teller(o.gebruik.deellinks, o.gebruik.max_deellinks) : "–"}</td>
                <td className={o.gebruik && vol(o.gebruik.opslag_mb, o.gebruik.max_opslag_mb) ? "t-sys-vol" : ""}>{o.gebruik ? teller(Math.round(o.gebruik.opslag_mb), o.gebruik.max_opslag_mb, " MB") : "–"}</td>
                <td>{datum(o.laatst_actief)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="t-kaart" style={{ overflowX: "auto", marginTop: 20 }}>
        <div className="t-rij" style={{ alignItems: "baseline" }}>
          <h2 className="t-sys-kop" style={{ flex: 1 }}>Plug-ins</h2>
          <a className="t-knop klein" href={`${REPO}/pulls?q=is%3Apr+is%3Aopen+label%3Adependencies`} target="_blank" rel="noreferrer">Klaargezette updates</a>
        </div>
        <p className="t-sub" style={{ margin: "0 0 10px" }}>
          {teUpdaten.length ? `${teUpdaten.length} van ${lijst.length} hebben een nieuwere versie.` : `Alle ${lijst.length} op de laatste versie.`} Updates komen één keer per maand samen klaar op GitHub, na een geslaagde build. Grote updates (eerste cijfer anders, of bij 0.x het tweede) komen niet vanzelf: die plannen we samen, met een test.
        </p>
        <table className="t-tabel">
          <thead><tr><th>Plug-in</th><th>In gebruik</th><th>Nieuwste</th><th>Stand</th></tr></thead>
          <tbody>
            {lijst.map((x) => (
              <tr key={x.naam}>
                <td><code>{x.naam}</code></td>
                <td>{x.nu}</td>
                <td>{x.nieuw || "Onbekend"}</td>
                <td>{!x.nieuw ? <span className="t-pil">Niet op te halen</span> : !x.nieuwer ? <span className="t-pil ok">Bij</span> : x.groot ? <span className="t-pil let-op">Grote update</span> : <span className="t-pil blauw">Kleine update</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
