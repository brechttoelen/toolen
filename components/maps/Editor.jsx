'use client';

import { heeftModule, nietInPakket } from './merk';
const GEEN_DOEKEN = [];
import { zorgVoorVeldpuntLagen, zetVeldpunten } from './veldpunten';
import { zetCursor } from './cursor';
import { bevestig, vraagTekst, AppDialogen, useSluitBuiten } from './dialoog';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import './kaartwerker';
import 'maplibre-gl/dist/maplibre-gl.css';
import './maps.css';
import { maps, alles, inBereik, sb, BUCKET, foutTekst, wieBenIk, magSchrijven as kanSchrijven, namenVan, publiekeUrl } from './db';
import { maakBewaarder, verschil as itemVerschil, pasPatchToe, gelijk, instellingenOpdrachten } from './bewaren';
import Botsingen from './Botsingen';
import { startLive, startLobby } from './live';
import Aanwezigen, { anderenUit, kleurVoor, SlotBanner } from './Aanwezigheid';
import { ClaimKnop, geldigeClaim, nieuweClaim, ItemGeschiedenis, sindsVorigBezoek, Aankondiging } from './Werkverdeling';
import { basisStijl, zetOndergrond, registreerProtocollen, ONDERGRONDEN, klapBronvermeldingIn, FOTO_VL, kiesFotoVl, SCHADUW, inVlaanderen } from './ondergronden';
import { metTekeningen } from './tekeningen';
import { stellingPunten, kaartLagen, naarGeojson, zorgVoorPatronen, effectieveStijl, tekeningZijdig, maten, matenTekst, nadenVan, heeftFracties, toegelatenFracties, herkomstVan, paalVerdeling, paalPerPunt, hulplijnenVan, herschikKoord, koordVan, hekStuk, isHekElement } from './stijl';
import { bronBijwerken, bronVerberg, bronHerstel } from './kaartbron';
import { FAMILIE_NAAM, familieVan, familieVanElement } from './familie';
import FeedbackKnop, { zetFeedbackContext } from './Feedback';
import { deurPlek, lijnHeel, isDeurElement, deurLijnId, deurBreedte, deurPlaats, deurOpPlek, volgLijn, schuifOpening, herschikOpeningen, knipOpeningen, keerOpeningen } from './deur';
import * as geo from './geo';
import * as turf from '@turf/turf';
import { kaderVan, stelsel } from './groepschaal';
import { isBouwElement } from './bouwerSignaal';
import { binnenNaTentMaat } from './tentbinnen';
import { openStreetView } from './streetview';
import { vernieuwGridlabDoeken } from './gridlab';
import { isLichtmast } from './licht';
import { isTentBouw, tentTypeVan, TENTTYPES, tentMaten, tentErnaast, naastTent, stukOpPlan, tentAssen } from './tentbouw';
import { vraagBouwer } from './bouwerSignaal';
import { isUnitEl } from './containerbouw';
import { Icoon } from './iconen';
import Lagenpaneel from './Lagenpaneel';
import { LaagOpties } from './laagOpties';
import { hitOp } from './hit';
import LaagChip from './LaagChip';
import Tekenscherm from './Tekenscherm';
import BibliotheekPaneel from './BibliotheekPaneel';
import Stuklijst, { berekenStuklijst } from './Stuklijst';
import MateriaalScherm from './MateriaalScherm';
import Eigenschappen, { PlanAlgemeen } from './Eigenschappen';
import PopupInhoud, { NavKnoppen } from './PopupInhoud';
import DraaiboekPaneel from './DraaiboekPaneel';
import { controleer } from './controle';
import Delen from './Delen';
import PdfDialoog from './PdfDialoog';
import PlanPaneel, { verschil } from './PlanPaneel';
import OnderleggerGrepen from './OnderleggerGrepen';
import { zetOnderleggers, naarLokaal, pasAan, pasAanVast, planTransform, nieuweOnderlegger, dxfGeojson, pdfLijnen, bewaarVectorOnderlegger } from './onderlegger';
import StroomPaneel from './StroomPaneel';
import { stroomVan, berekenStroom, kabellijstCsv, KABEL_KLEUR, kabelSpanning, kabelDoelen, kabelTypeVoor, koppelVoeding } from './stroom';
import SignalisatiePaneel from './SignalisatiePaneel';
import CommandoPalet from './CommandoPalet';
import { IcoonKiezer, IcoonBol, icoonNaam } from './kaarticonen';
import Uitvoer from './Uitvoer';
import ExportVoortgang from './ExportVoortgang';
import { startExport } from './planLaden';
import CadImport from './CadImport';
import ControlePaneel, { DefinitiefDialoog } from './ControlePaneel';
import { isSign, instSign, volgendNr, richtingUitRoutes, signGeojson, zorgVoorKijkIcoon } from './signalisatie';
import { laadVasteAansluitingen, uitPlekItem, naarGeojsonVa, zorgVoorVaIconen, vaKaartLagen, zetVaDekking, vaId, isVaId, vaUuid, alsStroomItem } from './vasteAansluitingen';
import VasteAansluitingPaneel from './VasteAansluitingPaneel';
import { WR_MODULE, WERKRUIMTES, werkruimteOp, onthoudWerkruimte, laatsteWerkruimte, relevanteItems, kerncijfers, tvTelling } from './werkruimtes';
import WerkruimteBalk from './WerkruimteBalk';
import SignPuntDetail, { signPunten } from './SignPuntDetail';
import VerkeerPaneel, { VerkeerDetail } from './VerkeerPaneel';
import { isVerkeer, isVerkeerBord, verkeerGeojson, laadVerkeerIconen, verkeerKaartLagen, instVerkeer, verkeerStuklijst, verkeerStuklijstCsv, volgendVerkeerNr, VERKEER_LAAG, BORD_MAP } from './verkeer';
import VeiligheidPaneel, { VeiligheidDetail } from './VeiligheidPaneel';
import BrandingPaneel from './BrandingPaneel';
import { trefferBij, zetOntwerp, huidigOntwerp, brandingTelling, plekNaam, brandingBestellijst, brandingCsv } from './branding';
import StroomDetail from './StroomDetail';
import { tentChecklist } from './veiligheid';
import { opDeGrond, afstand as afstandTussen } from './controle';
import { bestellijst, bestellijstCsv } from './signalisatie';

import { GEREEDSCHAP, UITLEG, UITGEBREID_TOOLS, LIJST_TABS, LIJST_IDS, TD_MODUS, GROEPEN, PANELEN, PANEELNAAM, PANEELTIP, TEKEN_DELEN, nieuwId } from './gereedschap';
import { tdModusVoor, draaiItem, maatVan, lokaalNaarKaart, draaiRond } from './itemgeo';
import ZoekBalk from './ZoekBalk';
import HoekVeld from './HoekVeld';
import ZweefKaartje from './ZweefKaartje';
import SelectieInfo from './SelectieInfo';
import BinnenPreview from './BinnenPreview';
import BinnenScherm from './BinnenScherm';
import HulpMenu from './HulpMenu';
import slimSlepen, { vastItem, zetVasteLagen } from './slimSlepen';
import terraDrawStart from './terraDrawStart';
import elementPlaatsen from './elementPlaatsen';
import vakSlepen from './vakSlepen';
import routeTekenen from './routeTekenen';
import { legLangsWeg } from './wegVolgen';
import tekenhulp from './tekenhulp';

// Hoort een item bij dit binnenplan (gebouw, tent of container + verdieping)?
export const inBinnen = (it, b) => !!b && it.velden?.binnen?.host === b.host && (it.velden.binnen.verd || null) === (b.verd || null);

// Hoe vlakvullende elementen (rijplaten, vloeren …) gelegd worden: [sleutel, knop, uitleg, icoon, aanwijzing].
const PLAAT = (x, y, w, h) => <rect x={x} y={y} width={w} height={h} fill="currentColor" opacity=".85" />;
const PLAAT_LEG = [
  ['vak', 'Vlak', 'Sleep een rechthoek: die wordt helemaal gevuld met platen. Eén klik = één plaat.', <>{PLAAT(1, 1, 7, 5.5)}{PLAAT(9.5, 1, 7, 5.5)}{PLAAT(18, 1, 7, 5.5)}{PLAAT(1, 7.5, 7, 5.5)}{PLAAT(9.5, 7.5, 7, 5.5)}{PLAAT(18, 7.5, 7, 5.5)}</>, 'sleep een vak of klik voor één plaat'],
  ['dwars', 'Pad · dwars', 'Teken het pad als lijn: de platen liggen dwars op de rijrichting (korte kant in de rijrichting).', <>{PLAAT(2, 2, 4, 10)}{PLAAT(7.5, 2, 4, 10)}{PLAAT(13, 2, 4, 10)}{PLAAT(18.5, 2, 4, 10)}</>, 'teken het pad · Enter = klaar'],
  ['langs', 'Pad · in lengte', 'Teken het pad als lijn: de platen liggen in de lengte, achter elkaar.', <>{PLAAT(1, 3.5, 7.5, 7)}{PLAAT(9.3, 3.5, 7.5, 7)}{PLAAT(17.6, 3.5, 7.5, 7)}</>, 'teken het pad · Enter = klaar'],
  ['sporen', 'Rijsporen', 'Teken het pad als lijn: twee smalle rijen platen, één onder elk wiel (bv. voor een vrachtwagen).', <>{PLAAT(1, 1.5, 7.5, 3.5)}{PLAAT(9.3, 1.5, 7.5, 3.5)}{PLAAT(17.6, 1.5, 7.5, 3.5)}{PLAAT(1, 9, 7.5, 3.5)}{PLAAT(9.3, 9, 7.5, 3.5)}{PLAAT(17.6, 9, 7.5, 3.5)}</>, 'teken het pad · Enter = klaar'],
];

// Lagen voor het sleepvoorbeeld: dezelfde lagen als de kaart, op eigen bronnen. Eén keer bij het laden
// (68 lagen toevoegen tijdens de eerste sleep gaf een hapering).
function zorgVoorSleepLagen(map) {
  if (map.getSource('fm-sleep-v')) return;
  const leeg = { type: 'FeatureCollection', features: [] };
  map.addSource('fm-sleep-v', { type: 'geojson', data: leeg });
  map.addSource('fm-sleep-l', { type: 'geojson', data: leeg });
  for (const l of map.getStyle().layers) {
    if ((l.source !== 'fm-vormen' && l.source !== 'fm-labels') || l.id.endsWith('-sleep')) continue;
    const { id, source, ...rest } = l;
    map.addLayer({ ...rest, id: `${id}-sleep`, source: source === 'fm-vormen' ? 'fm-sleep-v' : 'fm-sleep-l' });
  }
}

// De meldingstekst: luistert op het winkeltje, hertekent enkel zichzelf.
function MeldingTekst({ winkel }) {
  const tekst = useSyncExternalStore(
    useCallback((l) => { winkel.luisteraars.add(l); return () => winkel.luisteraars.delete(l); }, [winkel]),
    () => winkel.tekst, () => '',
  );
  return tekst || null;
}

// Elementen die niet meer aangeboden worden (actief = false) blijven op het plan zichtbaar zolang er items naar
// verwijzen: ze komen mee in de lijst, maar niet in de bibliotheek (zie zonderHuis).
async function metOudeElementen(lijst, items) {
  const ids = new Set((lijst || []).map((e) => e.id));
  const mist = [...new Set((items || []).map((it) => it.element_id).filter((id) => id && !ids.has(id)))];
  if (!mist.length) return lijst || [];
  const r = await maps().from('bibliotheek').select('*').in('id', mist);
  return r.error || !r.data ? lijst || [] : [...(lijst || []), ...r.data];
}

export default function Editor({ planId }) {
  const kaartRef = useRef(null);
  const mapRef = useRef(null);
  const tdRef = useRef(null);
  const snapMiddenRef = useRef(null);
  const shiftRef = useRef(false);
  const grbRef = useRef([]);
  const laatsteSelectie = useRef(null);
  const voorkeurRef = useRef(null);
  const popupRef = useRef(null);
  const bewaarTimers = useRef(new Map());
  const historiek = useRef({ terug: [], vooruit: [] });
  const volgBezig = useRef(false); // deur of poort volgt de lijn: niet nog eens terugkoppelen
  const bewaarder = useRef(null);
  const [botsingen, setBotsingen] = useState([]); // { id, soort: 'botsing'|'verwijderd', mijn, server, door, paden, naam }
  const botsingenRef = useRef([]);
  botsingenRef.current = botsingen;

  const [profiel, setProfiel] = useState(null);
  const mijnIdRef = useRef(null); mijnIdRef.current = profiel?.id || null;
  const [plan, setPlan] = useState(null);
  const [lagen, setLagen] = useState([]);
  const [fasen, setFasen] = useState([]);
  const [items, setItems] = useState([]);
  const [elementen, setElementen] = useState([]);
  const [fout, setFout] = useState('');
  const [laden, setLaden] = useState(true);
  const [kaartKlaar, setKaartKlaar] = useState(false);

  const [gereedschap, setGereedschapRuw] = useState('selecteer');
  // Kabel en vaste aansluiting horen bij de module Stroom.
  const setGereedschap = useCallback((g) => setGereedschapRuw((oud) => { const n = typeof g === 'function' ? g(oud) : g; if (['kabel', 'vast'].includes(n) && !heeftModule('stroom')) { setTimeout(() => setMelding(nietInPakket('stroom')), 0); return oud; } return n; }), []);
  const [gekozenElement, setGekozenElement] = useState(null);
  const [elementRot, setElementRot] = useState(0);
  const [elementAantal, setElementAantal] = useState(1);
  // Lijnelementen (nadar, heras …): null = lijn tekenen, n = met één klik n stuks plaatsen.
  const [lijnStuks, setLijnStuks] = useState(null);
  // Rijplaten: in een vak slepen, of langs een lijn (dwars, in de lengte, of twee sporen).
  const [plaatLeg, setPlaatLeg] = useState('vak');
  const [plaatsFractie, setPlaatsFractie] = useState(null);
  useEffect(() => { setPlaatsFractie(null); }, [gekozenElement?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [doekPenseel, setDoekPenseel] = useState(null); // { itemId, doekId } om hekken op de kaart aan te klikken
  const [herkomstFilter, setHerkomstFilter] = useState(null); // enkel items van deze leverancier scherp (Lijsten › Stuklijst)
  const [materiaalOpen, setMateriaalOpen] = useState(false); // materiaalscherm (volledig scherm)
  const [focusLijst, setFocusLijst] = useState(null); // { ids: Set, label }: enkel deze items scherp (Toon op kaart uit het materiaalscherm)
  const [brandPenseel, setBrandPenseel] = useState(null); // { id: ontwerp of null (gom), drager } · werkruimte Branding
  const [penseelTip, setPenseelTip] = useState(null); // { x, y, tekst }
  const [vasthouden, setVasthouden] = useState(false);
  // Eenvoudig (standaard) of uitgebreid, per browser onthouden.
  const [uitgebreid, setUitgebreidRaw] = useState(false);
  useEffect(() => { try { setUitgebreidRaw(localStorage.getItem('fm-uitgebreid') === '1'); } catch {} }, []);
  const setUitgebreid = (v) => { setUitgebreidRaw(v); try { localStorage.setItem('fm-uitgebreid', v ? '1' : '0'); } catch {} };
  const laatsteLijst = useRef('stuklijst');
  const [controleFouten, setControleFouten] = useState(0);
  const [controleBlok, setControleBlok] = useState(null); // blok dat open moet in Controle (via Ctrl K)
  const [metingen, setMetingen] = useState([]);
  const [klembord, setKlembord] = useState(null);
  useEffect(() => { try { const k = JSON.parse(localStorage.getItem('fm-klembord') || 'null'); if (k?.items?.length) setKlembord(k); } catch {} }, []);
  const [actieveLaag, setActieveLaag] = useState(null);
  const [snelstijlen, setSnelstijlen] = useState([]);
  const [actieveFase, setActieveFase] = useState(null);
  const [geselecteerd, setGeselecteerd] = useState(null);
  const [popupDiv, setPopupDiv] = useState(null);
  const [tab, setTab] = useState(null);
  // Instellingen van het plan (tandwiel onderaan links): rechts, zolang niets geselecteerd is.
  const [planZicht, setPlanZicht] = useState(false);
  const [planTab, setPlanTab] = useState('algemeen');
  const zetPlanZicht = setPlanZicht;
  const toonPlan = (t) => { setVolScherm(false); setGeselecteerd(null); setExtra([]); setVastSel(null); if (t) setPlanTab(t); zetPlanZicht(true); };
  const [uitklap, setUitklap] = useState(null);
  // Icoon en kleur voor nieuwe punten (blijft bewaard in deze browser).
  const [puntStijl, setPuntStijlState] = useState(() => { try { return JSON.parse(localStorage.getItem('fm-puntstijl') || '{}'); } catch { return {}; } });
  const puntStijlRef = useRef(puntStijl); puntStijlRef.current = puntStijl;
  const setPuntStijl = (p) => setPuntStijlState((o) => { const n = { ...o, ...p }; try { localStorage.setItem('fm-puntstijl', JSON.stringify(n)); } catch {} return n; });
  const [puntKiezerOpen, setPuntKiezerOpen] = useState(false);
  const [palet, setPalet] = useState(false);
  useSluitBuiten(puntKiezerOpen, () => setPuntKiezerOpen(false));
  const [uitklapY, setUitklapY] = useState(0);
  // Selectie en Meten klappen open bij erover gaan (met een korte vertraging bij het verlaten).
  const zweefTimer = useRef(null);
  const zweefOpen = (id, y) => { clearTimeout(zweefTimer.current); zweefTimer.current = setTimeout(() => { setUitklapY(y); setUitklap(id); }, 90); };
  const zweefDicht = () => { clearTimeout(zweefTimer.current); zweefTimer.current = setTimeout(() => setUitklap(null), 260); };
  const zweefBlijf = () => clearTimeout(zweefTimer.current);
  const [bouwType, setBouwType] = useState(null);
  const [laatsteTool, setLaatsteTool] = useState({ selectie: 'selecteer', tekenen: 'lijn', element: 'element', meten: 'meten' });
  const [menu, setMenu] = useState(null);
  useSluitBuiten(!!menu, () => setMenu(null));
  useSluitBuiten(!!uitklap, () => setUitklap(null));
  const [volScherm, setVolScherm] = useState(false);
  // De meldingstekst onderaan de kaart verandert tijdens slepen en tekenen tientallen keren per seconde; die staat
  // daarom niet in de state van de editor (dat zou telkens alles hertekenen) maar in een klein winkeltje waarop
  // enkel de balk zelf luistert. De editor onthoudt alleen óf er een melding is (voor de plaats van de knoppenbalken).
  const meldingWinkel = useRef({ tekst: '', luisteraars: new Set() }).current;
  const [meldingAan, setMeldingAan] = useState(false);
  const setMelding = useCallback((t) => {
    const v = (typeof t === 'function' ? t(meldingWinkel.tekst) : t) || '';
    if (v === meldingWinkel.tekst) return;
    meldingWinkel.tekst = v;
    setMeldingAan(!!v);
    for (const l of meldingWinkel.luisteraars) l();
  }, [meldingWinkel]);
  const melding = meldingAan; // enkel aan/uit; de tekst komt uit het winkeltje (MeldingTekst)
  const [snap, setSnap] = useState({ punten: true, lijnen: true, hoek: false, midden: false, grb: false });
  const [extra, setExtra] = useState([]); // extra geselecteerde items (Shift-klik)
  const [stijlKlembord, setStijlKlembord] = useState(null);
  const [anderePlannen, setAnderePlannen] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [plekItems, setPlekItems] = useState([]);
  const [dialoog, setDialoog] = useState(null);
  const [uitvoer, setUitvoer] = useState(null); // { tab, id } van het scherm Exporteren
  const [pdfNaDelen, setPdfNaDelen] = useState(false); // PDF van het beeld vanuit Delen: daarna terug naar Delen
  const [bewaarStatus, setBewaarStatus] = useState('');
  const [verbinding, setVerbinding] = useState('verbinden'); // live | verbinden | offline
  const verbindingRef = useRef('verbinden');
  verbindingRef.current = verbinding;
  const liveRef = useRef(null);
  const [anderen, setAnderen] = useState([]); // collega's in dit plan (presence)
  const anderenRef = useRef([]);
  anderenRef.current = anderen;
  const [overname, setOvername] = useState(() => new Set()); // "Toch bewerken"
  const overnameRef = useRef(overname);
  overnameRef.current = overname;
  const actiefRef = useRef({ id: null, op: 0 });
  const [mijnNaam, setMijnNaam] = useState('');
  const [muisAan, setMuisAan] = useState(() => { try { return localStorage.getItem('fm-muis-tonen') !== '0'; } catch { return true; } });
  const [nuTik, setNuTik] = useState(0);
  const slotInfo = useRef({ slot: null, kijkers: [] });
  const [bezoek, setBezoek] = useState(null); // wat collega's deden sinds je vorige bezoek
  const [aankondiging, setAankondiging] = useState(null);
  const slepenRef = useRef(false);
  const uitgesteld = useRef(new Map()); // id -> rij: binnengekomen tijdens slepen
  const lokaalWeg = useRef(new Map()); // id -> tijd: zelf verwijderd, late meldingen negeren
  const posRef = useRef(null); // coördinaten onderaan: rechtstreeks in de DOM, geen render per muisbeweging
  const muisPosRef = useRef(null);
  const [zweef, setZweef] = useState(null);
  // Veldpunten: punten die iemand via een deellink op het terrein zette ("camera 3 hier"), om in te tekenen.
  const [veldpunten, setVeldpunten] = useState([]); const [vpKeuze, setVpKeuze] = useState(null);
  const [binnenZweef, setBinnenZweef] = useState(null); // { host, x, y } voorvertoning van een binnenplan
  const [overgang, setOvergang] = useState(''); // '' | 'in' | 'uit': naar binnen / buiten gaan
  const [binnenFoto, setBinnenFoto] = useState(false); // luchtfoto zichtbaar onder het binnenplan
  const [binnenScherm, setBinnenScherm] = useState(null); // { host, verd } binnenplan in een eigen scherm
  const schermNaPassen = useRef(null);
  const [kalibratie, setKalibratie] = useState(null); // { id, bron: [], doel: [], uitleg }
  const [olBewerk, setOlBewerk] = useState(null); // id van de achtergrondtekening die je op de kaart sleept/schaalt/draait
  const [vergelijkVersie, setVergelijkVersie] = useState(null);
  const [signZet, setSignZet] = useState(false);
  const [verdFilter, setVerdFilter] = useState(null);
  const [cadVervang, setCadVervang] = useState(null);
  const [iso, setIso] = useState(null); // groep die geïsoleerd bewerkt wordt
  const [binnen, setBinnen] = useState(null); // binnenplan: { host: item-id, verd: verdieping-id }
  const [ruimteKlik, setRuimteKlik] = useState(null); // onderlegger waarin je een ruimte aanklikt
  // Vaste aansluitingen (register over alle evenementen) en de gekozen: een rij uit de tabel, of { geometrie } voor een nieuwe.
  const [vast, setVast] = useState([]);
  const [vastSel, setVastSel] = useState(null);
  const [vastInBeeld, setVastInBeeld] = useState(new Set());
  // Werkruimte: Plan (alles) of een lens op dezelfde data (Signalisatie, Stroom, Veiligheid).
  const [werkruimte, setWerkruimte] = useState('plan');
  const [alleTools, setAlleTools] = useState(false);
  const [toonAlles, setToonAlles] = useState(false);
  const [signModus, setSignModus] = useState('wegwijzers');
  const [wrUitklap, setWrUitklap] = useState(null); // { id, y, lijst } keuzelijstje van bibliotheek-elementen
  const [wrLijst, setWrLijst] = useState(null); // { id, lijst } dezelfde keuze, maar in het paneel links (tab 'wrlijst')
  const [exportBezig, setExportBezig] = useState('');
  const [brandFouten, setBrandFouten] = useState(0);
  const tabVoorWr = useRef(null);
  const voorinstelRef = useRef(null); // naam/stijl/velden voor het volgende punt of de volgende lijn (werkruimte-gereedschap)
  const kabelVanRef = useRef(null);   // kabel-gereedschap: gekozen bron of kast
  useSluitBuiten(!!wrUitklap, () => setWrUitklap(null));
  // Menu Bouwers: kies een bouwer, klik op de kaart waar hij moet komen, de bouwer opent meteen.
  const [bouwMenu, setBouwMenu] = useState(null); // { y, tent: open? }
  useSluitBuiten(!!bouwMenu, () => setBouwMenu(null));
  const bouwerRef = useRef(null); // { soort: 'tent' | 'binnen' | 'teken', el }
  useEffect(() => { const w = laatsteWerkruimte(); setWerkruimte(WR_MODULE[w] && !heeftModule(WR_MODULE[w]) ? 'plan' : w); }, []);

  const [mijnWp, setMijnWp] = useState(null); // null = het hele plan; anders enkel deze werkplekken
  const magWp = (it) => !mijnWp || !Array.isArray(it?.werkplekken) || it.werkplekken.some((w) => mijnWp.includes(w)); // nieuw item: de database beslist
  const schrijven = kanSchrijven(profiel) && (!mijnWp || mijnWp.includes(werkruimte));

  // Altijd verse waarden in kaart- en Terra Draw-handlers.
  const st = useRef({});
  st.current = { mijnWp, binnen, doekPenseel, brandPenseel, vasthouden, items, lagen, elementen, gereedschap, gekozenElement, elementRot, elementAantal, lijnStuks, plaatLeg, plaatsFractie, actieveLaag, actieveFase, geselecteerd, schrijven, plan, fasen, snap, kalibratie, signZet, extra, plekItems, iso, vast, vastSel, werkruimte };

  const lagenMap = useMemo(() => new Map(lagen.map((l) => [l.id, l])), [lagen]);
  const [doeken, setDoeken] = useState([]);
  const [planEvent, setPlanEvent] = useState(null); // event van dit plan (naam, kleur)
  const elementenMap = useMemo(() => new Map([...elementen, ...doeken].map((e) => [e.id, e])), [elementen, doeken]);
  // Een doek opgeladen vanuit een bouwer (stelling, truss, wand): meteen in de lijsten.
  useEffect(() => {
    const nieuw = (e) => { const d = e.detail; if (d?.id) setDoeken((l) => (l.some((x) => x.id === d.id) ? l : [...l, d]).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))); };
    window.addEventListener('fm-ontwerp-nieuw', nieuw); return () => window.removeEventListener('fm-ontwerp-nieuw', nieuw);
  }, []);
  // Doeken uit GridLab: bijwerken als het ontwerp in GridLab gewijzigd is (bij het laden en als je terugkomt naar dit tabblad).
  const doekenRef = useRef(doeken); doekenRef.current = doeken;
  const heeftGridlab = doeken.some((d) => d.eigenschappen?.gridlab?.id);
  useEffect(() => {
    if (!heeftGridlab) return undefined;
    let laatst = 0;
    const kijk = () => {
      if (Date.now() - laatst < 20000 || document.visibilityState === 'hidden') return; laatst = Date.now();
      vernieuwGridlabDoeken(doekenRef.current).then((rijen) => { if (rijen.length) setDoeken((l) => l.map((x) => rijen.find((r) => r.id === x.id) || x)); }).catch(() => {});
    };
    kijk(); document.addEventListener('visibilitychange', kijk); window.addEventListener('focus', kijk);
    return () => { document.removeEventListener('visibilitychange', kijk); window.removeEventListener('focus', kijk); };
  }, [heeftGridlab]);
  const verborgenLagen = useMemo(() => new Set(lagen.filter((l) => !l.zichtbaar).map((l) => l.id)), [lagen]);
  const vergrendeldeLagen = useMemo(() => new Set(lagen.filter((l) => l.vergrendeld).map((l) => l.id)), [lagen]);
  zetVasteLagen(lagen);
  const item = items.find((i) => i.id === geselecteerd) || null;

  // ---------- Laden ----------
  useEffect(() => {
    let weg = false;
    (async () => {
      try {
        const [wie, p, l, f, i, b] = await Promise.all([
          wieBenIk(),
          maps().from('plannen').select('*').eq('id', planId).maybeSingle(),
          maps().from('lagen').select('*').eq('plan_id', planId).order('volgorde'),
          maps().from('fasen').select('*').eq('plan_id', planId).order('volgorde'),
          alles(() => maps().from('items').select('*').eq('plan_id', planId).order('volgorde')),
          alles(() => maps().from('bibliotheek').select('*').eq('actief', true).or(`plan_id.is.null,plan_id.eq.${planId}`).order('categorie').order('naam')),
        ]);
        const eerste = [p, l, f, i, b].find((r) => r.error);
        if (eerste) throw eerste.error;
        b.data = inBereik(await metOudeElementen(b.data, i.data), p.data?.event_id || null, i.data);
        if (!p.data) throw new Error('Dit plan bestaat niet (meer).');
        if (p.data.verwijderd_op) throw new Error('Dit plan staat in de prullenbak. Zet het terug via Plannen › Prullenbak om het te openen.');
        if (weg) return;
        setProfiel(wie);
        setPlan(p.data);
        // Beperkt tot werkplekken (bv. enkel Stroom)? Dan meteen in die werkplek openen.
        maps().rpc('mijn_werkplekken', { p_org: p.data.organisatie_id }).then(({ data }) => {
          if (weg || !Array.isArray(data) || !data.length) return;
          setMijnWp(data);
          const eerste = WERKRUIMTES.find((w) => data.includes(w.id) && (!WR_MODULE[w.id] || heeftModule(WR_MODULE[w.id])));
          if (eerste) { setWerkruimte(eerste.id); setTab(eerste.tab); }
          setMelding(`Je wijzigt enkel ${data.map((x) => WERKRUIMTES.find((w) => w.id === x)?.naam || x).join(', ')}. De rest van het plan zie je wel.`);
        });
        setLagen(l.data || []);
        setFasen(f.data || []);
        bewaarder.current?.zetBasis(i.data || []);
        setItems(i.data || []);
        b.data = metTekeningen(b.data);
        setElementen((b.data || []).filter((x) => x.tekenwijze !== 'stijl' && x.tekenwijze !== 'doek'));
        setDoeken((b.data || []).filter((x) => x.tekenwijze === 'doek'));
        setSnelstijlen((b.data || []).filter((x) => x.tekenwijze === 'stijl'));
        // Laatst gebruikte laag van dit plan onthouden (per browser).
        let bewaard = null; try { bewaard = localStorage.getItem(`fm-laag-${planId}`); } catch {}
        setActieveLaag(((l.data || []).find((x) => x.id === bewaard) || (l.data || [])[0])?.id || null);
      } catch (e) {
        setFout(foutTekst(e));
      } finally {
        if (!weg) setLaden(false);
      }
    })();
    return () => { weg = true; };
  }, [planId]);

  // Feedback: elk moment weten wat er te zien is (ingevuld verderop, na de hulpfuncties).
  const fbRef = useRef(null);
  useEffect(() => zetFeedbackContext(() => fbRef.current?.()), []);
  // Vanuit het feedbackoverzicht: ?item=… selecteert dat item, ?c=lng,lat&z=… zet het kaartbeeld.
  const urlGaNaar = useRef(null);
  if (urlGaNaar.current === null && typeof window !== 'undefined') { const q = new URLSearchParams(window.location.search); urlGaNaar.current = q.get('item') || q.get('c') ? { item: q.get('item'), c: q.get('c'), z: Number(q.get('z')) || null } : false; }
  useEffect(() => {
    if (laden || !kaartKlaar || !urlGaNaar.current) return;
    const w = urlGaNaar.current; urlGaNaar.current = false;
    const m = mapRef.current;
    if (w.c) { const [lng, lat] = w.c.split(',').map(Number); if (Number.isFinite(lng) && Number.isFinite(lat)) m?.jumpTo({ center: [lng, lat], ...(w.z ? { zoom: w.z } : {}) }); }
    if (w.item && st.current.items.some((x) => x.id === w.item)) { setGeselecteerd(w.item); setExtra([]); setTimeout(() => { try { tdRef.current?.selectFeature(w.item); } catch {} }, 60); }
  }, [laden, kaartKlaar]); // eslint-disable-line react-hooks/exhaustive-deps
  // Waar je was na vernieuwen: het open binnenplan (en de verdieping) staat in de adresbalk.
  const urlBinnen = useRef(null);
  if (urlBinnen.current === null && typeof window !== 'undefined') { const q = new URLSearchParams(window.location.search); urlBinnen.current = q.get('binnen') ? { host: q.get('binnen'), verd: q.get('verd') || null } : false; }
  useEffect(() => {
    if (laden || !urlBinnen.current) return;
    const w = urlBinnen.current; urlBinnen.current = false;
    if (!heeftModule('binnen')) return;
    const host = items.find((x) => x.id === w.host); if (!host) return;
    const vs = verdiepingenVan(host);
    setBinnenScherm({ host: host.id, verd: vs.some((v) => v.id === w.verd) ? w.verd : vs[0].id });
  }, [laden]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (laden || urlBinnen.current) return;
    try {
      const u = new URL(window.location.href);
      if (binnenScherm) { u.searchParams.set('binnen', binnenScherm.host); u.searchParams.set('verd', binnenScherm.verd); } else { u.searchParams.delete('binnen'); u.searchParams.delete('verd'); }
      if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u.href);
    } catch {}
  }, [binnenScherm?.host, binnenScherm?.verd, laden]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bibliotheek opnieuw ophalen als ze elders gewijzigd is (bibliotheekbeheer in een ander tabblad)
  // of als je terugkomt naar dit tabblad: nieuwe elementen en doeken zijn dan meteen te gebruiken.
  useEffect(() => {
    if (!planId) return undefined;
    let laatst = Date.now();
    const haal = async () => {
      laatst = Date.now();
      const b = await alles(() => maps().from('bibliotheek').select('*').eq('actief', true).or(`plan_id.is.null,plan_id.eq.${planId}`).order('categorie').order('naam'));
      if (b.error || !b.data) return;
      const l = metTekeningen(inBereik(await metOudeElementen(b.data, st.current.items), st.current.plan?.event_id || null, st.current.items));
      setElementen(l.filter((x) => x.tekenwijze !== 'stijl' && x.tekenwijze !== 'doek'));
      setDoeken(l.filter((x) => x.tekenwijze === 'doek'));
      setSnelstijlen(l.filter((x) => x.tekenwijze === 'stijl'));
    };
    let kanaal = null; try { kanaal = new BroadcastChannel('fm-bibliotheek'); kanaal.onmessage = () => haal(); } catch {}
    const terug = () => { if (document.visibilityState === 'visible' && Date.now() - laatst > 15000) haal(); };
    document.addEventListener('visibilitychange', terug); window.addEventListener('focus', terug);
    return () => { try { kanaal?.close(); } catch {} document.removeEventListener('visibilitychange', terug); window.removeEventListener('focus', terug); };
  }, [planId]);

  // ---------- Bewaren ----------
  // Enkel gewijzigde velden, met de versie die we kenden (bewaren.js + migratie 006).
  if (!bewaarder.current) {
    bewaarder.current = maakBewaarder({
      maps,
      rpc: (fn, args) => maps().rpc(fn, args),
      lokaal: (id) => st.current.items.find((x) => x.id === id),
      onStatus: (s) => setBewaarStatus(s === 'bezig' ? 'Bewaren…' : s === 'fout' ? 'Niet bewaard' : s === 'offline' ? 'Wacht op verbinding' : 'Bewaard'),
      onFout: (e) => setFout(foutTekst(e)),
      // De server-stand overnemen als de gebruiker het item intussen niet verder wijzigde.
      onServer: (verzonden, server, status) => {
        setItems((oud) => {
          let veranderd = false;
          const lijst = oud.map((x) => {
            if (x.id !== server.id || x !== verzonden) return x;
            veranderd = true;
            return { ...server };
          });
          if (!veranderd) return oud;
          st.current.items = lijst;
          return lijst;
        });
        if (status === 'samengevoegd') setTimeout(() => syncTdRef.current?.(), 0);
      },
      onBotsing: async (b) => {
        const namen = await namenVan([b.door]);
        setBotsingen((l) => [...l.filter((x) => x.id !== b.id), { ...b, soort: 'botsing', naam: namen[b.door] || 'een collega' }]);
      },
      onVerwijderd: async (id, info) => {
        const mijn = st.current.items.find((x) => x.id === id);
        // Door mezelf verwijderd (bv. ongedaan maken, of een ander tabblad) terwijl het hier nog staat:
        // dan wil ik het nog, dus stil terugzetten in plaats van te vragen.
        if (info && mijn && info.door && info.door === mijnIdRef.current) {
          try { await bewaarder.current.terugzetten([id]); const nu = st.current.items.find((x) => x.id === id); if (nu) bewaarder.current.bewaar(nu); } catch (e) { setFout(foutTekst(e)); }
          return;
        }
        if (!info || !mijn) {
          setItems((oud) => { const l = oud.filter((x) => x.id !== id); st.current.items = l; return l; });
          setTimeout(() => syncTdRef.current?.(), 0);
          return;
        }
        const namen = await namenVan([info.door]);
        setBotsingen((l) => [...l.filter((x) => x.id !== id), { id, soort: 'verwijderd', mijn, door: info.door, op: info.op, naam: namen[info.door] || 'een collega' }]);
      },
    });
  }
  const syncTdRef = useRef(null);
  const deelLater = useRef(null);

  const bewaarItem = useCallback((it, direct = false) => {
    if (!st.current.schrijven) return;
    const timers = bewaarTimers.current;
    clearTimeout(timers.get(it.id));
    const doe = () => { timers.delete(it.id); bewaarder.current.bewaar(it); };
    if (direct) doe(); else timers.set(it.id, setTimeout(doe, 400));
  }, []);
  // Alles wat nog in de wachttijd zit meteen bewaren (bv. voor een aangekondigde grote actie).
  const bewaarAllesNu = useCallback(() => {
    for (const [id, t] of bewaarTimers.current) {
      clearTimeout(t); bewaarTimers.current.delete(id);
      const it = st.current.items.find((x) => x.id === id);
      if (it) bewaarder.current.bewaar(it);
    }
  }, []);

  const verwijderUitDb = useCallback(async (ids) => {
    if (!ids.length) return;
    for (const id of ids) { clearTimeout(bewaarTimers.current.get(id)); bewaarTimers.current.delete(id); lokaalWeg.current.set(id, Date.now()); }
    await bewaarder.current.verwijder(ids);
  }, []);

  // Botsing of verwijderd door een ander: de keuze van de gebruiker uitvoeren.
  const losBotsingOp = useCallback(async (b, keuze) => {
    setBotsingen((l) => l.filter((x) => x.id !== b.id));
    const huidig = st.current.items.find((x) => x.id === b.id);
    if (b.soort === 'botsing') {
      if (keuze === 'mijn') { if (huidig) bewaarder.current.kiesMijn(huidig, b.server); return; }
      bewaarder.current.kiesHun(b.server);
      setItems((oud) => { const l = oud.map((x) => (x.id === b.id ? { ...b.server } : x)); st.current.items = l; return l; });
    } else if (keuze === 'mijn') {
      try {
        await bewaarder.current.terugzetten([b.id]);
        if (huidig) bewaarder.current.bewaar(huidig);
      } catch (e) { setFout(foutTekst(e)); }
      return;
    } else {
      bewaarder.current.vergeet([b.id]);
      setItems((oud) => { const l = oud.filter((x) => x.id !== b.id); st.current.items = l; return l; });
    }
    setTimeout(() => syncTdRef.current?.(), 0);
  }, []);

  // ---------- Terra Draw synchroniseren ----------
  const tdFeature = useCallback((it) => {
    const s = effectieveStijl(it, lagenMap.get(it.laag_id), elementenMap.get(it.element_id));
    return { id: it.id, type: 'Feature', geometry: geo.rondGeom(it.geometrie), properties: { mode: tdModusVoor(it), pid: it.id, kleur: s.kleur, gebogen: Object.values(it.parameters?.bogen || {}).some((h) => Number(h)) } };
  }, [lagenMap, elementenMap]);

  // Een item dat een collega op dit moment bewerkt (laatste 30 s), is voor jou vergrendeld.
  const slotVan = useCallback((id) => (id && !overnameRef.current.has(id)
    ? anderenRef.current.find((a) => a.bewerkt === id && Date.now() - (a.actief || 0) < 30000) || null : null), []);
  const bewerkbaar = useCallback((it) => {
    const { actieveFase: fase } = st.current;
    if (!it || it.verborgen || it.vergrendeld) return false;
    if (slotVan(it.id)) return false;
    if (st.current.mijnWp && Array.isArray(it.werkplekken) && !it.werkplekken.some((w) => st.current.mijnWp.includes(w))) return false;
    if (st.current.iso && it.groep_id !== st.current.iso) return false;
    // Binnenplan: enkel wat erin staat; buiten het binnenplan blijft de inrichting onaanraakbaar.
    if (st.current.binnen ? !inBinnen(it, st.current.binnen) : !!it.velden?.binnen) return false;
    if (it.element_id && (st.current.plan?.instellingen?.verborgen_elementen || []).includes(it.element_id)) return false;
    if (it.laag_id && (verborgenLagen.has(it.laag_id) || vergrendeldeLagen.has(it.laag_id))) return false;
    if (fase && it.fase_ids?.length && !it.fase_ids.includes(fase)) return false;
    return true;
  }, [verborgenLagen, vergrendeldeLagen]);

  const bewerkbaarRef = useRef(bewerkbaar); bewerkbaarRef.current = bewerkbaar;
  const syncTd = useCallback(() => {
    const td = tdRef.current;
    if (!td) return;
    // Terra Draw houdt enkel de selectie vast (zie slimTd in terraDrawStart.js): de rest wordt pas geladen als
    // het geselecteerd wordt. Onderdelen van een groep zijn enkel los te bewerken in Groep bewerken (iso).
    const sel = new Set([st.current.geselecteerd, ...(st.current.extra || [])].filter(Boolean));
    const gewenst = new Map(st.current.items.filter((it) => sel.has(it.id) && bewerkbaar(it) && !(it.groep_id && !st.current.iso)).map((it) => [it.id, it]));
    const huidig = td.getSnapshot().filter((f) => f.properties?.pid);
    const weg = huidig.filter((f) => !gewenst.has(f.id)).map((f) => f.id);
    if (weg.length) {
      if (weg.includes(st.current.geselecteerd)) {
        // Een item uit een groep zit niet in Terra Draw (de groep beweegt als geheel): het eruit halen mag de
        // selectie in de app niet wissen, anders ging het paneel meteen weer dicht.
        const id0 = st.current.geselecteerd;
        st.current.stilDeselect = st.current.items.some((x) => x.id === id0 && x.groep_id && !st.current.iso);
        try { td.deselectFeature(id0); } catch {}
        st.current.stilDeselect = false;
      }
      td.removeFeatures(weg);
    }
    const bekend = new Set(huidig.map((f) => f.id));
    const nieuw = [];
    for (const it of gewenst.values()) {
      if (!bekend.has(it.id)) nieuw.push(tdFeature(it));
      else {
        const f = td.getSnapshotFeature(it.id);
        if (f && JSON.stringify(f.geometry.coordinates) !== JSON.stringify(geo.rondGeom(it.geometrie).coordinates)) {
          try { td.updateFeatureGeometry(it.id, geo.rondGeom(it.geometrie)); } catch { td.removeFeatures([it.id]); nieuw.push(tdFeature(it)); }
        }
        const { kleur, gebogen } = tdFeature(it).properties;
        if (f && (f.properties.kleur !== kleur || !!f.properties.gebogen !== gebogen)) td.updateFeatureProperties(it.id, { kleur, gebogen });
      }
    }
    if (nieuw.length) {
      const r = td.addFeatures(nieuw);
      const mis = r.filter((x) => !x.valid);
      if (mis.length) console.warn('Toolen Maps: niet in Terra Draw geladen', mis);
    }
  }, [bewerkbaar, tdFeature]);

  syncTdRef.current = syncTd;

  // ---------- Live: wijzigingen van collega's ----------
  const syncLater = useRef(null);
  const naExtern = useCallback(() => { clearTimeout(syncLater.current); syncLater.current = setTimeout(() => { syncTdRef.current?.(); deurenNaExternRef.current?.(); }, 60); }, []);
  // Na wijzigingen van een collega: deuren en poorten die niet (meer) op hun plek in de lijn staan, erin zetten
  // (bv. als de lijn al toekwam en de deur nog niet). Zonder stap in de historiek.
  const deurenNaExternRef = useRef(null);
  deurenNaExternRef.current = () => {
    if (!st.current.schrijven || slepenRef.current || volgBezig.current) return;
    let n = 0;
    for (const lijn of st.current.items) {
      if (lijn.geometrie?.type !== 'LineString' || !lijn.parameters?.openingen?.length) continue;
      const v = volgLijn(lijn, st.current.items);
      volgBezig.current = true;
      try { for (const { deur, patch } of v.patches) { pasToeRef.current?.(deur, { ...deur, ...patch }, { geschiedenis: false }); n += 1; } } finally { volgBezig.current = false; }
    }
    if (n) setTimeout(() => syncTdRef.current?.(), 0);
  };
  const ontvangItem = useCallback((rij) => {
    if (rij.plan_id !== planId || !('geometrie' in rij)) return; // enkel echte items
    // Zelf verwijderd: late meldingen van de eigen wijzigingen negeren. Zet een collega het terug
    // (bewerkt_door is dan iemand anders), dan komt het wel terug op de kaart.
    const weg = lokaalWeg.current.get(rij.id);
    if (weg && Date.now() - weg < 15000 && (!rij.bewerkt_door || rij.bewerkt_door === mijnIdRef.current)) return;
    if (weg) lokaalWeg.current.delete(rij.id);
    if (slepenRef.current && st.current.geselecteerd === rij.id) { uitgesteld.current.set(rij.id, rij); return; }
    const lokaal = st.current.items.find((x) => x.id === rij.id);
    const nieuw = bewaarder.current.extern(rij, lokaal);
    if (!nieuw) return;
    if (lokaal && Object.keys(itemVerschil(lokaal, nieuw)).length === 0) return; // eigen wijziging die terugkomt
    setItems((oud) => {
      const i = oud.findIndex((x) => x.id === rij.id);
      const lijst = i < 0 ? [...oud, nieuw] : oud.map((x) => (x.id === rij.id ? nieuw : x));
      st.current.items = lijst;
      return lijst;
    });
    naExtern();
  }, [planId, naExtern]);
  const ontvangWeg = useCallback(async (rij) => {
    const lokaal = st.current.items.find((x) => x.id === rij.id);
    if (!lokaal) return;
    // In dit tabblad verwijderd (bv. ongedaan maken van het tekenen) en intussen hier weer teruggezet
    // (opnieuw): de eigen stand wint, stil opnieuw bewaren in plaats van te vragen.
    const b = bewaarder.current.basis.get(rij.id);
    const eigen = b ? Object.keys(itemVerschil(b, lokaal)).length : 0;
    const zelf = !rij.verwijderd_door || rij.verwijderd_door === mijnIdRef.current;
    if (zelf && (lokaalWeg.current.has(rij.id) || (eigen && st.current.geselecteerd === rij.id))) {
      lokaalWeg.current.delete(rij.id);
      bewaarder.current.vergeet([rij.id]);
      bewaarder.current.bewaar(st.current.items.find((x) => x.id === rij.id) || lokaal);
      return;
    }
    clearTimeout(bewaarTimers.current.get(rij.id)); bewaarTimers.current.delete(rij.id);
    if (eigen && st.current.geselecteerd === rij.id) {
      const namen = await namenVan([rij.verwijderd_door]);
      setBotsingen((l) => [...l.filter((x) => x.id !== rij.id), { id: rij.id, soort: 'verwijderd', mijn: lokaal, door: rij.verwijderd_door, op: rij.verwijderd_op, naam: namen[rij.verwijderd_door] || 'een collega' }]);
      return;
    }
    bewaarder.current.vergeet([rij.id]);
    if (st.current.geselecteerd === rij.id) setGeselecteerd(null);
    setItems((oud) => { const l = oud.filter((x) => x.id !== rij.id); st.current.items = l; return l; });
    naExtern();
  }, [naExtern]);
  useEffect(() => { if (actieveLaag) try { localStorage.setItem(`fm-laag-${planId}`, actieveLaag); } catch {} }, [actieveLaag, planId]);
  // Actieve laag weg (verwijderd, ook door een collega)? Dan de eerste laag.
  useEffect(() => {
    if (lagen.length && actieveLaag && !lagen.some((l) => l.id === actieveLaag)) setActieveLaag(lagen[0].id);
  }, [lagen, actieveLaag]);
  // Eigen laagwijzigingen onderweg: de echo's van de server (met tussenstanden) negeren,
  // anders springen lagen heen en weer tijdens het herschikken.
  const laagBezig = useRef(new Map());
  const ontvangLaag = useCallback((soort, nieuw, oud) => {
    if (soort === 'DELETE') { setLagen((l) => l.filter((x) => x.id !== oud?.id)); return; }
    // Enkel echte lagen: een item (met geometrie) hoort hier nooit in de lagenlijst.
    if (!nieuw?.id || nieuw.plan_id !== planId || 'geometrie' in nieuw || !('volgorde' in nieuw)) return;
    if ((laagBezig.current.get(nieuw.id) || 0) > Date.now()) { setLagen((l) => l.map((x) => (x.id === nieuw.id ? { ...x, rev: Math.max(x.rev ?? 0, nieuw.rev ?? 0) } : x))); return; }
    setLagen((l) => {
      const i = l.findIndex((x) => x.id === nieuw.id);
      if (i < 0) return [...l, nieuw].sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
      if ((l[i].rev ?? 0) >= (nieuw.rev ?? 0)) return l;
      return l.map((x) => (x.id === nieuw.id ? nieuw : x)).sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
    });
  }, [planId]);
  const planBezig = useRef(0);
  const ontvangPlan = useCallback((rij) => {
    if (planBezig.current) return; // eigen wijziging onderweg: die brengt de serverstand mee
    setPlan((p) => {
      if (!p || (p.rev ?? 0) >= (rij.rev ?? 0)) return p;
      const n = { ...p, ...rij, centrum: p.centrum, zoom: p.zoom };
      st.current.plan = n;
      return n;
    });
  }, []);
  // Na een onderbreking alles ophalen wat gemist werd.
  const herlaad = useCallback(async () => {
    const [i, l, p] = await Promise.all([
      alles(() => maps().from('items').select('*').eq('plan_id', planId)),
      maps().from('lagen').select('*').eq('plan_id', planId).order('volgorde'),
      maps().from('plannen').select('*').eq('id', planId).maybeSingle(),
    ]);
    if (i.error || !i.data) return;
    const op = new Set(i.data.map((x) => x.id));
    for (const r of i.data) ontvangItem(r);
    const weg = st.current.items.filter((x) => !op.has(x.id) && bewaarder.current.basis.has(x.id)).map((x) => x.id);
    if (weg.length) {
      bewaarder.current.vergeet(weg);
      setItems((oud) => { const n = oud.filter((x) => !weg.includes(x.id)); st.current.items = n; return n; });
    }
    if (l.data) for (const r of l.data) ontvangLaag('UPDATE', r);
    if (p.data) ontvangPlan(p.data);
    bewaarder.current.opnieuw();
    naExtern();
  }, [planId, ontvangItem, ontvangLaag, ontvangPlan, naExtern]);

  useEffect(() => {
    if (laden || !profiel?.id || !planId) return undefined;
    const tab = Math.random().toString(36).slice(2, 8);
    const live = startLive({
      client: sb(), planId, sleutel: `${profiel.id}:${tab}`,
      onItem: ontvangItem, onWeg: ontvangWeg, onLaag: ontvangLaag, onPlan: ontvangPlan,
      onStatus: (s, opnieuw) => { setVerbinding(s); if (s === 'live' && opnieuw) herlaad(); if (s === 'live') setTimeout(() => deelLater.current?.(), 200); },
      onAanwezig: (state) => aanwezigRef.current?.(state),
      onMuis: (m) => muisRef.current?.(m),
      onBericht: (m) => berichtRef.current?.(m),
    });
    liveRef.current = live;
    const lobby = startLobby({ client: sb(), sleutel: `${profiel.id}:${tab}`, orgId: plan?.organisatie_id });
    lobbyRef.current = lobby;
    const los = () => {
      if (!slepenRef.current) return;
      slepenRef.current = false;
      const l = [...uitgesteld.current.values()]; uitgesteld.current.clear();
      setTimeout(() => l.forEach(ontvangItem), 600); // eerst de eigen wijziging laten bewaren
    };
    const neer = (e) => { if (e.target?.closest?.('.fm-kaart')) slepenRef.current = true; };
    document.addEventListener('pointerdown', neer, true);
    document.addEventListener('pointerup', los, true);
    return () => { live.stop(); lobby.stop(); liveRef.current = null; lobbyRef.current = null; document.removeEventListener('pointerdown', neer, true); document.removeEventListener('pointerup', los, true); };
  }, [laden, profiel?.id, planId]); // eslint-disable-line react-hooks/exhaustive-deps
  const aanwezigRef = useRef(null);
  const lobbyRef = useRef(null);
  const muisRef = useRef(null);
  const berichtRef = useRef(null);
  // Bij elke update van een collega meldt presence hem even af en weer aan: niet laten knipperen,
  // wie verdwijnt blijft nog 6 s staan (tenzij hij echt weg is).
  const gezienRef = useRef(new Map()); const gezienTimer = useRef(null);
  aanwezigRef.current = (state) => {
    const nu = Date.now(); const g = gezienRef.current;
    const lijst = anderenUit(state, profiel?.id);
    for (const a of lijst) g.set(a.uid, { a, t: nu });
    for (const [uid, v] of g) if (nu - v.t > 6000) g.delete(uid);
    const uit = [...g.values()].map((v) => (lijst.find((x) => x.uid === v.a.uid) || v.a)).sort((x, y) => String(x.naam).localeCompare(String(y.naam), 'nl'));
    setAnderen((oud) => (oud.length === uit.length && oud.every((x, i) => x.uid === uit[i].uid && JSON.stringify(x) === JSON.stringify(uit[i])) ? oud : uit));
    clearTimeout(gezienTimer.current);
    if (uit.length > lijst.length) gezienTimer.current = setTimeout(() => aanwezigRef.current?.(state), 6100);
  };
  berichtRef.current = (m) => { if (m?.soort === 'aankondiging') { bewaarAllesNu(); setAankondiging(m); } };
  useEffect(() => { if (!laden && profiel?.id) sindsVorigBezoek(planId, profiel.id).then((b) => b && setBezoek(b)).catch(() => {}); }, [laden, profiel?.id, planId]);
  // Een grote actie aankondigen: collega's krijgen 30 s, hun openstaande wijzigingen worden eerst bewaard.
  const kondigAan = useCallback(async (actie, extra = {}) => {
    if (!anderenRef.current.length || !liveRef.current) return;
    const op = Date.now() + 30000;
    liveRef.current.bericht({ soort: 'aankondiging', actie, naam: mijnNaam || 'Een collega', op, ...extra });
    setAankondiging({ actie, naam: 'Jij', op, eigen: true, ...extra });
    await new Promise((r) => setTimeout(r, 30000));
    setAankondiging(null);
  }, [mijnNaam]);

  // Eigen naam (voor collega's).
  useEffect(() => { if (profiel?.id) namenVan([profiel.id]).then((n) => setMijnNaam(n[profiel.id] && n[profiel.id] !== 'een collega' ? n[profiel.id] : (profiel.email || '').split('@')[0] || 'Collega')); }, [profiel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Eigen aanwezigheid delen: werkruimte, selectie en wat je bewerkt. Hoogstens om de 1,5 s.
  const deelNu = useCallback(() => {
    const live = liveRef.current;
    if (!live || !profiel?.id) return;
    const sel = st.current.geselecteerd ? [st.current.geselecteerd, ...(st.current.extra || []).filter((x) => x !== st.current.geselecteerd)] : (st.current.extra || []);
    live.deel({ uid: profiel.id, naam: mijnNaam || 'Collega', kleur: kleurVoor(profiel.id), werkruimte: st.current.werkruimte, selectie: sel.slice(0, 20), bewerkt: actiefRef.current.id, actief: actiefRef.current.op, sinds: Date.now() });
  }, [profiel?.id, mijnNaam]);
  const deelWacht = useRef({ t: 0, h: null });
  deelLater.current = () => {
    const w = deelWacht.current;
    clearTimeout(w.h);
    const wacht = Math.max(0, 1500 - (Date.now() - w.t));
    w.h = setTimeout(() => { w.t = Date.now(); deelNu(); }, wacht);
  };
  useEffect(() => { deelLater.current?.(); }, [werkruimte, geselecteerd, extra, verbinding, mijnNaam]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (profiel?.id && mijnNaam && verbinding === 'live') lobbyRef.current?.meld({ uid: profiel.id, naam: mijnNaam, kleur: kleurVoor(profiel.id), plan_id: planId, werkruimte }); }, [profiel?.id, mijnNaam, verbinding, planId, werkruimte]);

  // Sloten verlopen na 30 s: zolang iemand iets bewerkt, af en toe herberekenen.
  const sloten = anderen.filter((a) => a.bewerkt && Date.now() - (a.actief || 0) < 30000).map((a) => a.bewerkt).join(',');
  useEffect(() => {
    syncTdRef.current?.();
    if (!sloten) return undefined;
    const t = setInterval(() => { setNuTik((n) => n + 1); syncTdRef.current?.(); }, 5000);
    return () => clearInterval(t);
  }, [sloten, overname]);

  // Selecties van collega's op de kaart, in hun kleur.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    const feats = [];
    for (const a of anderen) {
      for (const id of a.selectie || []) {
        const it = items.find((x) => x.id === id);
        if (!it?.geometrie) continue;
        const g = it.geometrie.type === 'Polygon' ? { type: 'LineString', coordinates: it.geometrie.coordinates[0] } : it.geometrie;
        feats.push({ type: 'Feature', geometry: g, properties: { kleur: a.kleur, naam: a.bewerkt === id && Date.now() - (a.actief || 0) < 30000 ? `${a.naam} bewerkt` : a.naam } });
      }
    }
    const data = { type: 'FeatureCollection', features: feats };
    if (map.getSource('fm-anderen')) { map.getSource('fm-anderen').setData(data); return; }
    try {
      map.addSource('fm-anderen', { type: 'geojson', data });
      map.addLayer({ id: 'fm-anderen-lijn', type: 'line', source: 'fm-anderen', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': ['get', 'kleur'], 'line-width': 3, 'line-dasharray': [2, 1.2] } });
      map.addLayer({ id: 'fm-anderen-punt', type: 'circle', source: 'fm-anderen', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 13, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ['get', 'kleur'], 'circle-stroke-width': 3 } });
      map.addLayer({ id: 'fm-anderen-naam', type: 'symbol', source: 'fm-anderen', layout: { 'text-field': ['get', 'naam'], 'text-size': 11, 'symbol-placement': 'point', 'text-offset': [0, -1.6], 'text-allow-overlap': true }, paint: { 'text-color': '#fff', 'text-halo-color': ['get', 'kleur'], 'text-halo-width': 3 } });
    } catch {}
  }, [anderen, items, kaartKlaar, nuTik]);

  // Muis van collega's.
  const muizen = useRef(new Map()); // sleutel -> { marker, t }
  muisRef.current = ({ sleutel, pos }) => {
    const map = mapRef.current;
    const m = muizen.current.get(sleutel);
    const wie = anderenRef.current.find((a) => a.key === sleutel) || anderenRef.current.find((a) => sleutel?.startsWith(`${a.uid}:`));
    if (!map || !pos || !wie || !muisAan) { if (m) { m.marker.remove(); muizen.current.delete(sleutel); } return; }
    if (m) { m.marker.setLngLat(pos); m.t = Date.now(); return; }
    const el = document.createElement('div');
    el.className = 'fm-muis';
    // Kleur komt van een collega (aanwezigheid): enkel een echte kleurcode in de HTML.
    const kl = /^#[0-9a-fA-F]{3,8}$/.test(String(wie.kleur || '')) ? wie.kleur : '#108AED';
    el.innerHTML = `<svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true"><path d="M1 1l13 7-6 1.5L5.5 16z" fill="${kl}" stroke="#fff" stroke-width="1.5"/></svg><span style="background:${kl}"></span>`;
    el.querySelector('span').textContent = wie.naam;
    const marker = new maplibregl.Marker({ element: el, anchor: 'top-left' }).setLngLat(pos).addTo(map);
    muizen.current.set(sleutel, { marker, t: Date.now() });
  };
  useEffect(() => {
    const t = setInterval(() => {
      for (const [k, m] of muizen.current) if (Date.now() - m.t > 15000 || !anderenRef.current.some((a) => k.startsWith(`${a.uid}:`))) { m.marker.remove(); muizen.current.delete(k); }
    }, 3000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return undefined;
    const beweeg = (e) => { if (muisAan && anderenRef.current.length) liveRef.current?.muis([e.lngLat.lng, e.lngLat.lat]); };
    const weg = () => { if (anderenRef.current.length) liveRef.current?.muis(null); };
    map.on('mousemove', beweeg);
    map.getCanvasContainer().addEventListener('mouseleave', weg);
    return () => { map.off('mousemove', beweeg); try { map.getCanvasContainer().removeEventListener('mouseleave', weg); } catch {} };
  }, [kaartKlaar, muisAan]);
  useEffect(() => { if (!muisAan) { for (const m of muizen.current.values()) m.marker.remove(); muizen.current.clear(); } try { localStorage.setItem('fm-muis-tonen', muisAan ? '1' : '0'); } catch {} }, [muisAan]);

  // ---------- Item-mutaties met historiek ----------
  const pasToe = useCallback((voor, na, { geschiedenis = true, direct = false } = {}) => {
    // Nooit bewaren in een laag die niet (meer) bestaat (bv. net verwijderd): dan de actieve of de eerste laag.
    if (na?.laag_id && st.current.lagen.length && !st.current.lagen.some((l) => l.id === na.laag_id)) {
      const ok = st.current.lagen.some((l) => l.id === st.current.actieveLaag) ? st.current.actieveLaag : st.current.lagen[0].id;
      na = { ...na, laag_id: ok };
    }
    if (na?.geometrie) na = { ...na, geometrie: geo.rondGeom(na.geometrie) };
    // Bochten volgen hun stuk als er punten bij komen of weg gaan.
    if (voor?.parameters?.bogen && na?.geometrie && voor.geometrie && na.parameters?.bogen === voor.parameters.bogen) na = { ...na, parameters: { ...na.parameters, bogen: geo.herschikBogen(voor.geometrie, na.geometrie, voor.parameters.bogen) } };
    // Deuren en poorten blijven in de lijn als die verandert (verplaatst, gedraaid, knooppunt versleept of erbij).
    if (voor?.parameters?.openingen?.length && na?.geometrie?.type === 'LineString' && voor.geometrie && na.parameters?.openingen === voor.parameters.openingen && na.geometrie !== voor.geometrie) {
      const op = herschikOpeningen(voor.geometrie, na.geometrie, voor.parameters.openingen);
      if (op !== voor.parameters.openingen) na = { ...na, parameters: { ...na.parameters, openingen: op?.length ? op : undefined } };
    }
    // Een deur of poort die zelf versleept of breder/smaller wordt, schuift langs haar lijn (en blijft erin).
    if (!volgBezig.current && voor && na && deurLijnId(na) && na.geometrie) {
      const lijn = st.current.items.find((x) => x.id === deurLijnId(na));
      const o = lijn && (lijn.parameters?.openingen || []).find((x) => x?.id === na.id);
      if (lijn && o) {
        const pl = deurPlaats(lijn, o, Number(na.parameters?.diepte) || 0.7);
        if (pl && !deurOpPlek(na, pl)) {
          const sch = schuifOpening(lijn, na, na.parameters?.breedte);
          let lijn2 = lijn;
          if (sch) {
            lijn2 = { ...lijn, parameters: { ...lijn.parameters, openingen: lijn.parameters.openingen.map((x) => (x?.id === na.id ? sch.opening : x)) } };
            volgBezig.current = true;
            try { pasToeRef.current?.(lijn, lijn2, { geschiedenis, direct }); } finally { volgBezig.current = false; }
          }
          const pl2 = deurPlaats(lijn2, sch ? sch.opening : o, Number(na.parameters?.diepte) || 0.7) || pl;
          na = { ...na, geometrie: pl2.geometrie, parameters: { ...na.parameters, midden: pl2.midden, rot: pl2.rot, breedte: pl2.breedte } };
          setTimeout(() => syncTdRef.current?.(), 0);
        }
      }
    }
    // Paal en net: een knikpunt op elke paal.
    // Enkel bij het tekenen (nieuw item): daarna mag je palen zelf verder uit elkaar zetten.
    if (na?.element_id && na.geometrie?.type === 'LineString' && !voor) {
      const pv = paalVerdeling(na.geometrie, st.current.elementen.find((x) => x.id === na.element_id), na.parameters?.bogen);
      if (pv) { const par = herschikKoord(na, (k) => pv.vakken[k]); na = { ...na, geometrie: geo.rondGeom(pv.geometrie), parameters: { ...(par || na.parameters || {}), bogen: pv.bogen || undefined } }; setTimeout(() => syncTdRef.current?.(), 0); }
    }
    setItems((oud) => {
      let lijst = oud;
      if (voor && !na) lijst = oud.filter((x) => x.id !== voor.id);
      else if (!voor && na) lijst = [...oud, na];
      else lijst = oud.map((x) => (x.id === na.id ? na : x));
      st.current.items = lijst;
      return lijst;
    });
    if (geschiedenis) {
      // Alles wat in dezelfde handeling gebeurt (bv. een selectie verslepen of draaien) is één stap terug.
      const h = historiek.current;
      if (h.bundel && h.terug.length) h.terug[h.terug.length - 1].stappen.push({ voor, na });
      else { h.terug.push({ stappen: [{ voor, na }] }); h.bundel = true; setTimeout(() => { h.bundel = false; }, 0); }
      if (h.terug.length > 200) h.terug.shift();
      h.vooruit = [];
    }
    if (na) bewaarItem(na, direct || !voor);
    else if (voor) verwijderUitDb([voor.id]);
    if (na) { actiefRef.current = { id: na.id, op: Date.now() }; deelLater.current?.(); }
    // Een ingerichte tent groter of kleiner: de ruimte groeit mee, deuren volgen de wand, de rest blijft staan.
    if (voor && na && na.element_id && na.parameters?.midden && (voor.parameters?.breedte !== na.parameters?.breedte || voor.parameters?.diepte !== na.parameters?.diepte)) {
      const el = st.current.elementen.find((x) => x.id === na.element_id);
      const pt = binnenNaTentMaat(voor, na, el, st.current.items, st.current.plan?.instellingen?.onderleggers || []);
      for (const { id, patch } of pt) { const v = st.current.items.find((x) => x.id === id); if (v) pasToeRef.current?.(v, { ...v, ...patch }, { geschiedenis }); }
      if (pt.length) setTimeout(() => syncTdRef.current?.(), 0);
    }
    // Vloerstukken van een tent (terras, podium …) volgen de tent: verplaatst, gedraaid, groter of in de bouwer aangepast.
    if (na && na.velden?.tent && (na.velden.tent.stukken?.length || voor?.velden?.tent?.stukken?.length)
      && (!voor || voor.velden?.tent?.stukken !== na.velden.tent.stukken || voor.laag_id !== na.laag_id || (voor.fase_ids || []).join() !== (na.fase_ids || []).join() || JSON.stringify(voor.parameters) !== JSON.stringify(na.parameters))) setTimeout(() => stukSyncRef.current?.(na.id), 0);
    // Deuren en poorten in een hekkenlijn: op hun plek in de lijn zetten (zelfde stap in de historiek).
    // Een opening zonder deur (bv. een gekopieerde lijn) verdwijnt.
    if (!volgBezig.current && na?.geometrie?.type === 'LineString' && na.parameters?.openingen?.length) {
      const lijnVeranderd = !voor || voor.geometrie !== na.geometrie || voor.parameters !== na.parameters || voor.laag_id !== na.laag_id || voor.groep_id !== na.groep_id || (voor.fase_ids || []).join() !== (na.fase_ids || []).join();
      if (lijnVeranderd) {
        const v = volgLijn(na, st.current.items);
        volgBezig.current = true;
        try {
          for (const { deur, patch } of v.patches) {
            const mee = {};
            if (voor && voor.laag_id !== na.laag_id) mee.laag_id = na.laag_id;
            if (voor && voor.groep_id !== na.groep_id) mee.groep_id = na.groep_id || null;
            if (voor && (voor.fase_ids || []).join() !== (na.fase_ids || []).join()) mee.fase_ids = na.fase_ids || null;
            pasToeRef.current?.(deur, { ...deur, ...patch, ...mee }, { geschiedenis, direct });
          }
          // Laag, groep of fase van de lijn veranderd: ook de deuren die al goed staan.
          if (voor && (voor.laag_id !== na.laag_id || voor.groep_id !== na.groep_id || (voor.fase_ids || []).join() !== (na.fase_ids || []).join())) {
            const al = new Set(v.patches.map((x) => x.deur.id));
            for (const o of v.openingen) {
              const deur = !al.has(o.id) && st.current.items.find((x) => x.id === o.id);
              if (deur && (deur.laag_id !== na.laag_id || (deur.groep_id || null) !== (na.groep_id || null) || (deur.fase_ids || []).join() !== (na.fase_ids || []).join())) pasToeRef.current?.(deur, { ...deur, laag_id: na.laag_id, groep_id: na.groep_id || null, fase_ids: na.fase_ids || null }, { geschiedenis, direct });
            }
          }
        } finally { volgBezig.current = false; }
        // Openingen zonder deur: pas na deze tik nakijken (een deur die in dezelfde handeling gemaakt is, zit nog niet in de lijst).
        if (v.weg.length) setTimeout(() => ruimOpeningenOpRef.current?.(na.id), 0);
        if (v.patches.length) setTimeout(() => syncTdRef.current?.(), 0);
      }
    }
  }, [bewaarItem, verwijderUitDb]);
  const stukSyncRef = useRef(null);
  const pasToeRef = useRef(null); pasToeRef.current = pasToe;
  // Openingen in een lijn waarvan de deur weg is of bij een andere lijn hoort (bv. een gekopieerde lijn): laten vallen.
  const ruimOpeningenOpRef = useRef(null);
  ruimOpeningenOpRef.current = (lijnId) => {
    const lijn = st.current.items.find((x) => x.id === lijnId);
    if (!lijn?.parameters?.openingen?.length) return;
    const v = volgLijn(lijn, st.current.items);
    if (!v.weg.length) return;
    volgBezig.current = true;
    try { pasToe(lijn, { ...lijn, parameters: { ...lijn.parameters, openingen: v.openingen.length ? v.openingen : undefined } }, { geschiedenis: false }); } finally { volgBezig.current = false; }
    setTimeout(() => syncTdRef.current?.(), 0);
  };


  const wijzigItem = useCallback((id, patch, opties) => {
    const voor = st.current.items.find((x) => x.id === id);
    if (!voor) return;
    const na = { ...voor, ...patch };
    pasToe(voor, na, opties);
  }, [pasToe]);

  const maakItem = useCallback((it) => {
    const { plan: p, actieveLaag: laag, actieveFase: fase } = st.current;
    // Vooringevuld door een werkruimte-gereedschap (bv. PPO-punt, kabel): naam, stijl, velden en laag.
    const vi = voorinstelRef.current;
    if (vi && !it.element_id && (it.soort === 'punt' || it.soort === 'lijn') && ['punt', 'lijn'].includes(st.current.gereedschap)) {
      const l = vi.laag ? st.current.lagen.find((x) => vi.laag.test(x.naam)) : null;
      it = { naam: vi.naam ?? it.naam, ...it, stijl: { ...(vi.stijl || {}), ...(it.stijl || {}) }, velden: { ...(it.velden || {}), ...(vi.velden || {}) }, ...(l ? { laag_id: l.id } : {}) };
    }
    const vol = {
      id: it.id || nieuwId(), plan_id: p.id, laag_id: it.laag_id !== undefined ? it.laag_id : laag,
      element_id: null, groep_id: st.current.iso || null, soort: 'vlak', parameters: {}, stijl: {}, naam: null, notitie: null,
      velden: {}, fase_ids: fase ? [fase] : null, vergrendeld: false, verborgen: false,
      volgorde: st.current.items.length, ...it,
    };
    if (st.current.binnen && !vol.velden?.binnen) vol.velden = { ...(vol.velden || {}), binnen: { host: st.current.binnen.host, verd: st.current.binnen.verd || null } };
    pasToe(null, vol, { direct: true });
    return vol;
  }, [pasToe]);

  stukSyncRef.current = (tentId) => {
    const it = st.current.items.find((x) => x.id === tentId); const elOp = (id) => st.current.elementen.find((x) => x.id === id);
    const oud = st.current.items.filter((x) => x.velden?.tentStuk?.tent === tentId);
    const el = it && elOp(it.element_id); const stukken = (it && el && it.velden?.tent?.stukken) || [];
    const td = tdRef.current; let n = 0; const houden = new Set();
    for (const s of stukken) {
      const e = elOp(s.el); const r = e && stukOpPlan(it, el, s, e); if (!r) continue;
      const par = { midden: r.midden, breedte: r.breedte, diepte: r.diepte, rot: r.rot, ...(Number(s.h) > 0 ? { hoogte: Number(s.h) } : {}), ...(e.eigenschappen?.verspringend_standaard ? { verspringend: true } : {}) };
      const g = geo.elementVeelhoek(r.midden, r.breedte, r.diepte, r.rot);
      const x = oud.find((q) => q.velden.tentStuk.stuk === s.id);
      // Ligt het stuk al goed (bv. mee versleept met de tent), dan niets doen: anders schuift het dubbel en wordt slepen traag.
      const xp = x?.parameters || {}; const zelfde = x && x.element_id === e.id && xp.midden && Math.abs(xp.midden[0] - par.midden[0]) < 2e-7 && Math.abs(xp.midden[1] - par.midden[1]) < 2e-7
        && Math.abs((Number(xp.rot) || 0) - par.rot) < 0.05 && xp.breedte === par.breedte && xp.diepte === par.diepte && (xp.hoogte || 0) === (par.hoogte || 0);
      // Laag en fasen volgen de tent.
      const zelfdeLaag = x && x.laag_id === it.laag_id && (x.fase_ids || []).join() === (it.fase_ids || []).join();
      if (x) { houden.add(x.id); if (!zelfde || !zelfdeLaag) { wijzigItem(x.id, { element_id: e.id, laag_id: it.laag_id, fase_ids: it.fase_ids || null, ...(zelfde ? {} : { geometrie: g, parameters: { ...xp, ...par } }) }); n += 1; } }
      else { const nw = maakItem({ laag_id: it.laag_id, fase_ids: it.fase_ids || null, soort: 'element', element_id: e.id, geometrie: g, parameters: par, velden: { tentStuk: { tent: tentId, stuk: s.id } } }); td?.addFeatures([tdFeature(nw)]); n += 1; }
    }
    const weg = oud.filter((x) => !houden.has(x.id)).map((x) => x.id);
    if (weg.length) verwijderItems(weg);
    if (n) setTimeout(() => syncTdRef.current?.(), 0);
  };
  const verwijderItems = useCallback((idsIn) => {
    const td = tdRef.current;
    let ids = [...idsIn]; let heel = 0;
    // Een hekkenlijn met deuren of poorten: die gaan mee weg.
    for (const id of idsIn) {
      const it = st.current.items.find((x) => x.id === id);
      for (const o of it?.parameters?.openingen || []) if (o?.id && !ids.includes(o.id) && st.current.items.some((x) => x.id === o.id && deurLijnId(x) === id)) ids.push(o.id);
    }
    // Een deur of poort weg: de opening in de lijn sluit, de hekken lopen weer door.
    for (const id of idsIn) {
      const deur = st.current.items.find((x) => x.id === id); const lid = deurLijnId(deur);
      if (!lid || ids.includes(lid)) continue;
      const lijn = st.current.items.find((x) => x.id === lid);
      if (!lijn?.parameters?.openingen?.some((o) => o?.id === id)) continue;
      const rest = lijn.parameters.openingen.filter((o) => o?.id !== id);
      pasToe(lijn, { ...lijn, parameters: { ...lijn.parameters, openingen: rest.length ? rest : undefined } });
      heel += 1;
    }
    // Oud model: een deur uit een geknipte heraslijn weghalen, de twee stukken ernaast worden terug één lijn.
    for (const id of idsIn) {
      const d = st.current.items.find((x) => x.id === id)?.parameters?.inLijn;
      if (!d?.a || !d?.b || ids.includes(d.a) || ids.includes(d.b)) continue;
      const a = st.current.items.find((x) => x.id === d.a); const b = st.current.items.find((x) => x.id === d.b);
      if (!a || !b || a.element_id !== b.element_id) continue;
      const el = st.current.elementen?.find?.((x) => x.id === a.element_id) || null;
      const m = el && lijnHeel(a, b, el);
      if (!m) continue;
      pasToe(a, { ...a, ...m });
      for (const x of st.current.items) if (x.parameters?.inLijn?.a === b.id && !ids.includes(x.id)) pasToe(x, { ...x, parameters: { ...x.parameters, inLijn: { ...x.parameters.inLijn, a: a.id } } });
      ids.push(b.id); heel += 1;
    }
    if (heel) setTimeout(() => setMelding(heel > 1 ? `${heel} deuren weg: de lijnen zijn weer heel.` : 'Deur weg: de lijn is weer heel.'), 0);
    const groepen = new Set(ids.map((id) => st.current.items.find((x) => x.id === id)?.groep_id).filter(Boolean));
    for (const id of ids) {
      // Eerst uit Terra Draw halen, anders blijft de geselecteerde vorm staan tot je ernaast klikt.
      try { td?.deselectFeature(id); } catch {}
      try { if (td?.hasFeature?.(id) ?? true) td?.removeFeatures([id]); } catch {}
      const voor = st.current.items.find((x) => x.id === id);
      if (voor) pasToe(voor, null);
    }
    // Blijft er van een groep nog maar één item over: dan is het geen groep meer (anders kan je het niet bewerken).
    for (const g of groepen) {
      const rest = st.current.items.filter((x) => x.groep_id === g && !ids.includes(x.id));
      if (rest.length === 1) pasToe(rest[0], { ...rest[0], groep_id: null });
    }
    // Enkel deselecteren als het geselecteerde item zelf weg is (een bouwer die vloerstukken weghaalt, blijft open).
    if (!st.current.geselecteerd || ids.includes(st.current.geselecteerd)) setGeselecteerd(null);
    else setExtra((x) => x.filter((id) => !ids.includes(id)));
    setTimeout(syncTd, 0);
  }, [pasToe, syncTd]);

  // Deur (bibliotheek: eigenschappen.inzet = 'deur') op de dichtstbijzijnde heraslijn zetten.
  const zoekDeurPlek = useCallback((el, punt) => {
    const map = mapRef.current;
    const b = Number(el.breedte_m) || 1;
    const mpp = map ? geo.meterPerPixel(map.getZoom(), punt[1]) : 0.1;
    let best = null;
    for (const it of st.current.items) {
      if (it.soort !== 'element' || it.geometrie?.type !== 'LineString' || it.verborgen || !bewerkbaarRef.current?.(it)) continue;
      const le = st.current.elementen?.find?.((x) => x.id === it.element_id);
      if (!le || !isHekElement(le) || !(Number(le.eenheid_m) > 0)) continue;
      let d; try { d = turf.pointToLineDistance(turf.point(punt), turf.lineString(it.geometrie.coordinates), { units: 'meters' }); } catch { continue; }
      if (d <= Math.max(1.5, 25 * mpp) && (!best || d < best.d)) best = { it, le, d };
    }
    if (!best) return { fout: 'Klik op een heraslijn: de deur komt op de dichtstbijzijnde naad.' };
    const pl = deurPlek(best.it, best.le, punt, b);
    return pl.fout ? pl : { ...best, pl, b };
  }, []);
  const zetDeur = useCallback((el, punt) => {
    const z = zoekDeurPlek(el, punt);
    if (z.fout) { setMelding(z.fout); return null; }
    const { pl, b } = z; const it = z.it;
    const d = Number(el.diepte_m) || 0.7;
    const poort = el.eigenschappen?.inzet === 'poort';
    // Eerst de deur, dan de opening in de lijn: zo vindt de lijn haar deur meteen.
    const deur = maakItem({ soort: 'element', element_id: el.id, laag_id: it.laag_id, groep_id: it.groep_id || null, fase_ids: it.fase_ids, ...(it.velden?.binnen ? { velden: { binnen: it.velden.binnen } } : {}),
      geometrie: geo.elementVeelhoek(pl.midden, b, d, pl.rot, null), parameters: { midden: pl.midden, breedte: b, diepte: d, rot: pl.rot, inLijn: { lijn: it.id }, ...(poort ? { dubbel: false } : {}) } });
    wijzigItem(it.id, { parameters: { ...(it.parameters || {}), openingen: [...(it.parameters?.openingen || []), { id: deur.id, k: pl.k, d: pl.d, b }] } });
    tdRef.current?.addFeatures([tdFeature(deur)]);
    setTimeout(syncTd, 0);
    setMelding(poort ? `Poort in de lijn gezet (na hek ${pl.i}). Enkel of dubbel en de draairichting kies je in de eigenschappen; de poort schuift mee als je ze versleept.` : `Deur in de lijn gezet (na hek ${pl.i}). Draairichting aanpassen in de eigenschappen; de deur schuift mee als je ze versleept.`);
    return deur;
  }, [zoekDeurPlek, wijzigItem, maakItem, tdFeature, syncTd]);
  const zetDeurRef = useRef(null); zetDeurRef.current = zetDeur;
  // Binnenlocatie als icoon: een punt (element 'Binnenlocatie' of een punt met een binnenplan) opent ook een binnenplan.
  // Gereedschap Punt → Binnenlocatie: een gebouwicoon zetten en meteen selecteren (Binnenplan maken).
  const binnenPlaatsRef = useRef(null);
  // Gereedschap 'bouwer' (uit het menu Bouwers): een tent plaatsen en de tentbouwer openen, of het tekenscherm op die plek.
  const bouwerPlaatsRef = useRef(null);
  const lichtRichtRef = useRef(null); // eenmalige klik: richting van de spots van een lichtmast
  bouwerPlaatsRef.current = (p) => {
    const k = bouwerRef.current; bouwerRef.current = null; setGereedschap('selecteer');
    if (!k) return;
    if (k.soort === 'teken') { openTekenschermRef.current?.(null, p); return; }
    if (k.soort === 'unit' && k.el) {
      const el = k.el; const b = Number(el.breedte_m) || 3; const d = Number(el.diepte_m) || 6; const rot = Number(st.current.elementRot) || 0;
      const it = maakItem({ laag_id: laagVoorElement(el), soort: 'element', element_id: el.id, geometrie: geo.elementVeelhoek(p, b, d, rot), parameters: { midden: p, breedte: b, diepte: d, rot } });
      tdRef.current?.addFeatures([tdFeature(it)]);
      vraagBouwer(it.id);
      setTimeout(() => { setGeselecteerd(it.id); try { tdRef.current?.selectFeature(it.id); } catch {} }, 30);
      return;
    }
    if (k.soort === 'tent' && k.el) {
      const el = k.el; const n = el.eigenschappen?.module ? 3 : 1; const b = (Number(el.breedte_m) || 5) * n; const d = Number(el.diepte_m) || 5; const rot = Number(st.current.elementRot) || 0;
      const it = maakItem({ laag_id: laagVoorElement(el), soort: 'element', element_id: el.id, geometrie: geo.elementVeelhoek(p, b, d, rot, n > 1 ? null : el.omtrek), parameters: { midden: p, breedte: b, diepte: d, rot } });
      tdRef.current?.addFeatures([tdFeature(it)]);
      vraagBouwer(it.id);
      setTimeout(() => { setGeselecteerd(it.id); try { tdRef.current?.selectFeature(it.id); } catch {} }, 30);
    }
  };
  binnenPlaatsRef.current = (p) => {
    const el = st.current.elementen.find((x) => x.eigenschappen?.binnenlocatie);
    const it = maakItem(el
      ? { laag_id: laagVoorElement(el), soort: 'element', element_id: el.id, geometrie: { type: 'Point', coordinates: p }, parameters: { midden: p } }
      : { soort: 'punt', naam: 'Binnenlocatie', geometrie: { type: 'Point', coordinates: p }, parameters: {}, stijl: { icoon: 'gebouw', kleur: '#1d1d1b' }, velden: { binnenplan: { verdiepingen: [{ id: 'g', naam: 'Gelijkvloers' }] } } });
    tdRef.current?.addFeatures([tdFeature(it)]);
    naTekenenRef.current?.([it.id]);
    // Via Bouwers → Binnenplan: het binnenplan meteen openen.
    if (bouwerRef.current?.soort === 'binnen') { bouwerRef.current = null; setTimeout(() => openBinnenRef.current?.(it.id), 250); }
  };
  const isBinnenPunt = (it) => it?.geometrie?.type === 'Point' && (!!it.velden?.binnenplan || !!elementenMap.get(it.element_id)?.eigenschappen?.binnenlocatie);
  // Welke bibliotheek-elementen al in dit plan staan (meest gebruikt eerst), voor het paneel.
  const gebruiktInPlan = useMemo(() => {
    const m = new Map();
    for (const it of items) if (it.element_id) m.set(it.element_id, (m.get(it.element_id) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [items]);
  // Voorbeeld tijdens het plaatsen van een deur: groen waar ze komt, rood als het daar niet kan.
  useEffect(() => {
    const map = mapRef.current;
    const el = gekozenElement;
    if (!map || !kaartKlaar || gereedschap !== 'element' || !isDeurElement(el)) return undefined;
    const zet = (f) => {
      const data = { type: 'FeatureCollection', features: f };
      if (map.getSource('fm-deurv')) map.getSource('fm-deurv').setData(data);
      else { map.addSource('fm-deurv', { type: 'geojson', data }); map.addLayer({ id: 'fm-deurv-l', type: 'fill', source: 'fm-deurv', paint: { 'fill-color': ['get', 'k'], 'fill-opacity': 0.45, 'fill-outline-color': ['get', 'k'] } }); }
    };
    let raf = 0;
    const beweeg = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const z = zoekDeurPlek(el, [e.lngLat.lng, e.lngLat.lat]);
        if (z.fout) { zet([]); return; }
        zet([{ type: 'Feature', geometry: geo.elementVeelhoek(z.pl.midden, z.b, Math.max(0.9, Number(el.diepte_m) || 0.7), z.pl.rot, null), properties: { k: '#16A34A' } }]);
      });
    };
    map.on('mousemove', beweeg);
    return () => { cancelAnimationFrame(raf); map.off('mousemove', beweeg); try { map.getSource('fm-deurv')?.setData({ type: 'FeatureCollection', features: [] }); } catch {} };
  }, [kaartKlaar, gereedschap, gekozenElement, zoekDeurPlek]);

  const ongedaan = useCallback((opnieuw = false) => {
    const h = historiek.current;
    const groep = (opnieuw ? h.vooruit : h.terug).pop();
    if (!groep) return;
    (opnieuw ? h.terug : h.vooruit).push(groep);
    const stappen = groep.stappen || [groep];
    // Deuren en poorten zitten met hun lijn in dezelfde stap: niets laten terugkoppelen tijdens het terugzetten.
    volgBezig.current = true;
    try { for (const stap of opnieuw ? stappen : [...stappen].reverse()) doeStap(stap, opnieuw); } finally { volgBezig.current = false; }
    setTimeout(syncTd, 0);
  }, [pasToe, syncTd]); // eslint-disable-line react-hooks/exhaustive-deps
  const doeStap = (stap, opnieuw) => {
    const [van, naar] = opnieuw ? [stap.voor, stap.na] : [stap.na, stap.voor];
    if (van && naar) {
      // Enkel de velden van deze stap terugzetten, bovenop de huidige stand. Velden die een
      // ander intussen veranderde (huidige waarde ≠ waarde na mijn stap) blijven staan.
      const huidig = st.current.items.find((x) => x.id === van.id);
      if (!huidig) { setMelding('Stap overgeslagen: dit item bestaat niet meer.'); return; }
      const stapPatch = itemVerschil(van, naar);
      const eigen = {};
      let overgeslagen = 0;
      for (const [k, v] of Object.entries(stapPatch)) {
        if (v && typeof v === 'object' && !Array.isArray(v) && ['velden', 'stijl', 'parameters'].includes(k)) {
          const sub = {};
          for (const [s2, w] of Object.entries(v)) { if (gelijk(huidig[k]?.[s2], van[k]?.[s2])) sub[s2] = w; else overgeslagen++; }
          if (Object.keys(sub).length) eigen[k] = sub;
        } else if (gelijk(huidig[k], van[k])) eigen[k] = v; else overgeslagen++;
      }
      if (overgeslagen) setMelding('Een deel van de stap is overgeslagen: een collega wijzigde dit item na jou.');
      if (!Object.keys(eigen).length) return;
      pasToe(huidig, pasPatchToe(huidig, eigen), { geschiedenis: false, direct: true });
    } else {
      pasToe(van, naar, { geschiedenis: false, direct: true });
    }
  };

  const wijzigLaagRef = useRef(null);
  // Testhaak: enkel actief als een test vóór het laden window.__FM_TEST zet (meerdere browsers tegelijk).
  if (typeof window !== 'undefined' && window.__FM_TEST) {
    window.__FM_TEST.editor = { wijzigItem, maakItem, verwijderItems, ongedaan, wijzigPlan: (x) => wijzigPlanRef.current?.(x), items: () => st.current.items, lagen: () => st.current.lagen, plan: () => st.current.plan, verbinding: () => verbindingRef.current, anderen: () => anderenRef.current, kies: (id) => setGeselecteerd(id), botsingen: () => botsingenRef.current, kondigAan: (a, x) => kondigAan(a, x), kaart: () => mapRef.current, td: () => tdRef.current, zetDeur, kiesElement: (el) => { setGekozenElement(el); setGereedschap('element'); }, naarBinnen: (id) => gaNaarBinnenRef.current?.(id), kiesMeer: (ids) => { setGeselecteerd(ids[0]); setExtra(ids.slice(1)); }, geselecteerd: () => st.current.geselecteerd, zetLaag: (id, patch) => wijzigLaagRef.current?.(id, patch), elementen: () => st.current.elementen, stuklijst: () => berekenStuklijst(st.current.items, elementenMap, lagenMap) };
  }

  // ---------- Elementen ----------
  const elementItem = useCallback((el, midden, rot, extra = {}) => {
    if (el.tekenwijze === 'punt') {
      // 'aantal' is geen kolom: bij een punt hoort het niet in het item.
      const { aantal, ...rest } = extra;
      return { soort: 'element', element_id: el.id, geometrie: { type: 'Point', coordinates: midden }, parameters: { midden }, naam: null, ...rest };
    }
    const { aantal, ...rest } = extra;
    const n = el.tekenwijze === 'schaal' && !el.eigenschappen?.module && Number(aantal) > 1 ? Math.round(Number(aantal)) : 1;
    const b = (Number(el.breedte_m) || 1) * n;
    const d = Number(el.diepte_m) || 1;
    return {
      soort: 'element', element_id: el.id,
      geometrie: geo.elementVeelhoek(midden, b, d, rot, n > 1 ? null : el.omtrek),
      parameters: { midden, breedte: b, diepte: d, rot, ...(n > 1 ? { aantal: n } : {}) }, ...rest,
    };
  }, []);

  const laagVoorElement = useCallback((el) => {
    // De laag waarin je werkt wint (zoals de 'current layer' in AutoCAD of de geselecteerde laag
    // in Illustrator en My Maps). De standaardlaag van het element is enkel nog een terugval,
    // als de actieve laag verborgen of vergrendeld is.
    const actief = st.current.lagen.find((x) => x.id === st.current.actieveLaag);
    if (actief && actief.zichtbaar !== false && !actief.vergrendeld) return actief.id;
    if (!el?.standaardlaag) return (st.current.lagen.find((x) => x.zichtbaar !== false && !x.vergrendeld) || actief)?.id || st.current.actieveLaag;
    // Synoniemen, zodat oudere plannen (laag "Stroom") ook werken.
    const ALIAS = { elektriciteit: ['elektriciteit', 'stroom'], stroom: ['stroom', 'elektriciteit'] };
    const namen = ALIAS[el.standaardlaag.toLowerCase()] || [el.standaardlaag.toLowerCase()];
    const l = namen.map((n) => st.current.lagen.find((x) => x.naam.toLowerCase() === n)).find(Boolean);
    return l?.id || st.current.actieveLaag;
  }, []);

  // Na het tekenen of plaatsen: terug naar Selectie met het nieuwe item
  // geselecteerd (zoals Figma), tenzij het gereedschap vastgehouden wordt.
  // Lijn of vlak afwerken zonder toetsenbord (knop Klaar, of Esc).
  const rondTekenenAf = () => {
    const m = mapRef.current; if (!m) return false;
    const td = tdRef.current;
    const bezig = td?.getSnapshot?.().some((f) => f.properties?.currentlyDrawing);
    if (!bezig) return false;
    const ev = new KeyboardEvent('keyup', { key: 'Enter', bubbles: true });
    m.getCanvas().dispatchEvent(ev);
    return true;
  };
  const laatstePuntWeg = () => {
    const td = tdRef.current;
    if (!td?.getSnapshot?.().some((f) => f.properties?.currentlyDrawing)) return false;
    try { if (td.canUndo()) { td.undo(); return true; } } catch {}
    return false;
  };
  const naTekenenRef = useRef(null);
  naTekenenRef.current = (ids) => {
    if (st.current.vasthouden || !ids?.length) return;
    setGereedschap('selecteer');
    setTimeout(() => {
      const [eerste, ...rest] = ids.map(String);
      setExtra(rest);
      setGeselecteerd(eerste);
      laatsteSelectie.current = eerste;
      try { tdRef.current?.setMode('select'); tdRef.current?.selectFeature(eerste); } catch {}
    }, 40);
  };

  // ---------- Kaart opstarten ----------
  useEffect(() => {
    if (!plan || !kaartRef.current || mapRef.current) return;
    registreerProtocollen();
    const centrum = Array.isArray(plan.centrum) ? plan.centrum : [3.6031, 50.8456];
    const map = new maplibregl.Map({
      container: kaartRef.current,
      style: (kiesFotoVl(plan.instellingen), basisStijl(plan.basiskaart || 'luchtfoto')),
      center: centrum, zoom: Number(plan.zoom) || 17, maxZoom: 22,
      attributionControl: { compact: true }, preserveDrawingBuffer: false, dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    klapBronvermeldingIn(map);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 140 }), 'bottom-left');
    mapRef.current = map;
    if (typeof window !== 'undefined') window.__fmMap = map; // voor tests

    map.on('load', () => {
      map.addSource('fm-vormen', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('fm-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      for (const l of kaartLagen(centrum[1])) map.addLayer(l);
      zorgVoorSleepLagen(map);
      setKaartKlaar(true);
    });
    map.on('mousemove', (e) => { muisPosRef.current = [e.lngLat.lng, e.lngLat.lat]; if (posRef.current) posRef.current.textContent = `${e.lngLat.lat.toFixed(5)}° N · ${e.lngLat.lng.toFixed(5)}° O`; });
    map.getCanvasContainer().addEventListener('mouseleave', () => { muisPosRef.current = null; });

    let viewTimer;
    map.on('moveend', () => {
      if (!st.current.schrijven) return;
      clearTimeout(viewTimer);
      viewTimer = setTimeout(() => {
        const c = map.getCenter();
        maps().from('plannen').update({ centrum: [c.lng, c.lat], zoom: map.getZoom() }).eq('id', plan.id).then(() => {});
      }, 2500);
    });

    return () => {
      clearTimeout(viewTimer);
      try { tdRef.current?.stop(); } catch {}
      tdRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Terra Draw opstarten (enkel wie mag schrijven) ----------
  useEffect(() => terraDrawStart(() => ({ bewerkbaar: (it) => bewerkbaarRef.current(it), grbRef, kaartKlaar, laagVoorElement, laatsteSelectie, maakItem, mapRef, naTekenenRef, puntStijlRef, schrijven, setExtra, setGereedschap, setGeselecteerd, setMelding, setMetingen, shiftRef, snapMiddenRef, st, syncTd, tdFeature, tdRef, volgMee, voorkeurRef, voorbeeldRef, wijzigItem })), [kaartKlaar, schrijven]); // eslint-disable-line react-hooks/exhaustive-deps

  // Snap-instellingen live bijwerken.
  useEffect(() => {
    const td = tdRef.current;
    if (!td) return;
    const s = { toCoordinate: snap.punten, toLine: snap.lijnen, ...(snap.hoek ? { toDegree: { degree: 15 } } : {}), ...(snapMiddenRef.current ? { toCustom: snapMiddenRef.current } : {}) };
    try { td.updateModeOptions('linestring', { snapping: s }); td.updateModeOptions('polygon', { snapping: s }); } catch {}
  }, [snap]);

  // Gereedschap → Terra Draw-modus.
  useEffect(() => {
    const td = tdRef.current;
    const map = mapRef.current;
    if (!map) return;
    if (td) {
      let modus = TD_MODUS[gereedschap] || 'static';
      const perStuk = gekozenElement?.tekenwijze === 'lijn' && Number(gekozenElement.eenheid_m) > 0 && lijnStuks;
      const alsLijn = ((gekozenElement?.tekenwijze === 'lijn' && !perStuk) || (gekozenElement?.eigenschappen?.module && plaatLeg !== 'vak')) && !isBouwElement(gekozenElement);
      if (gereedschap === 'element') modus = alsLijn ? 'linestring' : 'static';
      try { td.setMode(modus); } catch {}
    }
    zetCursor(map, 'gereedschap', gereedschap === 'element' && (gekozenElement?.tekenwijze !== 'lijn' || isBouwElement(gekozenElement)) && !(gekozenElement?.eigenschappen?.module && plaatLeg !== 'vak') ? 'crosshair' : ['punt', 'tekst', 'sector', 'veelhoek', 'ellips', 'meten', 'meten-vlak', 'maatlijn', 'knip', 'binnenlocatie', 'bouwer', 'lichtricht'].includes(gereedschap) ? 'crosshair' : '');
    setMelding(gereedschap === 'element' && !gekozenElement ? 'Kies links een element uit de bibliotheek' : '');
  }, [gereedschap, gekozenElement, plaatLeg, lijnStuks]);

  // Klikken op de kaart: element plaatsen, of (alleen lezen) een item tonen.
  useEffect(() => elementPlaatsen(() => ({ binnenPlaatsRef, bouwerPlaatsRef, lichtRichtRef, plaatsSnapRef, zetDeurRef, elementItem, kaartKlaar, kalibreerKlik, laagVoorElement, maakItem, mapRef, naTekenenRef, negeerKlik, plaatsSjabloon, setExtra, setGereedschap, setGeselecteerd, st, tdFeature, tdRef, zetSignPunt })), [kaartKlaar, maakItem, elementItem, laagVoorElement, tdFeature]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Vlakvullende elementen: een vak slepen = ingedeeld in stukken ----------
  const negeerKlik = useRef(false);
  useEffect(() => vakSlepen(() => ({ kaartKlaar, laagVoorElement, maakItem, mapRef, naTekenenRef, negeerKlik, setMelding, st, tdFeature, tdRef })), [kaartKlaar, maakItem, laagVoorElement, tdFeature]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Route langs de weg (OSRM van FOSSGIS: auto, fiets, te voet) ----------
  const [routeProfiel, setRouteProfiel] = useState('bike');
  const [routeInfo, setRouteInfo] = useState(null);
  const routeRef = useRef({ punten: [], segmenten: [] });
  const routeKlaarRef = useRef(null);
  const routeTerugRef = useRef(null);
  const routeTekenRef = useRef(null);
  const profielRef = useRef('bike'); profielRef.current = routeProfiel;
  useEffect(() => routeTekenen(() => ({ kaartKlaar, maakItem, wijzigItem, mapRef, naTekenenRef, profielRef, routeKlaarRef, routeRef, routeTerugRef, routeTekenRef, setMelding, setRouteInfo, st, tdFeature, tdRef })), [kaartKlaar, maakItem, wijzigItem, tdFeature]);
  // Een bestaande lijn als route aanpassen: enkel de hoofdpunten worden handvatten.
  // Sleep een punt, of sleep op de lijn om een tussenpunt te maken; de weg wordt opnieuw gevolgd.
  const routeAanpassen = useCallback((id) => {
    const it = st.current.items.find((x) => x.id === id);
    const c = it?.geometrie?.type === 'LineString' ? it.geometrie.coordinates : null;
    if (!c || c.length < 2) return;
    const lijn = turf.lineString(c);
    const L = turf.length(lijn, { units: 'meters' });
    let punten = Array.isArray(it.parameters?.route?.punten) && it.parameters.route.punten.length >= 2 ? it.parameters.route.punten : null;
    if (!punten || punten.length > 30) {
      // Geen routepunten bewaard (bv. geïmporteerd): de knikken van de lijn, vereenvoudigd tot een handvol.
      let tol = 0.00015;
      punten = punten || c;
      for (let k = 0; k < 6 && punten.length > 25; k++, tol *= 2) {
        try { punten = turf.simplify(turf.lineString(punten), { tolerance: tol, highQuality: true }).geometry.coordinates; } catch { break; }
      }
    }
    // Stukken tussen de punten uit de huidige lijn: er verandert niets tot je een punt verplaatst.
    let vorige = 0;
    const loc = punten.map((p, k) => {
      if (k === 0) return 0;
      if (k === punten.length - 1) return L;
      const n = turf.nearestPointOnLine(lijn, turf.point(p), { units: 'meters' }).properties.location;
      vorige = Math.max(vorige, n); return vorige;
    });
    const segmenten = punten.slice(1).map((_, k) => {
      try { const seg = turf.lineSliceAlong(lijn, loc[k], Math.max(loc[k + 1], loc[k] + 0.01), { units: 'meters' }).geometry.coordinates; return seg.length > 1 ? seg : [punten[k], punten[k + 1]]; } catch { return [punten[k], punten[k + 1]]; }
    });
    routeRef.current = { punten: punten.map((p) => [...p]), segmenten, bewerk: id };
    if (it.parameters?.route?.profiel) setRouteProfiel(it.parameters.route.profiel);
    else if (routeProfiel === 'recht') setRouteProfiel('car');
    try { tdRef.current?.deselectFeature(id); } catch {}
    setGeselecteerd(null); setExtra([]);
    setGereedschap('route');
    setTimeout(() => routeTekenRef.current?.(), 0);
  }, [routeProfiel]); // eslint-disable-line react-hooks/exhaustive-deps
  const routeAnnuleer = useCallback(() => {
    const id = routeRef.current.bewerk;
    routeRef.current = { punten: [], segmenten: [] };
    routeTekenRef.current?.();
    setGereedschap('selecteer');
    if (id) setTimeout(() => { setGeselecteerd(id); try { tdRef.current?.selectFeature(id); } catch {} }, 40);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps // eslint-disable-line react-hooks/exhaustive-deps
  // ---------- Tekenhulp: maat aan de cursor, lengte typen, kader-selectie, verlengen, knippen, rechtermuisklik ----------
  const tipRef = useRef(null);
  const getypt = useRef('');
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, lngLat, id }
  const [verleng, setVerleng] = useState(null); // { id, kant: 'begin' | 'einde' | null }
  const [knipId, setKnipId] = useState(null);
  const [evenwijdigOpen, setEvenwijdigOpen] = useState(null); // id
  const [ewVb, setEwVb] = useState(null); // { kant, meter } voorbeeld bij zweven over links/rechts/beide
  const stukStart = useRef(null); const brandStart = useRef(null);
  const [stukStatus, setStukStatus] = useState('');
  const [tekenscherm, setTekenscherm] = useState(null); // { items (sjabloon-formaat), groepId, ids, midden, rot }
  const [ewKies, setEwKies] = useState(null); // { id, meter, kant, a } evenwijdige kopie tussen twee punten
  const [ewStuk, setEwStuk] = useState('heel');
  const verlengRef = useRef(null); verlengRef.current = verleng;
  useSluitBuiten(!!evenwijdigOpen, () => setEvenwijdigOpen(null));
  const knipRef = useRef(null); knipRef.current = knipId;

  const toonTip = useCallback((tekst) => {
    const el = tipRef.current;
    if (!el) return;
    if (!tekst) { el.style.display = 'none'; return; }
    el.textContent = tekst; el.style.display = 'block';
  }, []);

  // Element plaatsen: een voorbeeld op ware grootte onder de muis, met de maat erbij. Dicht bij een
  // ander element of een rechthoek lijnt het voorbeeld zich uit tegen die rand (Alt = vrij plaatsen).
  const plaatsSnapRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    const el = gekozenElement;
    plaatsSnapRef.current = null;
    const perStuk = el?.tekenwijze === 'lijn' && Number(el.eenheid_m) > 0 && lijnStuks;
    const ok = map && kaartKlaar && gereedschap === 'element' && el && (['schaal', 'sjabloon'].includes(el.tekenwijze) || perStuk)
      && !isDeurElement(el) && !el.eigenschappen?.module;
    if (!ok) return undefined;
    const n = el.tekenwijze === 'schaal' && Number(elementAantal) > 1 ? Math.round(Number(elementAantal)) : 1;
    const b = perStuk ? Number(el.eenheid_m) * lijnStuks : (Number(el.breedte_m) || 1) * n;
    const d = perStuk ? Math.max(0.25, Math.min(1, Number(el.diepte_m) || 0.5)) : Number(el.diepte_m) || 1;
    // Losse stuks: aansluiten op het uiteinde van een lijn in de buurt (in het verlengde).
    const eindZoek = (pt) => {
      let best = null;
      for (const it of st.current.items) {
        if (it.geometrie?.type !== 'LineString' || it.verborgen || it.soort !== 'element') continue;
        const c = it.geometrie.coordinates; if (c.length < 2) continue;
        for (const [p, q] of [[c[c.length - 1], c[c.length - 2]], [c[0], c[1]]]) {
          const sp = map.project(p); const dist = Math.hypot(sp.x - pt.x, sp.y - pt.y);
          if (dist <= 16 && (!best || dist < best.dist)) best = { dist, p, br: turf.bearing(q, p) };
        }
      }
      return best;
    };
    const zet = (f) => {
      const data = { type: 'FeatureCollection', features: f };
      if (map.getSource('fm-spook')) map.getSource('fm-spook').setData(data);
      else {
        map.addSource('fm-spook', { type: 'geojson', data });
        map.addLayer({ id: 'fm-spook-v', type: 'fill', source: 'fm-spook', paint: { 'fill-color': ['case', ['get', 'snap'], '#16A34A', '#2563EB'], 'fill-opacity': 0.18 } });
        map.addLayer({ id: 'fm-spook-l', type: 'line', source: 'fm-spook', paint: { 'line-color': ['case', ['get', 'snap'], '#16A34A', '#2563EB'], 'line-width': 1.5, 'line-dasharray': [2, 1.5] } });
      }
    };
    const M = { units: 'meters' };
    // Randen van vlakken in de buurt (elementen, rechthoeken, vlakken), in pixels.
    const randZoek = (pt, px) => {
      let best = null;
      for (const it of st.current.items) {
        const g = it.geometrie;
        const bi = st.current.binnen;
        if (g?.type !== 'Polygon' || it.verborgen || (bi ? it.id !== bi.host && it.velden?.binnen?.host !== bi.host : !!it.velden?.binnen)) continue;
        const r = g.coordinates[0]; if (!r || r.length < 4 || r.length > 400) continue;
        for (let i = 0; i < r.length - 1; i++) {
          const a = map.project(r[i]); const c = map.project(r[i + 1]);
          const dx = c.x - a.x; const dy = c.y - a.y; const L2 = dx * dx + dy * dy; if (L2 < 4) continue;
          const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / L2));
          const fx = a.x + t * dx; const fy = a.y + t * dy; const dist = Math.hypot(pt.x - fx, pt.y - fy);
          if (dist <= px && (!best || dist < best.dist)) best = { dist, a: r[i], c: r[i + 1], t, cursorKant: (dx * (pt.y - a.y) - dy * (pt.x - a.x)) > 0 ? 1 : -1 };
        }
      }
      return best;
    };
    let raf = 0;
    const beweeg = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const p = [e.lngLat.lng, e.lngLat.lat];
        const mpp = geo.meterPerPixel(map.getZoom(), p[1]);
        let midden = p; let rot = Number(st.current.elementRot) || 0; let snap = null;
        if (perStuk) {
          // Beginpunt = muis, of het uiteinde van een lijn in de buurt; richting = R-draaiing of het verlengde.
          const eind = !e.originalEvent?.altKey ? eindZoek(e.point) : null;
          const start = eind ? eind.p : p; const richting = eind ? eind.br : rot + 90;
          const stop = turf.destination(start, b, richting, M).geometry.coordinates;
          plaatsSnapRef.current = { lijn: [start, stop] };
          rot = ((richting - 90) % 360 + 360) % 360;
          midden = turf.midpoint(start, stop).geometry.coordinates;
          zet([{ type: 'Feature', geometry: geo.elementVeelhoek(midden, b, d, rot, null), properties: { snap: !!eind } }]);
          toonTip(`${geo.getal(b)} m${eind ? ' · sluit aan' : ''}`);
          return;
        }
        if (!e.originalEvent?.altKey && el.tekenwijze === 'schaal') {
          // Zoek een rand binnen een halve diepte + 14 px van de muis.
          const rand = randZoek(e.point, d / 2 / mpp + 14);
          if (rand) {
            const br = turf.bearing(rand.a, rand.c);
            // Element-x evenwijdig met de rand; kies de draaiing die het dichtst bij de huidige ligt.
            const opties = [br - 90, br + 90].map((x) => ((x % 360) + 360) % 360);
            const verschil = (x) => Math.abs(((x - rot + 540) % 360) - 180);
            rot = Math.round((verschil(opties[0]) <= verschil(opties[1]) ? opties[0] : opties[1]) * 10) / 10;
            const L = turf.distance(rand.a, rand.c, M);
            let langs = rand.t * L;
            // Uiteinden gelijk leggen als ze dicht bij een hoek van de rand komen (10 px).
            const tol = 10 * mpp;
            if (Math.abs(langs - b / 2) < tol) langs = b / 2; else if (Math.abs(L - langs - b / 2) < tol) langs = L - b / 2;
            const voet = turf.along(turf.lineString([rand.a, rand.c]), Math.max(0, Math.min(L, langs)), M).geometry.coordinates;
            // Loodrecht op de rand, aan de kant van de muis (in kaartcoördinaten: y omhoog).
            const normaal = br + (rand.cursorKant > 0 ? 90 : -90);
            midden = turf.destination(voet, d / 2, normaal, M).geometry.coordinates;
            snap = { midden, rot };
          }
        }
        plaatsSnapRef.current = snap;
        const g = geo.elementVeelhoek(midden, b, d, rot, null);
        zet([{ type: 'Feature', geometry: g, properties: { snap: !!snap } }]);
        toonTip(`${geo.getal(b)} × ${geo.getal(d)} m${snap ? ' · tegen de rand' : ''}`);
      });
    };
    const weg = () => { cancelAnimationFrame(raf); zet([]); toonTip(''); plaatsSnapRef.current = null; };
    map.on('mousemove', beweeg); map.on('mouseout', weg);
    return () => { cancelAnimationFrame(raf); map.off('mousemove', beweeg); map.off('mouseout', weg); try { map.getSource('fm-spook')?.setData({ type: 'FeatureCollection', features: [] }); } catch {} toonTip(''); plaatsSnapRef.current = null; };
  }, [kaartKlaar, gereedschap, gekozenElement, elementAantal, lijnStuks, toonTip]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selecteer een lijst items: eerste als hoofdselectie, de rest erbij.
  const selecteerLijst = useCallback((ids, erbij = false) => {
    const td = tdRef.current;
    const alle = erbij ? [...new Set([...selectieRef.current, ...ids])] : ids;
    if (!alle.length) return;
    const [a, ...r] = alle;
    setGereedschap('selecteer');
    setTimeout(() => {
      try { td?.setMode('select'); td?.selectFeature(a); } catch {}
      setExtra(r); setGeselecteerd(a); // na selectFeature: het select-event zet anders de extra selectie leeg
    }, 30);
  }, []);

  // Lijn knippen in twee stukken op het punt het dichtst bij `p`.
  const knipLijn = useCallback((id, p, { blijf = false } = {}) => {
    const it = st.current.items.find((x) => x.id === id);
    if (!it || it.geometrie?.type !== 'LineString') return;
    const c = it.geometrie.coordinates;
    const np = turf.nearestPointOnLine(turf.lineString(c), turf.point(p), { units: 'meters' });
    const i = np.properties.index; const q = np.geometry.coordinates;
    const deel1 = [...c.slice(0, i + 1), q];
    const deel2 = [q, ...c.slice(i + 1)];
    const lang = (d) => d.length >= 2 && geo.lengte({ type: 'LineString', coordinates: d }) > 0.05;
    if (!lang(deel1) || !lang(deel2)) { setMelding('Knip niet aan het uiteinde: kies een plek op de lijn.'); return; }
    // Bochten verdelen: stukken vóór de knip blijven bij deel 1, die erna schuiven op in deel 2; het geknipte stuk wordt recht.
    const bg = it.parameters?.bogen;
    const par1 = bg ? { ...it.parameters, bogen: Object.fromEntries(Object.entries(bg).filter(([k]) => Number(k) < i)) } : { ...(it.parameters || {}) };
    const par2 = bg ? { ...it.parameters, bogen: Object.fromEntries(Object.entries(bg).filter(([k]) => Number(k) > i).map(([k, h]) => [Number(k) - i, h])) } : { ...(it.parameters || {}) };
    const ko = it.parameters?.koord;
    if (ko?.length) {
      // Koord-vakken: vóór de knip blijven ze, erna schuiven ze op; het geknipte vak blijft koord in beide delen.
      const a = ko.filter((k) => k <= i); const b = ko.filter((k) => k >= i).map((k) => k - i);
      par1.koord = a.length ? a : undefined; par2.koord = b.length ? b : undefined;
    }
    // Deuren en poorten: elk bij het deel waar ze in zitten; die van deel 2 verwijzen naar de nieuwe lijn.
    const kopieId = nieuwId();
    const op = it.parameters?.openingen?.length ? knipOpeningen(it.parameters.openingen, i, c, q) : null;
    if (op) {
      par1.openingen = op.a; par2.openingen = op.b;
      for (const o of op.b || []) { const deur = st.current.items.find((x) => x.id === o.id); if (deur) wijzigItem(deur.id, { parameters: { ...deur.parameters, inLijn: { lijn: kopieId } } }); }
    }
    wijzigItem(id, { geometrie: { type: 'LineString', coordinates: deel1 }, ...(bg || ko?.length || op ? { parameters: par1 } : {}) });
    const { id: _, created_at, updated_at, ...rest } = it;
    const kopie = maakItem({ ...rest, id: kopieId, parameters: par2, geometrie: { type: 'LineString', coordinates: deel2 } });
    tdRef.current?.addFeatures([tdFeature(kopie)]);
    setTimeout(syncTd, 0);
    setMelding(`Lijn geknipt: ${geo.getal(geo.lengte({ type: 'LineString', coordinates: deel1 }))} m en ${geo.getal(geo.lengte({ type: 'LineString', coordinates: deel2 }))} m.`);
    if (!blijf) selecteerLijst([kopie.id]);
  }, [wijzigItem, maakItem, tdFeature, syncTd, selecteerLijst]);

  // Evenwijdige kopie van een lijn op x meter (links, rechts of beide).
  const evenwijdigeKopie = useCallback((id, meter, kant, stuk = null) => {
    const it = st.current.items.find((x) => x.id === id);
    if (!it || it.geometrie?.type !== 'LineString' || !(meter > 0)) return;
    const ids = [];
    for (const k of kant === 'beide' ? [-1, 1] : [kant === 'links' ? -1 : 1]) {
      const g = geo.evenwijdig(stuk || geo.buig(it.geometrie, it.parameters?.bogen), k * meter);
      if (!g) continue;
      const { id: _, created_at, updated_at, ...rest } = it;
      // Hekken met een kant (schuin dranghek, crash barrier): pootjes en steundriehoeken altijd naar buiten,
      // weg van de lijn waarvan je kopieert. Links van de kopie (k = -1) is buiten links, rechts is buiten rechts.
      const el = it.element_id ? elementenMap.get(it.element_id) : null;
      const buiten = k === -1 ? 'links' : 'rechts';
      const velden = el?.tekenwijze === 'lijn' ? {
        ...(rest.velden || {}),
        ...(tekeningZijdig(el) ? { spiegel: buiten === 'rechts' } : {}),
        ...(rest.velden?.toebehoren ? { toebehoren: Object.fromEntries(Object.entries(rest.velden.toebehoren).map(([tk, tv]) => [tk, tv?.kant && tv.kant !== 'beide' ? { ...tv, kant: buiten } : tv])) } : {}),
      } : rest.velden;
      const kopie = maakItem({ ...rest, id: nieuwId(), geometrie: g, groep_id: null, velden, parameters: { ...(rest.parameters || {}), ...(stuk || it.parameters?.bogen ? { bogen: undefined, koord: undefined } : {}), openingen: undefined } }); // de bocht zit al in de punten; deuren blijven in de oorspronkelijke lijn
      tdRef.current?.addFeatures([tdFeature(kopie)]);
      ids.push(kopie.id);
    }
    setTimeout(syncTd, 0);
    setMelding(`${ids.length === 2 ? 'Twee kopieën' : 'Kopie'}${stuk ? ` van ${geo.getal(geo.lengte(stuk))} m` : ''} op ${geo.getal(meter)} m ${kant === 'beide' ? 'aan beide kanten' : kant}.`);
    if (ids.length) selecteerLijst(ids);
  }, [maakItem, tdFeature, syncTd, selecteerLijst, elementenMap]);

  // Voorbeeld van de evenwijdige kopie zolang je over Links, Rechts of Beide kanten zweeft.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return undefined;
    const it = evenwijdigOpen && ewVb ? st.current.items.find((x) => x.id === evenwijdigOpen) : null;
    const f = [];
    if (it?.geometrie?.type === 'LineString' && ewVb.meter > 0) {
      for (const k of ewVb.kant === 'beide' ? [-1, 1] : [ewVb.kant === 'links' ? -1 : 1]) { const g = geo.evenwijdig(geo.buig(it.geometrie, it.parameters?.bogen), k * ewVb.meter); if (g) f.push({ type: 'Feature', geometry: g, properties: {} }); }
      // Pijl in de tekenrichting op het einde van de lijn, zodat links en rechts duidelijk zijn.
      const c = it.geometrie.coordinates;
      if (c.length >= 2) {
        const e = c[c.length - 1]; const r = turf.bearing(c[c.length - 2], e); const L = Math.min(3, Math.max(0.8, geo.lengte(it.geometrie) * 0.04));
        const vleugel = (d) => turf.destination(e, L, r + 180 + d, { units: 'meters' }).geometry.coordinates;
        f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [vleugel(-30), e, vleugel(30)] }, properties: { pijl: true } });
      }
    }
    const data = { type: 'FeatureCollection', features: f };
    if (map.getSource('fm-ew-vb')) map.getSource('fm-ew-vb').setData(data);
    else if (f.length) {
      map.addSource('fm-ew-vb', { type: 'geojson', data });
      map.addLayer({ id: 'fm-ew-vb-wit', type: 'line', source: 'fm-ew-vb', filter: ['!', ['has', 'pijl']], paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.8 } });
      map.addLayer({ id: 'fm-ew-vb', type: 'line', source: 'fm-ew-vb', filter: ['!', ['has', 'pijl']], paint: { 'line-color': '#2563EB', 'line-width': 3, 'line-dasharray': [2, 1.2] } });
      map.addLayer({ id: 'fm-ew-vb-pijl', type: 'line', source: 'fm-ew-vb', filter: ['has', 'pijl'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2563EB', 'line-width': 3 } });
    }
    return undefined;
  }, [ewVb, evenwijdigOpen, kaartKlaar, items]);
  useEffect(() => { if (!evenwijdigOpen) setEwVb(null); }, [evenwijdigOpen]);

  // Evenwijdige kopie tussen twee punten: begin en einde op de lijn aanklikken.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar || !ewKies) return undefined;
    if (gereedschap !== 'evenwijdig') { setEwKies(null); return undefined; }
    const it = st.current.items.find((x) => x.id === ewKies.id);
    if (!it || it.geometrie?.type !== 'LineString') { setEwKies(null); return undefined; }
    const lijn = turf.lineString(geo.buig(it.geometrie, it.parameters?.bogen).coordinates);
    const M = { units: 'meters' };
    zetCursor(map, 'penseel', 'crosshair');
    const op = (e) => {
      const q = turf.nearestPointOnLine(lijn, [e.lngLat.lng, e.lngLat.lat], M);
      const pq = map.project(q.geometry.coordinates);
      return Math.hypot(pq.x - e.point.x, pq.y - e.point.y) <= 24 ? q : null;
    };
    const stukVan = (a, b) => { const [x, y] = a < b ? [a, b] : [b, a]; try { return turf.lineSliceAlong(lijn, x, Math.max(y, x + 0.05), M).geometry; } catch { return null; } };
    const toon = (q) => {
      const f = [];
      if (ewKies.a != null) f.push({ type: 'Feature', geometry: turf.along(lijn, ewKies.a, M).geometry, properties: { r: 0 } });
      if (q) {
        f.push({ type: 'Feature', geometry: q.geometry, properties: { r: 0 } });
        if (ewKies.a != null) {
          const g = stukVan(ewKies.a, q.properties.location);
          if (g) {
            f.push({ type: 'Feature', geometry: g, properties: { r: 1 } });
            for (const k of ewKies.kant === 'beide' ? [-1, 1] : [ewKies.kant === 'links' ? -1 : 1]) { const g2 = geo.evenwijdig(g, k * ewKies.meter); if (g2) f.push({ type: 'Feature', geometry: g2, properties: { r: 2 } }); }
          }
        }
      }
      const data = { type: 'FeatureCollection', features: f };
      if (map.getSource('fm-ew')) map.getSource('fm-ew').setData(data);
      else {
        map.addSource('fm-ew', { type: 'geojson', data });
        map.addLayer({ id: 'fm-ew-l', type: 'line', source: 'fm-ew', filter: ['==', ['get', 'r'], 1], paint: { 'line-color': '#F59E0B', 'line-width': 7, 'line-opacity': 0.7 } });
        map.addLayer({ id: 'fm-ew-k', type: 'line', source: 'fm-ew', filter: ['==', ['get', 'r'], 2], paint: { 'line-color': '#1d1d1b', 'line-width': 2, 'line-dasharray': [2, 1.5] } });
        map.addLayer({ id: 'fm-ew-p', type: 'circle', source: 'fm-ew', filter: ['==', ['get', 'r'], 0], paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#B45309', 'circle-stroke-width': 2 } });
      }
    };
    toon(null);
    const beweeg = (e) => toon(op(e));
    const klik = (e) => {
      const q = op(e); if (!q) { setMelding('Klik op de lijn zelf.'); return; }
      const loc = q.properties.location;
      if (ewKies.a == null) { setEwKies({ ...ewKies, a: loc }); return; }
      const g = stukVan(ewKies.a, loc);
      const { id, meter, kant } = ewKies;
      setEwKies(null); setGereedschap('selecteer');
      if (g) evenwijdigeKopie(id, meter, kant, g);
    };
    map.on('mousemove', beweeg); map.on('click', klik);
    return () => { map.off('mousemove', beweeg); map.off('click', klik); zetCursor(map, 'penseel', ''); try { map.getSource('fm-ew')?.setData({ type: 'FeatureCollection', features: [] }); } catch {} };
  }, [ewKies, gereedschap, kaartKlaar, evenwijdigeKopie]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => tekenhulp(() => ({ bewerkbaarRef, getypt, kaartKlaar, knipLijn, knipRef, mapRef, muisPosRef, selecteerLijst, selectieRef, setCtxMenu, setGereedschap, setKnipId, setMelding, setVerleng, st, syncTd, tdRef, tipRef, toonTip, verlengRef, wijzigItem })), [kaartKlaar, wijzigItem, syncTd, knipLijn, selecteerLijst, toonTip]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gereedschap gewisseld: hulp opruimen.
  useEffect(() => {
    const map = mapRef.current;
    if (!['punt', 'lijn'].includes(gereedschap)) voorinstelRef.current = null;
    if (gereedschap !== 'kabel') kabelVanRef.current = null;
    if (gereedschap !== 'verleng' && verleng) setVerleng(null);
    if (gereedschap !== 'knip' && knipId) setKnipId(null);
    if (!['verleng', 'knip'].includes(gereedschap)) map?.getSource('fm-hulp')?.setData({ type: 'FeatureCollection', features: [] });
    getypt.current = '';
    toonTip('');
    if (map) { if (gereedschap === 'verleng') map.doubleClickZoom.disable(); else if (gereedschap !== 'route') map.doubleClickZoom.enable(); }
  }, [gereedschap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ander gereedschap gekozen: onafgewerkte route weg.
  useEffect(() => {
    if (gereedschap !== 'route' && routeRef.current.punten.length) {
      routeRef.current = { punten: [], segmenten: [] };
      const m = mapRef.current; m?.getSource('fm-route')?.setData({ type: 'FeatureCollection', features: [] });
      setRouteInfo(null);
    }
    const m = mapRef.current;
    if (m) { if (gereedschap === 'route') m.doubleClickZoom.disable(); else m.doubleClickZoom.enable(); }
  }, [gereedschap]);

  // ---------- Tussenpunten wissen: dubbelklik op een punt, of de knop 'Punten wissen' ----------
  const [puntWissen, setPuntWissen] = useState(false);
  const puntWissenRef = useRef(false); puntWissenRef.current = puntWissen;
  useEffect(() => { if (!geselecteerd) setPuntWissen(false); }, [geselecteerd]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    const vrij = (it) => it && it.geometrie && (it.geometrie.type === 'LineString' || (it.geometrie.type === 'Polygon' && !(it.parameters?.breedte && it.parameters?.diepte) && !['cirkel', 'ellips', 'veelhoek', 'sector'].includes(it.soort)));
    const wis = (e) => {
      const s0 = st.current;
      if (!s0.schrijven || s0.gereedschap !== 'selecteer') return false;
      const it = s0.items.find((x) => x.id === s0.geselecteerd);
      if (!vrij(it) || vastItem(it)) return false;
      const g = it.geometrie;
      const ring = g.type === 'LineString' ? g.coordinates : g.coordinates[0].slice(0, -1);
      let best = -1; let bd = 12;
      ring.forEach((c, i) => { const q = map.project(c); const d = Math.hypot(q.x - e.point.x, q.y - e.point.y); if (d < bd) { bd = d; best = i; } });
      if (best < 0) return false;
      const min = g.type === 'LineString' ? 2 : 3;
      if (ring.length <= min) { setMelding(`Een ${g.type === 'LineString' ? 'lijn' : 'vlak'} heeft minstens ${min} punten nodig.`); return true; }
      const rest = ring.filter((_, i) => i !== best);
      const nieuw = g.type === 'LineString' ? { type: 'LineString', coordinates: rest } : { type: 'Polygon', coordinates: [[...rest, rest[0]]] };
      zetGeometrie(it.id, nieuw, {});
      setMelding(`Punt gewist (${ring.length - 1} over). Ctrl Z of het pijltje bovenaan zet het terug.`);
      return true;
    };
    const dubbel = (e) => { if (wis(e)) e.preventDefault(); };
    const klik = (e) => { if (puntWissenRef.current) wis(e); };
    map.on('dblclick', dubbel);
    map.on('click', klik);
    return () => { map.off('dblclick', dubbel); map.off('click', klik); };
  }, [kaartKlaar]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Metingen: hulplaag met afstand of oppervlakte ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    const f = [];
    for (const m of metingen) {
      const g = m.geometrie;
      f.push({ type: 'Feature', geometry: g, properties: { id: m.id } });
      const tekst = g.type === 'Polygon'
        ? `${geo.getal(geo.oppervlakte(g), 0)} m²\nomtrek ${geo.getal(geo.lengte(g))} m`
        : `${geo.getal(geo.lengte(g))} m`;
      const plek = g.type === 'Polygon' ? geo.middelpunt(g) : g.coordinates[g.coordinates.length - 1];
      f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: plek }, properties: { id: m.id, tekst } });
      // Tussenlengtes per stuk
      const c = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates;
      if (c.length > 2 + (g.type === 'Polygon' ? 1 : 0)) {
        for (let i = 0; i < c.length - 1; i++) {
          const l = geo.lengte({ type: 'LineString', coordinates: [c[i], c[i + 1]] });
          f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [(c[i][0] + c[i + 1][0]) / 2, (c[i][1] + c[i + 1][1]) / 2] }, properties: { id: m.id, stuk: `${geo.getal(l)} m` } });
        }
      }
    }
    const data = { type: 'FeatureCollection', features: f };
    if (map.getSource('fm-metingen')) map.getSource('fm-metingen').setData(data);
    else {
      map.addSource('fm-metingen', { type: 'geojson', data });
      map.addLayer({ id: 'fm-meting-vlak', type: 'fill', source: 'fm-metingen', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.15 } });
      map.addLayer({ id: 'fm-meting-lijn', type: 'line', source: 'fm-metingen', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': '#B45309', 'line-width': 2, 'line-dasharray': [3, 2] } });
      map.addLayer({ id: 'fm-meting-stuk', type: 'symbol', source: 'fm-metingen', filter: ['has', 'stuk'], layout: { 'text-field': ['get', 'stuk'], 'text-size': 10.5, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true }, paint: { 'text-color': '#7C2D12', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });
      map.addLayer({ id: 'fm-meting-tekst', type: 'symbol', source: 'fm-metingen', filter: ['has', 'tekst'], layout: { 'text-field': ['get', 'tekst'], 'text-size': 12.5, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true, 'text-offset': [0, -1] }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#B45309', 'text-halo-width': 3 } });
    }
  }, [metingen, kaartKlaar]);

  // Aantal fouten uit Controle als teller op de knop (met vertraging: niet bij elke muisbeweging).
  useEffect(() => {
    if (!plan) return undefined;
    // Pas als de browser even niets te doen heeft (requestIdleCallback), zodat de controle nooit tussen twee
    // muisbewegingen van een sleep valt.
    let idle = 0;
    const t = setTimeout(() => {
      const werk = () => {
        try {
          const m = controleer({ plan, lagen, items, elementenMap, fasen, vast });
          setControleFouten(m.filter((x) => x.soort === 'fout' && !x.goedgekeurd).length);
          setBrandFouten(m.filter((x) => x.soort === 'fout' && !x.goedgekeurd && x.groep === 'Brandveiligheid').length);
        } catch {}
      };
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(werk, { timeout: 3000 }); else werk();
    }, 1200);
    return () => { clearTimeout(t); if (idle && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle); };
  }, [plan, lagen, items, elementenMap, fasen, vast]);

  // ---------- Sleepvoorbeeld: tijdens het slepen enkel de versleepte items opnieuw tekenen ----------
  // De volledige kaartbron blijft staan (de originelen worden even weggefilterd); pas bij het
  // loslaten wordt alles één keer herrekend. Zo blijft slepen vlot, ook in grote plannen.
  const voorbeeldRef = useRef(null);
  voorbeeldRef.current = (lijst) => {
    const map = mapRef.current;
    if (!map || !map.getSource('fm-vormen')) return;
    const leeg = { type: 'FeatureCollection', features: [] };
    if (!lijst) {
      if (map._fmSleepFilters) {
        for (const [id, f] of map._fmSleepFilters) { if (map.getLayer(id)) map.setFilter(id, f || null); }
        map._fmSleepFilters = null;
      }
      if (map._fmSleepWeg) { map._fmSleepWeg = false; bronHerstel(map, 'fm-vormen'); bronHerstel(map, 'fm-labels'); }
      map.getSource('fm-sleep-v')?.setData(leeg); map.getSource('fm-sleep-l')?.setData(leeg);
      map._fmSleepCache = null; map._fmSleepNu = null; if (map._fmSleepRaf) { cancelAnimationFrame(map._fmSleepRaf); map._fmSleepRaf = 0; }
      return;
    }
    zorgVoorSleepLagen(map);
    // De originelen even uit de kaartbron (enkel hun tegels worden herbouwd). Lukt dat niet, dan wegfilteren
    // per laag (duurder: elke laag laadt dan al zijn tegels opnieuw).
    if (!map._fmSleepFilters && !map._fmSleepWeg) {
      const ids = lijst.map((x) => x.id);
      if (bronVerberg(map, 'fm-vormen', ids) && bronVerberg(map, 'fm-labels', ids)) map._fmSleepWeg = true;
    }
    if (!map._fmSleepFilters && !map._fmSleepWeg) {
      const ids = lijst.map((x) => x.id);
      const verberg = ['!', ['in', ['get', 'id'], ['literal', ids]]];
      map._fmSleepFilters = [];
      for (const l of map.getStyle().layers) {
        if ((l.source !== 'fm-vormen' && l.source !== 'fm-labels') || l.id.endsWith('-sleep')) continue;
        const f = map.getFilter(l.id);
        map._fmSleepFilters.push([l.id, f]);
        map.setFilter(l.id, f ? ['all', f, verberg] : verberg);
      }
    }
    // Zware items (tent met wanden, vloerstukken, stellingen): de tekening één keer maken en bij gewoon verschuiven
    // enkel verplaatsen; opnieuw tekenen alleen bij draaien of schalen. En hoogstens één keer per beeld.
    map._fmSleepNu = lijst;
    if (map._fmSleepRaf) return;
    map._fmSleepRaf = requestAnimationFrame(() => {
      map._fmSleepRaf = 0; const l2 = map._fmSleepNu; if (!l2 || !map.getSource('fm-sleep-v')) return;
      const eerste = (g) => (g?.type === 'Point' ? g.coordinates : g?.type === 'LineString' ? g.coordinates[0] : g?.type === 'Polygon' ? g.coordinates[0][0] : null);
      const laatste = (g) => (g?.type === 'LineString' ? g.coordinates[g.coordinates.length - 1] : g?.type === 'Polygon' ? g.coordinates[0][Math.floor(g.coordinates[0].length / 2)] : null);
      const ring = (g) => (g?.type === 'LineString' ? g.coordinates : g?.type === 'Polygon' ? g.coordinates[0] : null);
      const alleVerschoven = (g0, g1, dx, dy) => {
        const r0 = ring(g0); const r1 = ring(g1); if (!r0 || !r1) return true;
        if (r0.length !== r1.length) return false;
        for (let i = 0; i < r0.length; i++) if (Math.abs(r1[i][0] - r0[i][0] - dx) > 1e-9 || Math.abs(r1[i][1] - r0[i][1] - dy) > 1e-9) return false;
        return true;
      };
      const sleutelL = l2.map((x) => x.id).join(',');
      let c = map._fmSleepCache;
      let d = null;
      if (c && c.sleutel === sleutelL) {
        const a0 = eerste(c.basis[0].geometrie); const b0 = eerste(l2[0].geometrie);
        if (a0 && b0) {
          const dx = b0[0] - a0[0]; const dy = b0[1] - a0[1];
          // Ook het laatste punt moet even ver verschoven zijn: anders is het item gedraaid (een lijn heeft geen rot).
          const ok = l2.every((x, k) => { const p0 = eerste(c.basis[k].geometrie); const p1 = eerste(x.geometrie); const q0 = laatste(c.basis[k].geometrie); const q1 = laatste(x.geometrie); return p0 && p1 && Math.abs(p1[0] - p0[0] - dx) < 1e-9 && Math.abs(p1[1] - p0[1] - dy) < 1e-9
            && (!q0 || !q1 || (Math.abs(q1[0] - q0[0] - dx) < 1e-9 && Math.abs(q1[1] - q0[1] - dy) < 1e-9))
            // Een punt midden in een lijn of vlak verslepen laat begin en einde staan: elk punt moet even ver verschoven zijn.
            && alleVerschoven(c.basis[k].geometrie, x.geometrie, dx, dy)
            && (Number(x.parameters?.rot) || 0) === (Number(c.basis[k].parameters?.rot) || 0) && x.parameters?.breedte === c.basis[k].parameters?.breedte && x.parameters?.diepte === c.basis[k].parameters?.diepte
            // Een bocht verslepen verandert enkel de bogen, niet de punten: dan opnieuw tekenen.
            && JSON.stringify(x.parameters?.bogen || null) === JSON.stringify(c.basis[k].parameters?.bogen || null); });
          if (ok) d = [dx, dy];
        }
      }
      if (!d) {
        const s = st.current;
        const { vormen, labels } = naarGeojson(l2, lagenMap, elementenMap, { verborgenLagen, actieveFase: s.actieveFase, verbergElementen: s.plan?.instellingen?.verborgen_elementen, hulplijnen: true });
        zorgVoorPatronen(map, vormen.features, labels.features);
        c = map._fmSleepCache = { sleutel: sleutelL, basis: l2, vormen, labels }; d = [0, 0];
      }
      const sp = (q) => [q[0] + d[0], q[1] + d[1]];
      const sg = (g) => (g.type === 'Point' ? { ...g, coordinates: sp(g.coordinates) } : g.type === 'LineString' || g.type === 'MultiPoint' ? { ...g, coordinates: g.coordinates.map(sp) } : g.type === 'Polygon' || g.type === 'MultiLineString' ? { ...g, coordinates: g.coordinates.map((r) => r.map(sp)) } : g.type === 'MultiPolygon' ? { ...g, coordinates: g.coordinates.map((pl) => pl.map((r) => r.map(sp))) } : g);
      const schuif = (fc) => (d[0] === 0 && d[1] === 0 ? fc : { type: 'FeatureCollection', features: fc.features.map((f) => (f.geometry ? { ...f, geometry: sg(f.geometry) } : f)) });
      map.getSource('fm-sleep-v').setData(schuif(c.vormen));
      map.getSource('fm-sleep-l').setData(schuif(c.labels));
    });
  };

  // ---------- Zweefkaartje: essentiële info bij hoveren (bewerkmodus) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    let raf = 0;
    const LAGEN = ['fm-sign', 'fm-punt', 'fm-tekst', 'fm-lijn-vol', 'fm-lijn-streep', 'fm-lijn-stip', 'fm-lijn-streeppunt', 'fm-stuk-vulling', 'fm-stuk-lijn-vol', 'fm-vulling', 'fm-patroon', 'fm-vloer', 'fm-vloer-lijn'];
    const beweeg = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const s = st.current;
        if (!s.schrijven || s.gereedschap !== 'selecteer' || s.brandPenseel || e.originalEvent?.buttons) { setZweef(null); licht(null); return; }
        // Zelfde regel als selecteren (hit.js): wat oplicht, is wat je met een klik selecteert.
        const id = hitOp(map, e.point, s.items)?.id;
        if (!id || id === s.geselecteerd) { setZweef(null); licht(null); zetCursor(map, 'licht', id ? 'move' : ''); return; }
        zetCursor(map, 'licht', 'pointer');
        setZweef((z) => (z?.id === id ? z : { id, x: e.point.x, y: e.point.y }));
        licht(id);
      });
    };
    // Oplichten van het item onder de muis, zodat je ziet wat je gaat selecteren.
    let vorigLicht = null;
    const licht = (id) => {
      if (id === vorigLicht) return;
      vorigLicht = id;
      const it = id ? st.current.items.find((x) => x.id === id) : null;
      // Zoals het getekend is: met de bochten, niet de rechte tussen de punten.
      const gl = it?.geometrie ? geo.buig(it.geometrie, it.parameters?.bogen) : null;
      const data = { type: 'FeatureCollection', features: gl ? [{ type: 'Feature', geometry: gl.type === 'Polygon' ? { type: 'LineString', coordinates: gl.coordinates[0] } : gl, properties: {} }] : [] };
      if (map.getSource('fm-licht')) map.getSource('fm-licht').setData(data);
      else {
        map.addSource('fm-licht', { type: 'geojson', data });
        map.addLayer({ id: 'fm-licht-l', type: 'line', source: 'fm-licht', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#2563EB', 'line-width': 2, 'line-opacity': 0.9, 'line-gap-width': 3 } });
        map.addLayer({ id: 'fm-licht-p', type: 'circle', source: 'fm-licht', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 15, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#2563EB', 'circle-stroke-width': 2 } });
      }
    };
    const weg = () => { cancelAnimationFrame(raf); setZweef(null); licht(null); };
    map.on('mousemove', beweeg); map.on('mouseout', weg); map.on('movestart', weg);
    return () => { cancelAnimationFrame(raf); map.off('mousemove', beweeg); map.off('mouseout', weg); map.off('movestart', weg); };
  }, [kaartKlaar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stroomberekening voor de kerncijfers, het detailpaneel en de vaste aansluitingen.
  const stroomRes = useMemo(() => { try { return berekenStroom(items, elementenMap, { gelijktijdigheid: plan?.instellingen?.stroom?.gelijktijdigheid ?? 0.8, fasen, vast }); } catch { return null; } }, [items, elementenMap, plan?.instellingen?.stroom?.gelijktijdigheid, fasen, vast]);
  const stroomRef = useRef(null); stroomRef.current = stroomRes;

  // ---------- Werkruimte: relevante items, kerncijfers ----------
  const itemsMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const wrFocus = useMemo(() => (werkruimte === 'plan' ? null : relevanteItems(werkruimte, { plan, items, lagenMap, elementenMap, modus: signModus })), [werkruimte, plan, items, lagenMap, elementenMap, signModus]);
  const veiligRes = useMemo(() => (werkruimte === 'veiligheid' && plan ? (() => { try { return tentChecklist({ plan, items, elementenMap, opDeGrond, afstand: afstandTussen }); } catch { return null; } })() : null), [werkruimte, plan, items, elementenMap]);
  const brandingRes = useMemo(() => (werkruimte === 'branding' ? brandingTelling(items, elementenMap) : null), [werkruimte, items, elementenMap]);
  const tvRes = useMemo(() => (werkruimte === 'tv' ? tvTelling(items, elementenMap, geo.lengte) : null), [werkruimte, items, elementenMap]);
  const verkeerRes = useMemo(() => {
    if (werkruimte !== 'sign' || signModus !== 'verkeer' || !plan) return null;
    const l = verkeerStuklijst(items, instVerkeer(plan));
    return { ...l, controleren: items.filter((i) => isVerkeerBord(i) && i.velden.verkeer.auto?.controleren).length };
  }, [werkruimte, signModus, plan, items]);
  const signRes = useMemo(() => {
    if (werkruimte !== 'sign' || !plan) return null;
    const punten = signPunten(items);
    const l = bestellijst(items, instSign(plan).bestemmingen, instSign(plan).reserve, instSign(plan).bord);
    return { punten: punten.length, panelen: l.panelen.reduce((t, x) => t + x.stuks, 0), controleren: punten.filter((p) => p.velden.sign.auto?.controleren).length, lijst: l };
  }, [werkruimte, plan, items]);
  const gedimd = wrFocus && !toonAlles ? items.filter((i) => !i.verborgen && !wrFocus.has(i.id)).length : 0;
  const levStd = plan?.instellingen?.leveranciers || null;
  const hkFocus = useMemo(() => (focusLijst ? focusLijst.ids : herkomstFilter ? new Set(items.filter((i) => i.element_id && herkomstVan(i, elementenMap.get(i.element_id), levStd) === herkomstFilter).map((i) => i.id)) : null), [focusLijst, herkomstFilter, items, elementenMap, levStd]);

  // ---------- Kaart tekenen ----------
  // De selectie telt enkel mee voor de kaart als een focus (werkruimte, hekken) ze gebruikt: anders
  // hoeft een klik de hele kaartbron niet opnieuw op te bouwen.
  const selFocusSleutel = hkFocus || (wrFocus && !toonAlles) ? [geselecteerd, ...extra].join('|') : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    // Binnenplan: enkel de inrichting van dat gebouw en die verdieping, met het gebouw zelf gedimd eronder.
    // Elders staat de inrichting van binnenplannen niet op de kaart.
    const basisItems = binnen ? items.filter((i) => i.id === binnen.host || inBinnen(i, binnen)) : items.filter((i) => !i.velden?.binnen);
    const zichtbaar = [...(binnen ? [] : plekItems.map((x) => ({ ...x, stijl: { kleur: '#686D76', streep: 'streep', vuldekking: 0.08, ...(x.stijl || {}) } }))), ...basisItems.filter((i) => !isSign(i) && !isVerkeerBord(i))];
    // Focus: geïsoleerde groep, of de items van de werkruimte (de rest gedimd, blijft selecteerbaar).
    let focus = iso ? new Set(items.filter((x) => x.groep_id === iso).map((x) => x.id)) : binnen ? new Set(basisItems.filter((x) => x.id !== binnen.host).map((x) => x.id)) : null;
    if (!focus && hkFocus) focus = new Set([...hkFocus, geselecteerd, ...extra].filter(Boolean));
    if (!focus && wrFocus && !toonAlles) focus = new Set([...wrFocus, geselecteerd, ...extra].filter(Boolean));
    const { vormen, labels } = naarGeojson(zichtbaar, lagenMap, elementenMap, { verborgenLagen, actieveFase, verbergElementen: plan?.instellingen?.verborgen_elementen, verdieping: verdFilter, focus, hulplijnen: true });
    // Hulplijnen: tekenen klikt eraan vast.
    if (mapRef.current) mapRef.current._fmHulplijnen = zichtbaar.flatMap((it) => (it.parameters?.hulplijnen?.length ? hulplijnenVan(it).map((h) => h.geometrie) : []));
    // Kabels in de kleur van de stekker (blauw 230 V, rood 400 V) in de werkruimte Stroom.
    if (werkruimte === 'stroom' && stroomRes) {
      vormen.features = vormen.features.map((f) => {
        const it = f.properties?.id ? itemsMap.get(f.properties.id) : null;
        if (it?.velden?.stroom?.rol !== 'kabel') return f;
        const naar = it.velden.stroom.naar ? stroomRes.knopen.get(it.velden.stroom.naar) : null;
        return { ...f, properties: { ...f.properties, kleur: KABEL_KLEUR[kabelSpanning(it.velden.stroom.kabeltype, naar)], dikte: Math.max(f.properties.dikte || 1, 3) } };
      });
    }
    zorgVoorPatronen(map, vormen.features, labels.features);
    // Enkel wat veranderde naar de kaart sturen: de features per item komen uit een cache (stijl.js), dus
    // een verplaatst hek is een paar features weg en erbij, niet het hele plan opnieuw indexeren.
    bronBijwerken(map, 'fm-vormen', vormen);
    bronBijwerken(map, 'fm-labels', labels);
  }, [items, lagenMap, elementenMap, verborgenLagen, actieveFase, selFocusSleutel, kaartKlaar, schrijven, plekItems, plan?.instellingen?.verborgen_elementen, verdFilter, iso, binnen, wrFocus, hkFocus, toonAlles, werkruimte, stroomRes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (kaartKlaar) syncTd(); }, [lagen, actieveFase, kaartKlaar, syncTd, plan?.instellingen?.verborgen_elementen, iso]);
  // Na een (de)selectie: wat niet meer geselecteerd is, mag uit Terra Draw (even wachten tot de selectie rond is).
  useEffect(() => { if (!kaartKlaar) return undefined; const t = setTimeout(() => syncTdRef.current?.(), 150); return () => clearTimeout(t); }, [geselecteerd, extra, kaartKlaar]);
  // Geïsoleerd bewerken: enkel items van de groep zijn selecteerbaar.
  useEffect(() => {
    if (!iso) return;
    const it = items.find((x) => x.id === geselecteerd);
    if (it && it.groep_id !== iso) { try { tdRef.current?.deselectFeature(it.id); } catch {} setGeselecteerd(null); }
    setExtra((x) => x.filter((id) => items.find((y) => y.id === id)?.groep_id === iso));
  }, [iso, geselecteerd]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (iso && !items.some((x) => x.groep_id === iso)) setIso(null); }, [iso, items]);

  // ---------- Binnenplan: inrichting van een gebouw, tent of container, per verdieping ----------
  const binnenVorig = useRef(null);
  const sluitBinnenRef = useRef(null);
  const verdiepingenVan = (host) => host?.velden?.binnenplan?.verdiepingen?.length ? host.velden.binnenplan.verdiepingen : [{ id: 'g', naam: 'Gelijkvloers' }];
  // Grondplan verschoven/gedraaid/verschaald: alles wat in het binnenplan staat gaat mee (uit de lokale vorm).
  const herprojecteerBinnen = useCallback((oud, nieuw) => {
    if (!oud?.binnen?.host) return;
    const T = planTransform(nieuw, null);
    // PDF of foto zonder vaste schaal: lokale maten schalen mee met de nieuwe breedte.
    const f = !nieuw.natuur && Number(oud.breedte) > 0 && Number(nieuw.breedte) > 0 ? Number(nieuw.breedte) / Number(oud.breedte) : 1;
    const sc = (c) => [c[0] * f, c[1] * f];
    const mapG = (g, fn) => (g.type === 'Point' ? { type: 'Point', coordinates: fn(g.coordinates) } : g.type === 'LineString' ? { type: 'LineString', coordinates: g.coordinates.map(fn) } : { type: 'Polygon', coordinates: g.coordinates.map((r) => r.map(fn)) });
    for (const it of st.current.items) {
      const bi = it.velden?.binnen; const l = bi?.lokaal;
      if (bi?.host !== oud.binnen.host || (bi.verd || null) !== (oud.binnen.verd || null) && !(bi.verd === 'g' && !oud.binnen.verd) || !l?.geometrie) continue;
      const lok = { geometrie: mapG(l.geometrie, sc), midden: l.midden ? sc(l.midden) : null, rot: l.rot };
      const par = { ...(it.parameters || {}) };
      if (lok.midden) par.midden = T.naarGeo(lok.midden);
      if (lok.rot != null) par.rot = ((((lok.rot + T.rot) % 360) + 360) % 360);
      wijzigItem(it.id, { geometrie: mapG(lok.geometrie, T.naarGeo), parameters: par, velden: { ...it.velden, binnen: { ...bi, lokaal: lok } } });
    }
  }, [wijzigItem]);
  // Binnenplan openen in een eigen scherm.
  useEffect(() => { if (!plan?.event_id) { setPlanEvent(null); return; } maps().from('events').select('naam, kleur').eq('id', plan.event_id).maybeSingle().then(({ data }) => setPlanEvent(data || null)); }, [plan?.event_id]);
  const openBinnenScherm = useCallback((hostId, verd = null) => {
    if (!heeftModule('binnen')) { setMelding(nietInPakket('binnen')); return; }
    const host = st.current.items.find((x) => x.id === hostId);
    if (!host?.geometrie) return;
    const vs = verdiepingenVan(host);
    if (!host.velden?.binnenplan && st.current.schrijven) wijzigItem(host.id, { velden: { ...(host.velden || {}), binnenplan: { verdiepingen: vs } } });
    for (const id of [st.current.geselecteerd, ...(st.current.extra || [])]) if (id) { try { tdRef.current?.deselectFeature(id); } catch {} }
    setGeselecteerd(null); setExtra([]); setGereedschap('selecteer');
    setBinnenScherm({ host: host.id, verd: verd || vs[0].id });
  }, [wijzigItem]);
  const openBinnenRef = useRef(null);
  const openBinnen = useCallback((hostId, verd = null) => {
    if (!heeftModule('binnen')) { setMelding(nietInPakket('binnen')); return; }
    const host = st.current.items.find((x) => x.id === hostId);
    if (!host?.geometrie) return;
    const vs = verdiepingenVan(host);
    if (!host.velden?.binnenplan && st.current.schrijven) wijzigItem(host.id, { velden: { ...(host.velden || {}), binnenplan: { verdiepingen: vs } } });
    const map = mapRef.current;
    if (map && !binnenVorig.current) binnenVorig.current = { c: map.getCenter(), z: map.getZoom(), b: map.getBearing() };
    for (const id of [st.current.geselecteerd, ...(st.current.extra || [])]) if (id) { try { tdRef.current?.deselectFeature(id); } catch {} }
    setGeselecteerd(null); setExtra([]); setIso(null); setGereedschap('selecteer');
    setBinnen({ host: host.id, verd: verd || vs[0].id });
    // Passend op het gebouw en alles wat erin staat (bij een icoon: op de inhoud van het binnenplan).
    const inhoud = st.current.items.filter((x) => x.velden?.binnen?.host === host.id && x.geometrie).map((x) => x.geometrie);
    const k = geo.kader([host.geometrie, ...inhoud]);
    if (map && host.geometrie.type === 'Point' && !inhoud.length) map.easeTo({ center: host.geometrie.coordinates, zoom: Math.max(map.getZoom(), 19.5), duration: 500 });
    else if (map && k) map.fitBounds([[k[0], k[1]], [k[2], k[3]]], { padding: 90, bearing: -(Number(host.parameters?.rot) || 0) % 360, duration: 500, maxZoom: 23 });
    setTimeout(() => syncTdRef.current?.(), 30);
  }, [wijzigItem]);
  const sluitBinnen = useCallback(() => {
    for (const id of [st.current.geselecteerd, ...(st.current.extra || [])]) if (id) { try { tdRef.current?.deselectFeature(id); } catch {} }
    setGeselecteerd(null); setExtra([]); setGereedschap('selecteer');
    const host = st.current.binnen?.host;
    setBinnen(null);
    const map = mapRef.current; const v = binnenVorig.current; binnenVorig.current = null;
    setOvergang('uit'); setTimeout(() => setOvergang(''), 520);
    if (map && v) map.easeTo({ center: v.c, zoom: v.z, bearing: v.b, duration: 450 });
    // Het gebouw blijft gekozen, ook in Terra Draw (anders viel de selectie meteen weer weg).
    setTimeout(() => { syncTdRef.current?.(); if (host && st.current.items.some((x) => x.id === host)) { setGeselecteerd(host); setExtra([]); setTimeout(() => { try { tdRef.current?.selectFeature(host); } catch {} }, 60); } }, 30);
  }, []);
  sluitBinnenRef.current = sluitBinnen;
  // Op de kaart: een duidelijk plattegrond-label bij elk gebouw, elke tent of container met een binnenplan.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return undefined;
    const tel = new Map();
    for (const x of items) if (x.velden?.binnen?.host) tel.set(x.velden.binnen.host, (tel.get(x.velden.binnen.host) || 0) + 1);
    const f = binnen ? [] : items.filter((x) => (x.geometrie?.type === 'Polygon' || x.geometrie?.type === 'Point') && !x.verborgen && !x.velden?.binnen && (x.velden?.binnenplan || tel.has(x.id))).map((x) => {
      const k = geo.kader([x.geometrie]);
      return { type: 'Feature', geometry: { type: 'Point', coordinates: x.parameters?.midden || [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2] }, properties: { host: x.id, t: `▦ ${x.naam || elementenMap.get(x.element_id)?.naam || 'Binnenplan'}` } };
    });
    const data = { type: 'FeatureCollection', features: f };
    if (map.getSource('fm-binnen')) map.getSource('fm-binnen').setData(data);
    else {
      map.addSource('fm-binnen', { type: 'geojson', data });
      // Onzichtbare cirkel op het gebouw/icoon zelf: daar zweven toont de voorvertoning; naar binnen via het label.
      map.addLayer({ id: 'fm-binnen-hit', type: 'circle', source: 'fm-binnen', minzoom: 15.5, paint: { 'circle-radius': 18, 'circle-opacity': 0, 'circle-stroke-opacity': 0 } });
      map.addLayer({ id: 'fm-binnen', type: 'symbol', source: 'fm-binnen', minzoom: 15.5, layout: { 'text-field': ['get', 't'], 'text-size': 12, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true, 'text-offset': [0, 1.4] }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#1d1d1b', 'text-halo-width': 2.5, 'text-halo-blur': 0.5 } });
    }
    return undefined;
  }, [items, binnen, kaartKlaar, elementenMap]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return undefined;
    const LG = ['fm-binnen', 'fm-binnen-hit'];
    const raak = (pt) => { const lg = LG.filter((l) => map.getLayer(l)); return lg.length ? map.queryRenderedFeatures([[pt.x - 6, pt.y - 6], [pt.x + 6, pt.y + 6]], { layers: lg })[0] : null; };
    const klik = (e) => {
      if (st.current.binnen || st.current.gereedschap !== 'selecteer' || e.originalEvent?.shiftKey || e.originalEvent?.altKey) return;
      // Enkel een klik op het label (▦ naam) gaat naar binnen. Een klik op de tent of het gebouw zelf kiest het item,
      // zoals bij elk ander item (anders ging het paneel heel even open en sprong de kaart meteen naar binnen).
      const f = map.getLayer('fm-binnen') ? map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], { layers: ['fm-binnen'] })[0] : null;
      if (f?.properties?.host) { map._fmNegeerKlik = Date.now() + 300; setBinnenZweef(null); gaNaarBinnenRef.current?.(f.properties.host); }
    };
    let vorige = null;
    const over = (e) => {
      if (st.current.binnen || e.originalEvent?.buttons) { if (vorige) { vorige = null; setBinnenZweef(null); } return; }
      const f = raak(e.point); const h = f?.properties?.host || null;
      if (h) { zetCursor(map, 'binnen', 'pointer'); setBinnenZweef({ host: h, x: e.point.x, y: e.point.y }); }
      else if (vorige) { zetCursor(map, 'binnen', ''); setBinnenZweef(null); }
      vorige = h;
    };
    const weg = () => { vorige = null; setBinnenZweef(null); };
    map.on('click', klik); map.on('mousemove', over); map.on('mouseout', weg); map.on('movestart', weg);
    return () => { map.off('click', klik); map.off('mousemove', over); map.off('mouseout', weg); map.off('movestart', weg); };
  }, [kaartKlaar, openBinnen]);
  // Naar binnen gaan: inzoomen op het gebouw terwijl het beeld wit wordt, dan het binnenplan openen en weer opklaren.
  const gaNaarBinnenRef = useRef(null);
  gaNaarBinnenRef.current = (hostId) => {
    const map = mapRef.current; const host = st.current.items.find((x) => x.id === hostId);
    if (!map || !host?.geometrie) { openBinnenScherm(hostId); return; }
    const k = geo.kader([host.geometrie]);
    const c = host.geometrie.type === 'Point' ? host.geometrie.coordinates : [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2];
    // Terugkeren naar het beeld van vóór de zoom (niet naar het ingezoomde tussenbeeld).
    if (!binnenVorig.current) binnenVorig.current = { c: map.getCenter(), z: map.getZoom(), b: map.getBearing() };
    setOvergang('in');
    map.easeTo({ center: c, zoom: map.getZoom() + 2.2, duration: 520, easing: (t) => t * t });
    setTimeout(() => { openBinnenScherm(hostId); setOvergang('uit'); setTimeout(() => setOvergang(''), 520); }, 480);
  };
  // Binnenplan: een eigen, effen ondergrond (geen luchtfoto); de luchtfoto kan erbij.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return undefined;
    const zet = () => {
      if (!map.getStyle()) return;
      const nodig = !!binnen && !binnenFoto;
      if (!nodig) { if (map.getLayer('fm-binnen-bg')) map.removeLayer('fm-binnen-bg'); return; }
      // Onder het grondplan en alle items: vóór de eerste onderlegger, anders vóór de vloeren/vulling.
      const lagen = map.getStyle().layers || [];
      const voor = lagen.find((l) => l.id.startsWith('fm-ol-'))?.id || (map.getLayer('fm-vloer') ? 'fm-vloer' : map.getLayer('fm-vulling') ? 'fm-vulling' : undefined);
      if (map.getLayer('fm-binnen-bg')) { if (voor && voor !== 'fm-binnen-bg') map.moveLayer('fm-binnen-bg', voor); return; }
      map.addLayer({ id: 'fm-binnen-bg', type: 'background', paint: { 'background-color': '#F5F4F0' } }, voor);
    };
    zet();
    map.on('styledata', zet);
    return () => { map.off('styledata', zet); };
  }, [binnen, binnenFoto, kaartKlaar]);
  useEffect(() => { if (binnen && !items.some((x) => x.id === binnen.host)) setBinnen(null); }, [binnen, items]);
  // Ruimte aanklikken: de kleinste gesloten vorm van het grondplan rond de klik wordt een ruimte.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar || !ruimteKlik) return undefined;
    let gj = null;
    fetch(ruimteKlik.url).then((x) => x.json()).then((d) => { gj = dxfGeojson(ruimteKlik, d); }).catch(() => setMelding('Grondplan niet te lezen.'));
    zetCursor(map, 'penseel', 'crosshair');
    const klik = (e) => {
      if (!gj) return;
      const p = [e.lngLat.lng, e.lngLat.lat];
      let beste = null;
      for (const f of gj.features) {
        if (f.geometry.type !== 'LineString') continue;
        const c = f.geometry.coordinates;
        if (c.length < 4 || Math.hypot(c[0][0] - c[c.length - 1][0], c[0][1] - c[c.length - 1][1]) > 1e-7) continue;
        const g = { type: 'Polygon', coordinates: [c] };
        try { if (!turf.booleanPointInPolygon(p, g)) continue; const a = turf.area(g); if (a > 2 && (!beste || a < beste.a)) beste = { g, a }; } catch { /* */ }
      }
      if (!beste) { setMelding('Hier vind ik geen gesloten ruimte in het grondplan. Teken ze met Vorm › Veelhoek: de lijnen van het grondplan klikken vast.'); return; }
      const t = gj.features.find((x) => x.geometry.type === 'Point' && /[A-Za-z]{3}/.test(x.properties.t || '') && (() => { try { return turf.booleanPointInPolygon(x.geometry.coordinates, beste.g); } catch { return false; } })());
      const naam = t ? String(t.properties.t).replace(/\s*\([^)]*m²\)\s*$/, '').trim() : 'Ruimte';
      const it = maakItem({ soort: 'vlak', naam, geometrie: geo.rondGeom(beste.g), stijl: { kleur: '#2563EB', vuldekking: 0.06, label: true }, velden: { ruimte: true } });
      tdRef.current?.addFeatures([tdFeature(it)]);
      setMelding(`Ruimte "${naam}" (${geo.getal(beste.a, 0)} m²) gemaakt. Klik de volgende of Klaar.`);
    };
    const toets = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { setRuimteKlik(null); setGereedschap('selecteer'); } };
    map.on('click', klik); window.addEventListener('keydown', toets);
    return () => { map.off('click', klik); window.removeEventListener('keydown', toets); zetCursor(map, 'penseel', ''); };
  }, [ruimteKlik, kaartKlaar]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!binnen || gereedschap !== 'hand') setRuimteKlik(null); }, [binnen, gereedschap]);
  // Zalen uit een DXF-grondplan (laag ZALEN, namen uit de teksten) als ruimtes van deze verdieping.
  const zalenUitGrondplan = async (ol) => {
    try {
      const d = await fetch(ol.url).then((x) => x.json());
      const gj = dxfGeojson(ol, d);
      const vlakken = gj.features.filter((f) => /^(zalen|ruimtes?|zones?)$/i.test(f.properties.laag || '') && f.geometry.coordinates.length >= 4);
      if (!vlakken.length) { setMelding('Geen gesloten lijnen op een laag ZALEN of RUIMTES in dit grondplan.'); return; }
      const teksten = gj.features.filter((f) => f.geometry.type === 'Point');
      let n = 0;
      for (const v of vlakken) {
        const c = [...v.geometry.coordinates]; if (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1]) c.push(c[0]);
        const g = { type: 'Polygon', coordinates: [c] };
        const t = teksten.find((x) => { try { return turf.booleanPointInPolygon(x.geometry.coordinates, g); } catch { return false; } });
        const naam = t ? String(t.properties.t).replace(/\s*\([^)]*m²\)\s*$/, '').trim() : `Ruimte ${n + 1}`;
        const it = maakItem({ soort: 'vlak', naam, geometrie: geo.rondGeom(g), stijl: { kleur: '#2563EB', vuldekking: 0.06, label: true }, velden: { ruimte: true } });
        tdRef.current?.addFeatures([tdFeature(it)]);
        n++;
      }
      setMelding(`${n} ${n === 1 ? 'ruimte' : 'ruimtes'} overgenomen uit het grondplan.`);
    } catch (e) { setFout(e?.message || String(e)); }
  };
  // Grondplan (PDF, foto of DXF) als onderlegger van deze verdieping, op de plaats en draaiing van het gebouw.
  const grondplanRef = useRef(null);
  const grondplanToevoegen = async (f, bArg = null) => {
    const b = bArg || st.current.binnen; const host = st.current.items.find((x) => x.id === b?.host);
    if (!f || !host) return;
    try {
      const p = host.parameters || {};
      const k = geo.kader([host.geometrie]);
      const midden = p.midden || [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2];
      // Bij een icoon (punt) weten we de maat van het gebouw niet: 40 m breed, daarna passen met twee punten.
      const breedte = p.breedte || (host.geometrie.type === 'Point' ? 40 : Math.max(5, geo.lengte({ type: 'LineString', coordinates: [[k[0], midden[1]], [k[2], midden[1]]] })));
      let o = null;
      // Een PDF met lijnen (CAD- of architectenplan) lezen we als lijnen in: scherp en met snappen.
      if (/\.pdf$/i.test(f.name)) {
        setMelding('Lijnen uit de PDF lezen…');
        const schaal = await vraagTekst('Schaal van het plan (bv. 500 voor 1/500). Laat leeg als je het niet weet: dan pas je het straks met twee punten.', '');
        const n = Number(String(schaal || '').replace(/^1\s*[:/]\s*/, '').replace(',', '.'));
        const ol = await pdfLijnen(f, { mPerPt: n > 0 ? n * 0.000352778 : null, breedteM: breedte });
        if (ol) { setMelding('Uploaden…'); o = await bewaarVectorOnderlegger(plan.id, f.name, ol, midden); }
      }
      const uitPdf = !!o;
      if (!o) o = await nieuweOnderlegger(plan.id, f, midden, breedte, setMelding);
      // DXF: echte maten, de schaal ligt vast (natuur = ware breedte in meter).
      const n = { ...o, rot: o.vast ? 0 : Number(p.rot) || 0, dekking: 0.6, binnen: { host: b.host, verd: b.verd || null }, ...(o.soort === 'dxf' && !uitPdf && !o.vast && o.breedte ? { natuur: o.breedte } : {}) };
      // Een nieuw grondplan voor dezelfde verdieping vervangt het vorige.
      const zelfde = (x) => x.binnen?.host === b.host && (x.binnen.verd || null) === (b.verd || null);
      await wijzigPlan({ instellingen: { ...(st.current.plan?.instellingen || {}), onderleggers: [...(st.current.plan?.instellingen?.onderleggers || []).filter((x) => !(bArg && zelfde(x))), n] } });
      setMelding(o.soort === 'dxf' ? `Grondplan ingelezen als lijnen: tekenen klikt erop vast. Pas het met twee punten (Grondplan passen).` : 'Grondplan geplaatst als afbeelding (geen lijnen in de PDF). Pas het met twee punten en teken erover.');
    } catch (e) { setFout(e?.message || String(e)); }
  };
  // Dubbelklik op een gegroepeerd item: groep geïsoleerd openen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return undefined;
    const dubbel = (e) => {
      const s = st.current;
      if (s.iso || s.gereedschap !== 'selecteer' || !s.schrijven) return;
      const hit = map.queryRenderedFeatures(e.point, { layers: ['fm-vulling', 'fm-patroon', 'fm-punt', 'fm-vloer'].filter((l) => map.getLayer(l)) }).map((f) => f.properties?.id).find(Boolean);
      const it = hit ? s.items.find((x) => x.id === hit) : null;
      if (it?.groep_id) { e.preventDefault(); setIso(it.groep_id); setGeselecteerd(null); setExtra([]); }
    };
    map.on('dblclick', dubbel);
    return () => map.off('dblclick', dubbel);
  }, [kaartKlaar]);
  // Kleine items (bv. een marshall-camera van 1,2 m) zijn op de kaart maar enkele pixels groot. Klik je er net naast,
  // dan kiest Toolen het dichtstbijzijnde item binnen 12 pixels, zodat je het niet hoeft te raken.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return undefined;
    const LG = ['fm-vulling', 'fm-patroon', 'fm-punt', 'fm-vloer', 'fm-lijn'];
    const klik = (e) => {
      const s = st.current;
      if (s.iso || s.binnen || s.gereedschap !== 'selecteer' || e.originalEvent?.shiftKey || e.originalEvent?.altKey) return;
      if ((map._fmNegeerKlik || 0) > Date.now()) return;
      const lg = LG.filter((l) => map.getLayer(l)); if (!lg.length) return;
      if (map.queryRenderedFeatures(e.point, { layers: lg }).some((f) => f.properties?.id)) return; // raak: terra-draw kiest zelf
      const R = 12; const p = e.point;
      const kand = map.queryRenderedFeatures([[p.x - R, p.y - R], [p.x + R, p.y + R]], { layers: lg }).map((f) => f.properties?.id).filter(Boolean);
      let best = null; let bestD = Infinity;
      for (const id of new Set(kand)) {
        const it = s.items.find((x) => x.id === id); const m = it?.parameters?.midden; if (!m) continue;
        const c = map.project(m); const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < bestD) { best = it; bestD = d; }
      }
      if (!best || bestD > R * 1.5) return;
      setTimeout(() => { setGeselecteerd(best.id); setExtra([]); try { tdRef.current?.selectFeature(best.id); } catch {} }, 0);
    };
    map.on('click', klik);
    return () => map.off('click', klik);
  }, [kaartKlaar]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && kaartKlaar && plan) { kiesFotoVl(plan.instellingen, map); zetOndergrond(map, plan.basiskaart); }
  }, [plan?.basiskaart, plan?.instellingen?.fotoVl, plan?.instellingen?.schaduw, kaartKlaar]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Onderleggers ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    const ol = (plan?.instellingen?.onderleggers || []).filter((o) => (binnen ? o.binnen?.host === binnen.host && (o.binnen.verd || null) === (binnen.verd || null) : !o.binnen));
    zetOnderleggers(map, ol).catch((e) => console.warn('onderlegger', e));
  }, [plan?.instellingen?.onderleggers, kaartKlaar, binnen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Passen met twee punten: eerst twee punten op de onderlegger, dan dezelfde twee op de kaart.
  const startKalibratie = useCallback((o) => {
    if (!o) { setKalibratie(null); setMelding(''); return; }
    setGereedschap('hand');
    setGeselecteerd(null);
    setKalibratie({ id: o.id, bron: [], doel: [], uitleg: 'Klik punt 1 op de onderlegger (bv. een hoek van een gebouw).' });
  }, []);
  const kalibreerKlik = useCallback((lngLat) => {
    const k = st.current.kalibratie;
    const lijst = st.current.plan?.instellingen?.onderleggers || [];
    const o = lijst.find((x) => x.id === k?.id);
    if (!k || !o) { setKalibratie(null); return; }
    if (k.bron.length < 2) {
      const bron = [...k.bron, naarLokaal(o, lngLat)];
      setKalibratie({ ...k, bron, uitleg: bron.length === 1 ? 'Klik punt 2 op de onderlegger, zo ver mogelijk van punt 1.' : 'Klik nu waar punt 1 echt ligt op de luchtfoto.' });
      return;
    }
    const doel = [...k.doel, lngLat];
    if (doel.length === 1) { setKalibratie({ ...k, doel, uitleg: 'Klik waar punt 2 echt ligt op de luchtfoto.' }); return; }
    // DXF met echte maten: enkel verschuiven en draaien, de schaal blijft.
    const nieuw = o.soort === 'dxf' && o.natuur ? pasAanVast(o, k.bron, doel) : pasAan(o, k.bron, doel);
    setKalibratie(null);
    if (!nieuw) { setMelding('De punten liggen te dicht bij elkaar. Probeer opnieuw.'); return; }
    const p = st.current.plan;
    wijzigPlanRef.current?.({ instellingen: { ...(p.instellingen || {}), onderleggers: lijst.map((x) => (x.id === o.id ? { ...x, ...nieuw } : x)) } });
    herprojecteerBinnen(o, { ...o, ...nieuw });
    if (schermNaPassen.current) { const sc = schermNaPassen.current; schermNaPassen.current = null; setTimeout(() => { setBinnen(null); setBinnenScherm(sc); }, 400); }
    setMelding(`Onderlegger gepast: ${geo.getal(nieuw.breedte, 1)} m breed, gedraaid ${geo.getal(nieuw.rot, 1)}°.`);
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    // Gekozen punten tonen.
    const o = (plan?.instellingen?.onderleggers || []).find((x) => x.id === kalibratie?.id);
    const punten = [];
    if (kalibratie && o) {
      kalibratie.bron.forEach((b, i) => {
        const [e, n] = [b[0], b[1]];
        const r = ((Number(o.rot) || 0) * Math.PI) / 180;
        const oost = e * Math.cos(r) + n * Math.sin(r);
        const noord = -e * Math.sin(r) + n * Math.cos(r);
        punten.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [o.midden[0] + oost / (111320 * Math.cos((o.midden[1] * Math.PI) / 180)), o.midden[1] + noord / 111320] }, properties: { t: `${i + 1}`, k: '#D97706' } });
      });
      kalibratie.doel.forEach((d, i) => punten.push({ type: 'Feature', geometry: { type: 'Point', coordinates: d }, properties: { t: `${i + 1}`, k: '#16865C' } }));
    }
    const data = { type: 'FeatureCollection', features: punten };
    if (map.getSource('fm-kal')) map.getSource('fm-kal').setData(data);
    else {
      map.addSource('fm-kal', { type: 'geojson', data });
      map.addLayer({ id: 'fm-kal', type: 'circle', source: 'fm-kal', paint: { 'circle-radius': 8, 'circle-color': ['get', 'k'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      map.addLayer({ id: 'fm-kal-t', type: 'symbol', source: 'fm-kal', layout: { 'text-field': ['get', 't'], 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true }, paint: { 'text-color': '#fff' } });
    }
  }, [kalibratie, kaartKlaar, plan?.instellingen?.onderleggers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Signalisatie ----------
  // Laag opzoeken of aanmaken (Signalisatie, Verkeer); geeft het laag-id via de callback.
  const zorgLaag = useCallback((test, naam, kleur, klaar) => {
    const s2 = st.current;
    const laag = s2.lagen.find((l) => test.test(l.naam));
    if (laag) { klaar(laag.id); return; }
    maps().from('lagen').insert({ plan_id: s2.plan.id, naam, kleur, volgorde: s2.lagen.length }).select().single().then(({ data, error }) => {
      if (error) { setFout(foutTekst(error)); return; }
      // De live-melding kan vóór het antwoord binnenkomen: niet dubbel toevoegen.
      setLagen((l) => (l.some((x) => x.id === data.id) ? l : [...l, data]));
      if (!st.current.lagen.some((x) => x.id === data.id)) st.current.lagen = [...st.current.lagen, data];
      klaar(data.id);
    });
  }, []);
  const zorgVerkeerLaag = useCallback((klaar) => zorgLaag(/^verkeer$/i, VERKEER_LAAG.naam, VERKEER_LAAG.kleur, klaar), [zorgLaag]);
  // Verkeersbord zetten (modus Verkeer): de code staat in signZet.
  const zetVerkeerBord = useCallback((punt, code) => {
    const b = BORD_MAP.get(code);
    if (!b) return;
    zorgVerkeerLaag((laagId) => {
      const nr = volgendVerkeerNr(st.current.items);
      const inst = instVerkeer(st.current.plan);
      const verkeer = { soort: 'bord', bord: code, nr, kijkrichting: 0, onderbord: '', ...(b.waarde ? { waarde: 50 } : {}), ...(b.pijl ? { pijl: 'rechtdoor' } : {}), ...(b.tekst ? { tekst: '' } : {}), ...(inst.van || inst.tot ? { van: inst.van, tot: inst.tot } : {}) };
      const it = maakItem({ soort: 'punt', laag_id: laagId, geometrie: { type: 'Point', coordinates: punt }, naam: `${code === 'NADAR' ? 'Nadar' : code} ${nr}`, velden: { verkeer } });
      tdRef.current?.addFeatures([tdFeature(it)]);
      setGeselecteerd(it.id);
    });
  }, [maakItem, tdFeature, zorgVerkeerLaag]);
  const zetSignPunt = useCallback((punt) => {
    const s2 = st.current;
    if (typeof s2.signZet === 'string') { zetVerkeerBord(punt, s2.signZet); return; }
    let laag = s2.lagen.find((l) => /signali/i.test(l.naam));
    const inst = instSign(s2.plan);
    const routes = inst.routes.map((r) => s2.items.find((i) => i.id === r.lijn_id)?.geometrie).filter(Boolean);
    const richting = richtingUitRoutes(punt, routes);
    const maak = (laagId) => {
      const nr = volgendNr(st.current.items, laagId);
      const it = maakItem({ soort: 'punt', laag_id: laagId, geometrie: { type: 'Point', coordinates: punt }, naam: `Signalisatie ${nr}`,
        velden: { sign: { nr, richting: richting != null ? Math.round(richting) : null, rijen: [], kant: 'rechts', bevestiging: 'heras' } } });
      tdRef.current?.addFeatures([tdFeature(it)]);
      setGeselecteerd(it.id);
    };
    if (laag) { maak(laag.id); return; }
    maps().from('lagen').insert({ plan_id: s2.plan.id, naam: 'Signalisatie', kleur: '#E11D48', volgorde: s2.lagen.length }).select().single().then(({ data, error }) => {
      if (error) { setFout(foutTekst(error)); return; }
      // De live-melding kan vóór het antwoord binnenkomen: niet dubbel toevoegen.
      setLagen((l) => (l.some((x) => x.id === data.id) ? l : [...l, data]));
      if (!st.current.lagen.some((x) => x.id === data.id)) st.current.lagen = [...st.current.lagen, data];
      maak(data.id);
    });
  }, [maakItem, tdFeature, zetVerkeerBord]);
  // ---------- CAD-plan van een leverancier als object ----------
  const cadKlaar = useCallback(async ({ naam, leverancier, tekening, cad }) => {
    const s2 = st.current;
    const el = cadVervang;
    if (el) {
      const eig = { ...(el.eigenschappen || {}), tekening, cad: { ...cad, vorige: el.eigenschappen?.cad ? { bestand: el.eigenschappen.cad.bestand, ingeladen: el.eigenschappen.cad.ingeladen } : null } };
      const { data, error } = await maps().from('bibliotheek').update({ naam, leverancier, breedte_m: tekening.b, diepte_m: tekening.h, eigenschappen: eig }).eq('id', el.id).select().single();
      if (error) { setFout(foutTekst(error)); return; }
      setElementen((e) => e.map((x) => (x.id === el.id ? data : x)));
      // Items van dit object: zelfde plek en draaiing, nieuwe maat.
      for (const it of s2.items.filter((x) => x.element_id === el.id)) {
        const p = it.parameters || {}; const midden = p.midden || geo.middelpunt(it.geometrie);
        wijzigItem(it.id, { parameters: { ...p, midden, breedte: tekening.b, diepte: tekening.h }, geometrie: geo.elementVeelhoek(midden, tekening.b, tekening.h, Number(p.rot) || 0, null) });
      }
      setTimeout(syncTd, 0);
      setMelding(`"${naam}" vervangen door de nieuwe versie.`);
    } else {
      const rij = { naam, categorie: 'Plan-objecten', tekenwijze: 'schaal', leverancier, breedte_m: tekening.b, diepte_m: tekening.h, plan_id: s2.plan.id, actief: true,
        stijl: { vuldekking: 0, kleur: '#1d1d1b' }, eigenschappen: { tekening, cad, omschrijving: `CAD-plan van ${leverancier || 'de leverancier'} (${cad.bestand}${cad.pagina ? `, pagina ${cad.pagina}` : ''}), ingeladen op ${cad.ingeladen}. Enkel in dit plan.` } };
      const { data, error } = await maps().from('bibliotheek').insert(rij).select().single();
      if (error) { setFout(foutTekst(error)); return; }
      setElementen((e) => [...e, data]);
      const c = mapRef.current?.getCenter();
      const midden = c ? [c.lng, c.lat] : geo.middelpunt(s2.items[0]?.geometrie || { type: 'Point', coordinates: [4.4, 51] });
      const it = maakItem({ ...elementItem(data, midden, 0), laag_id: s2.actieveLaag });
      tdRef.current?.addFeatures([tdFeature(it)]);
      setGeselecteerd(it.id);
      setMelding(`"${naam}" staat in het plan: verschuif en draai het op zijn plaats.`);
    }
    setDialoog(null); setCadVervang(null);
  }, [cadVervang, maakItem, elementItem, tdFeature, wijzigItem, syncTd]);

  // Voorstel van bordpunten toepassen in één keer.
  const signVoorstelToepassen = useCallback(({ nieuw = [], wijzig = [], weg = [] }) => {
    for (const id of weg) { const voor = st.current.items.find((x) => x.id === id); if (voor) pasToe(voor, null); }
    for (const w of wijzig) wijzigItem(w.id, w.patch);
    for (const it of nieuw) maakItem({ soort: 'punt', ...it });
    if (weg.includes(st.current.geselecteerd)) setGeselecteerd(null);
    setTimeout(syncTd, 0);
  }, [pasToe, wijzigItem, maakItem, syncTd]);
  useEffect(() => {
    if (signZet) { setGereedschap('hand'); }
  }, [signZet]);
  useEffect(() => { if (tab !== 'sign') setSignZet(false); }, [tab]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    zetCursor(map, 'modus', signZet || kalibratie ? 'crosshair' : '');
  }, [signZet, kalibratie, kaartKlaar]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    zorgVoorKijkIcoon(map);
    const data = signGeojson(items, lagenMap, verborgenLagen);
    if (map.getSource('fm-sign')) map.getSource('fm-sign').setData(data);
    else {
      map.addSource('fm-sign', { type: 'geojson', data });
      map.addLayer({ id: 'fm-sign-kijk', type: 'symbol', source: 'fm-sign', filter: ['get', 'heeftRichting'],
        layout: { 'icon-image': 'fm-kijk', 'icon-rotate': ['get', 'richting'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': 1, 'icon-offset': [0, -14] } });
      map.addLayer({ id: 'fm-sign', type: 'circle', source: 'fm-sign', paint: { 'circle-radius': 10, 'circle-color': '#E11D48', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
      map.addLayer({ id: 'fm-sign-nr', type: 'symbol', source: 'fm-sign', layout: { 'text-field': ['get', 'nr'], 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff' } });
    }
  }, [items, lagenMap, verborgenLagen, kaartKlaar]);
  // Verkeersborden: rechtop en leesbaar, met een wig voor de kijkrichting; E1 om de N m langs een parkeerverbod, C3 bij een afsluiting.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    zorgVoorKijkIcoon(map);
    const data = verkeerGeojson(items, verborgenLagen, instVerkeer(plan));
    if (map.getSource('fm-verkeer')) map.getSource('fm-verkeer').setData(data);
    else {
      map.addSource('fm-verkeer', { type: 'geojson', data });
      for (const l of verkeerKaartLagen()) map.addLayer(l);
      laadVerkeerIconen(map).then(() => map.triggerRepaint());
    }
  }, [items, verborgenLagen, kaartKlaar, plan?.instellingen?.verkeer]); // eslint-disable-line react-hooks/exhaustive-deps
  // Werkruimte: bordpunten dimmen buiten Signalisatie, vaste aansluitingen bescheiden buiten Stroom, routes in de kleur van hun bord.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    const vol = werkruimte === 'plan' || (werkruimte === 'sign' && signModus !== 'verkeer') || toonAlles;
    for (const [l, k] of [['fm-sign', 'circle-opacity'], ['fm-sign', 'circle-stroke-opacity'], ['fm-sign-nr', 'text-opacity'], ['fm-sign-kijk', 'icon-opacity']]) if (map.getLayer(l)) map.setPaintProperty(l, k, vol ? 1 : 0.25);
    const volVk = werkruimte === 'plan' || (werkruimte === 'sign' && signModus === 'verkeer') || toonAlles;
    for (const [l, k] of [['fm-vk-bord', 'icon-opacity'], ['fm-vk-bord', 'text-opacity'], ['fm-vk-herhaal', 'icon-opacity'], ['fm-vk-kijk', 'icon-opacity']]) if (map.getLayer(l)) map.setPaintProperty(l, k, volVk ? 1 : 0.25);
    zetVaDekking(map, werkruimte === 'stroom' || toonAlles);
    const f = [];
    if (werkruimte === 'sign' && signModus !== 'verkeer' && plan) {
      const inst = instSign(plan);
      const PALET = ['#2563EB', '#16865C', '#D97706', '#7C3AED', '#0E7490', '#B91C1C'];
      inst.routes.forEach((r, i) => {
        const lijn = itemsMap.get(r.lijn_id);
        const b = inst.bestemmingen.find((x) => x.id === r.bestemming_id);
        if (lijn?.geometrie?.type === 'LineString') f.push({ type: 'Feature', geometry: lijn.geometrie, properties: { kleur: b?.kleur && b.kleur !== '#ffffff' ? b.kleur : PALET[i % PALET.length], naam: b ? `${b.boventitel ? `${b.boventitel} ` : ''}${b.naam}` : `Route ${i + 1}` } });
      });
    }
    const data = { type: 'FeatureCollection', features: f };
    if (map.getSource('fm-sign-route')) map.getSource('fm-sign-route').setData(data);
    else {
      map.addSource('fm-sign-route', { type: 'geojson', data });
      const voor = map.getLayer('fm-sign-kijk') ? 'fm-sign-kijk' : undefined;
      map.addLayer({ id: 'fm-sign-route-wit', type: 'line', source: 'fm-sign-route', paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } }, voor);
      map.addLayer({ id: 'fm-sign-route', type: 'line', source: 'fm-sign-route', paint: { 'line-color': ['get', 'kleur'], 'line-width': 5, 'line-opacity': 0.85 }, layout: { 'line-cap': 'round', 'line-join': 'round' } }, voor);
      map.addLayer({ id: 'fm-sign-route-naam', type: 'symbol', source: 'fm-sign-route', layout: { 'symbol-placement': 'line', 'text-field': ['get', 'naam'], 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'symbol-spacing': 300 }, paint: { 'text-color': ['get', 'kleur'], 'text-halo-color': '#fff', 'text-halo-width': 1.5 } }, voor);
    }
  }, [werkruimte, signModus, toonAlles, kaartKlaar, plan?.instellingen?.signalisatie, itemsMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const maakSignPdf = useCallback(async () => {
    try {
      setMelding('Signalisatie-PDF maken…');
      const { signalisatiePdf } = await import('./signPdf');
      const { doc, meldingen } = await signalisatiePdf({ plan: st.current.plan, items: st.current.items, voortgang: setMelding });
      doc.save(`Signalisatie - ${st.current.plan.naam} v${st.current.plan.versie}.pdf`.replace(/[\\/:*?"<>|]/g, ''));
      setMelding(meldingen.join(' ') || 'Signalisatie-PDF gemaakt.');
    } catch (e) {
      setMelding('');
      setFout(e?.message || String(e));
    }
  }, []);

  // ---------- Stroom: wie voedt wie (stippellijn) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    const f = [];
    if (tab === 'stroom' || werkruimte === 'stroom') {
      const byId = new Map([...vast.map((v) => [vaId(v), alsStroomItem(v)]), ...items.map((i) => [i.id, i])]);
      for (const it of items) {
        const s2 = stroomVan(it, elementenMap.get(it.element_id));
        if (!['kast', 'verbruiker'].includes(s2.rol) || !it.geometrie) continue;
        // Eén stippellijn per voeding: een item met twee aansluitingen (podium 32 A + 63 A) krijgt er twee.
        const voedingen = s2.aansluitingen?.length ? s2.aansluitingen.map((a) => a.voeding).filter(Boolean) : s2.voeding ? [s2.voeding] : [];
        voedingen.forEach((vid, i) => {
          const v = byId.get(vid);
          if (!v?.geometrie) return;
          // Meerdere lijnen naar dezelfde bron: iets uit elkaar, zodat je ze apart ziet.
          const b = geo.middelpunt(it.geometrie);
          const eind = voedingen.length > 1 ? geo.verschuif({ type: 'Point', coordinates: b }, (i - (voedingen.length - 1) / 2) * 1.2, 0).coordinates : b;
          f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [geo.middelpunt(v.geometrie), eind] }, properties: {} });
        });
      }
    }
    const data = { type: 'FeatureCollection', features: f };
    if (map.getSource('fm-voeding')) map.getSource('fm-voeding').setData(data);
    else {
      map.addSource('fm-voeding', { type: 'geojson', data });
      map.addLayer({ id: 'fm-voeding', type: 'line', source: 'fm-voeding', paint: { 'line-color': '#5B21B6', 'line-width': 1.5, 'line-dasharray': [1, 2], 'line-opacity': 0.8 } });
    }
  }, [tab, items, elementenMap, kaartKlaar, vast, werkruimte]);

  // ---------- Versie vergelijken ----------
  const vergelijk = useMemo(() => (vergelijkVersie ? { ...vergelijkVersie, d: verschil(vergelijkVersie.items, items) } : null), [vergelijkVersie, items]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    const f = [];
    if (vergelijk) {
      for (const [lijst, status] of [[vergelijk.d.nieuw, 'nieuw'], [vergelijk.d.gewijzigd, 'gewijzigd'], [vergelijk.d.weg, 'weg']]) {
        for (const it of lijst) if (it.geometrie) f.push({ type: 'Feature', geometry: it.geometrie, properties: { status } });
      }
    }
    const data = { type: 'FeatureCollection', features: f };
    const kleur = ['match', ['get', 'status'], 'nieuw', '#16865C', 'gewijzigd', '#D97706', '#B91C1C'];
    if (map.getSource('fm-verschil')) map.getSource('fm-verschil').setData(data);
    else {
      map.addSource('fm-verschil', { type: 'geojson', data });
      map.addLayer({ id: 'fm-verschil-vlak', type: 'fill', source: 'fm-verschil', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': kleur, 'fill-opacity': 0.25 } });
      map.addLayer({ id: 'fm-verschil-lijn', type: 'line', source: 'fm-verschil', filter: ['all', ['!=', ['geometry-type'], 'Point'], ['!=', ['get', 'status'], 'weg']], paint: { 'line-color': kleur, 'line-width': 4 } });
      map.addLayer({ id: 'fm-verschil-weg', type: 'line', source: 'fm-verschil', filter: ['all', ['!=', ['geometry-type'], 'Point'], ['==', ['get', 'status'], 'weg']], paint: { 'line-color': '#B91C1C', 'line-width': 4, 'line-dasharray': [2, 1.5] } });
      map.addLayer({ id: 'fm-verschil-punt', type: 'circle', source: 'fm-verschil', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 11, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': kleur, 'circle-stroke-width': 3 } });
    }
  }, [vergelijk, kaartKlaar]);

  // ---------- Pop-up bij selectie ----------
  useEffect(() => {
    const map = mapRef.current;
    popupRef.current?.remove();
    popupRef.current = null;
    setPopupDiv(null);
    if (!map || !geselecteerd) return;
    // Wie bewerkt, ziet alles al in het eigenschappenpaneel: geen pop-up.
    if (st.current.schrijven) return;
    const it = st.current.items.find((x) => x.id === geselecteerd);
    if (!it) return;
    const div = document.createElement('div');
    // Wie bewerkt, krijgt de pop-up onder het item: de draaigreep en de knooppunten blijven vrij.
    const p = new maplibregl.Popup({ className: 'fm-popup', maxWidth: 'none', closeOnClick: false, offset: 14, ...(st.current.schrijven ? { anchor: 'top' } : {}) })
      .setLngLat(popupPlek(it.geometrie)).setDOMContent(div).addTo(map);
    p.on('close', () => { if (popupRef.current === p) setPopupDiv(null); });
    popupRef.current = p;
    setPopupDiv(div);
  }, [geselecteerd]);

  // Pop-up volgt het item als het verschuift.
  function popupPlek(g) {
    if (!st.current.schrijven || g.type === 'Point') return geo.middelpunt(g);
    const k = geo.kader([g]);
    return [geo.middelpunt(g)[0], k[1]];
  }
  useEffect(() => {
    if (popupRef.current && item?.geometrie) { try { popupRef.current.setLngLat(popupPlek(item.geometrie)); } catch {} }
  }, [item?.geometrie]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Acties ----------
  const dupliceer = useCallback((id, oost = 2, noord = -2) => {
    const bron = st.current.items.find((x) => x.id === id);
    if (!bron) return null;
    const geometrie = geo.verschuif(bron.geometrie, oost, noord);
    const parameters = { ...bron.parameters };
    if (parameters.midden) parameters.midden = geo.middelpunt(geometrie);
    // Een kopie van een hekkenlijn krijgt haar deuren niet mee; een gekopieerde deur staat los.
    delete parameters.openingen; delete parameters.inLijn;
    const { id: _, created_at, updated_at, ...rest } = bron;
    const kopie = maakItem({ ...rest, id: nieuwId(), geometrie, parameters });
    tdRef.current?.addFeatures([tdFeature(kopie)]);
    return kopie;
  }, [maakItem, tdFeature]);

  const maakRaster = useCallback((id, rijen, kolommen, tussenX, tussenY) => {
    const bron = st.current.items.find((x) => x.id === id);
    if (!bron) return;
    const b = Number(bron.parameters?.breedte) || 0;
    const d = Number(bron.parameters?.diepte) || 0;
    const rot = ((Number(bron.parameters?.rot) || 0) * Math.PI) / 180;
    const stapX = b + Number(tussenX || 0);
    const stapY = d + Number(tussenY || 0);
    for (let r = 0; r < rijen; r++) {
      for (let k = 0; k < kolommen; k++) {
        if (r === 0 && k === 0) continue;
        const x = k * stapX;
        const y = -r * stapY;
        const oost = x * Math.cos(rot) + y * Math.sin(rot);
        const noord = -x * Math.sin(rot) + y * Math.cos(rot);
        dupliceer(id, oost, noord);
      }
    }
  }, [dupliceer]);

  // Kabelgoot (gewoon of rolstoel) op elke open kruising van een kabel met een route: een lijn van twee
  // stukken over de kabel, in de richting van de kabel.
  const legKabelgoten = useCallback((el, kruispunten) => {
    if (!el || !kruispunten?.length) return;
    const e = Number(el.eenheid_m) || 0.9; const half = e; // 2 stukken
    const ids = [];
    for (const k of kruispunten) {
      const a = turf.destination(k.punt, half, k.richting + 180, { units: 'meters' }).geometry.coordinates;
      const b = turf.destination(k.punt, half, k.richting, { units: 'meters' }).geometry.coordinates;
      const it = maakItem({ laag_id: laagVoorElement(el), soort: 'element', element_id: el.id, geometrie: { type: 'LineString', coordinates: [a, b] }, parameters: {} });
      ids.push(it.id);
    }
    setTimeout(syncTd, 0);
    setMelding(`${ids.length} × ${el.naam} gelegd (2 stukken per kruising). Trek de lijn langer als de route breder is.`);
  }, [maakItem, laagVoorElement, syncTd]);

  const langsLijn = useCallback((lijnId, elementId, interval) => {
    const lijn = st.current.items.find((x) => x.id === lijnId);
    const el = st.current.elementen.find((x) => x.id === elementId);
    if (!lijn || !el || lijn.geometrie.type !== 'LineString') return;
    for (const { punt, richting } of geo.puntenLangs(lijn.geometrie, Number(interval))) {
      const it = maakItem({ laag_id: laagVoorElement(el), ...elementItem(el, punt, geo.rond(richting - 90, 1)) });
      tdRef.current?.addFeatures([tdFeature(it)]);
    }
  }, [maakItem, elementItem, laagVoorElement, tdFeature]);

  const zetGeometrie = useCallback((id, geometrie, parameters) => {
    const it = st.current.items.find((x) => x.id === id);
    if (!it) return;
    wijzigItem(id, { geometrie, parameters: { ...it.parameters, ...parameters } });
    try { tdRef.current?.updateFeatureGeometry(id, geo.rondGeom(geometrie)); } catch { setTimeout(syncTd, 0); }
  }, [wijzigItem, syncTd]);

  const bewaarAlsElement = useCallback(async (id) => {
    const it = st.current.items.find((x) => x.id === id);
    if (!it) return;
    const naam = await vraagTekst('Naam van het nieuwe bibliotheek-element', it.naam || '');
    if (!naam) return;
    const s = effectieveStijl(it, lagenMap.get(it.laag_id), null);
    const rij = { naam, categorie: 'Eigen', stijl: { kleur: s.kleur, dikte: s.dikte, streep: s.streep, vulkleur: s.vulkleur, vuldekking: s.vuldekking, vulpatroon: s.vulpatroon }, standaardlaag: lagenMap.get(it.laag_id)?.naam || null };
    if (it.geometrie.type === 'Point') rij.tekenwijze = 'punt';
    else if (it.geometrie.type === 'LineString') { rij.tekenwijze = 'lijn'; rij.eenheid_m = null; }
    else {
      rij.tekenwijze = 'schaal';
      if (it.parameters?.breedte) { rij.breedte_m = it.parameters.breedte; rij.diepte_m = it.parameters.diepte; }
      else {
        // Eigen omtrek: hoekpunten in meter t.o.v. het midden.
        const m = geo.middelpunt(it.geometrie);
        const ring = it.geometrie.coordinates[0].slice(0, -1);
        rij.omtrek = ring.map((c) => geo.offsetMeter(m, c).map((v) => geo.rond(v, 2)));
        const xs = rij.omtrek.map((p) => p[0]); const ys = rij.omtrek.map((p) => p[1]);
        rij.breedte_m = geo.rond(Math.max(...xs) - Math.min(...xs), 2);
        rij.diepte_m = geo.rond(Math.max(...ys) - Math.min(...ys), 2);
      }
    }
    const { data, error } = await maps().from('bibliotheek').insert(rij).select().single();
    if (error) { setFout(foutTekst(error)); return; }
    setElementen((e) => [...e, data].sort((a, b) => (a.categorie + a.naam).localeCompare(b.categorie + b.naam)));
    setMelding(`"${naam}" staat in de bibliotheek`);
  }, [lagenMap]);

  // Kabel van de voeding naar dit item, als rechte lijn om daarna bij te werken.
  // alleen: enkel de doelen waarvoor dit waar geeft (het binnenplan tekent zijn eigen kabels binnen).
  const tekenKabel = useCallback((id, { alleen = null } = {}) => {
    if (!heeftModule('stroom')) { setMelding(nietInPakket('stroom')); return; }
    const it = st.current.items.find((x) => x.id === id);
    if (!it) return;
    const sIt = stroomVan(it, st.current.elementen.find((e) => e.id === it.element_id));
    // Eén kabel per aansluiting (een podium met 32 A en 63 A krijgt er twee).
    const doelen = kabelDoelen(it, sIt).filter((d) => !alleen || alleen(d));
    const laag = st.current.lagen.find((l) => /stroom/i.test(l.naam));
    const b = geo.middelpunt(it.geometrie);
    let laatste = null;
    for (const d of doelen) {
      const bron = isVaId(d.voeding) ? (() => { const v = st.current.vast.find((x) => x.id === vaUuid(d.voeding)); return v ? alsStroomItem(v) : null; })() : st.current.items.find((x) => x.id === d.voeding);
      if (!bron) continue;
      const a = geo.middelpunt(bron.geometrie);
      // Kabel volgens de uitgang die deze aansluiting op de kast of bron krijgt; anders volgens ingang of ampère.
      const type = kabelTypeVoor(it, sIt, d, stroomRef.current?.knopen?.get(d.voeding));
      const k = maakItem({
        soort: 'lijn', laag_id: laag?.id ?? st.current.actieveLaag, geometrie: { type: 'LineString', coordinates: [a, b] },
        naam: `Kabel ${bron.naam || 'voeding'} → ${it.naam || 'verbruiker'}${d.label ? ` (${d.label})` : ''}`.slice(0, 80),
        velden: { stroom: { rol: 'kabel', van: bron.id, naar: d.naar, kabeltype: type } }, stijl: { streep: 'streep' },
      });
      tdRef.current?.addFeatures([tdFeature(k)]);
      laatste = k;
    }
    if (!laatste) return;
    setGeselecteerd(laatste.id);
    try { tdRef.current?.selectFeature(laatste.id); } catch {}
    setMelding(doelen.length > 1 ? `${doelen.length} kabels getekend, één per aansluiting. Versleep de tussenpunten om ze langs de juiste weg te leggen.` : 'Kabel getekend. Versleep de tussenpunten om hem langs de juiste weg te leggen.');
  }, [maakItem, tdFeature]);

  // ---------- Groepen en kabels volgen mee ----------
  const volgMee = useCallback((it, dx, dy, { groep = true } = {}) => {
    const s2 = st.current;
    const mee = new Map();
    if (groep && it.groep_id) for (const x of s2.items) if (x.groep_id === it.groep_id && x.id !== it.id) mee.set(x.id, x);
    // Een deur of poort volgt haar lijn vanzelf: niet apart verschuiven als die lijn ook mee gaat.
    for (const x of [...mee.values()]) { const lid = deurLijnId(x); if (lid && (lid === it.id || mee.has(lid))) mee.delete(x.id); }
    for (const x of mee.values()) {
      const geometrie = geo.verschuifGraden(x.geometrie, dx, dy);
      const parameters = x.parameters?.midden ? { ...x.parameters, midden: [x.parameters.midden[0] + dx, x.parameters.midden[1] + dy] } : x.parameters;
      wijzigItem(x.id, { geometrie, parameters });
      try { tdRef.current?.updateFeatureGeometry(x.id, geo.rondGeom(geometrie)); } catch {}
    }
    // Kabels die aan een verplaatst item hangen, volgen met hun uiteinde.
    const verplaatst = new Set([it.id, ...mee.keys()]);
    for (const k of st.current.items) {
      const sk = k.velden?.stroom;
      if (sk?.rol !== 'kabel' || k.geometrie?.type !== 'LineString') continue;
      const c = [...k.geometrie.coordinates];
      let veranderd = false;
      for (const [veld, idx] of [['van', 0], ['naar', c.length - 1]]) {
        const doelId = sk[veld] ? String(sk[veld]).split('#')[0] : null;
        if (doelId && verplaatst.has(doelId)) {
          const doel = st.current.items.find((x) => x.id === doelId);
          if (doel) { c[idx] = geo.middelpunt(doel.geometrie); veranderd = true; }
        }
      }
      if (veranderd) {
        const geometrie = { type: 'LineString', coordinates: c };
        wijzigItem(k.id, { geometrie }, { geschiedenis: false });
        try { tdRef.current?.updateFeatureGeometry(k.id, geo.rondGeom(geometrie)); } catch {}
      }
    }
  }, [wijzigItem]);

  // ---------- Sjablonen: een groep items als geheel bewaren en plaatsen ----------
  const naarOffsets = (g, m) => {
    const f = (c) => geo.offsetMeter(m, c).map((v) => geo.rond(v, 3));
    if (g.type === 'Point') return { type: 'Point', coordinates: f(g.coordinates) };
    if (g.type === 'LineString') return { type: 'LineString', coordinates: g.coordinates.map(f) };
    return { type: 'Polygon', coordinates: g.coordinates.map((r) => r.map(f)) };
  };
  const vanOffsets = (g, m) => {
    const f = ([x, y]) => geo.verschuif({ type: 'Point', coordinates: m }, x, y).coordinates;
    if (g.type === 'Point') return { type: 'Point', coordinates: f(g.coordinates) };
    if (g.type === 'LineString') return { type: 'LineString', coordinates: g.coordinates.map(f) };
    return { type: 'Polygon', coordinates: g.coordinates.map((r) => r.map(f)) };
  };
  const bewaarSjabloon = useCallback(async (ids) => {
    const lijst = st.current.items.filter((x) => ids.includes(x.id));
    if (lijst.length < 1) return;
    const naam = await vraagTekst('Naam van het sjabloon (bv. Standaard finishzone)');
    if (!naam) return;
    const k = geo.kader(lijst.map((x) => x.geometrie));
    const m = [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2];
    const sjabloon = lijst.map((x) => ({
      soort: x.soort, element_id: x.element_id, naam: x.naam, notitie: x.notitie, stijl: x.stijl, velden: x.velden,
      laag: st.current.lagen.find((l) => l.id === x.laag_id)?.naam || null,
      geometrie: naarOffsets(x.geometrie, m),
      parameters: { ...(x.parameters || {}), midden: x.parameters?.midden ? geo.offsetMeter(m, x.parameters.midden) : undefined },
    }));
    const breed = geo.lengte({ type: 'LineString', coordinates: [[k[0], m[1]], [k[2], m[1]]] });
    const diep = geo.lengte({ type: 'LineString', coordinates: [[m[0], k[1]], [m[0], k[3]]] });
    const { data, error } = await maps().from('bibliotheek').insert({ naam, categorie: 'Sjablonen', tekenwijze: 'sjabloon', breedte_m: geo.rond(breed, 1), diepte_m: geo.rond(diep, 1), eigenschappen: { items: sjabloon } }).select().single();
    if (error) { setFout(foutTekst(error)); return; }
    setElementen((e) => [...e, data]);
    setMelding(`Sjabloon "${naam}" met ${lijst.length} items staat in de bibliotheek.`);
  }, []);
  // Kopiëren en plakken (ook naar een ander plan of tabblad: via de browser bewaard).
  const kopieer = useCallback((ids) => {
    const lijst = st.current.items.filter((x) => ids.includes(x.id) && x.geometrie);
    if (!lijst.length) return;
    const k = geo.kader(lijst.map((x) => x.geometrie));
    const m = [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2];
    const items = lijst.map((x) => ({
      id: x.id, soort: x.soort, element_id: x.element_id, naam: x.naam, notitie: x.notitie, stijl: x.stijl, velden: x.velden,
      laag: st.current.lagen.find((l) => l.id === x.laag_id)?.naam || null, groep: x.groep_id || null,
      geometrie: naarOffsets(x.geometrie, m),
      parameters: { ...(x.parameters || {}), midden: x.parameters?.midden ? geo.offsetMeter(m, x.parameters.midden) : undefined },
    }));
    const kb = { items, n: items.length, van: st.current.plan?.naam || '' };
    setKlembord(kb);
    try { localStorage.setItem('fm-klembord', JSON.stringify(kb)); } catch {}
    setMelding(`${items.length} ${items.length === 1 ? 'item' : 'items'} gekopieerd. Plakken met Ctrl V of de knop links bovenaan.`);
  }, []);
  const plakRef = useRef(null);
  plakRef.current = () => {
    if (!klembord?.items?.length || !st.current.schrijven) return;
    const map = mapRef.current;
    const punt = muisPosRef.current && map ? muisPosRef.current : map ? map.getCenter().toArray() : null;
    if (!punt) return;
    const ids = plaatsSjabloon({ naam: 'Plakken', eigenschappen: { items: klembord.items } }, punt, 0, { groepeer: klembord.items.some((t) => t.groep) && klembord.items.every((t) => t.groep === klembord.items[0].groep) });
    setMelding(`${ids.length} ${ids.length === 1 ? 'item' : 'items'} geplakt.`);
    setGereedschap('selecteer');
    setTimeout(() => { const [a, ...r] = ids; try { tdRef.current?.setMode('select'); tdRef.current?.selectFeature(a); } catch {} setExtra(r); setGeselecteerd(a); }, 40);
  };

  const plaatsSjabloon = useCallback((el, punt, rot = 0, { groepeer = true, groepId = null } = {}) => {
    const groep = groepeer ? (groepId || nieuwId()) : null;
    const ids = [];
    // Deuren en poorten in een hekkenlijn: de verwijzingen (lijn ↔ opening) wijzen naar de nieuwe ids.
    const lijst = el.eigenschappen?.items || [];
    const nieuwIds = new Map(lijst.filter((t) => t.id).map((t) => [t.id, nieuwId()]));
    // Eerst de deuren, dan de lijnen: een lijn zonder haar deuren zou de openingen laten vallen.
    const volgorde = [...lijst].sort((a, b) => (b.parameters?.inLijn ? 1 : 0) - (a.parameters?.inLijn ? 1 : 0));
    for (const t of volgorde) {
      const laag = st.current.lagen.find((l) => l.naam === t.laag);
      const parameters = { ...(t.parameters || {}) };
      if (Array.isArray(parameters.midden)) parameters.midden = geo.verschuif({ type: 'Point', coordinates: punt }, parameters.midden[0], parameters.midden[1]).coordinates;
      else delete parameters.midden;
      if (parameters.openingen) { const op = parameters.openingen.filter((o) => o?.id && nieuwIds.has(o.id)).map((o) => ({ ...o, id: nieuwIds.get(o.id) })); if (op.length) parameters.openingen = op; else delete parameters.openingen; }
      if (parameters.inLijn) { const lid = parameters.inLijn.lijn; if (lid && nieuwIds.has(lid)) parameters.inLijn = { lijn: nieuwIds.get(lid) }; else delete parameters.inLijn; }
      let basis = { ...(t.id && nieuwIds.has(t.id) ? { id: nieuwIds.get(t.id) } : {}), soort: t.soort, element_id: t.element_id || null, naam: t.naam, notitie: t.notitie, stijl: t.stijl || {}, velden: t.velden || {}, laag_id: laag?.id ?? st.current.actieveLaag, geometrie: vanOffsets(t.geometrie, punt), parameters, groep_id: groep };
      if (rot) basis = draaiRond(basis, rot, punt, st.current.elementen);
      const it = maakItem(basis);
      if (!groep || st.current.iso) tdRef.current?.addFeatures([tdFeature(it)]);
      ids.push(it.id);
    }
    if (groepeer) setMelding(`${el.naam} geplaatst als groep. Sleep om de hele groep te verplaatsen, draai met het rondje erboven.`);
    return ids;
  }, [maakItem, tdFeature]);

  // ---------- Tekenscherm: een groep precies op een raster tekenen ----------
  // Een bestaande groep komt recht op het raster (de draaiing van het eerste element eruit
  // gehaald) en gaat bij Klaar terug naar dezelfde plek en draaiing.
  const openTekenschermRef = useRef(null);
  const openTekenscherm = useCallback((ids = null, punt = null) => {
    const lijst = ids ? st.current.items.filter((x) => ids.includes(x.id) && x.geometrie) : [];
    if (!lijst.length) {
      const m = punt || mapRef.current?.getCenter().toArray();
      if (m) setTekenscherm({ items: [], groepId: null, ids: [], midden: m, rot: 0 });
      return;
    }
    const k = geo.kader(lijst.map((x) => x.geometrie));
    const m = [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2];
    const rot = Number(lijst.find((x) => x.soort === 'element' && x.parameters?.rot != null)?.parameters.rot) || 0;
    const a = (-rot * Math.PI) / 180;
    const dr = ([x, y]) => [Math.round((x * Math.cos(a) + y * Math.sin(a)) * 1000) / 1000, Math.round((-x * Math.sin(a) + y * Math.cos(a)) * 1000) / 1000];
    const offs = (g) => { const f = (c) => dr(geo.offsetMeter(m, c)); return g.type === 'Point' ? { type: 'Point', coordinates: f(g.coordinates) } : g.type === 'LineString' ? { type: 'LineString', coordinates: g.coordinates.map(f) } : { type: 'Polygon', coordinates: g.coordinates.map((rr) => rr.map(f)) }; };
    const items = lijst.map((x) => {
      const p = { ...(x.parameters || {}) };
      if (Array.isArray(p.midden)) p.midden = dr(geo.offsetMeter(m, p.midden));
      if (p.rot != null || x.soort === 'element' || x.soort === 'rechthoek') p.rot = ((((Number(p.rot) || 0) - rot) % 360) + 360) % 360;
      return { soort: x.soort, element_id: x.element_id, naam: x.naam, notitie: x.notitie, stijl: x.stijl, velden: x.velden, laag: st.current.lagen.find((l) => l.id === x.laag_id)?.naam || null, geometrie: offs(x.geometrie), parameters: p };
    });
    setTekenscherm({ items, groepId: lijst[0].groep_id || null, ids: lijst.map((x) => x.id), midden: m, rot });
  }, []);
  openTekenschermRef.current = openTekenscherm; openBinnenRef.current = openBinnen;
  const tekenschermKlaar = (items) => {
    const t = tekenscherm; setTekenscherm(null);
    if (!t || !items.length) return;
    if (t.ids?.length) verwijderItems(t.ids);
    const nieuw = plaatsSjabloon({ naam: 'Tekening', eigenschappen: { items } }, t.midden, t.rot, { groepeer: items.length > 1, groepId: t.groepId });
    setTimeout(() => { syncTd(); const [a0, ...rest] = nieuw; setGeselecteerd(a0); setExtra(rest); }, 40);
    setMelding(`${items.length} ${items.length === 1 ? 'onderdeel' : 'onderdelen'} uit het tekenscherm ${t.ids?.length ? 'terug op hun plek' : 'op de kaart'}.`);
  };

  // ---------- Meervoudige selectie ----------
  const selectie = useMemo(() => (geselecteerd ? [geselecteerd, ...extra.filter((x) => x !== geselecteerd)] : extra), [geselecteerd, extra]);
  const groepSel = useMemo(() => {
    if (selectie.length < 2) return false;
    const gid = items.find((x) => x.id === selectie[0])?.groep_id;
    return !!gid && selectie.every((id) => items.find((x) => x.id === id)?.groep_id === gid);
  }, [selectie, items]);
  const multiActie = useCallback(async (soort) => {
    const ids = selectie;
    const lijst = st.current.items.filter((x) => ids.includes(x.id));
    if (!lijst.length) return;
    if (soort === 'draai+' || soort === 'draai-') {
      const k = geo.kader(lijst.filter((x) => x.geometrie).map((x) => x.geometrie));
      const c = [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2];
      const ids2 = new Set(lijst.map((x) => x.id));
      for (const x of lijst) if (!vastItem(x) && x.geometrie && !(deurLijnId(x) && ids2.has(deurLijnId(x)))) pasToe(x, draaiRond(x, soort === 'draai+' ? 15 : -15, c, st.current.elementen));
      setTimeout(syncTd, 0);
      return;
    }
    if (soort === 'groeperen') {
      const g = nieuwId();
      // Een groep hoort in één laag: de laag waar de meeste items al in zitten.
      const tel = new Map(); for (const x of lijst) tel.set(x.laag_id, (tel.get(x.laag_id) || 0) + 1);
      const laag = [...tel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? lijst[0]?.laag_id;
      for (const x of lijst) wijzigItem(x.id, x.laag_id === laag ? { groep_id: g } : { groep_id: g, laag_id: laag });
      setTimeout(() => syncTdRef.current?.(), 0);
      setMelding(`${lijst.length} items gegroepeerd.`);
      // Meteen een naam vragen: in de lagenlijst staat de groep als één regel.
      const n = await vraagTekst('Naam van de groep (mag leeg)', '', { titel: 'Groep', ok: 'Bewaren' });
      if (n && n.trim()) { const lijst2 = (st.current.plan?.instellingen?.groepen || []).filter((x) => x.id !== g); lijst2.push({ id: g, naam: n.trim() }); wijzigPlan({ instellingen: { ...(st.current.plan?.instellingen || {}), groepen: lijst2 } }); }
      return;
    }
    if (soort === 'degroeperen') { for (const x of lijst) if (x.groep_id) wijzigItem(x.id, { groep_id: null }); setTimeout(() => syncTdRef.current?.(), 0); setMelding('Groep opgeheven.'); return; }
    if (soort === 'verwijderen') { bevestig(`${lijst.length} items verwijderen?`, { ok: 'Verwijderen', gevaar: true }).then((ja) => { if (ja) { verwijderItems(ids); setExtra([]); } }); return; }
    if (soort === 'sjabloon') { bewaarSjabloon(ids); return; }
    if (soort === 'lijnen-koppelen') {
      // Lijnen tot één lijn aaneenrijgen: telkens het dichtste uiteinde erbij.
      const lijnen = lijst.filter((x) => x.geometrie?.type === 'LineString');
      if (lijnen.length < 2) { setMelding('Selecteer minstens twee lijnen (Shift + klik).'); return; }
      const d = (a, b) => turf.distance(a, b, { units: 'meters' });
      const eerst = lijnen.find((x) => x.id === st.current.geselecteerd) || lijnen[0];
      let c = [...eerst.geometrie.coordinates];
      const rest = lijnen.filter((x) => x.id !== eerst.id);
      while (rest.length) {
        let best = null;
        rest.forEach((l, i) => {
          const lc = l.geometrie.coordinates;
          const opties = [
            [d(c[c.length - 1], lc[0]), 'achter', lc], [d(c[c.length - 1], lc[lc.length - 1]), 'achter', [...lc].reverse()],
            [d(c[0], lc[lc.length - 1]), 'voor', lc], [d(c[0], lc[0]), 'voor', [...lc].reverse()],
          ];
          for (const o of opties) if (!best || o[0] < best.afst) best = { afst: o[0], kant: o[1], lc: o[2], i };
        });
        // Uiteinden die dicht bij elkaar liggen (tot 3 m) worden één punt, in het midden ertussen: geen kort
        // tussenstukje of knik. Verder uit elkaar: een verbindingsstuk.
        if (best.afst < 3) {
          const a = best.kant === 'achter' ? c[c.length - 1] : c[0]; const b = best.kant === 'achter' ? best.lc[0] : best.lc[best.lc.length - 1];
          const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          if (best.kant === 'achter') c = [...c.slice(0, -1), m, ...best.lc.slice(1)];
          else c = [...best.lc.slice(0, -1), m, ...c.slice(1)];
        } else c = best.kant === 'achter' ? [...c, ...best.lc] : [...best.lc, ...c];
        rest.splice(best.i, 1);
      }
      const geometrie = { type: 'LineString', coordinates: c };
      wijzigItem(eerst.id, { geometrie });
      try { tdRef.current?.updateFeatureGeometry(eerst.id, geo.rondGeom(geometrie)); } catch { setTimeout(syncTd, 0); }
      verwijderItems(lijnen.filter((x) => x.id !== eerst.id).map((x) => x.id));
      setExtra([]);
      setTimeout(() => { setGeselecteerd(eerst.id); try { tdRef.current?.selectFeature(eerst.id); } catch {} }, 50);
      setMelding(`${lijnen.length} lijnen gekoppeld tot één lijn van ${geo.getal(geo.lengte(geometrie))} m.`);
      return;
    }
    if (soort === 'dupliceren') { const g = lijst.some((x) => x.groep_id) ? nieuwId() : null; for (const x of lijst) { const k = dupliceer(x.id); if (k && g) wijzigItem(k.id, { groep_id: g }); } return; }
    // Uitlijnen en verdelen op de middelpunten (in graden, klein gebied).
    const mids = lijst.map((x) => ({ x, m: geo.middelpunt(x.geometrie), k: geo.kader([x.geometrie]) }));
    const zet = (x, dx, dy) => {
      if (!dx && !dy) return;
      const geometrie = geo.verschuifGraden(x.geometrie, dx, dy);
      const parameters = x.parameters?.midden ? { ...x.parameters, midden: [x.parameters.midden[0] + dx, x.parameters.midden[1] + dy] } : x.parameters;
      wijzigItem(x.id, { geometrie, parameters });
      try { tdRef.current?.updateFeatureGeometry(x.id, geo.rondGeom(geometrie)); } catch {}
    };
    if (soort === 'links') { const v = Math.min(...mids.map((a) => a.k[0])); mids.forEach((a) => zet(a.x, v - a.k[0], 0)); }
    if (soort === 'rechts') { const v = Math.max(...mids.map((a) => a.k[2])); mids.forEach((a) => zet(a.x, v - a.k[2], 0)); }
    if (soort === 'boven') { const v = Math.max(...mids.map((a) => a.k[3])); mids.forEach((a) => zet(a.x, 0, v - a.k[3])); }
    if (soort === 'onder') { const v = Math.min(...mids.map((a) => a.k[1])); mids.forEach((a) => zet(a.x, 0, v - a.k[1])); }
    if (soort === 'midden-h') { const v = mids.reduce((t, a) => t + a.m[0], 0) / mids.length; mids.forEach((a) => zet(a.x, v - a.m[0], 0)); }
    if (soort === 'midden-v') { const v = mids.reduce((t, a) => t + a.m[1], 0) / mids.length; mids.forEach((a) => zet(a.x, 0, v - a.m[1])); }
    if (soort === 'verdeel-h' && mids.length > 2) {
      const r = [...mids].sort((a, b) => a.m[0] - b.m[0]); const st0 = r[0].m[0]; const stap = (r[r.length - 1].m[0] - st0) / (r.length - 1);
      r.forEach((a, i) => zet(a.x, st0 + i * stap - a.m[0], 0));
    }
    if (soort === 'verdeel-v' && mids.length > 2) {
      const r = [...mids].sort((a, b) => a.m[1] - b.m[1]); const st0 = r[0].m[1]; const stap = (r[r.length - 1].m[1] - st0) / (r.length - 1);
      r.forEach((a, i) => zet(a.x, 0, st0 + i * stap - a.m[1]));
    }
  }, [selectie, wijzigItem, verwijderItems, bewaarSjabloon, dupliceer, syncTd, pasToe]);

  // ---------- Acties vanuit de eigenschappen ----------
  const actie = useCallback(async (soort, arg) => {
    // Een bouwer kan ook een ander item aanspreken (bv. de gekoppelde tent in de tentbouwer): arg._it.
    const it = st.current.items.find((x) => x.id === (arg && typeof arg === 'object' && arg._it ? arg._it : st.current.geselecteerd));
    if (!it) return;
    const herteken = (geometrie, extraPatch = {}) => {
      wijzigItem(it.id, { geometrie, ...extraPatch });
      try { tdRef.current?.updateFeatureGeometry(it.id, geo.rondGeom(geometrie)); } catch { setTimeout(syncTd, 0); }
    };
    const maxV = () => Math.max(0, ...st.current.items.map((x) => Number(x.volgorde) || 0));
    const minV = () => Math.min(0, ...st.current.items.map((x) => Number(x.volgorde) || 0));
    switch (soort) {
      case 'formaat': {
        // Ander formaat van hetzelfde soort (bv. tent 8 m → 10 m breed) zonder opnieuw te plaatsen:
        // midden, draaiing, binnenplan en inrichting blijven. De lengte blijft zo goed mogelijk (aantal travees).
        const nEl = st.current.elementen.find((x) => x.id === arg); const p = it.parameters || {};
        if (!nEl || !p.midden) break;
        const oud = st.current.elementen.find((x) => x.id === it.element_id);
        const per = Number(nEl.breedte_m) || 1; const L = Number(p.breedte) || per;
        const n = Math.max(1, Math.round(L / per)); // zelfde lengte, in travees of modules van het nieuwe formaat
        const b = per * n; const d = Number(nEl.diepte_m) || 1;
        const geometrie = geo.elementVeelhoek(p.midden, b, d, Number(p.rot) || 0, n > 1 ? null : nEl.omtrek);
        const oudB = Number(p.breedte) || 0; const oudD = Number(p.diepte) || 0;
        herteken(geometrie, { element_id: nEl.id, parameters: { ...p, breedte: b, diepte: d, ...(p.aantal != null || n > 1 ? { aantal: n } : {}) }, ...(it.naam && it.naam === oud?.naam ? { naam: nEl.naam } : {}) });
        // Ruimte binnen die de vorige tentmaat volgde: mee naar de nieuwe maat.
        for (const r of st.current.items.filter((x) => x.velden?.binnen?.host === it.id && x.velden?.ruimte)) {
          const ring = r.velden.binnen.lokaal?.geometrie?.coordinates?.[0]; if (!ring) continue;
          const xs = ring.map((q) => q[0]); const ys = ring.map((q) => q[1]);
          const past = Math.abs(Math.max(...xs) - Math.min(...xs) - oudB) < 0.15 && Math.abs(Math.max(...ys) - Math.min(...ys) - oudD) < 0.15;
          if (!past) continue;
          const nr = [[-b / 2, -d / 2], [b / 2, -d / 2], [b / 2, d / 2], [-b / 2, d / 2], [-b / 2, -d / 2]].map((q) => q.map((v) => Math.round(v * 1000) / 1000));
          const ingericht = st.current.items.some((x) => x.velden?.binnen?.host === it.id && !x.velden?.ruimte);
          const T = planTransform(null, null, p.midden, Number(it.velden?.binnenplan?.rot ?? (ingericht ? 0 : p.rot)) || 0); // zelfde stelsel als het binnenplan
          wijzigItem(r.id, { geometrie: { type: 'Polygon', coordinates: [nr.map((q) => T.naarGeo(q))] }, velden: { ...r.velden, binnen: { ...r.velden.binnen, lokaal: { ...r.velden.binnen.lokaal, geometrie: { type: 'Polygon', coordinates: [nr] } } } } });
        }
        setMelding(`Nu ${nEl.naam}${n > 1 ? ` · ${n} travees` : ''}`);
        break;
      }
      case 'draai': {
        const n = draaiItem(it, arg, st.current.elementen);
        if (n !== it) { pasToe(it, n); try { tdRef.current?.updateFeatureGeometry(n.id, geo.rondGeom(n.geometrie)); } catch { setTimeout(syncTd, 0); } }
        break;
      }
      case 'uitlijnen-weg': {
        // Evenwijdig draaien aan de dichtste lijn: getekende lijnen, GRB, DXF-onderlegger of straten.
        const map = mapRef.current;
        const c = it.parameters?.midden || geo.middelpunt(it.geometrie);
        const kand = [];
        for (const x of st.current.items) if (x.id !== it.id && x.geometrie?.type === 'LineString' && !x.verborgen) kand.push(x.geometrie);
        for (const l of grbRef.current || []) kand.push(l);
        for (const l of [...(map?._fmSnaplijnen || []), ...(map?._fmHulplijnen || [])]) kand.push(l);
        try {
          if (map?.getLayer('og-straten-lijn') && map.getLayoutProperty('og-straten-lijn', 'visibility') === 'visible') {
            const pc = map.project(c);
            for (const f of map.queryRenderedFeatures([[pc.x - 150, pc.y - 150], [pc.x + 150, pc.y + 150]], { layers: ['og-straten-lijn'] })) {
              if (f.geometry.type === 'LineString') kand.push(f.geometry);
              else if (f.geometry.type === 'MultiLineString') for (const cc of f.geometry.coordinates) kand.push({ type: 'LineString', coordinates: cc });
            }
          }
        } catch {}
        let best = null;
        for (const l of kand) {
          if (!l?.coordinates || l.coordinates.length < 2) continue;
          try {
            const np = turf.nearestPointOnLine(turf.lineString(l.coordinates), c, { units: 'meters' });
            const d = np.properties.dist;
            if (d > 80 || (best && d >= best.d)) continue;
            const i = Math.min(np.properties.index, l.coordinates.length - 2);
            best = { d, r: turf.bearing(l.coordinates[i], l.coordinates[i + 1]) };
          } catch {}
        }
        if (!best) { setMelding('Geen lijn of weg binnen 80 m gevonden. Zet "Luchtfoto met straten" aan of laad het GRB (Snappen).'); break; }
        // Breedte-as (oost bij draaiing 0) evenwijdig aan de weg; kies de kleinste draai.
        const huidig = Number(it.parameters?.rot) || 0;
        let doel = ((best.r - 90) % 180 + 180) % 180;
        let delta = ((doel - huidig) % 180 + 180) % 180;
        if (delta > 90) delta -= 180;
        const n = draaiItem(it, delta, st.current.elementen);
        if (n !== it) { pasToe(it, n); try { tdRef.current?.updateFeatureGeometry(n.id, geo.rondGeom(n.geometrie)); } catch { setTimeout(syncTd, 0); } }
        setMelding(`Evenwijdig gedraaid aan een lijn op ${geo.getal(best.d, 1)} m (${geo.getal(delta, 1)}°).`);
        break;
      }
      case 'voor': wijzigItem(it.id, { volgorde: maxV() + 1 }); break;
      case 'achter': wijzigItem(it.id, { volgorde: minV() - 1 }); break;
      case 'spiegel-x': case 'spiegel-y': {
        const geometrie = geo.spiegel(it.geometrie, soort === 'spiegel-x' ? 'x' : 'y');
        const p = it.parameters?.rot != null ? { parameters: { ...it.parameters, rot: geo.rond(((soort === 'spiegel-x' ? -it.parameters.rot : 180 - it.parameters.rot) % 360 + 360) % 360, 1) } } : {};
        herteken(geometrie, p); break;
      }
      case 'schaal': herteken(geo.schaal(it.geometrie, arg)); break;
      case 'langs-weg': {
        if (it.geometrie?.type !== 'LineString') break;
        setMelding(`${it.naam || 'Lijn'} wordt langs de weg gelegd…`);
        try {
          const r = await legLangsWeg(it.geometrie.coordinates, arg || 'car');
          // Huidige versie ophalen: intussen kan iemand anders iets gewijzigd hebben.
          if (!st.current.items.find((x) => x.id === it.id)) break;
          herteken({ type: 'LineString', coordinates: r.coords }, { parameters: { ...(it.parameters || {}), route: { profiel: arg || 'car', punten: r.punten } } });
          const km = (m) => (m / 1000).toLocaleString('nl-BE', { maximumFractionDigits: 2 });
          setMelding(`Langs de weg gelegd: ${km(r.L0)} → ${km(r.L1)} km${r.behouden ? ` · ${r.behouden} stuk${r.behouden > 1 ? 'ken' : ''} zoals getekend gelaten (daar zou de route een grote omweg maken)` : ''}. Niet goed? Ctrl Z zet de oude lijn terug.`);
        } catch {
          setMelding('Geen weg gevonden voor deze lijn (of geen verbinding). De lijn is niet gewijzigd.');
        }
        break;
      }
      case 'buffer': {
        const g2 = geo.buffer(geo.buig(it.geometrie, it.parameters?.bogen), arg);
        if (!g2) break;
        const b = maakItem({ soort: 'vlak', laag_id: it.laag_id, geometrie: g2, naam: `Buffer ${arg} m${it.naam ? ` rond ${it.naam}` : ''}`, stijl: { streep: 'streep', vuldekking: 0.08 }, parameters: { bron: it.id, afstand: arg } });
        tdRef.current?.addFeatures([tdFeature(b)]);
        break;
      }
      case 'pathfinder': {
        const ander = st.current.items.find((x) => x.id === arg.ander);
        if (!ander) break;
        const g2 = geo.pathfinder(it.geometrie, ander.geometrie, arg.bewerking);
        if (!g2) { setMelding('Geen resultaat: de vlakken raken elkaar niet.'); break; }
        herteken(g2, { soort: 'vlak', parameters: {} });
        if (arg.bewerking !== 'aftrekken') verwijderItems([ander.id]);
        setGeselecteerd(it.id);
        break;
      }
      case 'cad-versie': {
        const el = st.current.elementen.find((e) => e.id === it.element_id);
        if (el) { setCadVervang(el); setDialoog('cad'); }
        break;
      }
      case 'erbovenop': {
        // Zelfde unit, exact op dezelfde plek, één verdieping hoger (zonder inrichting).
        const v = (Number(it.velden?.verdieping) || 0) + 1;
        const { id: _i, created_at: _c, updated_at: _u, ...rest } = it;
        const { inrichting: _inr, ...velden } = it.velden || {};
        const kopie = maakItem({ ...rest, id: nieuwId(), velden: { ...velden, verdieping: v }, volgorde: st.current.items.length + 1 });
        tdRef.current?.addFeatures([tdFeature(kopie)]);
        setGeselecteerd(kopie.id);
        setVerdFilter((f) => (f != null ? v : f));
        break;
      }
      case 'tent-ernaast': {
        const elOp = (id) => st.current.elementen.find((x) => x.id === id);
        // Tentbouwer: een tweede tent tegen een zijde; op het plan koppelen ze vanzelf.
        const el = elOp(it.element_id); const el2 = elOp(arg?.el) || el; if (!el2) break;
        const r = tentErnaast(it, el, el2, arg.zijde); if (!r) break;
        const nieuw = maakItem({ laag_id: it.laag_id, soort: 'element', element_id: el2.id, geometrie: geo.elementVeelhoek(r.midden, r.breedte, r.diepte, r.rot), parameters: { midden: r.midden, breedte: r.breedte, diepte: r.diepte, rot: r.rot } });
        tdRef.current?.addFeatures([tdFeature(nieuw)]);
        setMelding(`${el2.naam} tegen de ${{ L: 'linkerzijde', R: 'rechterzijde', V: 'voorgevel', A: 'achtergevel' }[arg.zijde]} gezet en gekoppeld.`);
        break;
      }
      case 'tent-vloer': {
        // Vloer in een (gekoppelde) tent: elk lid van een groep heeft zijn eigen vloer.
        wijzigItem(it.id, { velden: { ...(it.velden || {}), vloer: arg?.vloer || null } });
        break;
      }
      case 'unit-plaats': {
        // Containerbouwer: een unit of trap erbij, in dezelfde laag als de unit waarmee je begon.
        const e2 = st.current.elementen.find((x) => x.id === arg?.el); if (!e2 || !arg?.midden) break;
        // Alle units van de opstelling vormen één groep op het plan (samen verschuiven en draaien).
        const gid = it.groep_id || nieuwId(); if (!it.groep_id) wijzigItem(it.id, { groep_id: gid });
        const nieuw = maakItem({ laag_id: it.laag_id, groep_id: gid, soort: 'element', element_id: e2.id, geometrie: geo.elementVeelhoek(arg.midden, arg.breedte, arg.diepte, arg.rot), parameters: { midden: arg.midden, breedte: arg.breedte, diepte: arg.diepte, rot: arg.rot }, velden: arg.verdieping ? { verdieping: arg.verdieping } : {} });
        tdRef.current?.addFeatures([tdFeature(nieuw)]);
        break;
      }
      case 'unit-groep': {
        // Bestaande opstelling: alle aaneengesloten units in één groep zetten.
        const ids = (arg?.ids || []).filter((id) => st.current.items.some((x) => x.id === id));
        if (ids.length < 2) break;
        const gid = st.current.items.find((x) => ids.includes(x.id) && x.groep_id)?.groep_id || nieuwId();
        for (const id of ids) { const x = st.current.items.find((y) => y.id === id); if (x && (x.groep_id !== gid || x.laag_id !== it.laag_id)) wijzigItem(id, { groep_id: gid, laag_id: it.laag_id }); }
        setTimeout(() => syncTdRef.current?.(), 0);
        break;
      }
      case 'unit-wijzig': {
        // Ander type (schakelunit eind/midden) of 180° gedraaid: zelfde midden.
        const e2 = arg?.el ? st.current.elementen.find((x) => x.id === arg.el) : null;
        const p0 = it.parameters || {}; const b = e2 ? Number(e2.breedte_m) || p0.breedte : p0.breedte; const d = e2 ? Number(e2.diepte_m) || p0.diepte : p0.diepte; const rot = arg?.rot != null ? arg.rot : Number(p0.rot) || 0;
        const mid = arg?.midden || p0.midden;
        const velden = arg?.verdieping != null ? (() => { const { verdieping: _v, ...r } = it.velden || {}; return arg.verdieping ? { ...r, verdieping: arg.verdieping } : r; })() : it.velden;
        wijzigItem(it.id, { ...(e2 ? { element_id: e2.id } : {}), geometrie: geo.elementVeelhoek(mid, b, d, rot), parameters: { ...p0, midden: mid, breedte: b, diepte: d, rot }, velden });
        setTimeout(syncTd, 0);
        break;
      }
      case 'unit-weg': {
        // De unit waarop de bouwer open staat: de bouwer verhuist naar een andere unit van de groep.
        verwijderItems([it.id]);
        if (arg?.anker && arg.anker !== it.id) {
          const a = arg.anker; vraagBouwer(a);
          setTimeout(() => { setGeselecteerd(a); try { tdRef.current?.selectFeature(a); } catch {} }, 0);
        }
        break;
      }
      case 'unit-gevel': { wijzigItem(it.id, { velden: { ...(it.velden || {}), gevel: arg?.gevel?.length ? arg.gevel : undefined } }); break; }
      case 'tent-lid': {
        // Tentbouwer: een gekoppelde tent aangepast in dezelfde bouwer.
        if (arg?.tent) wijzigItem(it.id, { velden: { ...(it.velden || {}), tent: arg.tent } });
        break;
      }
      case 'tent-maat': {
        try { if (arg?.el) localStorage.setItem('fm-tent-laatst', arg.el); } catch {}
        // Grondplan van de tentbouwer: tent langer/korter (per travee) of in een andere bestaande breedte; de overkant blijft staan.
        const elOp = (id) => st.current.elementen.find((x) => x.id === id);
        const el = elOp(it.element_id); const A = el && tentAssen(it, el); if (!A || !(arg?.L > 0) || !(arg?.B > 0)) break;
        const el2 = arg.el ? elOp(arg.el) || el : el; const rot = Number(it.parameters?.rot) || 0;
        const midden = A.naarGeo([arg.x0 + arg.L / 2, arg.y0 + arg.B / 2]);
        wijzigItem(it.id, { element_id: el2.id, geometrie: geo.elementVeelhoek(midden, arg.L, arg.B, rot), parameters: { ...it.parameters, midden, breedte: arg.L, diepte: arg.B }, velden: { ...(it.velden || {}), tent: arg.tent || it.velden?.tent } });
        setTimeout(syncTd, 0);
        setMelding(`Tent nu ${String(arg.L).replace('.', ',')} × ${String(arg.B).replace('.', ',')} m.`);
        break;
      }
      case 'tent-plaats': {
        // Grondplan van de tentbouwer: een tent als blok naast de tent gezet (midden in de assen van deze tent).
        const elOp = (id) => st.current.elementen.find((x) => x.id === id);
        const el = elOp(it.element_id); const el2 = elOp(arg?.el); const A = el && tentAssen(it, el); if (!el2 || !A) break;
        const rot = ((Number(it.parameters?.rot) || 0) + (arg.dwars ? 90 : 0)) % 360; const midden = A.naarGeo([Number(arg.x) || 0, Number(arg.y) || 0]);
        const nieuw = maakItem({ laag_id: it.laag_id, soort: 'element', element_id: el2.id, geometrie: geo.elementVeelhoek(midden, arg.L, arg.B, rot), parameters: { midden, breedte: arg.L, diepte: arg.B, rot } });
        tdRef.current?.addFeatures([tdFeature(nieuw)]);
        setMelding(`${el2.naam} (${String(arg.L).replace('.', ',')} × ${String(arg.B).replace('.', ',')} m) naast de tent gezet.`);
        break;
      }
      case 'tent-terras': {
        const elOp = (id) => st.current.elementen.find((x) => x.id === id);
        // Terras als echte vloer op het plan (bv. vlonders), tegen een zijde van de tent; bestaat het al, dan wordt het bijgewerkt.
        const el = elOp(it.element_id); const vEl = elOp(arg?.el); if (!el || !vEl) break;
        const mt = tentMaten(it, el); const langs = arg.zijde === 'L' || arg.zijde === 'R' ? mt.L : mt.B;
        const r = naastTent(it, el, arg.zijde, langs, Number(arg.diepte) || 3); if (!r) break;
        const g = geo.elementVeelhoek(r.midden, r.breedte, r.diepte, r.rot);
        const par = { midden: r.midden, breedte: r.breedte, diepte: r.diepte, rot: r.rot, ...(vEl.eigenschappen?.verspringend_standaard ? { verspringend: true } : {}) };
        const oud = st.current.items.find((x) => x.velden?.tentTerras?.tent === it.id && x.velden.tentTerras.zijde === arg.zijde);
        if (oud) { wijzigItem(oud.id, { element_id: vEl.id, geometrie: g, parameters: par }); setTimeout(syncTd, 0); }
        else { const n = maakItem({ laag_id: it.laag_id, soort: 'element', element_id: vEl.id, geometrie: g, parameters: par, velden: { tentTerras: { tent: it.id, zijde: arg.zijde } } }); tdRef.current?.addFeatures([tdFeature(n)]); }
        setMelding(`Terras van ${vEl.naam} (${String(Number(arg.diepte) || 3).replace('.', ',')} m diep) op het plan gezet.`);
        break;
      }
      case 'licht-alle-aan':
      case 'licht-alle-uit': {
        // Alle lichtmasten op het plan aan of uit (de stand van de spots blijft).
        const aan = soort === 'licht-alle-aan';
        const lm = st.current.items.filter((x) => !x.verborgen && x.element_id && isLichtmast(st.current.elementen.find((e) => e.id === x.element_id)));
        for (const x of lm) if (!!x.velden?.licht?.aan !== aan) wijzigItem(x.id, { velden: { ...(x.velden || {}), licht: { ...(x.velden?.licht || {}), aan } } });
        setMelding(`${lm.length} ${lm.length === 1 ? 'lichtmast' : 'lichtmasten'} ${aan ? 'aan' : 'uit'}.`);
        break;
      }
      case 'licht-richten': {
        // Volgende klik op de kaart = de richting van de spots (bij 180°).
        lichtRichtRef.current = (p) => {
          const m = it.parameters?.midden || (it.geometrie?.type === 'Point' ? it.geometrie.coordinates : null); if (!m) return;
          const dx = (p[0] - m[0]) * 111320 * Math.cos((m[1] * Math.PI) / 180); const dy = (p[1] - m[1]) * 110574;
          const r = Math.round(((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360);
          const v = st.current.items.find((x) => x.id === it.id); if (!v) return;
          wijzigItem(it.id, { velden: { ...(v.velden || {}), licht: { ...(v.velden?.licht || {}), aan: true, modus: '180', richting: r } } });
          // Terug naar Selectie met de lichtmast nog geselecteerd (het zijpaneel blijft open).
          setGereedschap('selecteer');
          setTimeout(() => { setGeselecteerd(it.id); try { tdRef.current?.setMode('select'); tdRef.current?.selectFeature(it.id); } catch {} setMelding(`Spots gericht naar ${r}°.`); }, 40);
        };
        // Eigen modus: de klik selecteert of deselecteert niets op de kaart.
        setGereedschap('lichtricht');
        setTimeout(() => setMelding('Klik op de kaart in de richting waar het licht naartoe moet · Esc = annuleren'), 0);
        break;
      }
      case 'nummeren': {
        // Een reeks = punten in dezelfde laag met hetzelfde icoon (bv. alle toiletten).
        const icoonVan = (x) => effectieveStijl(x, lagenMap.get(x.laag_id), elementenMap.get(x.element_id)).icoon || '';
        const ic = icoonVan(it);
        const punten = st.current.items.filter((x) => x.laag_id === it.laag_id && x.geometrie?.type === 'Point' && x.soort !== 'tekst' && !x.velden?.sign && icoonVan(x) === ic)
          .sort((a, b) => (Number(a.volgorde) || 0) - (Number(b.volgorde) || 0));
        punten.forEach((x, i) => wijzigItem(x.id, { velden: { ...(x.velden || {}), nr: i + 1 } }));
        setMelding(`${punten.length} punten${ic ? ' met hetzelfde icoon' : ' zonder icoon'} genummerd in de volgorde waarin ze getekend zijn.`);
        break;
      }
      case 'stijl-kopieren': {
        const s2 = effectieveStijl(it, lagenMap.get(it.laag_id), elementenMap.get(it.element_id));
        setStijlKlembord(s2); setMelding('Stijl gekopieerd. Selecteer een ander item en kies "Stijl plakken".'); break;
      }
      case 'stijl-plakken': if (stijlKlembord) wijzigItem(it.id, { stijl: { ...stijlKlembord } }); break;
      case 'snelstijl-bewaren': {
        const naam = await vraagTekst('Naam van de snelstijl (bv. Afsluiting Boplan, Zone partners). Iedereen in de organisatie ziet hem.');
        if (!naam?.trim()) break;
        const s2 = effectieveStijl(it, lagenMap.get(it.laag_id), elementenMap.get(it.element_id));
        const SLEUTELS = ['kleur', 'dikte', 'dikte_eenheid', 'streep', 'wit_rand', 'dekking', 'pijl', 'maatlijn', 'vloeiend', 'dubbel', 'vulkleur', 'vuldekking', 'vulpatroon', 'patroon_icoon', 'patroon_tekst', 'patroon_interval'];
        const stijl = Object.fromEntries(SLEUTELS.filter((k) => s2[k] !== undefined && s2[k] !== null).map((k) => [k, s2[k]]));
        const { data, error } = await maps().from('bibliotheek').insert({ naam: naam.trim(), categorie: 'Snelstijlen', tekenwijze: 'stijl', stijl, eigenschappen: { voor: arg || 'lijn' }, actief: true }).select().single();
        if (error) { setFout(foutTekst(error)); break; }
        setSnelstijlen((l) => [...l, data]);
        setMelding(`Snelstijl "${naam.trim()}" bewaard voor de hele organisatie.`);
        break;
      }
      case 'stijl-bewaren': {
        const naam = await vraagTekst('Naam van de stijl (bv. Zonegrens, Partner Ethias)');
        if (!naam) break;
        const s2 = effectieveStijl(it, lagenMap.get(it.laag_id), elementenMap.get(it.element_id));
        const p = st.current.plan;
        const lijst = (p.instellingen?.stijlen || []).filter((x) => x.naam !== naam);
        wijzigPlanRef.current?.({ instellingen: { ...(p.instellingen || {}), stijlen: [...lijst, { naam, stijl: s2 }] } });
        break;
      }
      case 'stijl-toepassen': {
        const x = (st.current.plan.instellingen?.stijlen || []).find((y) => y.naam === arg);
        if (x) wijzigItem(it.id, { stijl: { ...x.stijl } });
        break;
      }
      case 'kopieer-plan': {
        const doel = arg;
        const ids = selectie;
        const lijst = st.current.items.filter((x) => ids.includes(x.id));
        const { data: doelLagen } = await maps().from('lagen').select('*').eq('plan_id', doel);
        const laagVoor = async (laagId) => {
          const bron = st.current.lagen.find((l) => l.id === laagId);
          if (!bron) return null;
          let l = (doelLagen || []).find((x) => x.naam === bron.naam);
          if (!l) {
            const r = await maps().from('lagen').insert({ plan_id: doel, naam: bron.naam, kleur: bron.kleur, stijl: bron.stijl, map: bron.map || null, volgorde: (doelLagen || []).length }).select().single();
            l = r.data; if (l) doelLagen.push(l);
          }
          return l?.id || null;
        };
        const rijen = [];
        for (const x of lijst) {
          const { id, created_at, updated_at, plan_id, fase_ids, ...rest } = x;
          rijen.push({ ...rest, plan_id: doel, laag_id: await laagVoor(x.laag_id), fase_ids: null, geplaatst_op: null, geplaatst_door: null });
        }
        const { error } = await maps().from('items').insert(rijen);
        if (error) setFout(foutTekst(error));
        else setMelding(`${rijen.length} items gekopieerd naar ${anderePlannen.find((x) => x.id === doel)?.naam || 'het andere plan'}.`);
        break;
      }
      default: break;
    }
  }, [wijzigItem, maakItem, tdFeature, verwijderItems, syncTd, lagenMap, elementenMap, stijlKlembord, selectie, anderePlannen, pasToe]);

  // Een tent selecteren: zijn vloerstukken nakijken (laag, fasen, plaats) — herstelt ook oudere plannen.
  useEffect(() => {
    const it = geselecteerd ? st.current.items.find((x) => x.id === geselecteerd) : null;
    if (it?.velden?.tent?.stukken?.length && st.current.schrijven) setTimeout(() => stukSyncRef.current?.(it.id), 0);
  }, [geselecteerd]);
  // Een vloerstuk van een tent is geen los item: selecteren = de tent selecteren.
  useEffect(() => {
    const it = geselecteerd ? st.current.items.find((x) => x.id === geselecteerd) : null; const tid = it?.velden?.tentStuk?.tent;
    if (!tid || !st.current.items.some((x) => x.id === tid)) return;
    try { tdRef.current?.deselectFeature(geselecteerd); } catch {}
    setGeselecteerd(tid); setExtra([]); setTimeout(() => { try { tdRef.current?.selectFeature(tid); } catch {} }, 0);
  }, [geselecteerd]);

  useEffect(() => {
    if (!planId) return undefined; let weg = false;
    const laad = () => maps().from('opmerkingen').select('*').eq('plan_id', planId).not('punt', 'is', null).order('created_at').then(({ data }) => { if (weg || !data) return; setVeldpunten((oud) => { const n = data.filter((o) => o.status === 'open' && !oud.some((x) => x.id === o.id)).length; if (n) setTimeout(() => setMelding(`${n} ${n === 1 ? 'nieuw veldpunt' : 'nieuwe veldpunten'} van het terrein op het plan (oranje). Klik erop om in te tekenen.`), 0); return data; }); });
    laad(); const t = setInterval(laad, 60000); const f = () => laad(); window.addEventListener('focus', f);
    return () => { weg = true; clearInterval(t); window.removeEventListener('focus', f); };
  }, [planId]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !kaartKlaar) return undefined;
    const zet = () => { try { zorgVoorVeldpuntLagen(map); zetVeldpunten(map, veldpunten.filter((o) => o.status === 'open')); } catch { /* stijl nog niet klaar */ } };
    zet(); map.on('styledata', zet);
    const klik = (e) => { if (!map.getLayer('fm-veldpunt')) return; const h = map.queryRenderedFeatures([[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]], { layers: ['fm-veldpunt'] }); if (h[0]?.properties?.id) setVpKeuze({ id: h[0].properties.id, x: e.point.x, y: e.point.y }); };
    map.on('click', klik);
    return () => { map.off('styledata', zet); map.off('click', klik); };
  }, [veldpunten, kaartKlaar]);
  const vpAfhandelen = async (o, status = 'opgelost') => { const { error } = await maps().from('opmerkingen').update({ status }).eq('id', o.id); if (!error) setVeldpunten((l) => l.map((x) => (x.id === o.id ? { ...x, status } : x))); setVpKeuze(null); };
  const vpIntekenen = (o) => {
    // Als punt op het plan, in de actieve laag, met de tekst als naam; daarna afgehandeld.
    const it = maakItem({ soort: 'punt', naam: String(o.tekst || '').slice(0, 120), notitie: `Veldpunt van ${o.auteur_naam || 'een collega'} (${new Date(o.created_at).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })})`, geometrie: { type: 'Point', coordinates: o.punt } });
    tdRef.current?.addFeatures([tdFeature(it)]); vpAfhandelen(o); setGeselecteerd(it.id);
    setMelding('Veldpunt ingetekend als punt. Kies er een icoon of element voor in het eigenschappenpaneel.');
  };

  // Andere plannen (kopiëren), foto's van het gekozen item.
  useEffect(() => {
    maps().from('plannen').select('id, naam, editie_naam').neq('id', planId).is('verwijderd_op', null).order('updated_at', { ascending: false }).limit(100)
      .then(({ data }) => setAnderePlannen((data || []).map((x) => ({ id: x.id, naam: [x.editie_naam, x.naam].filter(Boolean).join(' · ') }))));
  }, [planId]);
  useEffect(() => {
    setFotos([]);
    if (!geselecteerd) return;
    maps().from('bestanden').select('pad').eq('item_id', geselecteerd).eq('soort', 'foto').then(({ data }) => {
      setFotos((data || []).map((f) => ({ pad: f.pad, url: publiekeUrl(f.pad) })));
    });
  }, [geselecteerd]);

  // Shift ingedrukt (meervoudige selectie).
  useEffect(() => {
    // De muisklik zelf beslist: zo blijft Shift nooit 'hangen' (bv. na een hoofdletter in een veld of Alt-Tab).
    const neer = (e) => { if (e.key === 'Shift') shiftRef.current = true; };
    const op = (e) => { if (e.key === 'Shift') shiftRef.current = false; };
    const klik = (e) => { shiftRef.current = !!e.shiftKey; };
    const weg = () => { shiftRef.current = false; };
    window.addEventListener('keydown', neer); window.addEventListener('keyup', op);
    window.addEventListener('pointerdown', klik, true); window.addEventListener('blur', weg);
    return () => {
      window.removeEventListener('keydown', neer); window.removeEventListener('keyup', op);
      window.removeEventListener('pointerdown', klik, true); window.removeEventListener('blur', weg);
    };
  }, []);

  // Extra selectie zichtbaar maken.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    const f = items.filter((x) => extra.includes(x.id) && x.geometrie).map((x) => ({ type: 'Feature', geometry: x.geometrie.type === 'Point' ? x.geometrie : { type: 'LineString', coordinates: ((g) => (g.type === 'LineString' ? g.coordinates : g.coordinates[0]))(geo.buig(x.geometrie, x.parameters?.bogen)) }, properties: { p: x.geometrie.type === 'Point' } }));
    const data = { type: 'FeatureCollection', features: f };
    if (map.getSource('fm-selectie')) map.getSource('fm-selectie').setData(data);
    else {
      map.addSource('fm-selectie', { type: 'geojson', data });
      map.addLayer({ id: 'fm-selectie-l', type: 'line', source: 'fm-selectie', filter: ['!', ['get', 'p']], paint: { 'line-color': '#1d1d1b', 'line-width': 2, 'line-dasharray': [2, 1.5] } });
      map.addLayer({ id: 'fm-selectie-p', type: 'circle', source: 'fm-selectie', filter: ['get', 'p'], paint: { 'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#1d1d1b', 'circle-stroke-width': 2 } });
    }
  }, [extra, items, kaartKlaar]);

  // ---------- Vaste aansluitingen: register van stroomkasten over alle evenementen ----------
  // Bewaarde kaarttegels (ook voor exports): de service worker van Toolen Maps.
  useEffect(() => { try { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/maps-sw.js', { scope: '/maps/' }).catch(() => {}); } catch {} }, []);
  useEffect(() => { laadVasteAansluitingen().then(setVast).catch((e) => console.warn('vaste aansluitingen', e)); }, []);
  const vastBewaard = useCallback((rij, weg = false) => {
    setVast((l) => (weg ? l.filter((x) => x.id !== rij.id) : l.some((x) => x.id === rij.id) ? l.map((x) => (x.id === rij.id ? rij : x)) : [...l, rij]));
    setVastSel(weg ? null : rij);
    // Omgezet plaatsfiche-item: verbergen (niet verwijderen), zodat het niet dubbel op de kaart staat.
    if (!weg && rij.bron_item_id && st.current.plekItems.some((x) => x.id === rij.bron_item_id)) {
      maps().from('items').update({ verborgen: true }).eq('id', rij.bron_item_id).then(() => setPlekItems((l) => l.filter((x) => x.id !== rij.bron_item_id)));
    }
    setMelding(weg ? `"${rij.naam}" uit het register gehaald.` : `"${rij.naam}" bewaard in het register van vaste aansluitingen.`);
  }, []);
  const kiesVa = useCallback((v) => {
    if (!v) return;
    if (st.current.geselecteerd) { try { tdRef.current?.deselectFeature(st.current.geselecteerd); } catch {} setGeselecteerd(null); setExtra([]); }
    setVastSel(v);
    const map = mapRef.current;
    if (map && v.geometrie) { const c = v.geometrie.coordinates; const b = map.getBounds(); if (!b.contains(c)) map.easeTo({ center: c, zoom: Math.max(map.getZoom(), 17) }); }
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return undefined;
    zorgVoorVaIconen(map);
    const data = naarGeojsonVa([...vast, ...(vastSel && !vastSel.id ? [{ ...vastSel, id: 'nieuw', naam: vastSel.naam || 'Nieuw', soort: vastSel.soort || 'straatkast' }] : [])], { gekozen: vastSel?.id || (vastSel ? 'nieuw' : null) });
    if (map.getSource('fm-va')) map.getSource('fm-va').setData(data);
    else {
      map.addSource('fm-va', { type: 'geojson', data });
      for (const l of vaKaartLagen()) map.addLayer(l);
    }
    const tel = () => { const b = map.getBounds(); const n = new Set(vast.filter((v) => v.geometrie && b.contains(v.geometrie.coordinates)).map((v) => v.id)); setVastInBeeld((o) => (o.size === n.size && [...n].every((id) => o.has(id)) ? o : n)); };
    tel();
    map.on('moveend', tel);
    return () => map.off('moveend', tel);
  }, [vast, vastSel, kaartKlaar]);
  // Klik op een vaste aansluiting, of met het gereedschap "Vaste aansluiting" een nieuwe zetten.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return undefined;
    const klik = (e) => {
      const s0 = st.current;
      if (s0.gereedschap === 'vast' && s0.schrijven) {
        setVastSel({ geometrie: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] }, soort: 'straatkast', beheerder: 'stad' });
        if (!s0.vasthouden) setGereedschap('selecteer');
        return;
      }
      if (!['selecteer', 'hand'].includes(s0.gereedschap) || !map.getLayer('fm-va')) return;
      const hit = map.queryRenderedFeatures(e.point, { layers: ['fm-va'] })[0]?.properties;
      if (hit?.id && hit.id !== 'nieuw') { const v = s0.vast.find((x) => x.id === hit.id); if (v) { e.preventDefault?.(); kiesVa(v); } }
    };
    const zweef = (e) => { if (st.current.gereedschap === 'vast') return; const hit = map.getLayer('fm-va') && map.queryRenderedFeatures(e.point, { layers: ['fm-va'] }).length; zetCursor(map, 'va', hit ? 'pointer' : ''); };
    map.on('click', klik); map.on('mousemove', zweef);
    return () => { map.off('click', klik); map.off('mousemove', zweef); };
  }, [kaartKlaar, kiesVa]);
  useEffect(() => { if (geselecteerd && vastSel) setVastSel(null); }, [geselecteerd]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const map = mapRef.current; if (map && kaartKlaar) zetCursor(map, 'vast', gereedschap === 'vast' ? 'crosshair' : ''); }, [gereedschap, kaartKlaar]);

  // ---------- Kabel-gereedschap: klik de bron of kast, dan de verbruiker ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return undefined;
    const LAGEN = ['fm-punt', 'fm-punt-icoon', 'fm-vulling', 'fm-patroon', 'fm-lijn-vol', 'fm-lijn-streep', 'fm-lijn-stip', 'fm-stuk-vulling', 'fm-stuk-lijn-vol', 'fm-vloer', 'fm-vloer-lijn'];
    const klik = (e) => {
      const s0 = st.current;
      if (s0.gereedschap !== 'kabel' || !s0.schrijven) return;
      let doel = null;
      if (map.getLayer('fm-va')) { const h = map.queryRenderedFeatures(e.point, { layers: ['fm-va'] })[0]?.properties?.id; if (h && h !== 'nieuw') doel = { id: vaId({ id: h }), rol: 'bron', naam: s0.vast.find((x) => x.id === h)?.naam }; }
      if (!doel) {
        const pt = e.point;
        const hits = map.queryRenderedFeatures([[pt.x - 6, pt.y - 6], [pt.x + 6, pt.y + 6]], { layers: LAGEN.filter((l) => map.getLayer(l)) }).map((f) => f.properties?.id).filter(Boolean);
        for (const id of hits) { const it = s0.items.find((x) => x.id === id); const sv = it && stroomVan(it, elementenMap.get(it.element_id)); if (sv?.rol && sv.rol !== 'kabel') { doel = { id: it.id, rol: sv.rol, naam: it.naam || elementenMap.get(it.element_id)?.naam, item: it, sv }; break; } }
      }
      if (!doel) { setMelding(kabelVanRef.current ? 'Klik een kast of verbruiker (tent, podium …) om de kabel te eindigen.' : 'Klik een bron, kast of vaste aansluiting om de kabel te starten.'); return; }
      const van = kabelVanRef.current;
      if (!van) {
        if (!['bron', 'kast'].includes(doel.rol)) { setMelding('Begin bij een bron, kast of vaste aansluiting.'); return; }
        kabelVanRef.current = doel; setMelding(`Kabel vanaf ${doel.naam || 'de bron'}: klik nu de verbruiker of kast.`); return;
      }
      if (doel.id === van.id) return;
      if (!['kast', 'verbruiker'].includes(doel.rol)) { setMelding('Eindig bij een kast of verbruiker.'); return; }
      // Voeding koppelen (bij meerdere aansluitingen: de eerste zonder voeding), dan de kabel tekenen.
      const it = doel.item; const sv = doel.sv;
      const { stroom, welke } = koppelVoeding(it, sv, van.id);
      wijzigItem(it.id, { velden: { ...(it.velden || {}), stroom } });
      // Even wachten tot de berekening de uitgang van de kast heeft toegewezen, dan de kabel in het juiste type.
      setTimeout(() => { tekenKabel(it.id); if (welke) setMelding((m) => `${doel.naam || 'Verbruiker'}${welke} aangesloten op ${van.naam || 'de bron'}. ${m || ''}`.trim()); }, 60);
      kabelVanRef.current = null;
      if (!s0.vasthouden) setGereedschap('selecteer');
    };
    map.on('click', klik);
    return () => map.off('click', klik);
  }, [kaartKlaar, elementenMap, wijzigItem]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Plaatsfiche: vaste kennis van de locatie ----------
  useEffect(() => {
    if (!plan?.plek_id) { setPlekItems([]); return; }
    maps().from('items').select('*').eq('plek_id', plan.plek_id).is('plan_id', null).eq('verborgen', false).then(({ data }) => setPlekItems(data || []));
  }, [plan?.plek_id]);
  const naarPlaatsfiche = useCallback(async (id) => {
    const p = st.current.plan;
    const it = st.current.items.find((x) => x.id === id);
    if (!it || !p.plek_id) return;
    const { error } = await maps().from('items').update({ plan_id: null, plek_id: p.plek_id, laag_id: null, fase_ids: null }).eq('id', id);
    if (error) { setFout(foutTekst(error)); return; }
    bewaarder.current.vergeet([id]);
    setItems((l) => { const n = l.filter((x) => x.id !== id); st.current.items = n; return n; });
    setPlekItems((l) => [...l, { ...it, plan_id: null, plek_id: p.plek_id, laag_id: null }]);
    setGeselecteerd(null);
    setTimeout(syncTd, 0);
  }, [syncTd]);
  const naarVast = useCallback((pi) => {
    const el = pi.element_id ? elementenMap.get(pi.element_id) : null;
    kiesVa(uitPlekItem(pi, el, geo.middelpunt(pi.geometrie)));
  }, [elementenMap, kiesVa]);
  const uitPlaatsfiche = useCallback(async (pi) => {
    const { id, created_at, updated_at, plek_id, ...rest } = pi;
    const it = maakItem({ ...rest, id: undefined, plan_id: st.current.plan.id, laag_id: st.current.actieveLaag });
    tdRef.current?.addFeatures([tdFeature(it)]);
  }, [maakItem, tdFeature]);

  // ---------- GRB laden om op te snappen (Vlaanderen) ----------
  const laadGrb = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getZoom() < 16.5) { setMelding('Zoom verder in (straatniveau) om het GRB te laden.'); return; }
    const b = map.getBounds();
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(',');
    setMelding('GRB laden…');
    try {
      const haal = async (laag) => {
        const url = `https://geo.api.vlaanderen.be/GRB/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=${laag}&outputFormat=application/json&srsName=urn:ogc:def:crs:OGC:1.3:CRS84&count=3000&bbox=${bbox},urn:ogc:def:crs:OGC:1.3:CRS84`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`GRB ${r.status}`);
        return (await r.json()).features || [];
      };
      const [gbg, wbn] = await Promise.all([haal('GRB:GBG'), haal('GRB:WBN')]);
      const lijnen = [];
      for (const f of [...gbg, ...wbn]) {
        const g = f.geometry;
        if (!g) continue;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const p of polys) for (const ring of p) lijnen.push({ type: 'LineString', coordinates: ring.map(([x, y]) => [x, y]) });
      }
      grbRef.current = lijnen;
      const data = { type: 'FeatureCollection', features: lijnen.map((g) => ({ type: 'Feature', geometry: g, properties: {} })) };
      if (map.getSource('fm-grb')) map.getSource('fm-grb').setData(data);
      else {
        map.addSource('fm-grb', { type: 'geojson', data });
        map.addLayer({ id: 'fm-grb', type: 'line', source: 'fm-grb', paint: { 'line-color': '#0EA5E9', 'line-width': 1, 'line-opacity': 0.8 } }, map.getLayer('fm-vloer') ? 'fm-vloer' : map.getLayer('fm-vulling') ? 'fm-vulling' : undefined);
      }
      setSnap((s) => ({ ...s, grb: true }));
      setMelding(`GRB geladen: ${gbg.length} gebouwen en ${wbn.length} wegbanen. Tekenen snapt nu op hun hoeken en randen.`);
    } catch (e) {
      setMelding('');
      setFout(`Het GRB kon niet geladen worden (${e?.message || e}). Buiten Vlaanderen is er geen GRB.`);
    }
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer('fm-grb')) map.setLayoutProperty('fm-grb', 'visibility', snap.grb ? 'visible' : 'none');
  }, [snap.grb]);

  // ---------- Draaigreep boven het geselecteerde item ----------
  const greepRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    const teken = () => {
      // Tijdens het slepen van een bocht tekent slimSlepen het bolletje zelf (het volgt de cursor).
      if (map._fmBochtSleep) return;
      const it = st.current.items.find((x) => x.id === st.current.geselecteerd);
      const f = [];
      greepRef.current = null;
      const sel = selectieRef.current;
      if (schrijven && sel.length > 1) {
        // Selectie of groep: greep boven het midden van het geheel.
        const lijst = st.current.items.filter((x) => sel.includes(x.id) && x.geometrie && !vastItem(x));
        const k = lijst.length ? geo.kader(lijst.map((x) => x.geometrie)) : null;
        if (k) {
          // Greep haaks op de lange as van het geheel (zoals bij één item), net buiten de rand:
          // bij een schuin liggende groep staat ze dan naast de groep in plaats van ergens boven het kader.
          const pts = []; const extraVan = (x) => (x.velden?.stelling ? stellingPunten(x) : []);
          for (const x of lijst) {
            const g = x.geometrie; const cs = g.type === 'Point' ? [g.coordinates] : g.type === 'LineString' ? g.coordinates : g.coordinates[0];
            for (const q of [...cs, ...extraVan(x)]) { pts.push(map.project(q)); if (pts.length > 4000) break; }
          }
          const mx = pts.reduce((a2, q) => a2 + q.x, 0) / pts.length; const my = pts.reduce((a2, q) => a2 + q.y, 0) / pts.length;
          let sxx = 0; let syy = 0; let sxy = 0;
          for (const q of pts) { sxx += (q.x - mx) ** 2; syy += (q.y - my) ** 2; sxy += (q.x - mx) * (q.y - my); }
          let as = 0.5 * Math.atan2(2 * sxy, sxx - syy); // lange as
          // Liggen alle items in dezelfde richting (bv. tenten die tegen elkaar staan): het kader volgt die richting.
          { const rots = lijst.map((x) => (x.parameters?.midden && x.parameters?.rot != null ? Number(x.parameters.rot) || 0 : null));
            if (rots.every((q) => q != null) && rots.every((q) => { const d = (((q - rots[0]) % 90) + 90) % 90; return d < 1 || d > 89; })) {
              const c0 = lijst[0].parameters.midden; const t0 = turf.destination(c0, 0.01, 90 + rots[0], { units: 'kilometers' }).geometry.coordinates;
              const pa = map.project(c0); const pb = map.project(t0); as = Math.atan2(pb.y - pa.y, pb.x - pa.x);
            } }
          let nx = -Math.sin(as); let ny = Math.cos(as); // haaks erop
          if (ny > 0) { nx = -nx; ny = -ny; } // naar boven op het scherm
          if (Math.abs(sxx - syy) < 1e-6 && Math.abs(sxy) < 1e-6) { nx = 0; ny = -1; }
          let rand = 0; for (const q of pts) rand = Math.max(rand, (q.x - mx) * nx + (q.y - my) * ny);
          const cm = map.unproject([mx, my]); const c = [cm.lng, cm.lat];
          const a = map.unproject([mx + nx * rand, my + ny * rand]);
          const b = map.unproject([mx + nx * (rand + 26), my + ny * (rand + 26)]);
          const p2 = [b.lng, b.lat];
          greepRef.current = { multi: true, punt: p2, centrum: c };
          f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], p2] }, properties: {} });
          f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p2 }, properties: {} });
          // Kader langs de lange as met grepen op hoeken en zijden: het geheel groter of kleiner maken
          // (bv. evenwijdige hekken allemaal tegelijk korter).
          {
            const q2 = map.unproject([mx + Math.cos(as) * 100, my + Math.sin(as) * 100]);
            const B = turf.bearing(c, [q2.lng, q2.lat]);
            const kk = kaderVan(lijst, c, B, extraVan); const S = stelsel(c, B);
            const du = kk.u1 - kk.u0; const dv = kk.v1 - kk.v0;
            if (du > 0.3 || dv > 0.3) {
              const ring = [[kk.u0, kk.v0], [kk.u1, kk.v0], [kk.u1, kk.v1], [kk.u0, kk.v1], [kk.u0, kk.v0]].map(S.van);
              f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: ring }, properties: { kader: true } });
              const grepen = [];
              for (const su of [-1, 0, 1]) for (const sv of [-1, 0, 1]) {
                if (!su && !sv) continue;
                if ((su && du <= 0.3) || (sv && dv <= 0.3)) continue;
                if (su && sv && (du <= 0.3 || dv <= 0.3)) continue;
                const u = su < 0 ? kk.u0 : su > 0 ? kk.u1 : (kk.u0 + kk.u1) / 2; const v = sv < 0 ? kk.v0 : sv > 0 ? kk.v1 : (kk.v0 + kk.v1) / 2;
                const punt = S.van([u, v]); grepen.push({ su, sv, punt });
                f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: punt }, properties: { maat: true } });
              }
              greepRef.current.schaal = { c, B, k: kk, grepen };
            }
          }
        }
      } else if (it && schrijven && !vastItem(it) && it.geometrie && it.geometrie.type !== 'Point' && !it.parameters?.route && !['notitie', 'afstand'].includes(it.soort)) {
        const p = it.parameters || {};
        let c = p.midden && it.soort !== 'sector' ? p.midden : geo.middelpunt(it.geometrie);
        // Richting "boven" van het item zelf: die draait mee met het item.
        let hoek = it.soort === 'sector' ? Number(p.richting) || 0 : Number(p.rot) || 0;
        // Afstand tot de rand in die richting: grootste projectie van de hoekpunten.
        const voet = it.velden?.stelling ? stellingPunten(it) : [];
        // Stelling (bv. een rennersbrug): het kader rond de hele constructie; draaien gebeurt rond het midden van
        // dat kader, niet rond de ankerlijn aan de rand.
        let stelKader = null;
        if (voet.length && it.geometrie.type === 'LineString' && it.geometrie.coordinates.length > 1) {
          const lc = it.geometrie.coordinates; const B = turf.bearing(lc[0], lc[1]);
          const kk = kaderVan([it], c, B, () => voet); const S = stelsel(c, B);
          stelKader = { ring: [[kk.u0, kk.v0], [kk.u1, kk.v0], [kk.u1, kk.v1], [kk.u0, kk.v1], [kk.u0, kk.v0]].map(S.van), midden: S.van([(kk.u0 + kk.u1) / 2, (kk.v0 + kk.v1) / 2]) };
          // De draaigreep staat aan de kant van de constructie, haaks op de ankerlijn: hij draait mee.
          hoek = turf.distance(c, stelKader.midden, { units: 'meters' }) > 0.5 ? turf.bearing(c, stelKader.midden) : B - 90;
          c = stelKader.midden;
        }
        const pc = map.project(c);
        const ring = [...(it.geometrie.type === 'LineString' ? it.geometrie.coordinates : it.geometrie.coordinates[0]), ...voet];
        const rad = (hoek * Math.PI) / 180;
        const ux = Math.sin(rad); const uy = -Math.cos(rad);
        let rand = 0;
        for (const q of ring) { const pq = map.project(q); rand = Math.max(rand, (pq.x - pc.x) * ux + (pq.y - pc.y) * uy); }
        const a = map.unproject([pc.x + ux * rand, pc.y + uy * rand]);
        const b = map.unproject([pc.x + ux * (rand + 26), pc.y + uy * (rand + 26)]);
        const p2 = [b.lng, b.lat];
        greepRef.current = { id: it.id, punt: p2, centrum: c, rond: !!stelKader };
        f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], p2] }, properties: {} });
        f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p2 }, properties: {} });
        if (stelKader) f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: stelKader.ring }, properties: { kader: true } });
        // Gebogen lijn of vlak: de selectielijn volgt de bochten (die van Terra Draw blijft recht en is dan verborgen).
        if ((it.geometrie.type === 'LineString' || it.geometrie.type === 'Polygon') && Object.values(p.bogen || {}).some((h) => Number(h))) {
          const gb = geo.buig(it.geometrie, p.bogen);
          f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: gb.type === 'Polygon' ? gb.coordinates[0] : gb.coordinates }, properties: { sel: true } });
        }
        // Verder tekenen: een '+' net voorbij elk uiteinde van een lijn.
        if (it.geometrie.type === 'LineString' && !p.route && !stelKader && !(it.groep_id && !st.current.iso) && !['notitie', 'afstand', 'maatlijn'].includes(it.soort) && it.geometrie.coordinates.length >= 2) {
          const c = it.geometrie.coordinates;
          greepRef.current.einden = [];
          for (const [kant, e0, e1] of [['begin', c[0], c[1]], ['einde', c[c.length - 1], c[c.length - 2]]]) {
            const pa = map.project(e0); const pb = map.project(e1);
            const l = Math.hypot(pa.x - pb.x, pa.y - pb.y) || 1;
            const q = map.unproject([pa.x + ((pa.x - pb.x) / l) * 26, pa.y + ((pa.y - pb.y) / l) * 26]);
            const punt = [q.lng, q.lat];
            greepRef.current.einden.push({ kant, punt });
            f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: punt }, properties: { verder: true } });
          }
        }
        // Bochtgrepen: één per stuk van een lijn of vlak, om het krom te trekken.
        if (!p.midden && !p.route && !stelKader && (it.geometrie.type === 'LineString' || it.geometrie.type === 'Polygon') && !['notitie', 'afstand', 'cirkel', 'ellips', 'sector', 'veelhoek'].includes(it.soort)) {
          const c = it.geometrie.type === 'Polygon' ? it.geometrie.coordinates[0] : it.geometrie.coordinates;
          {
            // Ook bij lange lijnen (bv. een geïmporteerd parcours): enkel de stukken die in beeld en lang genoeg zijn.
            greepRef.current.bochten = [];
            const cv = map.getCanvas(); const W = cv.clientWidth; const H = cv.clientHeight;
            for (let k = 0; k < c.length - 1 && greepRef.current.bochten.length < 200; k++) {
              const a = c[k]; const b2 = c[k + 1];
              const pa = map.project(a); const pb = map.project(b2);
              const lpx = Math.hypot(pb.x - pa.x, pb.y - pa.y);
              if (lpx < 34) continue;
              const mx = (pa.x + pb.x) / 2; const my = (pa.y + pb.y) / 2;
              if (mx < -20 || my < -20 || mx > W + 20 || my > H + 20) continue;
              const h = Number(p.bogen?.[k]) || 0;
              let punt;
              if (h) punt = geo.boogTop(a, b2, h);
              else { const nx = -(pb.y - pa.y) / lpx; const ny = (pb.x - pa.x) / lpx; const q = map.unproject([(pa.x + pb.x) / 2 + nx * 14, (pa.y + pb.y) / 2 + ny * 14]); punt = [q.lng, q.lat]; }
              greepRef.current.bochten.push({ k, a, b: b2, punt });
              f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: punt }, properties: { bocht: true, gebogen: !!h } });
            }
          }
        }
        // Maatgrepen op hoeken en zijden van rechthoeken en ellipsen.
        const bd = maatVan(it, elementenMap.get(it.element_id));
        if (bd) {
          greepRef.current.maat = [];
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const q = lokaalNaarKaart(p.midden, Number(p.rot) || 0, (sx * bd.b) / 2, (sy * bd.d) / 2);
            greepRef.current.maat.push({ sx, sy, punt: q });
            f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: q }, properties: { maat: true } });
          }
        }
      }
      const data = { type: 'FeatureCollection', features: f };
      if (map.getSource('fm-greep')) map.getSource('fm-greep').setData(data);
      else {
        map.addSource('fm-greep', { type: 'geojson', data });
        map.addLayer({ id: 'fm-greep-k', type: 'line', source: 'fm-greep', filter: ['has', 'kader'], paint: { 'line-color': '#2563EB', 'line-width': 1.2, 'line-dasharray': [3, 2] } });
        map.addLayer({ id: 'fm-greep-l', type: 'line', source: 'fm-greep', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!', ['has', 'kader']]], paint: { 'line-color': '#1d1d1b', 'line-width': ['case', ['has', 'sel'], 2, 1], 'line-opacity': ['case', ['has', 'sel'], 0.6, 1] } });
        map.addLayer({ id: 'fm-greep-p', type: 'circle', source: 'fm-greep', filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 'maat']], ['!', ['has', 'bocht']], ['!', ['has', 'verder']]], paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#1d1d1b', 'circle-stroke-width': 2 } });
        map.addLayer({ id: 'fm-greep-b', type: 'circle', source: 'fm-greep', filter: ['has', 'bocht'], paint: { 'circle-radius': 4.5, 'circle-color': ['case', ['get', 'gebogen'], '#7C3AED', '#ffffff'], 'circle-stroke-color': '#7C3AED', 'circle-stroke-width': 1.8 } });
        map.addLayer({ id: 'fm-greep-v', type: 'circle', source: 'fm-greep', filter: ['has', 'verder'], paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-color': '#16A34A', 'circle-stroke-width': 1.8 } });
        map.addLayer({ id: 'fm-greep-vt', type: 'symbol', source: 'fm-greep', filter: ['has', 'verder'], layout: { 'text-field': '+', 'text-size': 13, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#16A34A' } });
        map.addLayer({ id: 'fm-greep-m', type: 'circle', source: 'fm-greep', filter: ['has', 'maat'], paint: { 'circle-radius': 4.5, 'circle-color': '#ffffff', 'circle-stroke-color': '#2563EB', 'circle-stroke-width': 2 } });
      }
    };
    teken();
    // Grepen volgen de kaart ook tijdens het zoomen en schuiven (niet pas achteraf).
    let rf = 0;
    const volg = () => { cancelAnimationFrame(rf); rf = requestAnimationFrame(teken); };
    map.on('zoom', volg);
    map.on('move', volg);
    return () => { cancelAnimationFrame(rf); map.off('zoom', volg); map.off('move', volg); };
  }, [geselecteerd, items, extra, kaartKlaar, schrijven]);

  // ---------- Branding-penseel: ontwerp op hekken, totemzijden of vlaggen verven ----------
  const laatstePenseel = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar || !brandPenseel) { setPenseelTip(null); return undefined; }
    zetCursor(map, 'penseel', 'cell');
    try { tdRef.current?.setMode('static'); } catch {}
    let bezig = null; // { voor: Map(id -> item), nu: Map(id -> item) }
    const zoek = (e) => trefferBij({ items: st.current.items, elementenMap, lngLat: [e.lngLat.lng, e.lngLat.lat], punt: e.point, project: (c) => map.project(c), drager: brandPenseel.drager });
    const naam = (id) => (id ? elementenMap.get(id)?.naam || '?' : null);
    const verf = (h) => {
      const it = (bezig && bezig.nu.get(h.it.id)) || h.it;
      const na = zetOntwerp(it, h.el, h.plek, brandPenseel.id, h.opHek);
      if (na === it) return;
      if (bezig) { if (!bezig.voor.has(it.id)) bezig.voor.set(it.id, h.it); bezig.nu.set(it.id, na); }
      setItems((oud) => { const m = oud.map((x) => (x.id === na.id ? na : x)); st.current.items = m; return m; });
    };
    const tip = (e, h) => {
      if (!h) { setPenseelTip(null); return; }
      const nu = (bezig && bezig.nu.get(h.it.id)) || h.it;
      const huidig = huidigOntwerp(nu, h);
      const kop = `${nu.naam || h.el.naam} · ${plekNaam(h.drager, h.plek, h.opHek)}`;
      const wat = huidig ? naam(huidig) : 'nog leeg';
      const doe = brandPenseel.id ? (huidig === brandPenseel.id ? 'hangt er al' : `klik: ${naam(brandPenseel.id)} hangen`) : (huidig ? 'klik: weghalen' : '');
      setPenseelTip({ x: e.point.x, y: e.point.y, kop, tekst: [wat, doe].filter(Boolean).join(' · ') });
    };
    // Een stuk: eerste en laatste hek van een heklijn aanklikken.
    const S = brandStart;
    const perHek = (h) => h && (h.drager === 'hek' || h.opHek);
    const toonStuk = (h) => {
      const f = [];
      if (window.__FM_TEST) window.__FM_TEST.stuk = !!S.current;
      const a = S.current; const b = h && a && h.it.id === a.it.id ? h : null;
      if (a) {
        const naden = nadenVan(a.it.geometrie, a.el, a.it.parameters?.bogen, a.it.parameters?.openingen);
        const [i0, i1] = b ? [Math.min(a.plek, b.plek), Math.max(a.plek, b.plek)] : [a.plek, a.plek];
        for (let i = i0; i <= i1; i++) { const g = hekStuk(naden, i); if (g) f.push({ type: 'Feature', geometry: g, properties: { o: 0, weg: !brandPenseel.id } }); }
        f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: naden[a.plek].p }, properties: { o: 0, weg: false } });
      }
      const data = { type: 'FeatureCollection', features: f };
      if (window.__FM_TEST) window.__FM_TEST.voorbeeld = f.length;
      if (map.getSource('fm-hekvoorbeeld')) map.getSource('fm-hekvoorbeeld').setData(data);
      else if (f.length) {
        map.addSource('fm-hekvoorbeeld', { type: 'geojson', data });
        map.addLayer({ id: 'fm-hekvoorbeeld', type: 'line', source: 'fm-hekvoorbeeld', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': ['case', ['get', 'weg'], '#DC2626', '#16A34A'], 'line-width': 14, 'line-opacity': 0.4, 'line-offset': ['get', 'o'] } });
        map.addLayer({ id: 'fm-hekvoorbeeld-p', type: 'circle', source: 'fm-hekvoorbeeld', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-color': '#B45309', 'circle-stroke-width': 2.5 } });
      }
    };
    const neer = (e) => {
      if (e.originalEvent.button !== 0) return;
      const h = zoek(e); if (!h) return;
      e.preventDefault();
      if (brandPenseel.modus === 'stuk' && perHek(h)) {
        if (!S.current || S.current.it.id !== h.it.id) { S.current = h; toonStuk(h); setStukStatus(`Begin: hek ${h.plek + 1} · klik nu het laatste hek · Esc = opnieuw`); return; }
        const i0 = Math.min(S.current.plek, h.plek); const i1 = Math.max(S.current.plek, h.plek);
        bezig = { voor: new Map(), nu: new Map() };
        for (let i = i0; i <= i1; i++) verf({ ...h, plek: i });
        const b = bezig; bezig = null; S.current = null; toonStuk(null);
        for (const [id, voor] of b.voor) pasToe(voor, b.nu.get(id));
        setStukStatus(`Hek ${i0 + 1}–${i1 + 1} → ${brandPenseel.id ? naam(brandPenseel.id) : 'leeg gemaakt'} · volgend stuk of Klaar`);
        return;
      }
      map.dragPan.disable();
      bezig = { voor: new Map(), nu: new Map() };
      verf(h); tip(e, h);
    };
    const beweeg = (e) => { const h = zoek(e); if (S.current) toonStuk(h); if (bezig && h) verf(h); tip(e, h); };
    const los = () => {
      if (!bezig) return;
      const b = bezig; bezig = null; map.dragPan.enable();
      for (const [id, voor] of b.voor) pasToe(voor, b.nu.get(id));
    };
    const uit = () => setPenseelTip(null);
    const toets = (e) => {
      if (e.key === 'Escape' && S.current) { S.current = null; toonStuk(null); setStukStatus(''); return; }
      if (e.key === 'Escape' || (e.key === 'Enter' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target?.tagName || ''))) setBrandPenseel(null);
    };
    map.on('mousedown', neer); map.on('mousemove', beweeg); map.on('mouseup', los); map.on('mouseout', uit);
    window.addEventListener('keydown', toets);
    return () => {
      map.off('mousedown', neer); map.off('mousemove', beweeg); map.off('mouseup', los); map.off('mouseout', uit); window.removeEventListener('keydown', toets);
      zetCursor(map, 'penseel', ''); setPenseelTip(null);
      try { map.getSource('fm-hekvoorbeeld')?.setData({ type: 'FeatureCollection', features: [] }); } catch {}
      try { if (st.current.gereedschap === 'selecteer') { tdRef.current?.setMode('select'); if (st.current.geselecteerd) tdRef.current?.selectFeature(st.current.geselecteerd); } } catch {}
    };
  }, [brandPenseel, kaartKlaar, elementenMap, pasToe]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (brandPenseel && gereedschap !== 'selecteer') setBrandPenseel(null); }, [gereedschap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Een stuk opnieuw beginnen als je van lijn, toebehoren, ontwerp of manier wisselt (niet bij een kant of een ander doek).
  useEffect(() => { stukStart.current = null; setStukStatus(''); }, [doekPenseel?.itemId, doekPenseel?.tb, doekPenseel?.modus, !doekPenseel, brandPenseel?.id, brandPenseel?.drager, brandPenseel?.modus, !brandPenseel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { brandStart.current = null; }, [brandPenseel?.id, brandPenseel?.drager, brandPenseel?.modus, !brandPenseel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (brandPenseel) laatstePenseel.current = brandPenseel; }, [brandPenseel]);
  // ---------- Doek per hek: hekken op de kaart aanklikken of erover slepen ----------
  useEffect(() => { if (doekPenseel && doekPenseel.itemId !== geselecteerd) setDoekPenseel(null); }, [geselecteerd]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kaartKlaar || !doekPenseel) return undefined;
    zetCursor(map, 'penseel', 'cell');
    // Terra Draw even stil: anders versleept een klik bij een hoekpunt de lijn zelf.
    try { tdRef.current?.setMode('static'); } catch {}
    let bezig = null;
    // Gekozen hekken oplichten (toebehoren per hek).
    const toonKeuze = (it0) => {
      if (!doekPenseel.tb) return;
      const it = it0 || st.current.items.find((x) => x.id === doekPenseel.itemId);
      const el = it ? elementenMap.get(it.element_id) : null;
      const f = [];
      if (it && el && it.geometrie?.type === 'LineString') {
        const naden = nadenVan(it.geometrie, el, it.parameters?.bogen, it.parameters?.openingen);
        const tb = it.velden?.toebehoren?.[doekPenseel.tb] || {};
        for (const i of tb.plekken || []) {
          const g = hekStuk(naden, Number(i)); if (!g) continue;
          // Markering aan de gekozen kant (beide: beide kanten); zonder kant: op de lijn.
          const z = doekPenseel.zijde ? (tb.zijden?.[i] || tb.kant || 'rechts') : null;
          const kanten = !z ? [0] : z === 'beide' ? [1, -1] : [z === 'links' ? -1 : 1];
          // Vaste afstand op het scherm (line-offset in px): op elke zoom even duidelijk.
          for (const k of kanten) f.push({ type: 'Feature', geometry: g, properties: { r: 0, o: k * 8 } });
        }
        if (doekPenseel.zijde) {
          // Tekenrichting: pijltjes op de lijn, en L / R ernaast.
          const lijn = geo.buig(it.geometrie, it.parameters?.bogen);
          f.push({ type: 'Feature', geometry: lijn, properties: { r: 1 } });
          try {
            const c0 = lijn.coordinates[0];
            const mpp = (156543.03 * Math.cos((c0[1] * Math.PI) / 180)) / 2 ** map.getZoom();
            const L = turf.length(turf.lineString(lijn.coordinates), { units: 'meters' });
            const stap = Math.max(110 * mpp, L / 150); const off = 17 * mpp;
            for (let d = stap / 2; d < L; d += stap) {
              const a = turf.along(lijn, Math.max(0, d - 0.2), { units: 'meters' }).geometry.coordinates;
              const b = turf.along(lijn, Math.min(L, d + 0.2), { units: 'meters' }).geometry.coordinates;
              const m = turf.along(lijn, d, { units: 'meters' }).geometry.coordinates; const rr = turf.bearing(a, b);
              f.push({ type: 'Feature', geometry: turf.destination(m, off, rr - 90, { units: 'meters' }).geometry, properties: { r: 2, t: 'L' } });
              f.push({ type: 'Feature', geometry: turf.destination(m, off, rr + 90, { units: 'meters' }).geometry, properties: { r: 2, t: 'R' } });
            }
          } catch {}
        }
      }
      const data = { type: 'FeatureCollection', features: f };
      if (map.getSource('fm-hekkeuze')) map.getSource('fm-hekkeuze').setData(data);
      else {
        map.addSource('fm-hekkeuze', { type: 'geojson', data });
        map.addLayer({ id: 'fm-hekkeuze', type: 'line', source: 'fm-hekkeuze', filter: ['==', ['get', 'r'], 0], paint: { 'line-color': '#F59E0B', 'line-width': 6, 'line-opacity': 0.85, 'line-offset': ['get', 'o'] } });
        map.addLayer({ id: 'fm-hekkant', type: 'symbol', source: 'fm-hekkeuze', filter: ['==', ['get', 'r'], 2], layout: { 'text-field': ['get', 't'], 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#B45309', 'text-halo-color': '#fff', 'text-halo-width': 2 } });
        map.addLayer({ id: 'fm-hekrichting', type: 'symbol', source: 'fm-hekkeuze', filter: ['==', ['get', 'r'], 1], layout: { 'symbol-placement': 'line', 'symbol-spacing': 70, 'text-field': '›', 'text-size': 22, 'text-keep-upright': false, 'text-allow-overlap': true, 'text-ignore-placement': true, 'text-offset': [0, -0.08] }, paint: { 'text-color': '#B45309', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });
      }
    };
    toonKeuze();
    const opZoom = () => toonKeuze();
    map.on('zoomend', opZoom);
    // Voorbeeld onder de muis: groen = komt erbij, rood = gaat weg.
    // Een stuk: het eerste aangeklikte hek (in een ref: blijft staan als de balk of het paneel wijzigt).
    const S = stukStart;
    const bereik = (h) => (S.current ? [Math.min(S.current.i, h.i), Math.max(S.current.i, h.i)] : [h.i, h.i]);
    // Zou een klik (of het stuk tot hier) iets toevoegen (true) of weghalen (false)?
    const zouAan = (it, i0, i1, kant) => {
      if (!doekPenseel.tb) return !!doekPenseel.doekId;
      const tb = it.velden?.toebehoren?.[doekPenseel.tb] || {};
      const l = new Set((tb.plekken || []).map(Number));
      const doel = !doekPenseel.zijde ? [null] : doekPenseel.kant === 'beide' ? ['links', 'rechts'] : [doekPenseel.kant || kant];
      for (let i = i0; i <= i1; i++) {
        if (!l.has(i)) return true;
        const z = tb.zijden?.[i] || tb.kant || 'rechts';
        if (doel.some((k) => k && !(z === 'beide' || z === k))) return true;
      }
      return false;
    };
    const toonVoorbeeld = (h0) => {
      const f = [];
      const h = h0 || S.current;
      if (h) {
        const el = elementenMap.get(h.it.element_id);
        const naden = nadenVan(h.it.geometrie, el, h.it.parameters?.bogen, h.it.parameters?.openingen);
        const [i0, i1] = bereik(h);
        const kant = S.current ? S.current.kant : h.kant;
        const weg = !zouAan(h.it, i0, i1, kant);
        const kanten = !doekPenseel.zijde ? [null] : doekPenseel.kant === 'beide' ? ['links', 'rechts'] : [doekPenseel.kant || kant];
        for (let i = i0; i <= i1; i++) { const g = hekStuk(naden, i); if (g) for (const k of kanten) f.push({ type: 'Feature', geometry: g, properties: { o: k === 'links' ? -12 : k === 'rechts' ? 12 : 0, weg } }); }
        if (S.current) f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: naden[S.current.i].p }, properties: { o: 0, weg: false, p: true } });
      }
      const data = { type: 'FeatureCollection', features: f };
      if (window.__FM_TEST) window.__FM_TEST.voorbeeld = f.length;
      if (map.getSource('fm-hekvoorbeeld')) map.getSource('fm-hekvoorbeeld').setData(data);
      else if (f.length) {
        map.addSource('fm-hekvoorbeeld', { type: 'geojson', data });
        map.addLayer({ id: 'fm-hekvoorbeeld', type: 'line', source: 'fm-hekvoorbeeld', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': ['case', ['get', 'weg'], '#DC2626', '#16A34A'], 'line-width': 14, 'line-opacity': 0.4, 'line-offset': ['get', 'o'] } });
        map.addLayer({ id: 'fm-hekvoorbeeld-p', type: 'circle', source: 'fm-hekvoorbeeld', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-color': '#B45309', 'circle-stroke-width': 2.5 } });
      }
    };
    if (S.current) setTimeout(() => toonVoorbeeld(null), 0);
    const hekBij = (e) => {
      const it = st.current.items.find((x) => x.id === doekPenseel.itemId);
      const el = it ? elementenMap.get(it.element_id) : null;
      if (!it || !el || it.geometrie?.type !== 'LineString') return null;
      const lijnG = geo.buig(it.geometrie, it.parameters?.bogen);
      const q = turf.nearestPointOnLine(turf.lineString(lijnG.coordinates), [e.lngLat.lng, e.lngLat.lat], { units: 'meters' });
      const pq = map.project(q.geometry.coordinates);
      if (Math.hypot(pq.x - e.point.x, pq.y - e.point.y) > 16) return null;
      const naden = nadenVan(it.geometrie, el, it.parameters?.bogen, it.parameters?.openingen);
      const begin = (naden.runs || []).map((r) => r.van || 0);
      const pos = (j) => begin[naden[j].run] + naden[j].d;
      const loc = q.properties.location;
      // Aan welke kant van de lijn (in tekenrichting) je klikt.
      const kant = (i) => { const a = map.project(naden[i].p); const b = map.project(naden[i + 1].p); return (b.x - a.x) * (e.point.y - a.y) - (b.y - a.y) * (e.point.x - a.x) > 0 ? 'rechts' : 'links'; };
      for (let i = 0; i < naden.length - 1; i++) {
        const tot = naden[i + 1].run === naden[i].run ? pos(i + 1) : begin[naden[i + 1].run] + naden[i + 1].d;
        if (loc <= tot + 1e-6) return { it, i, n: naden.length - 1, kant: kant(i) };
      }
      return { it, i: naden.length - 2, n: naden.length - 1, kant: kant(naden.length - 2) };
    };
    const verf = (h) => {
      const it = bezig ? bezig.nu : h.it;
      if (doekPenseel.tb) {
        // Toebehoren per hek (bv. steundriehoeken): aan- of uitzetten; slepen zet de volgende hekken hetzelfde.
        const k = doekPenseel.tb; const tb = it.velden?.toebehoren?.[k] || {};
        const l = new Set((tb.plekken || []).map(Number));
        if (doekPenseel.zijde) {
          // Per plek een kant: klik links of rechts van de lijn zet of haalt de driehoek aan die kant.
          const standaard = tb.kant || 'rechts';
          const zijden = { ...(tb.zijden || {}) };
          const nu = (i) => { if (!l.has(i)) return new Set(); const z = zijden[i] || standaard; return new Set(z === 'beide' ? ['links', 'rechts'] : [z]); };
          const set = nu(h.i);
          // Kant: wat in de balk gekozen is, anders de kant waar je klikt.
          const doel = doekPenseel.kant === 'beide' ? ['links', 'rechts'] : [doekPenseel.kant || h.kant];
          const heeftAl = doel.every((x) => set.has(x));
          if (bezig && bezig.aan == null) bezig.aan = !heeftAl;
          const aan = bezig ? bezig.aan : !heeftAl;
          if (heeftAl === aan && (aan || !doel.some((x) => set.has(x)))) return it;
          for (const x of doel) { if (aan) set.add(x); else set.delete(x); }
          if (!set.size) { l.delete(h.i); delete zijden[h.i]; } else { l.add(h.i); zijden[h.i] = set.size === 2 ? 'beide' : [...set][0]; }
          const na = { ...it, velden: { ...(it.velden || {}), toebehoren: { ...(it.velden?.toebehoren || {}), [k]: { ...tb, aan: true, ...(doekPenseel.zet || {}), plekken: [...l].sort((x, y) => x - y), zijden } } } };
          setItems((oud) => { const m = oud.map((x) => (x.id === na.id ? na : x)); st.current.items = m; return m; });
          toonKeuze(na);
          return na;
        }
        if (bezig && bezig.aan == null) bezig.aan = !l.has(h.i);
        const aan = bezig ? bezig.aan : !l.has(h.i);
        if (l.has(h.i) === aan) return it;
        if (aan) l.add(h.i); else l.delete(h.i);
        const na = { ...it, velden: { ...(it.velden || {}), toebehoren: { ...(it.velden?.toebehoren || {}), [k]: { ...tb, aan: true, ...(doekPenseel.zet || {}), plekken: [...l].sort((x, y) => x - y) } } } };
        setItems((oud) => { const m = oud.map((x) => (x.id === na.id ? na : x)); st.current.items = m; return m; });
        toonKeuze(na);
        return na;
      }
      const l = Array.from({ length: h.n }, (_, k) => (it.velden?.doeken || [])[k] || null);
      if (l[h.i] === (doekPenseel.doekId || null)) return it;
      l[h.i] = doekPenseel.doekId || null;
      const na = { ...it, velden: { ...(it.velden || {}), doeken: l } };
      setItems((oud) => { const m = oud.map((x) => (x.id === na.id ? na : x)); st.current.items = m; return m; });
      return na;
    };
    const neer = (e) => {
      if (e.originalEvent.button !== 0) return;
      const h = hekBij(e);
      if (!h) return;
      e.preventDefault();
      if (doekPenseel.modus === 'stuk') {
        // Een stuk: eerste klik = begin, tweede = einde; alles ertussen in één keer.
        if (!S.current) { S.current = h; toonVoorbeeld(h); setStukStatus(`Begin: hek ${h.i + 1} · klik nu het laatste hek · Esc = opnieuw${doekPenseel.zijde && !doekPenseel.kant ? ' · de kant van je eerste klik telt' : ''}`); return; }
        const [i0, i1] = bereik(h); const kant = S.current.kant;
        const b = { voor: h.it, nu: h.it, aan: zouAan(h.it, i0, i1, kant) };
        bezig = b;
        for (let i = i0; i <= i1; i++) b.nu = verf({ ...h, i, kant });
        bezig = null; S.current = null;
        if (b.nu !== b.voor) pasToe(b.voor, b.nu);
        toonVoorbeeld(null);
        setStukStatus(`Hek ${i0 + 1}–${i1 + 1} ${doekPenseel.tb ? (b.aan ? 'toegevoegd' : 'weggehaald') : `→ ${elementenMap.get(doekPenseel.doekId)?.naam || 'geen doek'}`} · volgend stuk of Klaar`);
        return;
      }
      map.dragPan.disable();
      bezig = { voor: h.it, nu: h.it };
      bezig.nu = verf(h);
    };
    const beweeg = (e) => { const h = hekBij(e); if (!bezig) { toonVoorbeeld(h); return; } if (h) bezig.nu = verf(h); };
    const los = () => {
      if (!bezig) return;
      const { voor, nu } = bezig; bezig = null; map.dragPan.enable();
      if (nu !== voor) pasToe(voor, nu);
    };
    const toets = (e) => {
      if (e.key === 'Escape' && S.current) { e.preventDefault(); S.current = null; toonVoorbeeld(null); setStukStatus(''); return; }
      if (e.key === 'Escape' || (e.key === 'Enter' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target?.tagName || ''))) { e.preventDefault(); setDoekPenseel(null); return; }
      if (!doekPenseel.zijde || /INPUT|SELECT|TEXTAREA/.test(e.target?.tagName || '')) return;
      const k = { l: 'links', r: 'rechts', b: 'beide', k: null }[e.key.toLowerCase()];
      if (k !== undefined) setDoekPenseel((d) => (d ? { ...d, kant: k } : d));
    };
    map.on('mousedown', neer); map.on('mousemove', beweeg); map.on('mouseup', los);
    window.addEventListener('keydown', toets);
    return () => {
      map.off('mousedown', neer); map.off('mousemove', beweeg); map.off('mouseup', los); window.removeEventListener('keydown', toets); zetCursor(map, 'penseel', '');
      map.off('zoomend', opZoom);
      try { map.getSource('fm-hekkeuze')?.setData({ type: 'FeatureCollection', features: [] }); map.getSource('fm-hekvoorbeeld')?.setData({ type: 'FeatureCollection', features: [] }); } catch {}
      try { if (st.current.gereedschap === 'selecteer') { tdRef.current?.setMode('select'); if (st.current.geselecteerd) tdRef.current?.selectFeature(st.current.geselecteerd); } } catch {}
    };
  }, [doekPenseel, kaartKlaar, elementenMap, pasToe]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Slepen met slimme hulplijnen ----------
  // Zelf slepen (niet via Terra Draw) zodat we tijdens het slepen kunnen uitlijnen
  // op randen en middens van andere items, gelijke tussenafstanden voorstellen en
  // afstanden tonen. Shift = enkel horizontaal of verticaal; Alt = zonder hulplijnen.
  const selectieRef = useRef([]);
  selectieRef.current = selectie;
  useEffect(() => slimSlepen(() => ({ greepRef, kaartKlaar, maakItem, mapRef, pasToe, schrijven, selectieRef, setExtra, setGeselecteerd, setGereedschap, setItems, setMelding, setVerleng, st, syncTd, tdFeature, tdRef, voorbeeldRef, volgMee, voorkeurRef })), [kaartKlaar, schrijven, pasToe, volgMee, syncTd, maakItem, tdFeature]);

  // Huismateriaal (van een locatie, zie BinnenScherm) hoort niet in de gewone bibliotheek.
  const zonderHuis = useMemo(() => elementen.filter((e) => !e.eigenschappen?.huis && e.actief !== false), [elementen]);
  // ---------- Lagen en plan ----------
  const markeerLaag = (id) => laagBezig.current.set(id, Date.now() + 2500);
  const wijzigLaag = useCallback(async (id, patch) => {
    markeerLaag(id);
    setLagen((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (!st.current.schrijven) return;
    const { error } = await maps().from('lagen').update(patch).eq('id', id);
    markeerLaag(id);
    if (error) setFout(foutTekst(error));
  }, []);
  wijzigLaagRef.current = wijzigLaag;

  // Lagen herschikken (slepen in het lagenpaneel): nieuwe volgorde plus eventueel per laag
  // een wijziging (bv. andere map), in één keer op het scherm en daarna naar de server.
  const herschikLagen = useCallback(async (ids, patches = {}) => {
    const oud = new Map(st.current.lagen.map((l) => [l.id, l]));
    const nieuw = ids.map((id, i) => ({ ...oud.get(id), ...(patches[id] || {}), volgorde: i })).filter((x) => x.id);
    for (const l of nieuw) markeerLaag(l.id);
    st.current.lagen = nieuw;
    setLagen(nieuw);
    if (!st.current.schrijven) return;
    const werk = nieuw.filter((l) => oud.get(l.id)?.volgorde !== l.volgorde || patches[l.id]);
    const res = await Promise.all(werk.map((l) => maps().from('lagen').update({ volgorde: l.volgorde, ...(patches[l.id] || {}) }).eq('id', l.id)));
    for (const l of werk) markeerLaag(l.id);
    const f = res.find((r) => r.error);
    if (f) setFout(foutTekst(f.error));
  }, []);

  const nieuweLaag = useCallback(async (map) => {
    const inMap = typeof map === 'string' && map ? map : null;
    const naam = await vraagTekst(inMap ? `Naam van de nieuwe laag in ${inMap}` : 'Naam van de nieuwe laag');
    if (!naam) return;
    const { data, error } = await maps().from('lagen').insert({ plan_id: planId, naam, kleur: '#686D76', volgorde: st.current.lagen.length, ...(inMap ? { map: inMap } : {}) }).select().single();
    if (error) { setFout(foutTekst(error)); return; }
    setLagen((l) => [...l, data]);
    setActieveLaag(data.id);
  }, [planId]);

  // Lege lagen in één keer weg (bv. de standaardlagen van een nieuw plan die je niet gebruikt).
  const ruimLegeLagenOp = useCallback(async () => {
    const leeg = st.current.lagen.filter((l) => !st.current.items.some((i) => i.laag_id === l.id));
    if (!leeg.length) return;
    if (st.current.lagen.length - leeg.length < 1) leeg.shift(); // één laag blijft altijd
    if (!leeg.length || !await bevestig(`${leeg.length} lege ${leeg.length === 1 ? 'laag' : 'lagen'} verwijderen? (${leeg.map((l) => l.naam).join(', ')})`, { ok: 'Verwijderen', gevaar: true })) return;
    for (const l of leeg) {
      // Enkel als ze op de server ook echt leeg is (een collega kan er net iets in gezet hebben).
      const { count } = await maps().from('items').select('id', { count: 'exact', head: true }).eq('laag_id', l.id);
      if (count) continue;
      const { error } = await maps().from('lagen').delete().eq('id', l.id);
      if (error) { setFout(foutTekst(error)); return; }
      setLagen((x) => x.filter((y) => y.id !== l.id));
      if (st.current.actieveLaag === l.id) setActieveLaag(st.current.lagen.find((y) => y.id !== l.id && !leeg.includes(y))?.id || null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const verwijderLaag = useCallback(async (id) => {
    const aantal = st.current.items.filter((i) => i.laag_id === id).length;
    if (!await bevestig(aantal ? `Deze laag bevat ${aantal} items. Laag én items verwijderen?` : 'Laag verwijderen?', { ok: 'Verwijderen', gevaar: true })) return;
    const ids = st.current.items.filter((i) => i.laag_id === id).map((i) => i.id);
    bewaarder.current.vergeet(ids);
    // Op de echte inhoud van de laag, ook items die een collega er net aan toevoegde.
    const r0 = await maps().from('items').delete().eq('laag_id', id);
    if (r0.error) { setFout(foutTekst(r0.error)); return; }
    const { error } = await maps().from('lagen').delete().eq('id', id);
    if (error) { setFout(foutTekst(error)); return; }
    setItems((it) => it.filter((i) => i.laag_id !== id));
    setLagen((l) => l.filter((x) => x.id !== id));
    if (st.current.actieveLaag === id) setActieveLaag(st.current.lagen.find((y) => y.id !== id)?.id || null);
    historiek.current = { terug: [], vooruit: [] };
  }, [verwijderUitDb]);

  const wijzigPlanRef = useRef(null);
  const planKeten = useRef(Promise.resolve());
  const wijzigPlan = useCallback(async (patch) => {
    const oudInst = st.current.plan?.instellingen || {};
    setPlan((p) => ({ ...p, ...patch }));
    if (st.current.plan) st.current.plan = { ...st.current.plan, ...patch };
    if (!st.current.schrijven) return;
    const { instellingen, ...rest } = patch;
    // Instellingen per onderdeel bewaren, zodat collega's elkaars onderdelen niet overschrijven.
    const opdrachten = instellingen ? instellingenOpdrachten(oudInst, instellingen) : [];
    const werk = async () => {
      let laatste = null;
      for (const o of opdrachten) {
        const r = o.zet ? await maps().rpc('plan_lijst_id', { p_plan: planId, p_pad: o.pad, p_zet: o.zet, p_weg: o.weg, p_volgorde: o.volgorde })
          : o.bij ? await maps().rpc('plan_lijst', { p_plan: planId, p_pad: o.pad, p_bij: o.bij, p_weg: o.weg })
          : await maps().rpc('plan_instelling', { p_plan: planId, p_pad: o.pad, p_waarde: o.waarde });
        if (r.error) { setFout(foutTekst(r.error)); return; }
        laatste = r.data;
      }
      if (Object.keys(rest).length) {
        const { error } = await maps().from('plannen').update(rest).eq('id', planId);
        if (error) { setFout(foutTekst(error)); return; }
      }
      // De server-stand van de instellingen bevat ook wat collega's intussen wijzigden.
      if (laatste?.instellingen) {
        const lokaal = st.current.plan?.instellingen || {};
        if (gelijk(lokaal, instellingen)) {
          setPlan((p) => ({ ...p, instellingen: laatste.instellingen }));
          if (st.current.plan) st.current.plan = { ...st.current.plan, instellingen: laatste.instellingen };
        }
      }
    };
    planBezig.current++;
    const klaar = () => { planBezig.current--; };
    planKeten.current = planKeten.current.then(werk, werk).finally(klaar);
    return planKeten.current;
  }, [planId]);
  wijzigPlanRef.current = wijzigPlan;

  // Definitief maken loopt langs de controlelijst.
  const wijzigPlanGecontroleerd = useCallback((patch) => {
    if (patch.status === 'definitief' && st.current.plan?.status !== 'definitief') { setDialoog('definitief'); return; }
    wijzigPlan(patch);
  }, [wijzigPlan]);
  const maakDefinitief = useCallback(async (meldingen) => {
    setDialoog(null);
    await kondigAan('definitief');
    const p = st.current.plan;
    const lijst = meldingen.map((m) => `${m.groep}: ${m.tekst}`);
    const { error } = await maps().from('versies').insert({
      plan_id: p.id, versie: p.versie || 1, opmerking: `Definitief${lijst.length ? ` (${lijst.length} meldingen)` : ''}`, door: profiel?.id || null,
      momentopname: { items: st.current.items, lagen: st.current.lagen, fasen: st.current.fasen, controle: lijst },
    });
    if (error) { setFout(foutTekst(error)); return; }
    await wijzigPlan({ status: 'definitief', instellingen: { ...(p.instellingen || {}), definitief: { op: new Date().toISOString(), door: profiel?.email || null, versie: p.versie || 1, meldingen: lijst } } });
    setDialoog(null);
    setMelding(`Versie ${p.versie || 1} is definitief.`);
  }, [profiel, wijzigPlan, kondigAan]);

  const naImport = useCallback((nieuweLagen, nieuweItems) => {
    bewaarder.current.zetBasis(nieuweItems);
    if (nieuweLagen.length) setLagen((l) => [...l, ...nieuweLagen]);
    setItems((it) => { const lijst = [...it, ...nieuweItems]; st.current.items = lijst; return lijst; });
    setTimeout(() => {
      syncTd();
      const k = geo.kader(nieuweItems.map((i) => i.geometrie));
      if (k && mapRef.current) mapRef.current.fitBounds(k, { padding: 60, maxZoom: 19 });
    }, 50);
    setMelding(`${nieuweItems.length} items geïmporteerd.`);
  }, [syncTd]);

  const versieBewaren = useCallback(async () => {
    const opm = await vraagTekst('Wat is er veranderd in deze versie? (optioneel)', '');
    if (opm === null) return;
    const p = st.current.plan;
    const nieuweVersie = (p.versie || 1) + 1;
    const { error } = await maps().from('versies').insert({
      plan_id: p.id, versie: p.versie || 1, opmerking: opm || null, door: profiel?.id || null,
      momentopname: { items: st.current.items, lagen: st.current.lagen, fasen: st.current.fasen },
    });
    if (error) { setFout(foutTekst(error)); return; }
    await wijzigPlan({ versie: nieuweVersie });
    setMelding(`Versie ${p.versie || 1} bewaard. Je werkt nu aan versie ${nieuweVersie}.`);
  }, [profiel, wijzigPlan]);

  // Een oudere versie terugzetten. De huidige stand wordt eerst zelf als versie
  // bewaard, zodat terugzetten altijd ongedaan te maken is.
  const herstelVersie = useCallback(async (versieId) => {
    const p = st.current.plan;
    const { data: v, error: e1 } = await maps().from('versies').select('*').eq('id', versieId).single();
    if (e1) { setFout(foutTekst(e1)); return; }
    if (!await bevestig(`Versie ${v.versie} terugzetten? De huidige stand wordt eerst bewaard als versie ${p.versie || 1}, zodat je altijd terug kunt.${anderenRef.current.length ? ` ${anderenRef.current.map((a) => a.naam).join(', ')} ${anderenRef.current.length === 1 ? 'krijgt' : 'krijgen'} eerst 30 seconden verwittiging.` : ''}`)) return;
    await kondigAan('terugzetten', { versie: v.versie });
    bewaarAllesNu();
    const snap = v.momentopname || {};
    const { error: e2 } = await maps().from('versies').insert({
      plan_id: p.id, versie: p.versie || 1, opmerking: `Automatisch bewaard voor het terugzetten van versie ${v.versie}`, door: profiel?.id || null,
      momentopname: { items: st.current.items, lagen: st.current.lagen, fasen: st.current.fasen },
    });
    if (e2) { setFout(foutTekst(e2)); return; }
    const oudeItems = (snap.items || []).map((x) => ({ ...x, plan_id: p.id }));
    const oudeLagen = (snap.lagen || []).map((x) => ({ ...x, plan_id: p.id }));
    // Lagen die in de versie zaten maar intussen weg zijn, komen terug; nieuwere lagen blijven.
    const ontbrekend = oudeLagen.filter((l) => !st.current.lagen.some((x) => x.id === l.id));
    if (ontbrekend.length) { const r = await maps().from('lagen').upsert(ontbrekend); if (r.error) { setFout(foutTekst(r.error)); return; } }
    const houden = new Set(oudeItems.map((x) => x.id));
    const weg = st.current.items.filter((x) => !houden.has(x.id)).map((x) => x.id);
    if (weg.length) { const r = await maps().from('items').delete().in('id', weg); if (r.error) { setFout(foutTekst(r.error)); return; } }
    for (let i = 0; i < oudeItems.length; i += 200) {
      const r = await maps().from('items').upsert(oudeItems.slice(i, i + 200));
      if (r.error) { setFout(foutTekst(r.error)); return; }
    }
    await wijzigPlan({ versie: (p.versie || 1) + 1 });
    setLagen((l) => [...l, ...ontbrekend]);
    const vers = await alles(() => maps().from('items').select('*').eq('plan_id', p.id).order('volgorde'));
    const lijst = vers.data || oudeItems;
    bewaarder.current.zetBasis(lijst);
    st.current.items = lijst;
    setItems(lijst);
    historiek.current = { terug: [], vooruit: [] };
    setGeselecteerd(null); setExtra([]); setVergelijkVersie(null);
    setTimeout(syncTd, 0);
    setMelding(`Versie ${v.versie} is teruggezet. De vorige stand staat bij de versies als versie ${p.versie || 1}.`);
  }, [profiel, wijzigPlan, syncTd, kondigAan, bewaarAllesNu]);

  // ---------- Sneltoetsen ----------
  useEffect(() => {
    const toets = (e) => {
      const doel = e.target;
      if (document.querySelector('.fm-bs-tekenvel, .fm-ws')) return; // de tekenaar van het binnenplan heeft eigen sneltoetsen
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalet(true); return; }
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-9]$/.test(e.code)) { const w = WERKRUIMTES[Number(e.code.slice(5)) - 1]; if (w) { e.preventDefault(); kiesWerkruimteRef.current?.(w.id); } return; }
      if (doel && (doel.tagName === 'INPUT' || doel.tagName === 'TEXTAREA' || doel.tagName === 'SELECT' || doel.isContentEditable)) return;
      const s = st.current;
      const ctrl = e.ctrlKey || e.metaKey;
      if ((e.key === 'Backspace' || e.key === 'Delete' || (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey)) && laatstePuntWeg()) { e.preventDefault(); return; }
      if (ctrl && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalet(true); return; }
      if (ctrl && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) { const ids = selectieRef.current; if (ids?.length) { e.preventDefault(); kopieer(ids); } return; }
      if (ctrl && e.key.toLowerCase() === 'v') { if (s.schrijven) { e.preventDefault(); plakRef.current?.(); } return; }
      if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); if (s.schrijven) ongedaan(e.shiftKey); return; }
      if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); if (s.schrijven) ongedaan(true); return; }
      if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); if (s.schrijven && s.geselecteerd) dupliceer(s.geselecteerd); return; }
      if (ctrl) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.geselecteerd && s.schrijven && s.gereedschap === 'selecteer') {
        e.preventDefault(); verwijderItems([s.geselecteerd]); return;
      }
      if (e.key === 'Enter' && s.gereedschap === 'knip') { e.preventDefault(); setGereedschap('selecteer'); return; }
      // Enter bevestigt: lijn, vlak of meting afwerken, route afronden, verlengen stoppen, plaatsen stoppen, groep bewerken sluiten.
      if (e.key === 'Enter' && !e.defaultPrevented && doel?.tagName !== 'BUTTON') {
        if (rondTekenenAf()) { e.preventDefault(); return; }
        if (s.gereedschap === 'route' && routeRef.current.punten.length) { e.preventDefault(); routeKlaarRef.current?.(); return; }
        if (s.gereedschap === 'verleng') { e.preventDefault(); const id = verlengRef.current?.id; setGereedschap('selecteer'); if (id) selecteerLijst([id]); return; }
        if (s.gereedschap === 'element' || (s.gereedschap !== 'selecteer' && s.gereedschap !== 'hand')) { e.preventDefault(); setGereedschap('selecteer'); return; }
        if (s.iso && s.gereedschap === 'selecteer') { e.preventDefault(); setIso(null); setMelding('Klaar met de groep bewerken.'); return; }
        if (s.binnen && s.gereedschap === 'selecteer' && !s.geselecteerd) { e.preventDefault(); sluitBinnenRef.current?.(); return; }
      }
      if (e.key === 'Escape' && rondTekenenAf()) return;
      if (e.key === 'Escape' && s.iso && !s.geselecteerd && s.gereedschap === 'selecteer') { setIso(null); return; }
      if (e.key === 'Escape' && s.binnen && !s.iso && !s.geselecteerd && !(s.extra || []).length && s.gereedschap === 'selecteer') { sluitBinnenRef.current?.(); return; }
      if (e.key === 'Escape' && st.current.gereedschap === 'route' && routeRef.current.bewerk) { routeAnnuleer(); return; }
      if (e.key === 'Enter' && st.current.gereedschap === 'route' && routeRef.current.bewerk) { e.preventDefault(); routeKlaarRef.current?.(); return; }
      if (e.key === 'Escape' && st.current.gereedschap === 'route' && routeRef.current.punten.length) { routeKlaarRef.current?.(); return; }
      if (e.key === 'Backspace' && st.current.gereedschap === 'route' && routeRef.current.punten.length) { e.preventDefault(); routeTerugRef.current?.(); return; }
      if (e.key === 'Escape' && s.gereedschap === 'lichtricht') { lichtRichtRef.current = null; setGereedschap('selecteer'); const id = s.geselecteerd; if (id) setTimeout(() => { try { tdRef.current?.setMode('select'); tdRef.current?.selectFeature(id); } catch {} }, 40); return; }
      if (e.key === 'Escape') { if (s.gereedschap === 'element') setTab((t) => (t === 'bibliotheek' ? null : t)); setGereedschap('selecteer'); setSignZet(false); setExtra([]); setKalibratie(null); if (s.vastSel && !s.geselecteerd) { setVastSel(null); return; } if (s.geselecteerd) { try { tdRef.current?.deselectFeature(s.geselecteerd); } catch {} setGeselecteerd(null); } return; }
      if (e.key.toLowerCase() === 'r' && s.gereedschap === 'element') { setElementRot((r) => (r + (e.shiftKey ? -15 : 15) + 360) % 360); return; }
      const g = GEREEDSCHAP.find((x) => x && x.toets.toLowerCase() === e.key.toLowerCase());
      if (g && (s.schrijven || ['selecteer', 'hand', 'meten', 'meten-vlak'].includes(g.id))) {
        setGereedschap(g.id);
        if (g.id === 'element') setTab('bibliotheek');
        const gr = GROEPEN.find((x) => x.tools.includes(g.id));
        if (gr) setLaatsteTool((l) => ({ ...l, [gr.id]: g.id }));
      }
    };
    window.addEventListener('keydown', toets);
    return () => window.removeEventListener('keydown', toets);
  }, [ongedaan, dupliceer, verwijderItems]);

  // Waarschuwen bij verlaten met openstaande bewaringen.
  useEffect(() => {
    const weg = (e) => { if (bewaarTimers.current.size) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', weg);
    return () => window.removeEventListener('beforeunload', weg);
  }, []);

  const zoomNaar = useCallback((it) => {
    const map = mapRef.current;
    if (!map || !it) return;
    const k = geo.kader([it.geometrie]);
    if (!k) return;
    if (k[0] === k[2]) map.easeTo({ center: [k[0], k[1]], zoom: Math.max(map.getZoom(), 18) });
    else map.fitBounds(k, { padding: 80, maxZoom: 20 });
  }, []);

  // Kaart opnieuw meten als panelen open of dicht gaan.
  useEffect(() => {
    const t = setTimeout(() => { try { mapRef.current?.resize(); } catch {} }, 0);
    return () => clearTimeout(t);
  }, [tab, volScherm, !!item, !!vastSel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Werkruimte kiezen, gereedschap en export ----------
  const wr = werkruimteOp(werkruimte);
  const kiesWerkruimteRef = useRef(null);
  const kiesWerkruimte = (id) => {
    if (id === werkruimte) return;
    if (WR_MODULE[id] && !heeftModule(WR_MODULE[id])) { setMelding(nietInPakket(WR_MODULE[id])); return; }
    const w = werkruimteOp(id);
    if (werkruimte === 'plan') tabVoorWr.current = tab;
    setWerkruimte(id); onthoudWerkruimte(id);
    setAlleTools(false); setToonAlles(false); setVolScherm(false); setWrUitklap(null); setWrLijst(null);
    setSignZet(false); setGereedschap('selecteer'); setBrandPenseel(null);
    setTab(id === 'plan' ? (LIJST_IDS.includes(tabVoorWr.current) || PANELEN.some(([k]) => k === tabVoorWr.current) || tabVoorWr.current === 'bibliotheek' ? tabVoorWr.current : null) : w.tab);
    const c = geldigeClaim(st.current.plan?.instellingen?.claims?.[id]);
    if (c && c.uid !== profiel?.id) setMelding(`${c.naam} doet ${w.naam} sinds ${new Date(c.sinds).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}. Bewerken mag; spreek af wie wat doet.`);
  };
  const zetClaim = (wrId, claim) => wijzigPlan({ instellingen: { ...(st.current.plan?.instellingen || {}), claims: { ...(st.current.plan?.instellingen?.claims || {}), [wrId]: claim } } });
  kiesWerkruimteRef.current = kiesWerkruimte;
  const verkeerModus = werkruimte === 'sign' && signModus === 'verkeer';
  const wrTools = verkeerModus ? wr.toolsVerkeer : wr.tools;
  const wrExports = verkeerModus ? wr.exportsVerkeer : wr.exports;
  const wrToolActief = (t) => {
    if (t.actie === 'signZet') return signZet === true;
    if (t.actie === 'verkeerZet') return typeof signZet === 'string';
    if (t.actie === 'brandPenseel') return !!brandPenseel;
    if (t.lijn) return gereedschap === 'lijn' && voorinstelRef.current?.naam === t.lijn.naam;
    if (t.element) return gereedschap === 'element' && !!gekozenElement && t.element(gekozenElement);
    if (t.punt) return gereedschap === 'punt' && voorinstelRef.current?.naam === t.punt.naam;
    return gereedschap === t.id;
  };
  const kiesWrTool = (t, y) => {
    setWrUitklap(null); setUitklap(null);
    if (t.actie === 'signZet') { setTab('sign'); setSignZet((v) => !v); return; }
    if (t.actie === 'verkeerZet') { setTab('sign'); setSignZet((v) => (typeof v === 'string' ? false : 'C3')); return; }
    if (t.actie === 'brandPenseel') {
      setTab('branding');
      if (brandPenseel) setBrandPenseel(null);
      else if (laatstePenseel.current) { setGereedschap('selecteer'); setBrandPenseel(laatstePenseel.current); }
      else setMelding('Kies links een ontwerp: daarmee verf je hekken, totemzijden of vlaggen.');
      return;
    }
    setSignZet(false); setBrandPenseel(null);
    if (t.punt) { voorinstelRef.current = { ...t.punt }; setGereedschap('punt'); return; }
    if (t.lijn) {
      const start = () => { voorinstelRef.current = { ...t.lijn }; setGereedschap('lijn'); if (t.uitleg) setMelding(t.uitleg); };
      if (t.lijn.velden?.verkeer) zorgVerkeerLaag(start); else start();
      return;
    }
    if (t.element) {
      const lijst = elementen.filter((e) => e.actief !== false && t.element(e));
      if (!lijst.length) { setMelding(`Geen passend element in de bibliotheek voor "${t.naam}".`); return; }
      if (lijst.length === 1) { setGekozenElement(lijst[0]); setGereedschap('element'); return; }
      // Meerdere keuzes: als lijst met afbeeldingen in het paneel links (zoals de bibliotheek); nog eens klikken = dicht.
      if (tab === 'wrlijst' && wrLijst?.id === t.id) { setTab(null); return; }
      setWrLijst({ id: t.id, lijst }); setTab('wrlijst'); return;
    }
    if (t.profiel) setRouteProfiel(t.profiel);
    setGereedschap(t.id);
    const gr = GROEPEN.find((x) => x.tools.includes(t.id));
    if (gr) setLaatsteTool((l) => ({ ...l, [gr.id]: t.id }));
  };
  const wrTool = (id) => wrTools?.find((t) => t.id === id);
  // Keuzelijst links: klaar met kiezen/plaatsen (ander gereedschap, Esc) = terug naar het eigen paneel van de werkplek.
  useEffect(() => { if (gereedschap !== 'element' && tab === 'wrlijst') setTab(wr.tab || null); }, [gereedschap]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Uitgang tekenen" vanuit de checklist: tent in beeld, lijn-element Nooduitgang, snappen op de tentwand.
  const uitgangTekenen = (tent) => {
    const el = elementen.find((e) => e.eigenschappen?.veiligheid === 'uitgang');
    if (!el) { setMelding('Geen element "Nooduitgang" in de bibliotheek.'); return; }
    zoomNaar(tent); setGeselecteerd(null); setExtra([]);
    setSnap((x) => ({ ...x, lijnen: true, punten: true }));
    setGekozenElement(el); setGereedschap('element');
    setMelding(`Trek een lijn over de opening in de wand van ${tent.naam || 'de tent'}: de lijn snapt op de tentwand.`);
  };
  const laadCsv = (tekst, naam) => {
    const blob = new Blob(['\ufeff' + tekst], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = naam; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  // Geeft een bericht terug (bv. 'Nog geen kabels getekend.') of gooit een fout; het scherm Exporteren toont het.
  const exporteer = async (id) => {
    let bericht = '';
    const s0 = st.current; const fase = fasen.find((f) => f.id === actieveFase) || null;
    setFout('');
    // Kaart-PDF's in een eigen tabblad, met voortgang; hier kan je verder werken.
    if (['stroomplan', 'veiligheidsplan', 'brandingplan'].includes(id)) {
      if (startExport(s0.plan.id, { soort: 'werkruimte', id, faseId: fase?.id || null }, { stroomplan: 'Stroomdossier', veiligheidsplan: 'Veiligheidsplan', brandingplan: 'Brandingplan' }[id])) { return 'De PDF wordt gemaakt in een eigen tabblad. Je ziet de voortgang rechtsonder en kan intussen verder werken.'; }
    }
    try {
      if (id === 'drukbestand') {
        setExportBezig('Borden maken…');
        const { bordenPdf } = await import('./bord');
        const inst = instSign(s0.plan);
        const { doc, meldingen } = await bordenPdf({ plan: s0.plan, items: s0.items, inst, isSign, formaat: inst.formaat, voortgang: setExportBezig });
        if (doc) doc.save(`Borden - ${s0.plan.naam}.pdf`);
        if (meldingen.length) bericht = (meldingen.join(' '));
      } else if (id === 'bestellijst') {
        const inst = instSign(s0.plan);
        laadCsv(bestellijstCsv(bestellijst(s0.items, inst.bestemmingen, inst.reserve, inst.bord), inst.reserve), `Signalisatie bestellijst - ${s0.plan.naam}.csv`);
      } else if (id === 'stroomplan') {
        setExportBezig('Stroomplan…');
        const { stroomplanPdf } = await import('./werkruimtePdf');
        const m = await stroomplanPdf({ plan: s0.plan, lagen: s0.lagen, items: s0.items, elementenMap, lagenMap, fase, fasen, stroom: stroomRef.current, voortgang: setExportBezig });
        if (m?.length) bericht = (m.join(' '));
      } else if (id === 'kabellijst') {
        if (!stroomRef.current?.kabels?.length) { return 'Nog geen kabels getekend.'; }
        laadCsv(kabellijstCsv(stroomRef.current), `Kabellijst - ${s0.plan.naam}.csv`);
      } else if (id === 'veiligheidsplan') {
        setExportBezig('Veiligheidsplan…');
        const { veiligheidsplanPdf } = await import('./werkruimtePdf');
        const m = await veiligheidsplanPdf({ plan: s0.plan, lagen: s0.lagen, items: s0.items, elementenMap, lagenMap, fase, voortgang: setExportBezig });
        if (m?.length) bericht = (m.join(' '));
      } else if (id === 'verkeersplan') {
        setExportBezig('Signalisatieplan…');
        const { verkeersplanPdf } = await import('./verkeerPdf');
        const m = await verkeersplanPdf({ plan: s0.plan, items: s0.items, voortgang: setExportBezig });
        if (m?.length) bericht = (m.join(' '));
      } else if (id === 'verkeerlijst') {
        laadCsv(verkeerStuklijstCsv(verkeerStuklijst(s0.items, instVerkeer(s0.plan))), `Verkeerssignalisatie stuklijst - ${s0.plan.naam}.csv`);
      } else if (id === 'brandingplan') {
        setExportBezig('Brandingplan…');
        const { brandingplanPdf } = await import('./werkruimtePdf');
        const m = await brandingplanPdf({ plan: s0.plan, lagen: s0.lagen, items: s0.items, elementenMap, lagenMap, fase, voortgang: setExportBezig });
        if (m?.length) bericht = (m.join(' '));
      } else if (id === 'brandinglijst') {
        const rijen = brandingBestellijst(s0.items, elementenMap);
        if (!rijen.length) { return 'Nog geen ontwerpen toegewezen.'; }
        laadCsv(brandingCsv(rijen), `Branding bestellijst - ${s0.plan.naam}.csv`);
      } else if (id === 'checklist') {
        setExportBezig('Checklist…');
        const { checklistPdf } = await import('./werkruimtePdf');
        await checklistPdf({ plan: s0.plan, items: s0.items, elementenMap });
      }
    } catch (e) { setExportBezig(''); throw e; }
    setExportBezig('');
    return bericht || undefined;
  };
  // ---------- Weergave ----------
  if (laden) return <div className="fm" style={{ padding: 40 }}>Plan laden…</div>;
  if (fout && !plan) return <div className="fm" style={{ padding: 40, maxWidth: 640 }}><div className="fm-melding fout">{fout}</div><p><a className="fm-knop" href="/maps/plannen">Terug naar de plannen</a></p></div>;

  // Bronnen voor Ctrl K.
  const paletBronnen = () => {
    const r = [];
    const zetTab = (t) => { setVolScherm(false); setTab(t); };
    const acties = [
      ['PDF op schaal', () => setDialoog('pdf'), 'exporteren afdrukken'],
      ...(schrijven ? [['Tekenscherm (op maat tekenen met raster)', () => openTekenscherm(selectieRef.current?.length ? selectieRef.current : null), 'raster groep precisie']] : []),
      ...(heeftModule('signalisatie') ? [['Signalisatie-PDF', () => maakSignPdf(), 'borden']] : []),
      ['Delen en exporteren', () => setDialoog('delen'), 'link deel-link ontvanger pdf'],
      ['Snel exporteren', () => setUitvoer({ tab: 'exporteren', id: { stroom: 'stroomplan', veiligheid: 'veiligheidsplan', branding: 'brandingplan', sign: verkeerModus ? 'verkeersplan' : 'drukbestand' }[werkruimte] || 'materiaal' }), 'lijsten kml werkplek'],
      ['PDF van het beeld', () => setDialoog('pdf'), 'pdf afdrukken kader schaal'],
      ...(schrijven ? [['Importeren', () => setUitvoer({ tab: 'importeren' }), 'kml gpx csv cad']] : []),
      ['Versie bewaren', () => versieBewaren(), 'opslaan'],
      ['Versies bekijken en terugzetten', () => toonPlan('geschiedenis'), 'herstellen geschiedenis'],
      ['Lagen', () => zetTab('lagen'), ''],
      ['Materiaal per leverancier', () => setMateriaalOpen(true), 'stuklijst lijsten materiaal leveranciers'],
      ...(heeftModule('stroom') ? [['Elektriciteit', () => zetTab('stroom'), 'stroom lijsten kabels']] : []),
      ...(heeftModule('signalisatie') ? [['Borden (signalisatie)', () => zetTab('sign'), 'lijsten wegwijzers']] : []),
      ['Draaiboek', () => zetTab('draaiboek'), 'opbouw afbraak'],
      ...(heeftModule('veiligheid') ? [['Keuringsattesten', () => { setControleBlok('attesten'); zetTab('controle'); }, 'controle attesten'], ['Brandveiligheid', () => { setControleBlok('brand'); toonPlan('regels'); }, 'controle brandweer regels']] : []),
      ['Controle', () => zetTab('controle'), 'fouten veiligheid'],
      ['Instellingen van het plan', () => toonPlan('algemeen'), 'titelblok naam gegevens'],
      ['Fasen', () => toonPlan('fasen'), 'opbouw afbraak fase'],
      ['Achtergrondtekeningen', () => zetTab('lagen'), 'onderlegger pdf dxf'],
      ['Locatie en vaste items', () => toonPlan('algemeen'), 'plaatsfiche contactpersonen'],
      ['Regels voor de controle', () => toonPlan('regels'), 'afstandsregels hulpdiensten brandveiligheid'],
      ['Volledig scherm', () => setVolScherm((v) => !v), ''],
      ...WERKRUIMTES.map((w) => [`Werkruimte ${w.naam}`, () => kiesWerkruimte(w.id), `alt ${w.toets}`]),
      [uitgebreid ? 'Eenvoudige weergave' : 'Alle opties tonen', () => setUitgebreid(!uitgebreid), 'uitgebreid eenvoudig'],
      ...(heeftModule('terrein') ? [['Opbouwmodus (gsm)', () => { window.location.href = `/maps/${planId}/opbouw`; }, '']] : []),
    ];
    acties.forEach(([titel, doe, extra], k) => r.push({ groep: 'Acties', titel, doe, extra, standaard: k < 8 }));
    if (schrijven) {
      r.push({ groep: 'Bouwers', titel: 'Binnenplan bouwen', doe: () => kiesBouwer({ soort: 'binnen' }) });
      for (const x of TENTTYPES) { const el = bouwTenten(x.k)[0]; if (el) r.push({ groep: 'Bouwers', titel: `${x.naam} bouwen`, extra: el.naam, doe: () => kiesBouwer({ soort: 'tent', el }) }); }
      if (bouwEl.wand) r.push({ groep: 'Bouwers', titel: 'B-matrix wand bouwen', doe: () => kiesBouwer({ soort: 'element', el: bouwEl.wand, naam: 'de B-matrix wand' }) });
      if (bouwEl.truss) r.push({ groep: 'Bouwers', titel: 'Truss bouwen', doe: () => kiesBouwer({ soort: 'element', el: bouwEl.truss, naam: 'de truss' }) });
      if (bouwEl.stelling) r.push({ groep: 'Bouwers', titel: 'Stelling bouwen', doe: () => kiesBouwer({ soort: 'element', el: bouwEl.stelling, naam: 'de stelling' }) });
      r.push({ groep: 'Bouwers', titel: 'Element tekenen (tekenscherm)', doe: () => kiesBouwer({ soort: 'teken' }) });
    }
    for (const g of GEREEDSCHAP) if (g && (!['kabel', 'vast'].includes(g.id) || heeftModule('stroom')) && (schrijven || ['selecteer', 'hand', 'meten', 'meten-vlak'].includes(g.id))) r.push({ groep: 'Gereedschap', titel: g.naam, extra: g.toets ? `toets ${g.toets}` : '', doe: () => kiesTool(g.id), standaard: ['lijn', 'punt', 'rechthoek'].includes(g.id) });
    if (schrijven) for (const el of elementen) r.push({ groep: 'Elementen', titel: el.naam, extra: el.categorie, doe: () => { setGekozenElement(el); setGereedschap('element'); setTab('bibliotheek'); } });
    for (const l of lagen) r.push({ groep: 'Lagen', titel: `Laag ${l.naam}`, extra: l.zichtbaar ? '' : 'verborgen', doe: () => { setActieveLaag(l.id); zetTab('lagen'); } });
    for (const it of items) {
      const naam = it.naam || (isSign(it) ? `Bordpositie ${it.velden.sign.nr}` : null);
      if (!naam) continue;
      r.push({ groep: 'Items op de kaart', titel: naam, extra: elementenMap.get(it.element_id)?.naam || lagenMap.get(it.laag_id)?.naam || '', doe: () => kiesItemOpKaart(it.id) });
    }
    return r;
  };

  // Laag waarin nieuwe items komen, zichtbaar in de tekenbalk.
  const laagKies = (
    <label className="fm-laagkies" title="Nieuwe items komen in deze laag" onClick={(e) => e.stopPropagation()}>
      <i style={{ background: lagenMap.get(actieveLaag)?.kleur || '#686D76' }} />
      <select value={actieveLaag || ''} onChange={(e) => setActieveLaag(e.target.value)} aria-label="Laag voor nieuwe items">
        <LaagOpties lagen={lagen} />
      </select>
    </label>
  );
  const kiesGereedschap = (id) => {
    setGereedschap(id);
    if (id === 'element') setTab('bibliotheek');
    else if (gereedschap === 'element' && tab === 'bibliotheek') setTab(null); // bibliotheek ging open met Element: mee dicht
  };
  const elementUitleg = gereedschap === 'element' && gekozenElement
    ? `${gekozenElement.naam}${['schaal', 'sjabloon'].includes(gekozenElement.tekenwijze) ? ` · draaiing ${elementRot}°` : ''} · ${isBouwElement(gekozenElement) ? 'klik waar het moet komen: de bouwer opent meteen' : gekozenElement.tekenwijze === 'lijn' ? (lijnStuks ? `klik om te plaatsen · R = draaien · Alt = vrij · Esc = stoppen` : 'teken de lijn') : gekozenElement.eigenschappen?.module ? (PLAAT_LEG.find((x) => x[0] === plaatLeg)?.[4] || '') : 'klik om te plaatsen'}`
    : null;

  const kiesTool = (id) => {
    bouwerRef.current = null;
    kiesGereedschap(id);
    const gr = GROEPEN.find((x) => x.tools.includes(id));
    if (gr) setLaatsteTool((l) => ({ ...l, [gr.id]: id }));
    setUitklap(null);
  };
  // Bouwers: de elementen die met een bouwer opgebouwd worden.
  const TENT_VOORKEUR = { kader: /10 m breed \(per travee 5/, boog: /15 m/, pagode: /5 × 5/, vouw: /3×3|3 × 3/, stretch: /10 × 15/, sail: /12 × 18/ };
  // Laatst gebruikte tent (anders een kadertent van 10 m): daarmee start een nieuwe tent, de rest kies je in de bouwer.
  const standaardUnit = elementen.find((e) => e.actief !== false && !e.plan_id && /BU-06-CD/.test(e.naam || '')) || elementen.find((e) => e.actief !== false && !e.plan_id && isUnitEl(e)) || null;
  const standaardTent = (() => {
    let id = null; try { id = localStorage.getItem('fm-tent-laatst'); } catch {}
    const l = elementen.filter((e) => e.actief !== false && !e.plan_id && isTentBouw(e));
    return l.find((e) => e.id === id) || l.find((e) => tentTypeVan(e) === 'kader' && Number(e.diepte_m) === 10 && !e.leverancier) || l.find((e) => tentTypeVan(e) === 'kader') || l[0] || null;
  })();
  const bouwTenten = (type) => elementen.filter((e) => e.actief !== false && isTentBouw(e) && tentTypeVan(e) === type).sort((a, b) => (TENT_VOORKEUR[type]?.test(b.naam) ? 1 : 0) - (TENT_VOORKEUR[type]?.test(a.naam) ? 1 : 0) || (Number(a.diepte_m) || 0) - (Number(b.diepte_m) || 0) || a.naam.localeCompare(b.naam, 'nl'));
  const bouwEl = {
    wand: elementen.find((e) => e.actief !== false && isBouwElement(e) && e.eigenschappen?.wand),
    truss: elementen.filter((e) => e.actief !== false && isBouwElement(e) && /truss/i.test(e.categorie || '') && !e.eigenschappen?.wand && !e.eigenschappen?.stelling).sort((a, b) => (/f34/i.test(b.naam) ? 1 : 0) - (/f34/i.test(a.naam) ? 1 : 0))[0],
    stelling: elementen.find((e) => e.actief !== false && isBouwElement(e) && e.eigenschappen?.stelling),
  };
const bouwRij = (sleutel, icoon, naam, uitleg, doe, extra = {}) => (
    <button key={sleutel} type="button" disabled={!schrijven} className={`fm-tekenrij${extra.aan ? ' aan' : ''}`} onClick={doe} aria-expanded={extra.open}>
      <span className="ic"><Icoon naam={icoon} maat={20} /></span>
      <span className="tekst"><b>{naam}</b>{uitleg && <small>{uitleg}</small>}</span>
      {extra.tel != null && <kbd>{extra.tel}</kbd>}
    </button>
  );
  const kiesBouwer = (k) => {
    setBouwMenu(null); setUitklap(null); setTab(null);
    if (k.soort === 'element') { bouwerRef.current = null; setGekozenElement(k.el); setGereedschap('element'); setMelding(`Klik waar ${k.naam} moet komen: de bouwer opent meteen.`); return; }
    if (k.soort === 'binnen') { kiesGereedschap('binnenlocatie'); bouwerRef.current = { soort: 'binnen' }; setMelding('Klik op het gebouw of de plek: het binnenplan opent meteen.'); return; }
    kiesGereedschap('bouwer'); bouwerRef.current = k;
    setMelding(k.soort === 'teken' ? 'Klik waar het element moet komen: het tekenscherm opent op die plek.' : k.soort === 'unit' ? 'Klik waar de units moeten komen: de containerbouwer opent meteen.' : 'Klik waar de tent moet komen: de tentbouwer opent meteen.');
  };
  // Groepen: één naam per groep (plan.instellingen.groepen), de onderdelen zelf hebben geen naam.
  const groepNaam = (gid) => (plan?.instellingen?.groepen || []).find((g) => g.id === gid)?.naam || '';
  const zetGroepNaam = (gid, naam) => {
    const lijst = (st.current.plan?.instellingen?.groepen || []).filter((g) => g.id !== gid);
    if (naam) lijst.push({ id: gid, naam });
    wijzigPlan({ instellingen: { ...(st.current.plan?.instellingen || {}), groepen: lijst } });
  };
  const vraagGroepNaam = async (gid) => { const n = await vraagTekst('Naam van de groep', groepNaam(gid), { titel: 'Groep', ok: 'Bewaren' }); if (n != null) zetGroepNaam(gid, n.trim()); };
  // Het ⋯-menu van het detailpaneel (Paneel.jsx): één lijst voor alles over dit item, ook via rechtermuisknop.
  const paneelActie = async (soort, arg) => {
    const it = item; if (!it) return;
    const sel = selectie.length ? selectie : [it.id];
    switch (soort) {
      case 'zoom': zoomNaar(it); break;
      case 'melding': setMelding(String(arg || '')); break;
      case 'dupliceren': dupliceer(it.id); break;
      case 'kopieer': kopieer(sel); break;
      case 'verbergen': wijzigItem(it.id, { verborgen: true }); try { tdRef.current?.deselectFeature(it.id); } catch {} setGeselecteerd(null); setTimeout(syncTd, 0); setMelding('Item verborgen. Terug zichtbaar maken via Lagen (oogje bij het item).'); break;
      case 'vastzetten': wijzigItem(it.id, { vergrendeld: !it.vergrendeld }); setTimeout(syncTd, 0); break;
      case 'iso': if (it.groep_id) { setIso(it.groep_id); setGeselecteerd(null); setExtra([]); } break;
      case 'groep-naam': if (it.groep_id) vraagGroepNaam(it.groep_id); break;
      case 'groeperen': if (selectie.length > 1) multiActie('groeperen'); else setMelding('Selecteer eerst meerdere items (Shift + klik) om te groeperen.'); break;
      case 'degroeperen': multiActie('degroeperen'); break;
      case 'verleng': setVerleng({ id: it.id, kant: null }); setGereedschap('verleng'); break;
      case 'knip': setKnipId(it.id); setGereedschap('knip'); break;
      case 'omkeren': {
        // Tekenrichting omkeren: punten, bochten, koord en doeken per hek draaien mee.
        const g = it.geometrie; if (g?.type !== 'LineString') break;
        const n = g.coordinates.length - 1;
        const p0 = it.parameters || {}; const par = { ...p0 };
        if (p0.bogen) par.bogen = Object.fromEntries(Object.entries(p0.bogen).map(([k, v]) => [String(n - 1 - Number(k)), -Number(v)]));
        if (Array.isArray(p0.koord)) par.koord = p0.koord.map((k) => n - 1 - Number(k));
        if (Array.isArray(p0.vlaggen)) par.vlaggen = p0.vlaggen.map((k) => n - Number(k));
        if (p0.vlagBegin || p0.vlagEind) { par.vlagBegin = p0.vlagEind; par.vlagEind = p0.vlagBegin; }
        if (p0.openingen?.length) par.openingen = keerOpeningen(p0.openingen, g.coordinates);
        const velden = it.velden ? { ...it.velden } : undefined;
        if (velden?.doeken) velden.doeken = [...velden.doeken].reverse();
        if (velden?.vlaggen) velden.vlaggen = [...velden.vlaggen].reverse();
        if (velden?.doek_kant && velden.doek_kant !== 'beide') velden.doek_kant = velden.doek_kant === 'links' ? 'rechts' : 'links';
        const geometrie = { type: 'LineString', coordinates: [...g.coordinates].reverse() };
        wijzigItem(it.id, { geometrie, parameters: par, ...(velden ? { velden } : {}) });
        try { tdRef.current?.updateFeatureGeometry(it.id, geo.rondGeom(geometrie)); } catch { setTimeout(syncTd, 0); }
        setMelding('Tekenrichting omgekeerd: nummering, pootjes en doeken draaien mee.');
        break;
      }
      case 'punten-wissen': setPuntWissen((v) => !v); break;
      case 'route': routeAanpassen(it.id); break;
      case 'evenwijdig': setEvenwijdigOpen(it.id); break;
      case 'bewaar-element': bewaarAlsElement(it.id); break;
      case 'sjabloon': bewaarSjabloon([it.id]); break;
      case 'verwijderen': verwijderItems(sel); break;
      default: actie(soort, arg);
    }
  };
  const kiesGroepOpKaart = (gid) => {
    const ids = items.filter((x) => x.groep_id === gid).map((x) => x.id);
    if (!ids.length) return;
    setGeselecteerd(ids[0]); setExtra(ids.slice(1));
    try { tdRef.current?.selectFeature(ids[0]); } catch {}
    zoomNaar(items.find((x) => x.id === ids[0]));
  };
  const kiesItemOpKaart = (id) => { setGeselecteerd(id); try { tdRef.current?.selectFeature(id); } catch {} zoomNaar(items.find((x) => x.id === id)); };
  // Detail rechts per discipline (enkel als het item erbij hoort; anders de gewone eigenschappen).
  const wrDetail = (() => {
    if (!item || werkruimte === 'plan') return null;
    const el = item.element_id ? elementenMap.get(item.element_id) : null;
    if (werkruimte === 'sign' && isVerkeer(item)) return <VerkeerDetail plan={plan} items={items} item={item} schrijven={schrijven} onWijzigItem={(id, patch) => wijzigItem(id, patch)} onKiesItem={kiesItemOpKaart} />;
    if (werkruimte === 'sign' && isSign(item)) return <SignPuntDetail plan={plan} items={items} punt={item} schrijven={schrijven} onWijzigItem={(id, patch) => wijzigItem(id, patch)} onKiesItem={kiesItemOpKaart} nav compact={false} />;
    if (werkruimte === 'stroom' && (stroomVan(item, el).rol || wrFocus?.has(item.id))) return <StroomDetail item={item} el={el} stroom={stroomRes} items={items} elementenMap={elementenMap} vast={vast} schrijven={schrijven} onKiesItem={kiesItemOpKaart} onKabel={tekenKabel} onZet={(patch) => wijzigItem(item.id, { velden: { ...(item.velden || {}), stroom: { ...(item.velden?.stroom || {}), ...patch } } })} />;
    if (werkruimte === 'veiligheid' && veiligRes) {
      const c = veiligRes.tenten.find((t) => t.id === item.id);
      if (c) return <VeiligheidDetail c={c} R={veiligRes.R} ib={veiligRes.ib} schrijven={schrijven} onUitgang={() => uitgangTekenen(item)} onPersonen={(v) => wijzigItem(item.id, { velden: { ...(item.velden || {}), personen: v } })} onPubliek={(v) => wijzigItem(item.id, { velden: { ...(item.velden || {}), publiek: v } })} />;
    }
    return null;
  })();
  const cijfers = plan ? kerncijfers(werkruimte, { items, stroom: stroomRes, sign: signRes, veilig: veiligRes, verkeer: verkeerRes, branding: brandingRes, tv: tvRes }) : '';

  const paneelOpen = !volScherm && tab;
  const eigenschappenOpen = !volScherm && !!item;
  const veelSel = selectie.length > 1 && !groepSel; // meerdere losse items: selectiepaneel i.p.v. de eigenschappen van één
  const vastOpen = !volScherm && !!vastSel && !item;
  const plaatsOpen = schrijven && !volScherm && !item && gereedschap === 'element' && !!gekozenElement;
  const planOpen = !!plan && !volScherm && !item && !vastSel && !plaatsOpen && !binnen && planZicht;
  const gTool = (id) => GEREEDSCHAP.find((x) => x && x.id === id);
  // Feedback: wat er nu te zien is (scherm, werkruimte, gereedschap, item, tab, kaartbeeld).
  fbRef.current = () => {
    const s0 = st.current; const it = s0.geselecteerd ? s0.items.find((x) => x.id === s0.geselecteerd) : null;
    const el = it?.element_id ? elementenMap.get(it.element_id) : null;
    const m = mapRef.current; let zoom = null; let centrum = null;
    try { zoom = Math.round(m.getZoom() * 10) / 10; const c = m.getCenter(); centrum = [Number(c.lng.toFixed(6)), Number(c.lat.toFixed(6))]; } catch {}
    const tab = typeof document !== 'undefined' ? document.querySelector('.fm-eigenschappen .fm-paneeltabs .aan')?.textContent?.trim() : null;
    return {
      scherm: s0.binnen ? 'Binnenplan' : 'Plan bewerken', kaart: m, plan: s0.plan ? { id: s0.plan.id, naam: s0.plan.naam } : null,
      werkruimte: werkruimteOp(s0.werkruimte)?.naam || s0.werkruimte, gereedschap: gTool(s0.gereedschap)?.naam || s0.gereedschap,
      plaatsen: s0.gereedschap === 'element' && s0.gekozenElement ? s0.gekozenElement.naam : null,
      item: it ? { id: it.id, naam: it.naam || null, soort: it.soort, element: el?.naam || null, familie: FAMILIE_NAAM[familieVan(it, el)] || null, laag: lagenMap.get(it.laag_id)?.naam || null } : null,
      selectie: (s0.extra?.length || 0) + (s0.geselecteerd ? 1 : 0), tab: tab || null, zoom, centrum,
      gebruiker: profiel?.display_name || profiel?.email || null,
    };
  };

  const snapAan = ['punten', 'lijnen', 'hoek', 'midden', 'grb'].filter((k) => snap[k]).length;

  return (
    <div className="fm fm-editor" onClick={() => { if (menu) setMenu(null); if (uitklap) setUitklap(null); }}>
      <header className={`fm-topbalk fm-wr-${werkruimte}`}>
        <a className="fm-terug" href="/maps/plannen" aria-label="Terug naar de plannen"><Icoon naam="terug" /></a>
        <div className="fm-titel">
          <small style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{planEvent && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: planEvent.kleur, flex: 'none' }} />}{planEvent?.naam || plan.editie_naam || 'Eventplan'}{plan.locatie ? ` · ${plan.locatie}` : ''}</small>
          <strong>{plan.naam}</strong>
        </div>
        <WerkruimteBalk actief={werkruimte} onKies={kiesWerkruimte} badges={{ veiligheid: brandFouten }} />
        <ClaimKnop wr={wr} claim={plan.instellingen?.claims?.[werkruimte]} mijnUid={profiel?.id} schrijven={schrijven}
          onClaim={() => zetClaim(werkruimte, nieuweClaim(profiel.id, mijnNaam || 'Collega', kleurVoor(profiel.id)))}
          onVrij={() => { const c = geldigeClaim(plan.instellingen?.claims?.[werkruimte]); zetClaim(werkruimte, c?.uid === profiel?.id ? null : nieuweClaim(profiel.id, mijnNaam || 'Collega', kleurVoor(profiel.id))); }} />
        <ZoekBalk items={items} elementenMap={elementenMap} lagenMap={lagenMap} kaart={() => mapRef.current} onKiesItem={kiesItemOpKaart} />
        {schrijven && (
          <div className="fm-ongedaan" role="group" aria-label="Ongedaan maken en opnieuw">
            <button className="fm-knop" title="Ongedaan maken (Ctrl Z)" aria-label="Ongedaan maken" onClick={() => ongedaan(false)}><Icoon naam="ongedaan" maat={16} /></button>
            <button className="fm-knop" title="Opnieuw (Ctrl Shift Z)" aria-label="Opnieuw" onClick={() => ongedaan(true)}><Icoon naam="opnieuw" maat={16} /></button>
          </div>
        )}
        {/* Weergave: ondergrond, fase en verdieping in één knop, zodat de topbalk niet te lang wordt. */}
        {(() => {
          const heeftVerd = verdFilter != null || items.some((i) => Number(i.velden?.verdieping) > 0);
          const filter = (actieveFase ? 1 : 0) + (verdFilter != null ? 1 : 0);
          const fn = actieveFase ? fasen.find((f) => f.id === actieveFase)?.naam : null;
          return (
            <div style={{ position: 'relative' }}>
              <button data-menuknop className={`fm-knop fm-weergaveknop${filter ? ' filter' : ''}`} aria-expanded={menu === 'weergave'} title="Ondergrond, fase en verdieping"
                onClick={(e) => { e.stopPropagation(); setMenu(menu === 'weergave' ? null : 'weergave'); }}>
                <Icoon naam="lagen" maat={15} /><span className="lbl">{fn || ONDERGRONDEN[plan.basiskaart]?.naam || 'Weergave'}</span>{filter > 0 && <em>{filter}</em>}<Icoon naam="pijlomlaag" maat={12} />
              </button>
              {menu === 'weergave' && (
                <div className="fm-menu fm-weergavemenu" style={{ right: 0, top: 34 }} onClick={(e) => e.stopPropagation()}>
                  <div className="fm-ctxkop">Ondergrond</div>
                  {Object.entries(ONDERGRONDEN).map(([k, v]) => <button key={k} role="menuitemradio" aria-checked={plan.basiskaart === k} className={plan.basiskaart === k ? 'aan' : ''} onClick={() => wijzigPlan({ basiskaart: k })}><span style={{ flex: 1 }}>{v.naam}</span>{plan.basiskaart === k && <Icoon naam="vink" maat={14} />}</button>)}
                  {String(plan.basiskaart || 'luchtfoto').startsWith('luchtfoto') && inVlaanderen(mapRef.current ? mapRef.current.getCenter().toArray() : plan.centrum) && (() => {
                    const keys = Object.keys(FOTO_VL); const nu = FOTO_VL[plan.instellingen?.fotoVl] ? plan.instellingen.fotoVl : 'winter'; const i = keys.indexOf(nu);
                    const zetInst = (patch) => wijzigPlan({ instellingen: { ...(st.current.plan?.instellingen || {}), ...patch } });
                    const kies = (k) => zetInst({ fotoVl: k });
                    const sch = Number(plan.instellingen?.schaduw) || 0;
                    return (
                      <div className="fm-veld">Luchtfoto Vlaanderen
                        <div className="fm-fotojaar">
                          <button type="button" className="fm-knop klein" disabled={i <= 0} aria-label="Vorige opname" onClick={() => kies(keys[i - 1])}>‹</button>
                          <select aria-label="Luchtfoto Vlaanderen" value={nu} onChange={(e) => kies(e.target.value)}>
                            {['Winter', 'Zomer'].map((gr) => <optgroup key={gr} label={gr}>{Object.entries(FOTO_VL).filter(([, v]) => v.groep === gr).map(([k, v]) => <option key={k} value={k}>{v.naam}</option>)}</optgroup>)}
                          </select>
                          <button type="button" className="fm-knop klein" disabled={i >= keys.length - 1} aria-label="Volgende opname" onClick={() => kies(keys[i + 1])}>›</button>
                        </div>
                        <span className="fm-sub">Schaduw ophelderen</span>
                        <div className="fm-segment">{SCHADUW.map(([k, n]) => <button key={k} type="button" className={sch === k ? 'aan' : ''} onClick={() => zetInst({ schaduw: k || undefined })}>{n}</button>)}</div>
                      </div>
                    );
                  })()}
                  {fasen.length > 0 && (
                    <label className="fm-veld">Fase
                      <select aria-label="Fase" value={actieveFase || ''} onChange={(e) => setActieveFase(e.target.value || null)}>
                        <option value="">Alle fasen</option>
                        {fasen.map((f) => <option key={f.id} value={f.id}>{f.naam}</option>)}
                      </select>
                    </label>
                  )}
                  {heeftVerd && (
                    <label className="fm-veld" title="Eén verdieping scherp tonen, de rest gedimd">Verdieping
                      <select aria-label="Verdieping" value={verdFilter ?? ''} onChange={(e) => setVerdFilter(e.target.value === '' ? null : Number(e.target.value))}>
                        <option value="">Alle verdiepingen</option>
                        <option value="0">Gelijkvloers</option>
                        <option value="1">Verdieping 1</option>
                        <option value="2">Verdieping 2</option>
                      </select>
                    </label>
                  )}
                </div>
              )}
            </div>
          );
        })()}
        <Aanwezigen anderen={anderen} items={items} muisAan={muisAan} onMuisAan={setMuisAan}
          naamVan={(it) => it.naam || elementenMap.get(it.element_id)?.naam || (isSign(it) ? `bordpunt ${it.velden.sign.nr}` : 'een item')}
          onVolg={(p) => {
            const id = p.bewerkt || p.selectie?.[0];
            const it = id && items.find((x) => x.id === id);
            if (p.werkruimte && p.werkruimte !== werkruimte) kiesWerkruimte(p.werkruimte);
            if (it) zoomNaar(it); else { const m = muizen.current.get(p.key); if (m) mapRef.current?.easeTo({ center: m.marker.getLngLat() }); }
          }} />
        <div style={{ position: 'relative' }}>
          <button data-menuknop className={`fm-bewaard ${bewaarStatus === 'Niet bewaard' ? 'fout' : bewaarStatus === 'Wacht op verbinding' || verbinding === 'offline' ? 'offline' : bewaarStatus === 'Bewaren…' || verbinding === 'verbinden' ? 'bezig' : 'ok'}`}
            title={verbinding === 'live' ? 'Live: wijzigingen van collega\'s verschijnen meteen' : verbinding === 'offline' ? 'Geen live verbinding: je ziet wijzigingen van collega\'s pas na herverbinden' : 'Verbinden…'}
            onClick={(e) => { e.stopPropagation(); setMenu(menu === 'versie' ? null : 'versie'); }}>
            <i aria-hidden />
            {/* Alles in orde: enkel het groene bolletje en de versie; tekst alleen als er iets aan de hand is. */}
            {(['Niet bewaard', 'Wacht op verbinding', 'Bewaren…'].includes(bewaarStatus) || verbinding === 'offline') && <span>{bewaarStatus === 'Niet bewaard' ? 'Niet bewaard' : bewaarStatus === 'Wacht op verbinding' ? 'Offline · wacht' : bewaarStatus === 'Bewaren…' ? 'Bewaren…' : 'Bewaard · niet live'}</span>}
            <small>v{plan.versie}{plan.status === 'definitief' ? ' · definitief' : ''}</small>
          </button>
          {menu === 'versie' && (
            <div className="fm-menu" style={{ right: 0, top: 34, minWidth: 230 }} onClick={(e) => e.stopPropagation()}>
              <div className="fm-ctxkop">{bewaarStatus === 'Niet bewaard' ? 'Een wijziging is niet bewaard. Controleer je verbinding.' : bewaarStatus === 'Wacht op verbinding' ? 'Je bent offline. Je wijzigingen staan klaar en worden bewaard zodra je weer verbinding hebt.' : verbinding === 'live' ? 'Elke wijziging wordt meteen bewaard. Live: je ziet wat collega\'s doen.' : 'Elke wijziging wordt meteen bewaard. De live verbinding is weg; wijzigingen van collega\'s verschijnen zodra ze terug is.'}</div>
              {schrijven && <button onClick={() => { setMenu(null); versieBewaren(); }}>Versie bewaren<small>Een vast moment om naar terug te keren</small></button>}
              <button onClick={() => { setMenu(null); toonPlan('geschiedenis'); }}>Alle versies</button>
              {schrijven && <button onClick={() => { setMenu(null); setUitvoer({ tab: 'importeren' }); }}>Importeren<small>KML, GPX, CSV of een CAD-plan</small></button>}
            </div>
          )}
        </div>
        <FeedbackKnop />
        <button className="fm-knop fm-ikoon" title="Volledig scherm: panelen verbergen" aria-label="Volledig scherm" aria-pressed={volScherm} onClick={() => setVolScherm((v) => !v)}><Icoon naam="scherm" maat={16} /></button>
        <span className="fm-scheiding" aria-hidden />
        <button className="fm-knop rood" title="Deellinks en PDF's per ontvanger, en snel exporteren" onClick={() => setDialoog('delen')}>{exportBezig || <><span className="fm-lang">Delen en exporteren</span><span className="fm-kort">Delen</span></>}</button>
      </header>

      <div className="fm-romp">
        <nav className="fm-gereedschap" aria-label="Gereedschap" style={{ position: 'relative', '--wr-balk': wr.id === 'plan' ? 'var(--t-navy, #022056)' : (wr.accent || 'var(--t-navy, #022056)') }}>
          {werkruimte !== 'plan' && !alleTools && wrTools && (
            <>
              {wrTools.map((t0) => {
                const basis = gTool(t0.id);
                const t = { naam: basis?.naam, icoon: basis?.icoon, ...t0 };
                if (t.id === 'selecteer') t.naam = 'Selectie'; // zelfde naam als in Plan
                const aan = wrToolActief(t);
                const uit = !schrijven && !['selecteer', 'meten'].includes(t.id);
                return (
                  <button key={t.id} data-menuknop className={aan ? 'aan' : ''} disabled={uit} title={t.uitleg || t.naam} 
                    onClick={(e) => { e.stopPropagation(); kiesWrTool(t, e.currentTarget.getBoundingClientRect().top); }}>
                    <Icoon naam={t.icoon || 'punt'} maat={22} /><span>{t.naam}</span>
                    {t.element && elementen.filter(t.element).length > 1 && <i className="pijltje" />}
                  </button>
                );
              })}
              <hr />
              <button className="paneelknop" title="Alle gereedschap en panelen tonen" onClick={() => setAlleTools(true)}><Icoon naam="element" maat={22} /><span>Alle tools</span></button>
            </>
          )}
          {(werkruimte === 'plan' || alleTools) && <>
          {GROEPEN.map((gr0) => {
            const gr = { ...gr0, tools: gr0.tools.filter((x) => uitgebreid || !UITGEBREID_TOOLS.includes(x)) };
            const actief = gr.tools.includes(gereedschap);
            const toonId = actief ? gereedschap : (gr.tools.includes(laatsteTool[gr.id]) ? laatsteTool[gr.id] : gr.tools[0]);
            const t = gTool(toonId);
            const meer = gr.tools.length > 1 && !gr.paneel;
            const uit = !schrijven && !['selectie', 'meten'].includes(gr.id);
            return (
              <button key={gr.id} data-menuknop className={actief || (gr.paneel && tab === gr.id) ? 'aan' : ''} disabled={uit}
                title={meer ? `${gr.label}: ${gr.tools.map((x) => gTool(x).naam).join(', ')}` : t.naam}
                onMouseEnter={meer ? (e) => zweefOpen(gr.id, e.currentTarget.getBoundingClientRect().top) : undefined}
                onMouseLeave={meer ? zweefDicht : undefined}
                onClick={(e) => {
                  e.stopPropagation(); clearTimeout(zweefTimer.current);
                  if (gr.paneel) { setUitklap(null); setVolScherm(false); if (tab === gr.id) { setTab(null); return; } if (!actief) kiesTool(toonId); setTab(gr.id); return; }
                  // Nogmaals op Element: bibliotheek dicht en terug naar Selectie.
                  if (actief && gr.id === 'element') { setTab(null); kiesTool('selecteer'); return; }
                  if (gr.id === 'element') { setVolScherm(false); kiesTool('element'); return; }
                  // Selectie en Meten: klik kiest het getoonde gereedschap; de keuze zelf klapt open bij erover gaan.
                  if (!actief) kiesTool(toonId);
                  else if (meer) { setUitklapY(e.currentTarget.getBoundingClientRect().top); setUitklap(uitklap === gr.id ? null : gr.id); }
                }}>
                <Icoon naam={gr.icoon || t.icoon} maat={22} /><span>{gr.label}</span>
                {meer && <i className="pijltje" />}
              </button>
            );
          })}
          {schrijven && (
            <button data-menuknop className={gereedschap === 'bouwer' || tab === 'bouwers' ? 'aan' : ''} title="Bouwers: binnenplan, tent, B-matrix wand, truss, stelling of een element op maat tekenen"
              onClick={(e) => { e.stopPropagation(); setUitklap(null); setVolScherm(false); if (gereedschap === 'element') setGereedschap('selecteer'); setTab(tab === 'bouwers' ? null : 'bouwers'); }}>
              <Icoon naam="bouwers" maat={22} /><span>Bouwers</span>
            </button>
          )}
          {schrijven && (
            <button className={vasthouden ? 'paneelknop aan' : 'paneelknop'} aria-pressed={vasthouden} title={vasthouden ? 'Herhalen staat aan: je kunt meerdere items na elkaar tekenen of plaatsen. Klik om na elk item terug te gaan naar Selectie.' : 'Wil je meerdere items na elkaar tekenen of plaatsen (bv. 10 tenten)? Zet Herhalen aan.'}
              onClick={() => setVasthouden((v) => !v)}>
              <Icoon naam={vasthouden ? 'slot' : 'slotopen'} maat={20} /><span>{vasthouden ? 'Herhaal aan' : 'Herhaal'}</span>
            </button>
          )}
          <hr />
          {[...PANELEN.slice(0, 2), ...(uitgebreid || tab === 'draaiboek' ? [['draaiboek', 'Draaiboek', 'lijstje']] : []), ...PANELEN.slice(2)]
            .filter(([id]) => (id !== 'stroom' || heeftModule('stroom')) && (id !== 'sign' || heeftModule('signalisatie')))
            .map(([id, label, ic]) => {
            // Materiaal opent het volledige materiaalscherm (geen zijpaneel).
            const aan = id === 'materiaal' ? materiaalOpen : tab === id;
            return (
              <button key={id} className={`paneelknop${aan && !volScherm ? ' aan' : ''}`} title={PANEELTIP[id]} aria-label={label} aria-pressed={aan}
                onClick={() => { if (id === 'materiaal') { setMateriaalOpen(true); return; } setVolScherm(false); if (aan) setTab(null); else setTab(id); }}>
                <Icoon naam={ic} maat={22} /><span>{label}</span>
                {id === 'controle' && controleFouten > 0 && <i className="fm-badge">{controleFouten}</i>}
              </button>
            );
          })}
          {werkruimte !== 'plan' && <button className="paneelknop" title={`Terug naar het gereedschap van ${wr.naam}`} onClick={() => setAlleTools(false)}><Icoon naam="terug" maat={22} /><span>{wr.naam}</span></button>}
          </>}
          <button className={`paneelknop fm-instelknop${planOpen ? ' aan' : ''}`} title="Instellingen van het plan: gegevens, fasen, regels en versies" aria-pressed={planOpen}
            onClick={() => (planOpen ? zetPlanZicht(false) : toonPlan(null))}>
            <Icoon naam="instellingen" maat={22} /><span>Instellingen</span>
          </button>
        </nav>
        {uitklap && (
            <div className="fm-uitklap" style={{ top: uitklapY }} onClick={(e) => e.stopPropagation()} onMouseEnter={zweefBlijf} onMouseLeave={zweefDicht}>
              {(() => { const gr = GROEPEN.find((g) => g.id === uitklap); return gr.tools.filter((x) => uitgebreid || !UITGEBREID_TOOLS.includes(x)).map((id) => {
                const t = gTool(id);
                const uit = !schrijven && !['selecteer', 'hand', 'meten', 'meten-vlak'].includes(id);
                return <Fragment key={id}>{gr.scheiding === id && <hr />}<button disabled={uit} className={gereedschap === id ? 'aan' : ''} onClick={() => kiesTool(id)}><Icoon naam={t.icoon} maat={16} />{t.naam}<kbd>{t.toets}</kbd></button></Fragment>;
              }); })()}
            </div>
          )}

        {paneelOpen && (
          <aside className="fm-paneel">
            <div className="fm-paneelkop"><span>{tab === 'wrlijst' ? wrTool(wrLijst?.id)?.naam || 'Kiezen' : PANEELNAAM[tab]}</span><button className="fm-sluit" aria-label="Paneel sluiten" onClick={() => setTab(null)}>×</button></div>
            <div className="fm-paneel-inhoud">
              {tab === 'tekenen' && (
                <div className="fm-teken">
                  {TEKEN_DELEN.map((d) => (
                    <section key={d.naam}>
                      <h3>{d.naam}</h3>
                      {d.tools.filter((x) => uitgebreid || !UITGEBREID_TOOLS.includes(x)).map((id) => {
                        const t = gTool(id); if (!t) return null;
                        const uit = !schrijven;
                        return (
                          <button key={id} type="button" disabled={uit} className={`fm-tekenrij${gereedschap === id ? ' aan' : ''}`} onClick={() => kiesTool(id)}>
                            <span className="ic"><Icoon naam={t.icoon} maat={20} /></span>
                            <span className="tekst"><b>{t.naam}</b>{UITLEG[id] && <small>{UITLEG[id].split(' · ')[0]}</small>}</span>
                            {t.toets && <kbd>{t.toets}</kbd>}
                          </button>
                        );
                      })}
                    </section>
                  ))}
                </div>
              )}
              {tab === 'bouwers' && (
                <div className="fm-teken">
                  <section>
                    <h3>Gebouwen en tenten</h3>
                    {bouwRij('binnen', 'gebouw', 'Binnenplan', 'Klik op een gebouw: zalen, gangen en inrichting', () => kiesBouwer({ soort: 'binnen' }))}
                    {/* Eén ingang voor alle tenten: soort, breedte en gekoppelde tenten kies je in de tentbouwer. */}
                    {standaardTent && bouwRij('tent', `tent-${tentTypeVan(standaardTent) || 'kader'}`, 'Tent', 'Klik op de kaart; soort, breedte en tenten ertegen kies je in de bouwer', () => kiesBouwer({ soort: 'tent', el: standaardTent }))}
                  </section>
                  {standaardUnit && (
                    <section>
                      <h3>Units</h3>
                      {bouwRij('unit', 'bouw-unit', 'Containers', 'Klik op de kaart; units, stapelen en trappen kies je in de bouwer', () => kiesBouwer({ soort: 'unit', el: standaardUnit }))}
                    </section>
                  )}
                  {(bouwEl.wand || bouwEl.truss || bouwEl.stelling) && (
                    <section>
                      <h3>Constructies</h3>
                      {bouwEl.wand && bouwRij('wand', 'bouw-wand', 'B-matrix wand', 'Teken de lijn, de wandbouwer opent meteen', () => kiesBouwer({ soort: 'element', el: bouwEl.wand, naam: 'de B-matrix wand' }))}
                      {bouwEl.truss && bouwRij('truss', 'bouw-truss', 'Truss', 'Teken de lijn, de trussbouwer opent meteen', () => kiesBouwer({ soort: 'element', el: bouwEl.truss, naam: 'de truss' }))}
                      {bouwEl.stelling && bouwRij('stelling', 'bouw-stelling', 'Stelling', 'Klik op de kaart, de stellingbouwer opent meteen', () => kiesBouwer({ soort: 'element', el: bouwEl.stelling, naam: 'de stelling' }))}
                    </section>
                  )}
                  <section>
                    <h3>Op maat</h3>
                    {bouwRij('teken', 'vrijehand', 'Element tekenen', 'Eigen vorm in het tekenscherm, komt als groep op de kaart', () => kiesBouwer({ soort: 'teken' }))}
                  </section>
                </div>
              )}
              {tab === 'lagen' && (
                <Lagenpaneel lagen={lagen} items={items} actieveLaag={actieveLaag} schrijven={schrijven}
                  onKies={setActieveLaag} onWijzig={wijzigLaag} onNieuw={nieuweLaag} onVerwijder={verwijderLaag} onRuimOp={ruimLegeLagenOp} onVolgorde={herschikLagen}
                  legeMappen={plan.instellingen?.mappen || []} onLegeMappen={(lijst) => wijzigPlan({ instellingen: { ...(plan.instellingen || {}), mappen: lijst } })}
                  geselecteerd={geselecteerd} extra={extra} onKiesItems={(ids) => { setGeselecteerd(ids[0] || null); setExtra(ids.slice(1)); }} onKiesItem={kiesItemOpKaart} groepNaam={groepNaam} onKiesGroep={kiesGroepOpKaart} onGroepNaam={vraagGroepNaam}
                  elementenMap={elementenMap} verbergElementen={plan.instellingen?.verborgen_elementen || []}
                  onVerbergElementen={(lijst) => { wijzigPlan({ instellingen: { ...(plan.instellingen || {}), verborgen_elementen: lijst } }); setTimeout(syncTd, 50); }}
                  onItemZicht={(id, zicht) => { wijzigItem(id, { verborgen: !zicht }); setTimeout(syncTd, 0); }}
                  onItemSlot={(ids, slot) => { for (const id of ids) wijzigItem(id, { vergrendeld: slot }); setTimeout(syncTd, 0); setMelding(`${ids.length === 1 ? 'Item' : `${ids.length} items`} ${slot ? 'vergrendeld' : 'ontgrendeld'}`); }}
                  onItemLaag={(ids, laagId) => { const lijst = Array.isArray(ids) ? ids : [ids]; const mee = new Map(); for (const id of lijst) { const it = items.find((x) => x.id === id); if (!it || it.vergrendeld) continue; for (const x of it.groep_id ? items.filter((y) => y.groep_id === it.groep_id) : [it]) if (x.laag_id !== laagId) mee.set(x.id, x); } for (const x of mee.values()) wijzigItem(x.id, { laag_id: laagId }); const n = mee.size; setMelding(n ? `${n === 1 ? 'Item' : `${n} items`} verplaatst naar ${lagen.find((l) => l.id === laagId)?.naam || 'andere laag'}.` : 'Niets te verplaatsen (al in die laag of vergrendeld).'); }}
                  onStijlWissen={(lid) => {
                    // Enkel wat de laag regelt; iconen, pijlen en dergelijke blijven.
                    const SLEUTELS = ['kleur', 'vulkleur', 'dikte', 'dikte_eenheid', 'streep', 'vulpatroon', 'vuldekking', 'label', 'wit_rand', 'tekstgrootte', 'dekking'];
                    for (const x of st.current.items) {
                      if (x.laag_id !== lid || !x.stijl) continue;
                      if (!SLEUTELS.some((k) => k in x.stijl)) continue;
                      const rest = Object.fromEntries(Object.entries(x.stijl).filter(([k]) => !SLEUTELS.includes(k)));
                      wijzigItem(x.id, { stijl: rest });
                    }
                  }} />
              )}
              {tab === 'lagen' && !binnen && (
                <PlanPaneel deel="achtergrond" plan={plan} fasen={fasen} items={items} schrijven={schrijven} kaart={mapRef.current}
                  kalibratie={kalibratie} onKalibreer={startKalibratie} onFasen={setFasen} onPlan={wijzigPlan}
                  olBewerk={olBewerk} onBewerkOl={(id) => { setOlBewerk(id); if (id) { setGereedschap('hand'); setGeselecteerd(null); setExtra([]); } }} />
              )}
              {tab === 'wrlijst' && wrLijst && (
                <BibliotheekPaneel std={levStd} alleen={wrLijst.lijst} uitleg={wrTool(wrLijst.id)?.uitleg} elementen={zonderHuis} gekozen={gekozenElement} schrijven={schrijven}
                  onKies={(el) => { setGekozenElement(el); setGereedschap('element'); }} />
              )}
              {tab === 'bibliotheek' && (
                <BibliotheekPaneel std={levStd} gebruikt={gebruiktInPlan} startCat={binnen ? 'Binnenruimte' : ({ stroom: 'Elektriciteit', veiligheid: 'Veiligheid', branding: 'Doeken en drukwerk' }[werkruimte] || wr.bibCat || null)} elementen={zonderHuis} gekozen={gekozenElement} schrijven={schrijven}
                  onKies={(el) => { setGekozenElement(el); setGereedschap('element'); }} />
              )}
              {tab === 'controle' && (
                <ControlePaneel plan={plan} lagen={lagen} items={items} elementenMap={elementenMap} lagenMap={lagenMap} fasen={fasen} schrijven={schrijven} onPlan={wijzigPlan} onKiesItem={kiesItemOpKaart} openBlok={controleBlok} vast={vast} deel="meldingen" onRegels={() => toonPlan('regels')} />
              )}
              {LIJST_IDS.includes(tab) && LIJST_TABS.filter(([k]) => uitgebreid || !['draaiboek'].includes(k) || tab === k).length > 1 && (
                <div className="fm-subtabs" role="tablist">
                  {LIJST_TABS.filter(([k]) => uitgebreid || !['draaiboek'].includes(k) || tab === k).map(([k, t]) => (
                    <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'aan' : ''} onClick={() => { laatsteLijst.current = k; setTab(k); }}>{t}</button>
                  ))}
                </div>
              )}
              {tab === 'stuklijst' && <Stuklijst items={items} elementen={elementenMap} lagen={lagenMap} actieveFase={actieveFase} fasen={fasen} groepen={plan?.instellingen?.groepen || {}} herkomst={herkomstFilter} onHerkomst={setHerkomstFilter}  std={levStd} onMateriaal={() => setMateriaalOpen(true)} />}
              {tab === 'stroom' && heeftModule('stroom') && (
                <StroomPaneel plan={plan} items={items} lagen={lagen} fasen={fasen} elementenMap={elementenMap} schrijven={schrijven} onPlan={wijzigPlan} onKiesItem={kiesItemOpKaart} onKabelgoten={legKabelgoten} vast={vast} inBeeld={vastInBeeld} gekozenVa={vastSel?.id || null} onKiesVa={kiesVa} onNieuweVa={() => { setGereedschap('vast'); setMelding('Klik op de kaart waar de vaste aansluiting staat.'); }} geselecteerd={geselecteerd} />
              )}
              {tab === 'branding' && (
                <BrandingPaneel plan={plan} items={items} doeken={doeken} elementenMap={elementenMap} schrijven={schrijven} beheerder={profiel?.role === 'admin'}
                  penseel={brandPenseel} onPenseel={(p) => { if (p) { p = { modus: brandPenseel?.modus || laatstePenseel.current?.modus, ...p }; setGereedschap('selecteer'); setDoekPenseel(null); } setBrandPenseel(p); }}
                  onOntwerp={(d, soort) => setDoeken((l) => (soort === 'nieuw' ? [...l, d] : l.map((x) => (x.id === d.id ? d : x))).sort((a, b) => a.naam.localeCompare(b.naam, 'nl')))}
                  onKiesItem={kiesItemOpKaart} onTool={(id) => { const t = wrTool(id); if (t) kiesWrTool(t, 200); }} />
              )}
              {tab === 'veiligheid' && (
                <VeiligheidPaneel plan={plan} items={items} elementenMap={elementenMap} schrijven={schrijven} onPlan={wijzigPlan} onKiesItem={kiesItemOpKaart} geselecteerd={geselecteerd}
                  onUitgangTekenen={uitgangTekenen} onTool={(id) => { const t = wrTool(id); if (t) kiesWrTool(t, 200); }} />
              )}
              {tab === 'sign' && heeftModule('signalisatie') && (
                <SignalisatiePaneel plan={plan} items={items} schrijven={schrijven} geselecteerd={geselecteerd} onRouteAanpassen={routeAanpassen} zonderDetail={werkruimte === 'sign'}
                  modus={werkruimte === 'sign' ? signModus : 'wegwijzers'} onModus={werkruimte === 'sign' ? setSignModus : null}
                  zetModus={signZet === true} onZetModus={setSignZet} onPlan={wijzigPlan} onPdf={maakSignPdf}
                  onWijzigItem={(id, patch) => wijzigItem(id, patch)} onVoorstel={signVoorstelToepassen} lagen={lagen}
                  onKiesItem={(id) => { setGeselecteerd(id); zoomNaar(items.find((x) => x.id === id)); }}
                  verkeer={werkruimte === 'sign' && signModus === 'verkeer' ? (kop) => (
                    <VerkeerPaneel kop={kop} plan={plan} items={items} schrijven={schrijven} geselecteerd={geselecteerd}
                      zetBord={typeof signZet === 'string' ? signZet : null} onZetBord={(code) => setSignZet(code || false)}
                      onTool={(id) => { const t = wr.toolsVerkeer.find((x) => x.id === id); if (t) kiesWrTool(t, 200); }}
                      onPlan={wijzigPlan} onWijzigItem={(id, patch) => wijzigItem(id, patch)} onVoorstel={signVoorstelToepassen} onExport={exporteer}
                      onKiesItem={kiesItemOpKaart} />
                  ) : null} />
              )}
              {tab === 'draaiboek' && <DraaiboekPaneel plan={plan} items={items} elementenMap={elementenMap} fasen={fasen} actieveFase={actieveFase} schrijven={schrijven} onPlan={wijzigPlan} />}
            </div>
          </aside>
        )}

        <div className="fm-kaartvak" style={{ '--fm-l': paneelOpen ? '256px' : '0px', '--fm-r': eigenschappenOpen || vastOpen || planOpen || plaatsOpen ? '320px' : '0px' }}>
          <div ref={kaartRef} className="fm-kaart" />
          {olBewerk && !binnen && kaartKlaar && (() => {
            const lijst = plan?.instellingen?.onderleggers || []; const o = lijst.find((x) => x.id === olBewerk);
            if (!o || o.binnen) return null;
            const zet = (patch) => wijzigPlan({ instellingen: { ...(st.current.plan?.instellingen || {}), onderleggers: (st.current.plan?.instellingen?.onderleggers || []).map((x) => (x.id === o.id ? { ...x, ...patch } : x)) } });
            return <OnderleggerGrepen map={mapRef.current} o={o} onKlaar={(n) => zet({ midden: n.midden, breedte: n.breedte, rot: n.rot })} onDekking={(d) => zet({ dekking: d })} onStop={() => setOlBewerk(null)} />;
          })()}
          {ewKies && gereedschap === 'evenwijdig' && (
            <div className="fm-penseelbalk" role="status">
              <span><b>Evenwijdige kopie</b> · {ewKies.a == null ? 'klik op de lijn waar het stuk begint' : 'klik waar het stuk eindigt'} · Esc stopt</span>
              <button className="fm-knop klein" onClick={() => { setEwKies(null); setGereedschap('selecteer'); }}>Annuleren</button>
            </div>
          )}
          {brandPenseel && ['hek', 'vlag'].includes(brandPenseel.drager) && (
            <div className="fm-penseelbalk" role="status">
              <span><b>{brandPenseel.id ? (elementenMap.get(brandPenseel.id)?.naam || 'Ontwerp') : 'Gom'}</b> · {brandPenseel.modus === 'stuk' ? (stukStatus || 'klik het eerste hek') : 'klik of sleep over de hekken'}</span>
              <span className="fm-segment" style={{ width: 'auto' }}>
                {[['stuk', 'Een stuk'], ['hek', 'Losse hekken']].map(([k, n]) => <button key={k} className={(brandPenseel.modus || 'hek') === k ? 'aan' : ''} onClick={() => setBrandPenseel((d) => ({ ...d, modus: k }))}>{n}</button>)}
              </span>
              <button className="fm-knop klein zwart" onClick={() => setBrandPenseel(null)}>Klaar</button>
            </div>
          )}
          {doekPenseel && (
            <div className="fm-penseelbalk" role="status">
              <span><b>{doekPenseel.naam || (doekPenseel.tb ? 'Toebehoren' : (elementenMap.get(doekPenseel.doekId)?.naam || 'Geen doek'))}</b> · {doekPenseel.modus === 'stuk' ? (stukStatus || `klik het eerste hek${doekPenseel.zijde && !doekPenseel.kant ? ' (links of rechts naast de lijn)' : ''}`) : doekPenseel.zijde && !doekPenseel.kant ? 'klik of sleep links of rechts naast de lijn' : 'klik of sleep over de hekken'}</span>
              <span className="fm-segment" style={{ width: 'auto' }}>
                {[['stuk', 'Een stuk'], ['hek', 'Losse hekken']].map(([k, n]) => <button key={k} className={(doekPenseel.modus || 'hek') === k ? 'aan' : ''} onClick={() => { const d = doekPenseel; if (d.tb) { const it = st.current.items.find((x) => x.id === d.itemId); const tb = it?.velden?.toebehoren?.[d.tb]; if (tb && tb.keuze !== k) pasToe(it, { ...it, velden: { ...it.velden, toebehoren: { ...it.velden.toebehoren, [d.tb]: { ...tb, keuze: k } } } }); } setDoekPenseel({ ...d, modus: k }); }}>{n}</button>)}
              </span>
              {doekPenseel.zijde && (
                <span className="fm-segment" style={{ width: 'auto' }}>
                  {[[null, 'Waar ik klik', 'K'], ['links', 'Links', 'L'], ['rechts', 'Rechts', 'R'], ['beide', 'Beide', 'B']].map(([k, n, t]) => <button key={n} className={(doekPenseel.kant || null) === k ? 'aan' : ''} title={`Toets ${t}`} onClick={() => setDoekPenseel((d) => ({ ...d, kant: k }))}>{n}</button>)}
                </span>
              )}
              <button className="fm-knop klein zwart" onClick={() => setDoekPenseel(null)}>Klaar</button>
            </div>
          )}
          <LaagChip lagen={lagen} actieveLaag={actieveLaag} items={items} schrijven={schrijven} onKies={setActieveLaag} onZicht={(id, z) => wijzigLaag(id, { zichtbaar: z })} onPaneel={() => { setVolScherm(false); setTab('lagen'); }} />
          {penseelTip && <div className="fm-penseeltip" style={{ left: penseelTip.x + 14, top: penseelTip.y + 14 }}><b>{penseelTip.kop}</b><span>{penseelTip.tekst}</span></div>}
          <Botsingen lijst={botsingen} onKies={losBotsingOp}
            naamVan={(it) => it?.naam || elementenMap.get(it?.element_id)?.naam || 'dit item'}
            onToon={(b) => { const it = st.current.items.find((x) => x.id === b.id) || b.server || b.mijn; if (it) { setGeselecteerd(it.id); zoomNaar(it); } }} />
          {aankondiging && <Aankondiging a={aankondiging} onKlaar={() => { setAankondiging(null); if (!aankondiging.eigen) herlaad(); }} />}
          {bezoek && !aankondiging && (
            <div className="fm-bezoek" role="status">
              <span>Sinds je vorige bezoek: {bezoek.totaal} {bezoek.totaal === 1 ? 'wijziging' : 'wijzigingen'} door {bezoek.per.map(([n, k]) => `${n} (${k})`).join(', ')}.</span>
              {bezoek.items.some((id) => items.some((x) => x.id === id)) && (
                <button className="fm-knop klein" onClick={() => { const ids = bezoek.items.filter((id) => items.some((x) => x.id === id)); setGeselecteerd(ids[0]); setExtra(ids.slice(1)); const k = geo.kader(ids.map((id) => items.find((x) => x.id === id)?.geometrie).filter(Boolean)); if (k) mapRef.current?.fitBounds(k, { padding: 80, maxZoom: 19 }); }}>Aanduiden</button>
              )}
              <button className="fm-sluit" aria-label="Sluiten" onClick={() => setBezoek(null)}>×</button>
            </div>
          )}
          {binnen && (() => {
            const host = items.find((x) => x.id === binnen.host); if (!host) return null;
            const hel = host.element_id ? elementenMap.get(host.element_id) : null;
            const vs = verdiepingenVan(host);
            const n = (v) => items.filter((x) => inBinnen(x, { host: host.id, verd: v })).length;
            const zetVs = (l) => wijzigItem(host.id, { velden: { ...(host.velden || {}), binnenplan: { ...(host.velden?.binnenplan || {}), verdiepingen: l } } });
            const ol = (plan?.instellingen?.onderleggers || []).find((o) => o.binnen?.host === host.id && (o.binnen.verd || null) === (binnen.verd || null));
            return (
              <div className="fm-isobalk fm-binnenbalk" role="toolbar" aria-label="Binnenplan">
                <button onClick={sluitBinnen} title="Terug naar het hele plan">Plan</button>
                <span aria-hidden="true">›</span>
                <strong>{host.naam || hel?.naam || 'Gebouw'}</strong>
                <span className="fm-segment" style={{ width: 'auto' }}>
                  {vs.map((v) => <button key={v.id} className={binnen.verd === v.id ? 'aan' : ''} title="Dubbelklik om de naam te wijzigen" onClick={() => setBinnen({ host: host.id, verd: v.id })} onDoubleClick={async () => { if (!schrijven) return; const t = await vraagTekst('Naam van de verdieping', v.naam); if (t) zetVs(vs.map((x) => (x.id === v.id ? { ...x, naam: t } : x))); }}>{v.naam}{n(v.id) ? ` · ${n(v.id)}` : ''}</button>)}
                </span>
                {schrijven && <button title="Verdieping toevoegen" onClick={async () => { const t = await vraagTekst('Naam van de verdieping', vs.length === 1 ? '1e verdieping' : `${vs.length}e verdieping`); if (!t) return; const id = nieuwId().slice(0, 8); zetVs([...vs, { id, naam: t }]); setBinnen({ host: host.id, verd: id }); }}>+ Verdieping</button>}
                {schrijven && vs.length > 1 && !n(binnen.verd) && <button title="Deze lege verdieping weghalen" onClick={() => { const l = vs.filter((x) => x.id !== binnen.verd); zetVs(l); setBinnen({ host: host.id, verd: l[0].id }); }}>Verdieping weg</button>}
                {schrijven && (ol
                  ? <><button title="Grondplan passen met twee punten" onClick={() => startKalibratie(ol)}>Grondplan passen</button>
                    {ol.soort === 'dxf' && <button title="Gesloten lijnen op de laag ZALEN als ruimtes overnemen, met de namen uit de tekening" onClick={() => zalenUitGrondplan(ol)}>Zalen overnemen</button>}
                    {ol.soort === 'dxf' && <button className={ruimteKlik ? 'zwart' : ''} title="Klik in een ruimte van het grondplan: de vorm eromheen wordt een ruimte met de naam uit de tekening" onClick={() => { if (ruimteKlik) { setRuimteKlik(null); setGereedschap('selecteer'); } else { setGereedschap('hand'); setRuimteKlik(ol); } }}>{ruimteKlik ? 'Klaar met ruimtes' : 'Ruimte aanklikken'}</button>}
                    <button className={binnenFoto ? 'zwart' : ''} aria-pressed={binnenFoto} onClick={() => setBinnenFoto((x) => !x)}>Luchtfoto</button>
                    <label className="fm-sub" title="Doorzichtigheid van het grondplan">Grondplan <input type="range" min="0.1" max="1" step="0.1" value={ol.dekking ?? 0.6} onChange={(e) => wijzigPlan({ instellingen: { ...(plan.instellingen || {}), onderleggers: (plan.instellingen?.onderleggers || []).map((o) => (o.id === ol.id ? { ...o, dekking: Number(e.target.value) } : o)) } })} style={{ width: 70, verticalAlign: 'middle' }} /></label></>
                  : <button title="Een PDF, foto of DXF van het grondplan van deze verdieping, om over te tekenen" onClick={() => grondplanRef.current?.click()}>+ Grondplan</button>)}
                 <input ref={grondplanRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.dxf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; grondplanToevoegen(f); }} />
                <span className="fm-sub">Teken ruimtes als vlak met een naam · alles telt mee in de stuklijst</span>
                <button className="zwart" onClick={sluitBinnen}>Klaar</button>
              </div>
            );
          })()}
          {iso && (() => {
            const groepen = plan?.instellingen?.groepen || {};
            const naam = groepen[iso]?.naam || '';
            return (
              <div className="fm-isobalk" role="toolbar" aria-label="Groep bewerken">
                <button onClick={() => setIso(null)} title="Terug naar het hele plan">Plan</button>
                <span aria-hidden="true">›</span>
                <input value={naam} placeholder="Naam van de groep" disabled={!schrijven} onChange={(e) => wijzigPlan({ instellingen: { ...(plan.instellingen || {}), groepen: { ...groepen, [iso]: { ...(groepen[iso] || {}), naam: e.target.value } } } })} aria-label="Naam van de groep" />
                <span className="fm-sub">{items.filter((x) => x.groep_id === iso).length} items · nieuw getekende items horen bij de groep</span>
                <button className="zwart" onClick={() => setIso(null)}>Klaar</button>
              </div>
            );
          })()}
          {schrijven && kaartKlaar && items.length === 0 && !tab && (
            <div className="fm-leeg">
              <strong>Zo begin je</strong>
              <ol>
                <li>Zoek je locatie in het zoekveld bovenaan en kies de ondergrond.</li>
                <li>Klik links op <b>Element</b> en zet tenten, hekken en podia op de kaart.</li>
                <li>Klaar? <b>Exporteren</b> maakt een PDF, <b>Delen</b> een link voor leveranciers.</li>
              </ol>
              <button className="fm-knop zwart" onClick={() => kiesTool('element')}>Elementen openen</button>
            </div>
          )}
          {focusLijst && !iso && (
            // Vanuit het materiaalscherm: bovenaan, met de weg terug naar precies dezelfde plek in de lijst.
            <div className="fm-focusbalk" role="status">
              <button className="terug" onClick={() => setMateriaalOpen(true)}>‹ Terug naar materiaal</button>
              <span className="tekst">Enkel <b>{focusLijst.label}</b> · {hkFocus?.size || 0} items</span>
              <button className="weg" onClick={() => { setFocusLijst(null); setMateriaalOpen(false); }} title="Alles weer tonen">Alles tonen</button>
            </div>
          )}
          {herkomstFilter && !focusLijst && !iso && (
            <div className="fm-wr-chip">
              <span>Enkel geleverd door <b>{herkomstFilter}</b> · {hkFocus?.size || 0} items</span>
              <button onClick={() => setHerkomstFilter(null)}>Alles tonen</button>
            </div>
          )}
          {werkruimte !== 'plan' && !iso && !herkomstFilter && !focusLijst && (gedimd > 0 || toonAlles) && (
            <div className="fm-wr-chip">
              <span>{toonAlles ? 'Alles zichtbaar' : `${gedimd} gedimd`}</span>
              <button onClick={() => setToonAlles((v) => !v)}>{toonAlles ? `Enkel ${wr.naam.toLowerCase()}` : 'Toon alles'}</button>
            </div>
          )}
          <div ref={tipRef} className="fm-cursortip" style={{ display: 'none' }} />
          {vpKeuze && (() => { const o = veldpunten.find((x) => x.id === vpKeuze.id); if (!o) return null; return (
            <div className="fm-zwevend fm-vp-keuze" style={{ left: Math.min(vpKeuze.x + 12, (mapRef.current?.getCanvas().clientWidth || 800) - 300), top: vpKeuze.y + 12 }} onMouseDown={(e) => e.stopPropagation()}>
              <div className="fm-vp-kop"><strong>📍 {o.tekst}</strong><button type="button" className="fm-x" aria-label="Sluiten" onClick={() => setVpKeuze(null)}>×</button></div>
              <div className="fm-sub">Veldpunt van {o.auteur_naam || 'een collega'}{o.deel_link_id ? ' (deellink)' : ''} · {new Date(o.created_at).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })}</div>
              {schrijven && <div className="fm-vp-knoppen"><button type="button" className="fm-knop klein" onClick={() => vpAfhandelen(o)}>Afgehandeld</button><button type="button" className="fm-knop klein zwart" onClick={() => vpIntekenen(o)}>Intekenen als punt</button></div>}
            </div>); })()}
          {ctxMenu && (
            <div className="fm-ctxmenu-achter" onMouseDown={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}>
              <div className="fm-menu fm-ctxmenu" style={{ left: Math.max(4, Math.min(ctxMenu.x, (mapRef.current?.getContainer().clientWidth || 9999) - 230)), top: Math.max(4, Math.min(ctxMenu.y, (mapRef.current?.getContainer().clientHeight || 9999) - 390)) }} onMouseDown={(e) => e.stopPropagation()} onClick={() => setCtxMenu(null)}>
                {(() => {
                  const it = ctxMenu.id ? items.find((x) => x.id === ctxMenu.id) : null;
                  if (it && selectie.length > 1 && selectie.includes(it.id)) {
                    return <>
                      <div className="fm-ctxkop">{selectie.length} geselecteerd</div>
                      {groepSel && !iso && <button onClick={() => { setIso(it.groep_id); setGeselecteerd(null); setExtra([]); }}>Groep bewerken (geïsoleerd)</button>}
                      {schrijven && <button onClick={() => { setCtxMenu(null); openTekenscherm(selectie); }}>Openen in tekenscherm</button>}
                      <button onClick={() => multiActie(groepSel ? 'degroeperen' : 'groeperen')}>{groepSel ? 'Groep opheffen' : 'Groeperen'}</button>
                      <button onClick={() => multiActie('dupliceren')}><Icoon naam="kopie" maat={14} />Dupliceren</button>
                      <button onClick={() => kopieer(selectie)}>Kopiëren</button>
                      <button className="gevaar" onClick={() => multiActie('verwijderen')}><Icoon naam="prullenbak" maat={14} />Verwijderen</button>
                    </>;
                  }
                  if (it) {
                    const lijn = it.geometrie?.type === 'LineString';
                    return <>
                      <div className="fm-ctxkop">{it.naam || elementenMap.get(it.element_id)?.naam || it.soort}</div>
                      <div className="fm-menukop">Hier</div>
                      {lijn && <button onClick={() => knipLijn(it.id, ctxMenu.lngLat)}><Icoon naam="schaar" maat={14} />Hier knippen</button>}
                      {lijn && paalPerPunt(elementenMap.get(it.element_id)) && (() => {
                        // Paal en net: dit vak zonder net (enkel een koord), of weer net.
                        const c = it.geometrie.coordinates; let k = 0; let best = Infinity;
                        for (let j = 0; j < c.length - 1; j++) { const d = turf.pointToLineDistance(turf.point(ctxMenu.lngLat), turf.lineString([c[j], c[j + 1]]), { units: 'meters' }); if (d < best) { best = d; k = j; } }
                        const ko = koordVan(it); const aan = ko.has(k);
                        return <button onClick={() => { const n = new Set(ko); if (aan) n.delete(k); else n.add(k); const l = [...n].sort((a, b) => a - b); wijzigItem(it.id, { parameters: { ...(it.parameters || {}), koordAlles: undefined, koord: l.length ? l : undefined } }); setCtxMenu(null); }}>{aan ? 'Dit vak weer met net' : 'Dit vak: koord (net weg)'}</button>;
                      })()}
                      {it.geometrie && it.geometrie.type !== 'Point' && (() => {
                        // Gele vlag op het dichtste knooppunt (paal, hekeinde).
                        const c = it.geometrie.type === 'LineString' ? it.geometrie.coordinates : it.geometrie.coordinates[0];
                        let q = c[0]; let bd = Infinity; for (const v of c) { const d = turf.distance(v, ctxMenu.lngLat, { units: 'meters' }); if (d < bd) { bd = d; q = v; } }
                        const vl = it.parameters?.vlaggen || []; const heeft = vl.some((v) => turf.distance(v, q, { units: 'meters' }) < 3);
                        return <button onClick={() => { const n = heeft ? vl.filter((v) => turf.distance(v, q, { units: 'meters' }) >= 3) : [...vl, q]; wijzigItem(it.id, { parameters: { ...(it.parameters || {}), vlaggen: n.length ? n : undefined } }); setCtxMenu(null); }}><span style={{ display: 'inline-block', width: 14, height: 10, background: '#FACC15', clipPath: 'polygon(0 0,100% 50%,0 100%)', marginRight: 2 }} />{heeft ? 'Gele vlag weg op dit punt' : 'Gele vlag op dit punt'}</button>;
                      })()}
                      {it.geometrie?.type === 'Point' && <button onClick={() => { wijzigItem(it.id, { parameters: { ...(it.parameters || {}), vlag: !it.parameters?.vlag || undefined } }); setCtxMenu(null); }}><span style={{ display: 'inline-block', width: 14, height: 10, background: '#FACC15', clipPath: 'polygon(0 0,100% 50%,0 100%)', marginRight: 2 }} />{it.parameters?.vlag ? 'Gele vlag weg' : 'Gele vlag erop'}</button>}
                      <button title="Opent Google Street View in een nieuw tabblad" onClick={() => openStreetView(ctxMenu.lngLat, it.geometrie?.type === 'Point' && it.parameters?.richting != null ? it.parameters.richting : mapRef.current?.getBearing?.())}><Icoon naam="streetview" maat={14} />Street View hier</button>
                      <div className="fm-menukop">Dit item</div>
                      <button onClick={() => dupliceer(it.id)}><Icoon naam="kopie" maat={14} />Dupliceren</button>
                      <button onClick={() => kopieer([it.id])}>Kopiëren</button>
                      <button onClick={() => wijzigItem(it.id, { vergrendeld: !it.vergrendeld })}><Icoon naam={it.vergrendeld ? 'slotopen' : 'slot'} maat={14} />{it.vergrendeld ? 'Ontgrendelen' : 'Vergrendelen'}</button>
                      <button onClick={() => { wijzigItem(it.id, { verborgen: true }); try { tdRef.current?.deselectFeature(it.id); } catch {} setGeselecteerd(null); setTimeout(syncTd, 0); }}><Icoon naam="oogdicht" maat={14} />Verbergen</button>
                      <div className="fm-menukop">Volgorde</div>
                      <button onClick={() => actie('voor')}><Icoon naam="voor" maat={14} />Naar voren</button>
                      <button onClick={() => actie('achter')}><Icoon naam="achter" maat={14} />Naar achteren</button>
                      {lijn && <div className="fm-menukop">Lijn</div>}
                      {lijn && <button onClick={() => setEvenwijdigOpen(it.id)}><Icoon naam="evenwijdig" maat={14} />Evenwijdige kopie…</button>}
                      {lijn && <button onClick={() => { setVerleng({ id: it.id, kant: null }); setGereedschap('verleng'); }}><Icoon naam="verder" maat={14} />Verder tekenen</button>}
                      <hr />
                      <button className="gevaar" onClick={() => verwijderItems([it.id])}><Icoon naam="prullenbak" maat={14} />Verwijderen</button>
                    </>;
                  }
                  return <>
                    {klembord?.items?.length > 0 && <button onClick={() => { muisPosRef.current = ctxMenu.lngLat; plakRef.current?.(); }}>Hier plakken ({klembord.n})</button>}
                    {schrijven && <button onClick={() => { const p = ctxMenu.lngLat; setCtxMenu(null); openTekenscherm(null, p); }}>Tekenscherm: hier iets op maat tekenen</button>}
                    <button onClick={() => { const p0 = puntStijlRef.current || {}; const nieuw = maakItem({ soort: 'punt', geometrie: { type: 'Point', coordinates: ctxMenu.lngLat }, parameters: { midden: ctxMenu.lngLat }, stijl: { ...(p0.icoon ? { icoon: p0.icoon } : {}), ...(p0.kleur ? { kleur: p0.kleur } : {}) } }); tdRef.current?.addFeatures([tdFeature(nieuw)]); selecteerLijst([nieuw.id]); }}><Icoon naam="punt" maat={14} />Punt hier</button>
                    <button onClick={() => { const nieuw = maakItem({ soort: 'tekst', naam: 'Tekst', geometrie: { type: 'Point', coordinates: ctxMenu.lngLat } }); tdRef.current?.addFeatures([tdFeature(nieuw)]); selecteerLijst([nieuw.id]); }}><Icoon naam="tekst" maat={14} />Tekst hier</button>
                    <button onClick={() => setGereedschap('kader')}><Icoon naam="kader" maat={14} />Selecteren met een kader</button>
                    <button onClick={() => mapRef.current?.easeTo({ center: ctxMenu.lngLat })}>Kaart hier centreren</button>
                    <button title="Opent Google Street View in een nieuw tabblad, op het dichtste beeld bij deze plek" onClick={() => openStreetView(ctxMenu.lngLat, mapRef.current?.getBearing?.())}><Icoon naam="streetview" maat={14} />Street View hier</button>
                  </>;
                })()}
              </div>
            </div>
          )}
          {evenwijdigOpen && (() => {
            const it = items.find((x) => x.id === evenwijdigOpen);
            if (!it) return null;
            return (
              <div className="fm-evenwijdig" onClick={(e) => e.stopPropagation()}>
                <strong>Evenwijdige kopie</strong>
                <label className="fm-veld">Afstand (m)<input id="fm-ew-m" type="number" min="0.1" step="0.5" defaultValue="2" autoFocus /></label>
                <span className="fm-segment">
                  <button className={ewStuk === 'heel' ? 'aan' : ''} onClick={() => setEwStuk('heel')}>Hele lijn</button>
                  <button className={ewStuk === 'stuk' ? 'aan' : ''} onClick={() => setEwStuk('stuk')}>Tussen twee punten</button>
                </span>
                <div className="fm-segment">
                  {[['links', 'Links'], ['rechts', 'Rechts'], ['beide', 'Beide kanten']].map(([k, t]) => <button key={k}
                    onMouseEnter={() => setEwVb({ kant: k, meter: Number(String(document.getElementById('fm-ew-m')?.value || '2').replace(',', '.')) })}
                    onMouseLeave={() => setEwVb(null)} onFocus={() => setEwVb({ kant: k, meter: Number(String(document.getElementById('fm-ew-m')?.value || '2').replace(',', '.')) })} onBlur={() => setEwVb(null)}
                    onClick={() => {
                    const meter = Number(String(document.getElementById('fm-ew-m')?.value || '2').replace(',', '.'));
                    setEvenwijdigOpen(null);
                    if (ewStuk === 'stuk') { setGereedschap('evenwijdig'); setEwKies({ id: it.id, meter, kant: k, a: null }); }
                    else evenwijdigeKopie(it.id, meter, k);
                  }}>{t}</button>)}
                </div>
                <div className="fm-sub">{ewStuk === 'stuk' ? 'Daarna klik je op de lijn het begin en het einde van het stuk.' : 'Links en rechts in de tekenrichting van de lijn.'}</div>
                <button className="fm-knop klein" onClick={() => setEvenwijdigOpen(null)}>Annuleren</button>
              </div>
            );
          })()}
          {binnenZweef && !binnen ? <BinnenPreview hostId={binnenZweef.host} x={binnenZweef.x} y={binnenZweef.y} items={items} elementenMap={elementenMap} />
            : zweef && (items.find((x) => x.id === zweef.id)?.velden?.binnenplan && !binnen ? <BinnenPreview hostId={zweef.id} x={zweef.x} y={zweef.y} items={items} elementenMap={elementenMap} /> : <ZweefKaartje zweef={zweef} items={items} elementenMap={elementenMap} lagenMap={lagenMap} plan={plan} />)}
          {overgang && <div className={`fm-overgang ${overgang}`} aria-hidden="true" />}
          {binnenScherm && (() => {
            const host = items.find((x) => x.id === binnenScherm.host);
            if (!host) return null;
            const vs = verdiepingenVan(host);
            const verd = binnenScherm.verd;
            const ol = (plan?.instellingen?.onderleggers || []).find((o) => o.binnen?.host === host.id && (o.binnen.verd || vs[0].id) === verd);
            const zetOl = (patch) => wijzigPlan({ instellingen: { ...(plan.instellingen || {}), onderleggers: (plan.instellingen?.onderleggers || []).map((o) => (o.id === ol.id ? { ...o, ...patch } : o)) } });
            return (
              <BinnenScherm host={host} verdiepingen={vs} verd={verd} onderlegger={ol} items={items} elementen={elementen} elementenMap={elementenMap} schrijven={schrijven}
                onVerd={(v) => setBinnenScherm({ host: host.id, verd: v })}
                onDeelCamera={schrijven ? async (camId, naam) => {
                  // Live deellink van dit binnenplan die meteen het camerabeeld opent.
                  const { data, error } = await maps().from('deel_links').insert({ plan_id: plan.id, naam: `Camerabeeld ${naam}`, laag_ids: [], opties: { binnen: host.id, cam: camId, attesten: false }, live: true }).select().single();
                  if (error) { setFout(foutTekst(error)); return null; }
                  const basis = `${window.location.origin}/d/${data.token}`;
                  return `${basis}?cam=${camId}`;
                } : null}
                autoPdf={!!binnenScherm.pdf} onPdfKlaar={() => setBinnenScherm((b) => (b ? { host: b.host, verd: b.verd } : b))}
                onNieuweVerdieping={async () => { const t = await vraagTekst('Naam van de verdieping', vs.length === 1 ? '1e verdieping' : `${vs.length}e verdieping`); if (!t) return; const id = nieuwId().slice(0, 8); wijzigItem(host.id, { velden: { ...(host.velden || {}), binnenplan: { ...(host.velden?.binnenplan || {}), verdiepingen: [...vs, { id, naam: t }] } } }); setBinnenScherm({ host: host.id, verd: id }); }}
                onMaak={(it) => { const n = maakItem({ laag_id: host.laag_id || actieveLaag, ...it }); tdRef.current?.addFeatures([tdFeature(n)]); return n; }}
                onWijzig={(id, patch) => wijzigItem(id, patch)}
                onVerwijder={(ids) => verwijderItems(ids)}
                onMaakElement={async (rij) => { const { data, error } = await maps().from('bibliotheek').insert({ actief: true, ...rij }).select().single(); if (error) { setFout(foutTekst(error)); return null; } setElementen((e) => [...e, data]); return data; }}
                onWijzigElement={async (id, patch) => { setElementen((e) => e.map((x) => (x.id === id ? { ...x, ...patch } : x))); const { error } = await maps().from('bibliotheek').update(patch).eq('id', id); if (error) setFout(foutTekst(error)); }}
                onHost={(patch) => wijzigItem(host.id, patch)}
                stroom={stroomRes} vast={vast} onKabelBuiten={(id, alleen) => tekenKabel(id, { alleen })}
                fasen={fasen} actieveFase={actieveFase} onFase={setActieveFase}
                onOngedaan={(opnieuw) => { ongedaan(opnieuw); setTimeout(syncTd, 0); }}
                doeken={heeftModule('branding') ? doeken : GEEN_DOEKEN}
                onGrondplan={(f) => grondplanToevoegen(f, { host: host.id, verd: ol ? ol.binnen.verd : (verd === vs[0].id ? null : verd) })}
                onOnderlegger={(patch) => ol && zetOl(patch)}
                onPassen={() => { if (!ol) return; schermNaPassen.current = binnenScherm; setBinnenScherm(null); openBinnen(host.id, verd); setBinnenFoto(true); setTimeout(() => startKalibratie(ol), 600); }}
                onSluit={() => { const h = binnenScherm?.host; setBinnenScherm(null); setOvergang('uit'); setTimeout(() => setOvergang(''), 520); setTimeout(() => { syncTd(); if (h && st.current.items.some((x) => x.id === h)) { setGeselecteerd(h); setExtra([]); setTimeout(() => { try { tdRef.current?.selectFeature(h); } catch {} }, 60); } }, 30); }} />
            );
          })()}
          {schrijven && klembord?.items?.length > 0 && (
            <div className="fm-metingen-chip fm-klembord-chip" style={{ top: metingen.length ? 48 : 12 }}>
              <span>{klembord.n} gekopieerd{klembord.van && klembord.van !== plan.naam ? ` uit ${klembord.van}` : ''}</span>
              <button onClick={() => plakRef.current?.()} title="Plakken waar je muis was, of in het midden (Ctrl V)">Plakken</button>
              <button onClick={() => { setKlembord(null); try { localStorage.removeItem('fm-klembord'); } catch {} }} aria-label="Klembord leegmaken">×</button>
            </div>
          )}
          {metingen.length > 0 && (
            <div className="fm-metingen-chip">
              <span>{metingen.length} {metingen.length === 1 ? 'meting' : 'metingen'}</span>
              {schrijven && <button title="Metingen als maatlijn of vlak in het plan zetten, zodat ze op de PDF komen" onClick={() => {
                for (const m of metingen) {
                  const it = m.geometrie.type === 'Polygon'
                    ? maakItem({ soort: 'vlak', geometrie: m.geometrie, stijl: { opp: true, maten: true, kleur: '#B45309', vuldekking: 0.08, streep: 'streep' } })
                    : maakItem({ soort: 'lijn', geometrie: m.geometrie, stijl: { maatlijn: true, kleur: '#1d1d1b', dikte: 1, label: false } });
                  tdRef.current?.addFeatures([tdFeature(it)]);
                }
                setMetingen([]); setMelding('Metingen staan nu als maatlijn in het plan.');
              }}>Bewaren als maatlijn</button>}
              <button onClick={() => setMetingen((m) => m.slice(0, -1))} title="Laatste meting weg">Laatste weg</button>
              <button onClick={() => setMetingen([])}>Alles wissen</button>
            </div>
          )}
          <div className="fm-onderbalk">
          {(melding || elementUitleg) && (
            <div className="fm-melding-kaart" role="status">
              {gereedschap === 'element' && melding ? <MeldingTekst winkel={meldingWinkel} /> : (elementUitleg || <MeldingTekst winkel={meldingWinkel} />)}
              {melding && !elementUitleg && <button onClick={() => setMelding('')} style={{ marginLeft: 10, background: 'none', border: 0, color: '#fff', cursor: 'pointer' }} aria-label="Sluiten">×</button>}
            </div>
          )}
          {schrijven && puntWissen && (
            <div className="fm-melding-kaart fm-tekenbalk" style={{ bottom: melding ? 56 : 16 }}>
              <span>Klik op een punt van de lijn of het vlak om het te wissen</span>
              <span className="fm-melding-draai"><button style={{ width: 'auto', padding: '0 8px', background: '#fff', color: '#1d1d1b' }} onClick={() => setPuntWissen(false)}>Klaar</button></span>
            </div>
          )}
          {schrijven && gereedschap === 'punt' && (
            <div className="fm-melding-kaart fm-tekenbalk fm-puntbalk" role="toolbar" style={{ bottom: (melding ? 56 : 16) }} onClick={(e) => e.stopPropagation()}>
              <span>Klik op de kaart om een punt te zetten</span>
              {laagKies}
              <button className="fm-puntbalk-knop" data-menuknop onClick={() => setPuntKiezerOpen((v) => !v)} title="Icoon en kleur voor nieuwe punten">
                <IcoonBol naam={puntStijl.icoon} maat={22} kleur={puntStijl.kleur || '#2563EB'} />
                <span>{puntStijl.icoon ? icoonNaam(puntStijl.icoon) : 'Kies icoon'}</span>
                <Icoon naam="pijlomlaag" maat={12} />
              </button>
              {puntKiezerOpen && (
                <div className="fm-puntkiezer">
                  <IcoonKiezer compact waarde={puntStijl.icoon} kleur={puntStijl.kleur || '#2563EB'} onKies={(k) => { setPuntStijl({ icoon: k }); setPuntKiezerOpen(false); }} onKleur={(k) => setPuntStijl({ kleur: k })} />
                </div>
              )}
            </div>
          )}
          {schrijven && gereedschap === 'route' && (
            <div className="fm-melding-kaart fm-tekenbalk" role="toolbar" style={{ bottom: (melding ? 56 : 16) }}>
              <span>{routeInfo?.bewerk ? `Route aanpassen · ${geo.getal(routeInfo.km, 2)} km · sleep een punt of sleep op de lijn; dubbelklik op een punt = weg` : routeInfo ? `${routeInfo.n} punten · ${geo.getal(routeInfo.km, 2)} km · sleep een punt om het te verplaatsen` : 'Klik het startpunt'}</span>
              {!routeInfo?.bewerk && laagKies}
              <span className="fm-melding-draai">
                {[['bike', 'Fiets'], ['car', 'Auto'], ['foot', 'Te voet'], ['recht', 'Recht']].map(([k, t]) => (
                  <button key={k} className={routeProfiel === k ? 'aan' : ''} style={{ width: 'auto', padding: '0 8px' }} onClick={() => setRouteProfiel(k)} title={k === 'recht' ? 'Rechte stukken, bv. door een weide of over een plein' : `Volg de weg voor ${t.toLowerCase()}`}>{t}</button>
                ))}
              </span>
              {routeInfo && (
                <span className="fm-melding-draai">
                  {routeInfo.bewerk
                    ? <button style={{ width: 'auto', padding: '0 8px' }} onClick={routeAnnuleer} title="Niets wijzigen (Esc)">Annuleren</button>
                    : <button style={{ width: 'auto', padding: '0 8px' }} onClick={() => routeTerugRef.current?.()} title="Laatste punt weg (Backspace)">Laatste punt weg</button>}
                  <button style={{ width: 'auto', padding: '0 8px', background: '#fff', color: '#1d1d1b' }} onClick={() => routeKlaarRef.current?.()} title={routeInfo.bewerk ? 'Bewaren (Enter)' : undefined}>{routeInfo.bewerk ? 'Bewaren' : 'Klaar'}</button>
                </span>
              )}
            </div>
          )}
          {schrijven && ['rechthoek', 'cirkel', 'vrijehand', 'veelhoek', 'ellips', 'sector', 'tekst'].includes(gereedschap) && (
            <div className="fm-melding-kaart fm-tekenbalk" role="toolbar" style={{ bottom: (melding ? 56 : 16) }}>
              <span>{UITLEG[gereedschap]}</span>
              {laagKies}
            </div>
          )}
          {schrijven && ['lijn', 'vlak', 'meten', 'meten-vlak', 'maatlijn', 'notitie'].includes(gereedschap) && (
            <div className="fm-melding-kaart fm-tekenbalk" role="toolbar" style={{ bottom: (melding ? 56 : 16) }}>
              <span>{UITLEG[gereedschap]}</span>
              {!['meten', 'meten-vlak'].includes(gereedschap) && laagKies}
              <span className="fm-melding-draai">
                <button style={{ width: 'auto', padding: '0 8px' }} title="Laatste punt weg (Backspace)" onClick={() => laatstePuntWeg()}>Laatste punt weg</button>
                <button style={{ width: 'auto', padding: '0 8px', background: '#fff', color: '#1d1d1b' }} onClick={() => { if (!rondTekenenAf()) setGereedschap('selecteer'); }}>Klaar</button>
              </span>
            </div>
          )}
          {schrijven && ['verleng', 'knip'].includes(gereedschap) && (
            <div className="fm-melding-kaart fm-tekenbalk" role="toolbar" style={{ bottom: (melding ? 56 : 16) }}>
              <span>{UITLEG[gereedschap]}</span>
              <span className="fm-melding-draai">
                {gereedschap === 'verleng' && <button style={{ width: 'auto', padding: '0 8px' }} onClick={() => ongedaan(false)} title="Laatste punt weg">Laatste punt weg</button>}
                <button style={{ width: 'auto', padding: '0 8px', background: '#fff', color: '#1d1d1b' }} onClick={() => { const id = verleng?.id || knipId; setGereedschap('selecteer'); if (id) selecteerLijst([id]); }}>{gereedschap === 'knip' && knipId ? 'Annuleren' : 'Klaar'}</button>
              </span>
            </div>
          )}
          </div>
          {schrijven && item && selectie.length === 1 && !eigenschappenOpen && (
            <div className="fm-contextbalk" role="toolbar" aria-label="Acties voor het geselecteerde item">
              <span className="naam">{item.naam || elementenMap.get(item.element_id)?.naam || ({ punt: 'Punt', lijn: 'Lijn', vlak: 'Vlak', rechthoek: 'Rechthoek', cirkel: 'Cirkel', tekst: 'Tekst', element: 'Element', veelhoek: 'Veelhoek', ellips: 'Ellips', sector: 'Sector' }[item.soort] || 'Item')}</span>
              {item.geometrie?.type !== 'Point' && item.parameters?.midden && (item.soort === 'element' ? item.parameters?.breedte && item.parameters?.diepte : ['rechthoek', 'veelhoek', 'ellips', 'sector'].includes(item.soort))
                ? <HoekVeld key={item.id} waarde={Number(item.parameters?.rot ?? item.parameters?.richting) || 0} onDraai={(d) => actie('draai', d)} />
                : item.geometrie?.type !== 'Point' && (<>
                  <button title="15° linksom draaien" onClick={() => actie('draai', -15)}><Icoon naam="draailinks" maat={15} />15°</button>
                  <button title="15° rechtsom draaien" onClick={() => actie('draai', 15)}><Icoon naam="draairechts" maat={15} />15°</button>
                </>)}
              {item.geometrie?.type === 'LineString' && !item.vergrendeld && (item.parameters?.route || werkruimte === 'sign' || /route/i.test(item.naam || '')) && (
                <button className="zwart" title="Sleep de punten of op de lijn; de route volgt de weg" onClick={() => routeAanpassen(item.id)}><Icoon naam="navigeer" maat={15} />Route aanpassen</button>
              )}
              <button title="Dupliceren" onClick={() => dupliceer(item.id)}><Icoon naam="kopie" maat={15} />Dupliceren</button>
              {(item.geometrie?.type === 'LineString' || (item.geometrie?.type === 'Polygon' && !(item.parameters?.breedte && item.parameters?.diepte) && !['cirkel', 'ellips', 'veelhoek', 'sector'].includes(item.soort))) && (
                <button className={puntWissen ? 'aan' : ''} title="Klik daarna op een punt van de lijn of het vlak om het te wissen. Dubbelklik op een punt werkt ook." onClick={() => setPuntWissen((v) => !v)}>{puntWissen ? 'Klaar met wissen' : 'Punten wissen'}</button>
              )}
              <button title={item.vergrendeld ? 'Ontgrendelen' : 'Vergrendelen: kan niet meer per ongeluk verschuiven'} onClick={() => wijzigItem(item.id, { vergrendeld: !item.vergrendeld })}><Icoon naam={item.vergrendeld ? 'slot' : 'slotopen'} maat={15} /></button>
              <button title="Verwijderen" style={{ color: '#B4123A' }} onClick={() => verwijderItems([item.id])}><Icoon naam="prullenbak" maat={15} /></button>
              <div style={{ position: 'relative' }}>
                <button data-menuknop title="Meer acties" onClick={(e) => { e.stopPropagation(); setMenu(menu === 'ctx' ? null : 'ctx'); }}>Meer <Icoon naam="pijlomlaag" maat={12} /></button>
                {menu === 'ctx' && (
                  <div className="fm-menu" style={{ right: 0, top: 32, minWidth: 190 }} onClick={(e) => { e.stopPropagation(); setMenu(null); }}>
                    {item.geometrie?.type === 'Polygon' && <button onClick={() => actie('uitlijnen-weg')}>Evenwijdig aan de weg draaien</button>}
                    {item.geometrie?.type === 'LineString' && <>
                      <button onClick={() => { setVerleng({ id: item.id, kant: null }); setGereedschap('verleng'); }}><Icoon naam="verder" maat={14} />Verder tekenen</button>
                      <button onClick={() => { setKnipId(item.id); setGereedschap('knip'); }}><Icoon naam="schaar" maat={14} />Knippen</button>
                      <button onClick={() => setEvenwijdigOpen(item.id)}><Icoon naam="evenwijdig" maat={14} />Evenwijdige kopie…</button>
                      <button onClick={() => actie('langs-weg', 'car')}><Icoon naam="navigeer" maat={14} />Langs de weg leggen<small>auto</small></button>
                      <button onClick={() => actie('langs-weg', 'bike')}><Icoon naam="navigeer" maat={14} />Langs de weg leggen<small>fiets (ook fietspaden)</small></button>
                      <button onClick={() => actie('langs-weg', 'foot')}><Icoon naam="navigeer" maat={14} />Langs de weg leggen<small>te voet (ook paden)</small></button>
                    </>}
                    {item.laag_id && item.laag_id !== actieveLaag && lagenMap.get(item.laag_id) && <button onClick={() => { setActieveLaag(item.laag_id); setMelding(`Nieuwe items komen nu in ${lagenMap.get(item.laag_id).naam}.`); }}><Icoon naam="lagen" maat={14} />Laag {lagenMap.get(item.laag_id).naam} actief maken</button>}
                    <button onClick={() => actie('voor')}><Icoon naam="voor" maat={14} />Naar voren</button>
                    <button onClick={() => actie('achter')}><Icoon naam="achter" maat={14} />Naar achteren</button>
                    {item.geometrie?.type !== 'Point' && <button onClick={() => actie('spiegel-x')}>Spiegelen ↔</button>}
                    {item.geometrie?.type !== 'Point' && <button onClick={() => actie('spiegel-y')}>Spiegelen ↕</button>}
                    <button onClick={() => kopieer(selectie)}>Kopiëren (ook naar een ander plan)</button>
                    <button onClick={() => zoomNaar(item)}>Inzoomen op dit item</button>
                    <button onClick={() => { wijzigItem(item.id, { verborgen: true }); try { tdRef.current?.deselectFeature(item.id); } catch {} setGeselecteerd(null); setTimeout(syncTd, 0); setMelding('Item verborgen. Terug zichtbaar maken via Lagen (oogje bij het item).'); }}><Icoon naam="oogdicht" maat={14} />Verbergen</button>
                    {!item.element_id && <button onClick={() => bewaarAlsElement(item.id)}>Bewaren als bibliotheek-element</button>}
                    <button onClick={() => bewaarSjabloon([item.id])}>Bewaren als sjabloon</button>
                  </div>
                )}
              </div>
            </div>
          )}
          {schrijven && selectie.length > 1 && (
            <div className="fm-contextbalk" role="toolbar" aria-label="Acties voor de selectie">
              <span className="naam">{groepSel ? `${groepNaam(items.find((x) => x.id === selectie[0])?.groep_id) || 'Groep'} · ${selectie.length} items` : `${selectie.length} geselecteerd`}</span>
              {groepSel && <button title="De groep een naam geven (de onderdelen zelf krijgen geen naam)" onClick={() => vraagGroepNaam(items.find((x) => x.id === selectie[0])?.groep_id)}>Naam…</button>}
              <button title="Geheel 15° linksom draaien" onClick={() => multiActie('draai-')}><Icoon naam="draailinks" maat={15} />15°</button>
              <button title="Geheel 15° rechtsom draaien" onClick={() => multiActie('draai+')}><Icoon naam="draairechts" maat={15} />15°</button>
              {groepSel && !iso && schrijven && <button title="De groep recht op een raster bewerken, met maten en bestaande elementen" onClick={() => openTekenscherm(selectie)}>Tekenscherm</button>}
              {groepSel && !iso && <button className="zwart" title="Enkel deze groep bewerken; de rest van het plan blijft zichtbaar als achtergrond (ook: dubbelklik)" onClick={() => { const g = items.find((x) => x.id === selectie[0])?.groep_id; setIso(g); setGeselecteerd(null); setExtra([]); }}>Groep bewerken</button>}
              {groepSel
                ? <button title="De items weer los van elkaar selecteren" onClick={() => multiActie('degroeperen')}>Groep opheffen</button>
                : <button onClick={() => multiActie('groeperen')}>Groeperen</button>}
              <select aria-label="Uitlijnen" value="" onChange={(e) => e.target.value && multiActie(e.target.value)}>
                <option value="">Uitlijnen</option>
                <option value="links">Links</option><option value="rechts">Rechts</option><option value="boven">Boven</option><option value="onder">Onder</option>
                <option value="midden-h">Midden (verticale as)</option><option value="midden-v">Midden (horizontale as)</option>
                <option value="verdeel-h">Gelijk verdelen horizontaal</option><option value="verdeel-v">Gelijk verdelen verticaal</option>
              </select>
              <button onClick={() => multiActie('dupliceren')}>Dupliceren</button>
              {(() => {
                const sel = items.filter((x) => selectie.includes(x.id)); const nu = [...new Set(sel.map((x) => x.laag_id))];
                return (
                  <select aria-label="Naar laag" title="Alle geselecteerde items naar een andere laag" value={nu.length === 1 ? nu[0] || '' : ''} onChange={(e) => {
                    const doel = e.target.value; if (!doel) return;
                    const weg = sel.filter((x) => x.laag_id !== doel && !x.vergrendeld);
                    for (const x of weg) wijzigItem(x.id, { laag_id: doel });
                    setTimeout(syncTd, 0);
                    setMelding(`${weg.length} ${weg.length === 1 ? 'item' : 'items'} naar ${lagen.find((l) => l.id === doel)?.naam || 'de laag'}${sel.some((x) => x.vergrendeld) ? ' (vergrendelde items niet)' : ''}.`);
                  }}>
                    {nu.length !== 1 && <option value="">Laag: {nu.length} verschillende</option>}
                    <LaagOpties lagen={lagen} />
                  </select>
                );
              })()}
              <div style={{ position: 'relative' }}>
                <button data-menuknop title="Meer acties" onClick={(e) => { e.stopPropagation(); setMenu(menu === 'ctxm' ? null : 'ctxm'); }}>Meer <Icoon naam="pijlomlaag" maat={12} /></button>
                {menu === 'ctxm' && (
                  <div className="fm-menu" style={{ right: 0, top: 32, minWidth: 200 }} onClick={(e) => { e.stopPropagation(); setMenu(null); }}>
                    {!groepSel && <button onClick={() => multiActie('degroeperen')}>Groep opheffen</button>}
                    {items.filter((x) => selectie.includes(x.id) && x.geometrie?.type === 'LineString').length >= 2 && <button onClick={() => multiActie('lijnen-koppelen')}>Lijnen koppelen</button>}
                    {items.some((x) => selectie.includes(x.id) && x.geometrie?.type === 'LineString') && ['car', 'bike'].map((prof) => (
                      <button key={prof} onClick={async () => {
                        const lijnen = items.filter((x) => selectie.includes(x.id) && x.geometrie?.type === 'LineString' && !x.vergrendeld);
                        let ok = 0;
                        for (const [k, x] of lijnen.entries()) {
                          setMelding(`Langs de weg leggen: ${k + 1} van ${lijnen.length}…`);
                          try { const r = await legLangsWeg(x.geometrie.coordinates, prof); if (st.current.items.some((y) => y.id === x.id)) { wijzigItem(x.id, { geometrie: { type: 'LineString', coordinates: r.coords }, parameters: { ...(x.parameters || {}), route: { profiel: prof, punten: r.punten } } }); ok += 1; } } catch {}
                        }
                        setTimeout(syncTd, 0);
                        setMelding(`${ok} van ${lijnen.length} lijnen langs de weg gelegd${ok < lijnen.length ? ' (de rest: geen weg gevonden)' : ''}. Ctrl Z zet ze één voor één terug.`);
                      }}>Lijnen langs de weg leggen<small>{prof === 'car' ? 'auto' : 'fiets (ook fietspaden)'}</small></button>
                    ))}
                    <button onClick={async () => {
                      const sel = items.filter((x) => selectie.includes(x.id) && x.element_id);
                      if (!sel.length) { setMelding('Geen elementen in de selectie.'); return; }
                      const nu = [...new Set(sel.map((x) => x.velden?.herkomst || ''))];
                      const v = await vraagTekst(`Wie levert deze ${sel.length} elementen voor dit event? Bv. Gemeente of Delrue. Leeg = de leverancier uit de bibliotheek.`, nu.length === 1 ? nu[0] : '', { titel: 'Geleverd door', ok: 'Instellen' });
                      if (v == null) return;
                      for (const x of sel) wijzigItem(x.id, { velden: { ...(x.velden || {}), herkomst: v.trim() || null } });
                      setMelding(`${sel.length} elementen: geleverd door ${v.trim() || 'de leverancier uit de bibliotheek'}.`);
                    }}>Geleverd door…</button>
                    <button onClick={() => kopieer(selectie)}>Kopiëren</button>
                    <button onClick={() => { for (const id of selectie) wijzigItem(id, { verborgen: true }); setExtra([]); setGeselecteerd(null); setTimeout(syncTd, 0); setMelding(`${selectie.length} items verborgen. Terug zichtbaar via Lagen.`); }}>Verbergen</button>
                    <button onClick={() => multiActie('sjabloon')}>Als sjabloon bewaren</button>
                    {anderePlannen.map((x) => <button key={x.id} onClick={() => actie('kopieer-plan', x.id)}>Kopiëren naar {x.naam}</button>)}
                  </div>
                )}
              </div>
              <button style={{ color: '#B4123A' }} onClick={() => multiActie('verwijderen')}><Icoon naam="prullenbak" maat={15} /></button>
              <button onClick={() => setExtra([])}>×</button>
            </div>
          )}
          {fout && plan && <div className="fm-zwevend" style={{ right: 12, top: 12, maxWidth: 420 }}><div className="fm-melding fout" style={{ display: 'flex', gap: 8 }}><span style={{ flex: 1 }}>{fout}</span><button onClick={() => setFout('')} style={{ border: 0, background: 'none', cursor: 'pointer' }} aria-label="Sluiten">×</button></div></div>}
        </div>

        {!volScherm && vastSel && !item && (
          <aside className="fm-eigenschappen">
            <div className="fm-paneelkop"><span className="fm-paneelnaam">{vastSel.id ? vastSel.naam : 'Nieuwe vaste aansluiting'}</span><button className="fm-sluit" aria-label="Sluiten" onClick={() => setVastSel(null)}>×</button></div>
            <VasteAansluitingPaneel va={vastSel} schrijven={schrijven} profielId={profiel?.id} onBewaard={vastBewaard} onSluit={() => setVastSel(null)}
              knoop={vastSel.id ? stroomRef.current?.knopen?.get(vaId(vastSel)) || null : null} onZoom={(v) => mapRef.current?.easeTo({ center: v.geometrie.coordinates, zoom: Math.max(mapRef.current.getZoom(), 18) })} />
          </aside>
        )}
        {planOpen && (
          <aside className="fm-eigenschappen fm-planzij" aria-label="Instellingen">
            <div className="fm-paneelkop"><span className="fm-paneelnaam">Instellingen</span><button className="fm-sluit" aria-label="Instellingen sluiten" onClick={() => zetPlanZicht(false)}>×</button></div>
            <div className="fm-plantabs" role="tablist" aria-label="Instellingen">
              {[['algemeen', 'Algemeen'], ['fasen', 'Fasen'], ['regels', 'Regels'], ['geschiedenis', 'Versies']].map(([k, t]) => (
                <button key={k} role="tab" aria-selected={planTab === k} className={planTab === k ? 'aan' : ''} onClick={() => setPlanTab(k)}>{t}</button>
              ))}
            </div>
            <div className="fm-planzij-inhoud" role="tabpanel">
              {planTab === 'algemeen' && <PlanAlgemeen plan={plan} items={items} schrijven={schrijven} onPlan={wijzigPlanGecontroleerd} elementenMap={elementenMap} />}
              {planTab === 'regels' && (
                <ControlePaneel deel="regels" plan={plan} lagen={lagen} items={items} elementenMap={elementenMap} lagenMap={lagenMap} fasen={fasen} schrijven={schrijven} onPlan={wijzigPlan} onKiesItem={kiesItemOpKaart} openBlok={controleBlok} vast={vast} />
              )}
              {['algemeen', 'fasen', 'geschiedenis'].includes(planTab) && (
                <PlanPaneel key={planTab} deel={planTab} plan={plan} fasen={fasen} items={items} schrijven={schrijven} kaart={mapRef.current}
                  kalibratie={kalibratie} onKalibreer={startKalibratie} onFasen={setFasen} onPlan={wijzigPlan}
                  olBewerk={olBewerk} onBewerkOl={(id) => { setOlBewerk(id); if (id) { setGereedschap('hand'); setGeselecteerd(null); setExtra([]); } }}
                  vergelijkVersie={vergelijk} onVergelijk={setVergelijkVersie} onHerstel={herstelVersie}
                  plekItems={plekItems} onUitFiche={uitPlaatsfiche} onNaarVast={naarVast} lagen={lagen}
                  onKiesItem={(id) => { setGeselecteerd(id); zoomNaar(items.find((x) => x.id === id)); }} />
              )}
            </div>
          </aside>
        )}
        {(() => { slotInfo.current = item ? { slot: slotVan(item.id), kijkers: anderen.filter((a) => a.selectie?.includes(item.id) && !(a.bewerkt === item.id && Date.now() - (a.actief || 0) < 30000)) } : { slot: null, kijkers: [] }; return null; })()}
        {eigenschappenOpen && veelSel && (
          <SelectieInfo sel={items.filter((x) => selectie.includes(x.id))} lagen={lagen} lagenMap={lagenMap} fasen={fasen} elementenMap={elementenMap} schrijven={schrijven}
            onWijzig={(id, patch) => { wijzigItem(id, patch); setTimeout(syncTd, 0); }} onVerwijder={(ids) => ids.length && verwijderItems(ids)}
            onSluit={() => { setGeselecteerd(null); setExtra([]); }} onKies={(ids) => { setGeselecteerd(ids[0]); setExtra(ids.slice(1)); }}
            onMaak={(lijst) => { const n = lijst.map((x) => maakItem(x)); try { tdRef.current?.addFeatures(n.map((x) => tdFeature(x))); } catch { setTimeout(syncTd, 0); } setMelding?.(`${n.length} schuine hekken geplaatst`); }} />
        )}
        {schrijven && !volScherm && !item && gereedschap === 'element' && gekozenElement && (
          <aside className="fm-eigenschappen fm-plaatspaneel">
            <div className="fm-paneelkop"><span className="fm-paneelnaam fm-familienaam">Plaatsen · {FAMILIE_NAAM[familieVanElement(gekozenElement)]}</span><button className="fm-sluit" aria-label="Stoppen met plaatsen" onClick={() => setGereedschap('selecteer')}>×</button></div>
            <div className="fm-paneelkop2">
              <div className="fm-kiesrij stil"><span className="l">Element</span><span className="w" title={gekozenElement.naam}>{gekozenElement.naam}</span></div>
              <label className="fm-kiesrij"><span className="l">Laag</span>
                <span className="bol" style={{ background: lagenMap.get(laagVoorElement(gekozenElement))?.kleur || '#9A9EA6' }} />
                <select value={laagVoorElement(gekozenElement) || ''} onChange={(e) => setActieveLaag(e.target.value)} aria-label="Laag voor wat je plaatst"><LaagOpties lagen={lagen} /></select>
              </label>
            </div>
            <div className="fm-kern"><div className="groot">{gekozenElement.tekenwijze === 'lijn' ? (lijnStuks ? `${lijnStuks} ${lijnStuks === 1 ? 'stuk' : 'stuks'} per klik` : 'Lijn tekenen') : `${elementAantal > 1 ? `${elementAantal} × ` : ''}${gekozenElement.breedte_m ? `${geo.getal(Number(gekozenElement.breedte_m))} × ${geo.getal(Number(gekozenElement.diepte_m))} m` : gekozenElement.naam}`}</div><div className="klein">{elementUitleg || 'Klik op de kaart om te plaatsen'}</div></div>
            <div className="fm-sectie fm-plaatsopties">
              {['schaal', 'sjabloon'].includes(gekozenElement?.tekenwijze) && (
                <span className="fm-plaatsrij"><span className="l">Draaien</span>
                  <button title="15° linksom" onClick={() => setElementRot((r) => (r + 345) % 360)}><Icoon naam="draailinks" maat={14} /></button>
                  <button title="15° rechtsom" onClick={() => setElementRot((r) => (r + 15) % 360)}><Icoon naam="draairechts" maat={14} /></button>
                  <span className="w">{elementRot}°</span>
                </span>
              )}
              {heeftFracties(gekozenElement) && !gekozenElement.eigenschappen.vakken_standaard && (
                <span className="fm-plaatsrij fm-fracties" title="Fractie van wat je plaatst"><span className="l">Fractie</span>
                  {toegelatenFracties(gekozenElement).map((o) => (
                    <button key={o.k} className={(plaatsFractie || gekozenElement.eigenschappen.fractie_standaard || 'rest') === o.k ? 'aan' : ''} title={o.naam}
                      style={{ background: o.kleur, color: o.donker ? '#1d1d1b' : '#fff', width: 'auto' }} onClick={() => setPlaatsFractie(o.k)}>{o.letter}</button>
                  ))}
                </span>
              )}
              {gekozenElement?.eigenschappen?.module && (
                <span className="fm-plaatsrij fm-legkeuze" role="group" aria-label="Hoe de platen gelegd worden"><span className="l">Leggen als</span>
                  
                  {PLAAT_LEG.map(([k, t, uitleg, icoon]) => (
                    <button key={k} className={plaatLeg === k ? 'aan' : ''} aria-pressed={plaatLeg === k} aria-label={`${t}: ${uitleg}`} onClick={() => setPlaatLeg(k)}>
                      <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true">{icoon}</svg>{t}
                    </button>
                  ))}
                </span>
              )}
              {gekozenElement?.tekenwijze === 'lijn' && Number(gekozenElement.eenheid_m) > 0 && (
                <span className="fm-plaatsrij fm-aantalkies" title="Een lijn tekenen, of met één klik een vast aantal stuks plaatsen (R = draaien)"><span className="l">Per klik</span>
                  <button className={!lijnStuks ? 'aan' : ''} style={{ width: 'auto', padding: '0 8px' }} onClick={() => setLijnStuks(null)}>Tekenen</button>
                  {[1, 2, 3, 5].map((n) => <button key={n} className={lijnStuks === n ? 'aan' : ''} style={{ width: 'auto', padding: '0 7px' }} onClick={() => setLijnStuks(n)}>{n} st.</button>)}
                </span>
              )}
              {lijnStuks && gekozenElement?.tekenwijze === 'lijn' && (
                <span className="fm-plaatsrij"><span className="l">Draaien</span>
                  <button title="15° linksom" onClick={() => setElementRot((r) => (r + 345) % 360)}><Icoon naam="draailinks" maat={14} /></button>
                  <button title="15° rechtsom" onClick={() => setElementRot((r) => (r + 15) % 360)}><Icoon naam="draairechts" maat={14} /></button>
                  <span className="w">{elementRot}°</span>
                </span>
              )}
              {gekozenElement?.tekenwijze === 'schaal' && !gekozenElement.eigenschappen?.module && !gekozenElement.eigenschappen?.vakken_standaard && (
                <span className="fm-plaatsrij fm-aantalkies" title="Hoeveel naast elkaar in één keer plaatsen (telt als zoveel stuks)"><span className="l">Naast elkaar</span>
                  {[1, 2, 3, 4, 5].map((n) => <button key={n} className={elementAantal === n ? 'aan' : ''} onClick={() => setElementAantal(n)}>{n}×</button>)}
                  <button title="Meer" onClick={() => setElementAantal((n) => Math.min(50, n + 1))}>+</button>
                  {elementAantal > 5 && <span style={{ padding: '0 6px' }}>{elementAantal}×</span>}
                </span>
              )}
              <div className="fm-sub">R draait 15° · Esc stopt met plaatsen</div>
            </div>
          </aside>
        )}
        {eigenschappenOpen && !veelSel && werkruimte !== 'plan' && wrDetail && (
          <aside className="fm-eigenschappen">
            <div className="fm-paneelkop"><span className="fm-paneelnaam fm-familienaam">{isSign(item) ? `Bordpunt ${item.velden.sign.nr}` : FAMILIE_NAAM[familieVan(item, elementenMap.get(item.element_id))]}</span><button className="fm-sluit" aria-label="Selectie opheffen" onClick={() => { try { tdRef.current?.deselectFeature(item.id); } catch {} setGeselecteerd(null); setExtra([]); }}>×</button></div>
            <SlotBanner slot={slotInfo.current.slot} kijkers={slotInfo.current.kijkers} onToch={() => setOvername((o) => new Set([...o, item.id]))} />
            <ItemGeschiedenis item={item} />
            {wrDetail}
            <details className="fm-blok fm-wr-alles"><summary><span>Alle eigenschappen</span></summary>
              <Eigenschappen item={item} binnenplan={item?.geometrie?.type === 'Polygon' ? (binnen ? (item.id !== binnen.host && item.soort !== 'element' ? { ruimte: true } : null) : { open: () => gaNaarBinnenRef.current?.(item.id), aantal: items.filter((x) => x.velden?.binnen?.host === item.id).length }) : !binnen && isBinnenPunt(item) ? { open: () => gaNaarBinnenRef.current?.(item.id), aantal: items.filter((x) => x.velden?.binnen?.host === item.id).length } : null} groepNaam={item?.groep_id ? groepNaam(item.groep_id) : ''} onGroepNaam={(n) => item?.groep_id && zetGroepNaam(item.groep_id, n)} groepAantal={item?.groep_id ? items.filter((x) => x.groep_id === item.groep_id).length : 0} plan={plan} lagen={lagen} fasen={fasen} elementen={elementen} doeken={heeftModule('branding') ? doeken : GEEN_DOEKEN} doekPenseel={doekPenseel} onDoekPenseel={setDoekPenseel} elementenMap={elementenMap} lagenMap={lagenMap}
                items={items} schrijven={schrijven && !slotInfo.current.slot && magWp(item)} uitgebreid={uitgebreid} vast={vast}
                onWijzig={(patch) => { if (!item) return; if ('laag_id' in patch && item.groep_id) { for (const x of items.filter((y) => y.groep_id === item.groep_id)) wijzigItem(x.id, { laag_id: patch.laag_id }); const { laag_id, ...rest } = patch; if (Object.keys(rest).length) wijzigItem(item.id, rest); return; } wijzigItem(item.id, patch); if (patch.geometrie) { try { tdRef.current?.updateFeatureGeometry(item.id, geo.rondGeom(patch.geometrie)); } catch { setTimeout(syncTd, 0); } } }} onStijl={(patch) => item && wijzigItem(item.id, { stijl: { ...item.stijl, ...patch } })} onGeometrie={(g, p) => item && zetGeometrie(item.id, g, p)}
                onDupliceer={() => item && dupliceer(item.id)} onVerwijder={() => item && verwijderItems([item.id])} onRaster={(r, k, x, y) => item && maakRaster(item.id, r, k, x, y)} onLangsLijn={(elId, interval) => item && langsLijn(item.id, elId, interval)}
                onAlsElement={() => item && bewaarAlsElement(item.id)} onActie={(soort, arg) => (soort === 'plaatsfiche' ? item && naarPlaatsfiche(item.id) : actie(soort, arg))}
                gekopieerdeStijl={stijlKlembord} plannen={anderePlannen} fotos={fotos} snelstijlen={snelstijlen} onPlan={wijzigPlanGecontroleerd} onZoom={() => zoomNaar(item)} onKabel={tekenKabel} onMenu={paneelActie} iso={!!iso} />
            </details>
          </aside>
        )}
        {eigenschappenOpen && !veelSel && !(werkruimte !== 'plan' && wrDetail) && (
          <aside className="fm-eigenschappen">
            <div className="fm-paneelkop"><span className="fm-paneelnaam fm-familienaam" title="Eigenschappen">{FAMILIE_NAAM[familieVan(item, elementenMap.get(item.element_id))]}</span><button className="fm-sluit" aria-label="Selectie opheffen" onClick={() => { try { tdRef.current?.deselectFeature(item.id); } catch {} setGeselecteerd(null); setExtra([]); }}>×</button></div>
            <SlotBanner slot={slotInfo.current.slot} kijkers={slotInfo.current.kijkers} onToch={() => setOvername((o) => new Set([...o, item.id]))} />
            <ItemGeschiedenis item={item} />
            <Eigenschappen
              binnenplan={item?.geometrie?.type === 'Polygon' ? (binnen ? (item.id !== binnen.host && item.soort !== 'element' ? { ruimte: true } : null) : { open: () => gaNaarBinnenRef.current?.(item.id), aantal: items.filter((x) => x.velden?.binnen?.host === item.id).length }) : !binnen && isBinnenPunt(item) ? { open: () => gaNaarBinnenRef.current?.(item.id), aantal: items.filter((x) => x.velden?.binnen?.host === item.id).length } : null}
              groepNaam={item?.groep_id ? groepNaam(item.groep_id) : ''} onGroepNaam={(n) => item?.groep_id && zetGroepNaam(item.groep_id, n)} groepAantal={item?.groep_id ? items.filter((x) => x.groep_id === item.groep_id).length : 0}
              item={item} plan={plan} lagen={lagen} fasen={fasen} elementen={elementen} doeken={heeftModule('branding') ? doeken : GEEN_DOEKEN} doekPenseel={doekPenseel} onDoekPenseel={setDoekPenseel} elementenMap={elementenMap} lagenMap={lagenMap}
              items={items} schrijven={schrijven && !slotInfo.current.slot && magWp(item)} uitgebreid={uitgebreid}
              onWijzig={(patch) => { if (!item) return; if ('laag_id' in patch && item.groep_id) { for (const x of items.filter((y) => y.groep_id === item.groep_id)) wijzigItem(x.id, { laag_id: patch.laag_id }); const { laag_id, ...rest } = patch; if (Object.keys(rest).length) wijzigItem(item.id, rest); return; } wijzigItem(item.id, patch); if (patch.geometrie) { try { tdRef.current?.updateFeatureGeometry(item.id, geo.rondGeom(patch.geometrie)); } catch { setTimeout(syncTd, 0); } } }}
              onStijl={(patch) => item && wijzigItem(item.id, { stijl: { ...item.stijl, ...patch } })}
              onGeometrie={(g, p) => item && zetGeometrie(item.id, g, p)}
              onDupliceer={() => item && dupliceer(item.id)}
              onVerwijder={() => item && verwijderItems([item.id])}
              onRaster={(r, k, x, y) => item && maakRaster(item.id, r, k, x, y)}
              onLangsLijn={(elId, interval) => item && langsLijn(item.id, elId, interval)}
              onAlsElement={() => item && bewaarAlsElement(item.id)}
              onActie={(soort, arg) => (soort === 'plaatsfiche' ? item && naarPlaatsfiche(item.id) : actie(soort, arg))}
              gekopieerdeStijl={stijlKlembord} plannen={anderePlannen} fotos={fotos} snelstijlen={snelstijlen} vast={vast}
              onPlan={wijzigPlanGecontroleerd}
              onZoom={() => zoomNaar(item)}
              onKabel={tekenKabel}
              onMenu={paneelActie} iso={!!iso}
            />
            {item?.geometrie && isSign(item) && <div className="fm-nav-onder"><NavKnoppen geometrie={item.geometrie} /></div>}
          </aside>
        )}
      </div>

      <footer className="fm-statusbalk">
        {werkruimte !== 'plan' && <div className="vak fm-wr-cijfers" style={{ borderLeft: 0 }}><strong>{wr.naam}</strong><span>{cijfers}</span></div>}
        <div className="uitleg"><strong>{typeof signZet === 'string' ? `Bord ${signZet}` : signZet ? 'Bordpunt' : (gTool(gereedschap)?.naam || (gereedschap === 'bouwer' ? 'Bouwer plaatsen' : ''))}</strong><span className="fm-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{typeof signZet === 'string' ? 'Klik op de kaart, aan de kant van de weg waar het bord staat' : signZet ? wrTool('bordpunt')?.uitleg : (wrTools?.find((t) => gereedschap === t.id || (t.element && gereedschap === 'element' && gekozenElement && t.element(gekozenElement)))?.uitleg) || UITLEG[gereedschap]}</span></div>
        <div className="vak" ref={posRef} />
        <button className={`fm-optiesknop${uitgebreid ? ' aan' : ''}`} aria-pressed={uitgebreid} title="Eenvoudig toont enkel wat je meestal nodig hebt. Alle opties toont ook de zeldzame." onClick={() => setUitgebreid(!uitgebreid)}>{uitgebreid ? 'Alle opties' : 'Eenvoudig'}</button>
        <button data-menuknop onClick={(e) => { e.stopPropagation(); setMenu(menu === 'hulp' ? null : 'hulp'); }} title="Hulp en sneltoetsen">?</button>
        {menu === 'hulp' && <HulpMenu />}
        <button data-menuknop className={snapAan ? 'aan' : ''} onClick={(e) => { e.stopPropagation(); setMenu(menu === 'snap' ? null : 'snap'); }}>Snappen · {snapAan}</button>
        {menu === 'snap' && (
          <div className="fm-menu" style={{ right: 0, bottom: 28 }} onClick={(e) => e.stopPropagation()}>
            {[['punten', 'Op hoekpunten'], ['lijnen', 'Op lijnen'], ['hoek', 'Hoeken per 15°'], ['midden', 'Op het midden van lijnstukken']].map(([k, t]) => (
              <label key={k}><input type="checkbox" checked={!!snap[k]} onChange={() => setSnap((s2) => ({ ...s2, [k]: !s2[k] }))} />{t}</label>
            ))}
            <label title="Gebouwen en wegranden uit het GRB laden voor dit beeld (Vlaanderen)"><input type="checkbox" checked={!!snap.grb} onChange={() => (snap.grb ? setSnap((s2) => ({ ...s2, grb: false })) : laadGrb())} />Op gebouwen en wegen (GRB)</label>
          </div>
        )}
      </footer>

      {popupDiv && item && createPortal(
        <PopupInhoud item={item} laag={lagenMap.get(item.laag_id)} element={elementenMap.get(item.element_id)} profiel={profiel} />, popupDiv,
      )}
      <ExportVoortgang />
      {uitvoer && (() => {
        const hosts = !heeftModule('binnen') ? [] : [...new Set(items.map((x) => x.velden?.binnen?.host).filter(Boolean))].map((id) => items.find((x) => x.id === id)).filter(Boolean)
          .flatMap((h) => { const vs = verdiepingenVan(h); return vs.map((v) => ({ host: h.id, verd: v.id, naam: `${h.naam || elementenMap.get(h.element_id)?.naam || ''}${vs.length > 1 ? ` · ${v.naam}` : ''}` })); });
        return (
          <Uitvoer plan={plan} lagen={lagen} fasen={fasen} items={items} elementenMap={elementenMap} actieveFase={actieveFase} schrijven={schrijven} binnenHosts={hosts} kaart={mapRef.current} binnen={binnen}
            startTab={uitvoer.tab} startId={uitvoer.id} onSluit={() => setUitvoer(null)} onPlan={wijzigPlan}
            onExport={exporteer}
            onSignPdf={async () => { const { signalisatiePdf } = await import('./signPdf'); const { doc, meldingen } = await signalisatiePdf({ plan, items, voortgang: () => {} }); doc.save(`Signalisatie - ${plan.naam} v${plan.versie}.pdf`.replace(/[\\/:*?"<>|]/g, '')); return meldingen.join(' ') || undefined; }}
            onBinnenPdf={(host, verd) => { setUitvoer(null); setBinnenScherm({ host, verd, pdf: true }); }}
            onMateriaal={() => { setUitvoer(null); setMateriaalOpen(true); }}
            onCad={schrijven ? () => { setUitvoer(null); setCadVervang(null); setDialoog('cad'); } : null}
            onGeimporteerd={naImport} />
        );
      })()}
      {dialoog === 'cad' && <CadImport vervang={cadVervang} onSluit={() => { setDialoog(null); setCadVervang(null); }} onKlaar={cadKlaar} />}
      {dialoog === 'definitief' && (
        <DefinitiefDialoog plan={plan} lagen={lagen} items={items} elementenMap={elementenMap} fasen={fasen} vast={vast} onSluit={() => setDialoog(null)} onBevestig={maakDefinitief}
          onKiesItem={(id) => { setGeselecteerd(id); zoomNaar(items.find((x) => x.id === id)); }} />
      )}
      <CommandoPalet open={palet} onSluit={() => setPalet(false)} bronnen={paletBronnen} />
      <AppDialogen />
      {(materiaalOpen || focusLijst) && plan && (
        // Blijft bestaan (verborgen) terwijl je iets toont op de kaart: terug = zelfde groepering, open regels en scroll.
        <MateriaalScherm verborgen={!materiaalOpen} plan={plan} items={items} elementenMap={elementenMap} lagenMap={lagenMap} fasen={fasen} actieveFase={actieveFase} schrijven={schrijven}
          onWijzigItems={(lijst) => { for (const [id, patch] of lijst) wijzigItem(id, patch); setMelding(`${lijst.length} ${lijst.length === 1 ? 'item' : 'items'} aangepast.`); }}
          onStd={(nw) => wijzigPlan({ instellingen: { ...(st.current.plan?.instellingen || {}), leveranciers: nw } })}
          onToon={(ids, label) => {
            const set = new Set(ids); setHerkomstFilter(null); setFocusLijst({ ids: set, label }); setMateriaalOpen(false);
            const k = geo.kader(items.filter((x) => set.has(x.id)).map((x) => x.geometrie)); const map = mapRef.current;
            if (k && map) { if (k[0] === k[2] && k[1] === k[3]) map.easeTo({ center: [k[0], k[1]], zoom: Math.max(map.getZoom(), 18) }); else map.fitBounds(k, { padding: 80, maxZoom: 20 }); }
          }}
          onSluit={() => { setMateriaalOpen(false); setFocusLijst(null); }} />
      )}
      {dialoog === 'delen' && <Delen plan={plan} lagen={lagen} fasen={fasen} items={items} elementenMap={elementenMap} schrijven={schrijven} eventNaam={planEvent?.naam || plan.editie_naam || ''} eventKleur={planEvent?.kleur || '#108AED'} leveranciers={[...new Set(items.filter((i) => i.element_id).map((i) => herkomstVan(i, elementenMap.get(i.element_id), levStd)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'))} onSluit={() => setDialoog(null)} onSnel={(x) => setUitvoer(x)} onPdfBeeld={() => { setPdfNaDelen(true); setDialoog('pdf'); }} />}
      {tekenscherm && <Tekenscherm start={tekenscherm} elementen={elementen} elementenMap={elementenMap} onKlaar={tekenschermKlaar} onSluit={() => setTekenscherm(null)} />}
      {dialoog === 'pdf' && <PdfDialoog nieuwTab={!binnen} plan={plan} lagen={lagen} fasen={fasen} items={binnen ? items.filter((x) => x.id === binnen.host || inBinnen(x, binnen)) : items.filter((x) => !x.velden?.binnen)} elementenMap={elementenMap} actieveFase={actieveFase} kaart={mapRef.current} onPlan={wijzigPlan} onSluit={() => { setDialoog(pdfNaDelen ? 'delen' : null); setPdfNaDelen(false); }} />}
    </div>
  );
}

export { maten, matenTekst };
