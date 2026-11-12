// Updates vrijgeven: alles wat gebouwd wordt, komt eerst op de tak "test" (de testomgeving).
// Vrijgeven zet de tak "main" (wat klanten gebruiken) op dezelfde stand; terugzetten gaat naar de vorige stand.
// Loopt via de GitHub-API met een sleutel die enkel op de server staat (TOOLEN_GITHUB_TOKEN).

export const REPO = process.env.TOOLEN_GITHUB_REPO || "brechttoelen/toolen";
export const TAK_TEST = "test";
export const TAK_LIVE = "main";
const VORIGE = "tags/vorige-live";

export const vrijgaveIngesteld = () => !!process.env.TOOLEN_GITHUB_TOKEN;

async function gh<T>(pad: string, init: RequestInit = {}): Promise<{ status: number; data: T | null }> {
  const r = await fetch(`https://api.github.com/repos/${REPO}${pad}`, {
    ...init,
    cache: "no-store",
    headers: { accept: "application/vnd.github+json", authorization: `Bearer ${process.env.TOOLEN_GITHUB_TOKEN}`, "x-github-api-version": "2022-11-28", ...(init.body ? { "content-type": "application/json" } : {}) },
  });
  let data: T | null = null;
  try { data = (await r.json()) as T; } catch { /* leeg antwoord */ }
  return { status: r.status, data };
}

type Commit = { sha: string; commit: { message: string; author: { date: string } } };
export type Wijziging = { sha: string; tekst: string; op: string };
export type Stand = {
  live: string; test: string; wachtend: Wijziging[]; achter: number;
  controle: "ok" | "bezig" | "mislukt" | "onbekend"; vorige: string | null; kanTerug: boolean;
};

const sha = async (ref: string) => (await gh<{ object: { sha: string } }>(`/git/ref/${ref}`)).data?.object?.sha || null;

export async function stand(): Promise<Stand> {
  const [live, test, vorige] = await Promise.all([sha(`heads/${TAK_LIVE}`), sha(`heads/${TAK_TEST}`), sha(VORIGE)]);
  if (!live || !test) throw new Error(`De tak "${!live ? TAK_LIVE : TAK_TEST}" is niet gevonden op GitHub. Controleer de sleutel (TOOLEN_GITHUB_TOKEN) en zijn rechten.`);
  const [v, runs] = await Promise.all([
    gh<{ ahead_by: number; behind_by: number; commits: Commit[] }>(`/compare/${live}...${test}`),
    gh<{ check_runs: { status: string; conclusion: string | null }[] }>(`/commits/${test}/check-runs`),
  ]);
  const cr = runs.data?.check_runs || [];
  const controle = !cr.length ? "onbekend" : cr.some((c) => c.status !== "completed") ? "bezig" : cr.every((c) => c.conclusion === "success" || c.conclusion === "skipped" || c.conclusion === "neutral") ? "ok" : "mislukt";
  const wachtend = (v.data?.commits || []).map((c) => ({ sha: c.sha, tekst: c.commit.message.split("\n")[0], op: c.commit.author.date })).reverse();
  return { live, test, wachtend, achter: v.data?.behind_by || 0, controle, vorige, kanTerug: !!vorige && vorige !== live };
}

async function zetVorige(naar: string) {
  const r = await gh(`/git/refs/${VORIGE}`, { method: "PATCH", body: JSON.stringify({ sha: naar, force: true }) });
  if (r.status === 404 || r.status === 422) await gh("/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/${VORIGE}`, sha: naar }) });
}

// Vrijgeven: main naar de stand van test. Enkel als de controle van die stand geslaagd is.
export async function vrijgeven(verwacht: string): Promise<Stand> {
  const s = await stand();
  if (s.test !== verwacht) throw new Error("De testversie is intussen gewijzigd. Bekijk de lijst opnieuw.");
  if (!s.wachtend.length) throw new Error("Er wacht geen update.");
  if (s.controle !== "ok") throw new Error(s.controle === "bezig" ? "De controle van de testversie loopt nog. Probeer over enkele minuten opnieuw." : "De controle van de testversie is niet geslaagd. Vrijgeven kan pas als ze slaagt.");
  await zetVorige(s.live);
  // Gewoon doorschuiven als main niets eigen heeft; anders samenvoegen.
  const r = await gh(`/git/refs/heads/${TAK_LIVE}`, { method: "PATCH", body: JSON.stringify({ sha: s.test, force: false }) });
  if (r.status !== 200) {
    const m = await gh<{ message?: string }>("/merges", { method: "POST", body: JSON.stringify({ base: TAK_LIVE, head: TAK_TEST, commit_message: "Update vrijgegeven vanuit de testomgeving" }) });
    if (m.status !== 201 && m.status !== 204) throw new Error(`Vrijgeven is niet gelukt: ${m.data?.message || `GitHub antwoordde ${m.status}`}.`);
  }
  return stand();
}

// Terugzetten: main terug naar de stand van voor de laatste vrijgave. De testversie blijft zoals ze is.
export async function terugzetten(): Promise<Stand> {
  const s = await stand();
  if (!s.kanTerug || !s.vorige) throw new Error("Er is geen vorige versie om naar terug te gaan.");
  const r = await gh<{ message?: string }>(`/git/refs/heads/${TAK_LIVE}`, { method: "PATCH", body: JSON.stringify({ sha: s.vorige, force: true }) });
  if (r.status !== 200) throw new Error(`Terugzetten is niet gelukt: ${r.data?.message || `GitHub antwoordde ${r.status}`}.`);
  await zetVorige(s.vorige);
  return stand();
}
