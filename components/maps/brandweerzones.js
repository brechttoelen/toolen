// Vlaamse hulpverleningszones en hun regels voor tijdelijke evenementen.
// Gemeenten: lijst FOD Binnenlandse Zaken (versie 01/10/2026).
// regels: enkel waarden die in het reglement van de zone (of de gemeente die het gebruikt) staan;
// null = niet gevonden, dan geldt de richtwaarde. Onderzocht op 1/11/2026.
// uitgangen.tabel: [max. personen, aantal uitgangen]; uitgangen.daarna: basis + per begonnen 'per' personen boven 'vanaf'.
export const ZONES = [
 {
  "id": "antwerpen",
  "naam": "Brandweer Zone Antwerpen (BZA)",
  "website": "https://www.antwerpen.be",
  "gemeenten": [
   "Antwerpen",
   "Wijnegem"
  ],
  "bron_url": "https://assets.antwerpen.be/srv/assets/api/download/a615af80-0f29-4839-b6ea-ac72cd105cde/Standaardvoorwaarden%20Brandweer%20Zone%20Antwerpen%202023.pdf",
  "regels": {
   "personen_per_m2": null,
   "cm_per_persoon": 1.25,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": null,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": 100,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   },
   "uitgangen": {
    "tabel": [
     [
      50,
      1
     ],
     [
      250,
      2
     ],
     [
      500,
      3
     ]
    ],
    "daarna": {
     "basis": 3,
     "vanaf": 500,
     "per": 500
    }
   }
  },
  "extra": [
   "grote tijdelijke inrichting (>60 m² of >100 p): uitgangbreedte = 80 cm + 1,25 cm per persoon, hoogte ≥200 cm",
   "uitgangentabel: 1 uitgang ≤50 p (≤30 m²); 2 uitgangen 51-250 p; 3 uitgangen 251-500 p; daarna +1 per begonnen 500 p",
   "kleine inrichting ≤60 m² / 100 p: 1 uitgang <30 m², 2 uitgangen >30 m²; doorgang 120×200 cm",
   "groot evenemententerrein: elke uitgang ≥120×200 cm; aantal = √(oppervlakte m²)/15, naar boven afgerond; totale breedte = max personen × 0,002 m; >10.000 p in overleg",
   "blussers: 1 ABC-eenheid per begonnen 100 m², min 2 per inrichting, min 1 per niveau",
   "doodlopende gang max 15 m",
   "draaistraal 11/15 m; brandweg 4-10 m van de gevel; >120 cm van gevels",
   "kook- en verwarmingstoestellen ≥120 cm van brandbaar materiaal; gasslangen max 2 m",
   "vuurkorf max Ø60 cm × 90 cm hoog; groot vuur ≥25 m afstand, veiligheidszone 6 m, Ø max 6 m",
   "geen p/m²-norm en geen limiet in kg LPG (verwijst naar de Antwerpse politiecodex)"
  ],
  "opmerking": "Prioriteit voor Antwerpen. De tabel met uitgangen komt uit de ministeriële richtlijnen van december 1967 (https://www.antwerpen.be/assets-proxy/b113bee8-3b01-47bd-9627-a3599625bb9e). blusser_per_m2 = 100.",
  "zonder_reglement": false,
  "kort": "Antwerpen (BZA)"
 },
 {
  "id": "centrum",
  "naam": "Brandweerzone Centrum",
  "website": "https://www.brandweerzonecentrum.be",
  "gemeenten": [
   "Assenede",
   "Deinze",
   "Destelbergen",
   "Evergem",
   "Gavere",
   "Gent",
   "Laarne",
   "Lievegem",
   "Lochristi",
   "Merelbeke-Melle",
   "Nazareth-De Pinte",
   "Oosterzele",
   "Sint-Martens-Latem",
   "Wetteren",
   "Zelzate",
   "Zulte"
  ],
  "bron_url": "https://apidg.gent.be/supporting/dss-public/v1/sharedfiles/8b571abe-0fee-4578-b7d9-03be5ac8a9e7",
  "regels": {
   "personen_per_m2": 3,
   "cm_per_persoon": 1,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": 30,
   "max_afstand_tweede_m": 60,
   "blusser_per_m2": null,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   },
   "uitgangen": {
    "tabel": [
     [
      99,
      1
     ],
     [
      499,
      2
     ]
    ]
   }
  },
  "extra": [
   "geldt vanaf 100 p",
   "uitgangen: 1 <100 p; 2 bij 100-499 p; ≥500 p: 2+n",
   "trappen ×1,25 dalend / ×2 stijgend",
   "draaistraal 11/15 m; helling 6%; aslast 13 t",
   "installaties op fossiele brandstof ≥4 m van tent, beglaasde gevel of brandbaar materiaal",
   "aantal blussers in overleg met de brandweer",
   "Gentse addendum-politieverordening, gemeenteraad 26/9/2011, gewijzigd 24/10/2011"
  ],
  "opmerking": "Grotendeels dezelfde tekst als Oudenaarde, maar zonder 240 cm-regel en zonder 1/150 m². Gent heeft ook een PTI-politieverordening (2018), niet voor evenementen. In de lijst van 2026 staat Wachtebeke nergens.",
  "zonder_reglement": false,
  "kort": "Centrum (Gent…)"
 },
 {
  "id": "fluvia",
  "naam": "Brandweer Fluvia",
  "website": "https://www.brandweerfluvia.be",
  "gemeenten": [
   "Anzegem",
   "Avelgem",
   "Deerlijk",
   "Harelbeke",
   "Kortrijk",
   "Kuurne",
   "Ledegem",
   "Lendelede",
   "Menen",
   "Spiere-Helkijn",
   "Waregem",
   "Wevelgem",
   "Wielsbeke",
   "Zwevegem"
  ],
  "bron_url": "https://evenementen.hvzfluvia.be/tips-richtlijnen/evenementen-in-tenten-2-000p",
  "regels": {
   "personen_per_m2": null,
   "cm_per_persoon": 1,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": 60,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": 150,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   },
   "uitgangen": {
    "tabel": [
     [
      49,
      1
     ],
     [
      499,
      2
     ],
     [
      999,
      3
     ]
    ],
    "daarna": {
     "basis": 3,
     "vanaf": 999,
     "per": 1000
    }
   }
  },
  "extra": [
   "uitgangen: 1 ≤49 p; 2 ≤499 p; 3 ≤999 p; +1 per 1000 p",
   "geldt voor tenten <2000 p (>100 p of >60 m²)",
   "draaistraal 11/15 m; helling 6%; aslast 13 t",
   "tent ≥4 m van gebouwen (1 m tegen blinde gevel)",
   "generatoren, brandstof, verwarming en vuurkorven ≥4 m van tenten en gebouwen, ≥2 m van brandbaar materiaal",
   "gas: 1 fles + 1 reserve per toestel; foire of meerdaags max 130 kg; reserveflessen ≥8 m van het publiek; slang max 2 m en 5 jaar",
   "decoratie max 10% van het wandoppervlak",
   "trappen 1,25 / 2 cm per persoon; middenleuning vanaf 2,40 m"
  ],
  "opmerking": "Webpagina (footer 2021). De 60 m in max_afstand_uitgang_m is de evacuatieafstand tot een uitgang. Geen p/m²-norm op de pagina.",
  "zonder_reglement": false,
  "kort": "Fluvia (Kortrijk…)"
 },
 {
  "id": "kempen",
  "naam": "Brandweer zone Kempen",
  "website": "https://kempen.hulpverleningszone.be",
  "gemeenten": [
   "Balen",
   "Dessel",
   "Geel",
   "Grobbendonk",
   "Herenthout",
   "Herentals",
   "Herselt",
   "Hulshout",
   "Laakdal",
   "Meerhout",
   "Mol",
   "Olen",
   "Retie",
   "Vorselaar",
   "Westerlo"
  ],
  "bron_url": "https://kempen.hulpverleningszone.be/storage/dsg2cjTYfGZmvWP7HielU9y1J0ezAbTLq17dKJvC.pdf",
  "regels": {
   "personen_per_m2": 2.25,
   "cm_per_persoon": 1,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": 200
   },
   "max_afstand_uitgang_m": 30,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": 150,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   },
   "uitgangen": {
    "tabel": [
     [
      500,
      2
     ]
    ],
    "daarna": {
     "basis": 2,
     "vanaf": 0,
     "per": 1000
    }
   }
  },
  "extra": [
   "2,25 p/m² bruto in tenten (≈3 p/m² netto); openlucht 3 p/m²",
   "min 1 uitgang + 1 nooduitgang; >500 p: 2+M uitgangen (M = bezetting/1000, naar boven afgerond)",
   "nooduitgangen openlucht ≥2 m breed",
   "openlucht: max 60 m tot een uitgang",
   "brandweg 8 m breed bij doodlopende weg; draaistraal 11/15 m; helling 6%; aslast 13 t",
   "mobiele verwarming ≥2 m van brandbaar materiaal",
   "LPG ≥3 m van lager gelegen ruimtes; slang max 2 m en 5 jaar",
   "advies van 13-01-2020; politiereglement v3.2 sinds 1/3/2018 (https://www.laakdal.be/politiereglement-brandweerzone-kempen)"
  ],
  "opmerking": "De 200 cm in brede_route is de minimumbreedte van een nooduitgang in openlucht, niet de 500-personenregel. Geen tweede-uitgangsafstand.",
  "zonder_reglement": false,
  "kort": "Kempen (Geel, Mol…)"
 },
 {
  "id": "meetjesland",
  "naam": "Hulpverleningszone Meetjesland",
  "website": "https://www.zonemeetjesland.be",
  "gemeenten": [
   "Aalter",
   "Eeklo",
   "Kaprijke",
   "Maldegem",
   "Sint-Laureins"
  ],
  "bron_url": null,
  "regels": {
   "personen_per_m2": null,
   "cm_per_persoon": null,
   "min_uitgangen": null,
   "min_breedte_uitgang_cm": null,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": null,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": null,
   "brandweer": {
    "max_afstand_m": null,
    "breedte_m": null,
    "hoogte_m": null
   }
  },
  "extra": [],
  "opmerking": "Geen zonedocument voor evenementen gevonden. Assenede gebruikt een tekst uit 2011 (https://www.assenede.be/data/content/file/Evenementen/richtlijnen-evenementen-versie-22-maart-2011.pdf) met dezelfde cijfers als Gent/Oudenaarde: 3 p/m², 1 cm/p, 80×200 cm, 30/60 m, 60 m en 4×4 m. Assenede staat in de lijst van 2026 echter onder Centrum.",
  "zonder_reglement": true,
  "kort": "Meetjesland (Eeklo…)"
 },
 {
  "id": "midwest",
  "naam": "Zone Midwest",
  "website": "https://zonemidwest.be",
  "gemeenten": [
   "Ardooie",
   "Dentergem",
   "Hooglede",
   "Ingelmunster",
   "Izegem",
   "Lichtervelde",
   "Moorslede",
   "Oostrozebeke",
   "Pittem",
   "Roeselare",
   "Staden",
   "Tielt",
   "Wingene"
  ],
  "bron_url": "https://zonemidwest.be/uploads/files/Preventie/Evenementen/Evenementengids-MIDWEST.pdf",
  "regels": {
   "personen_per_m2": 3,
   "cm_per_persoon": null,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": 30,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": 150,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   },
   "uitgangen": {
    "tabel": [
     [
      99,
      1
     ],
     [
      499,
      2
     ],
     [
      1000,
      3
     ]
    ],
    "daarna": {
     "basis": 3,
     "vanaf": 1000,
     "per": 1000
    }
   }
  },
  "extra": [
   "3 p/m² netto of 1 p/m² bruto; voor een fuif aanbevolen 2 p/m²",
   "uitgangen: 1 ≤99 p; 2 vanaf 100 p; 3 vanaf 500 p; >1000 p: 3 + 1 per 1000 p",
   "trappen: 2 cm/p stijgend, 1,25 cm/p dalend (geen horizontaal cijfer vermeld)",
   "tent ≥4 m van gebouwen; generator en brandstof ≥4 m van de tent",
   "open vuur en kooktoestellen 4 m van gebouwen (1 m van blinde gevel), ≥2 m van brandbaar materiaal",
   "gas max 300 L/dag; flessen ≥3 m van kelderopeningen; slang max 2 m",
   "kampvuur max 1 m³ en 100 m van woningen",
   "evenementengids 20-12-2024 (opgesteld door PZ RIHO, gepubliceerd door Zone Midwest)"
  ],
  "opmerking": null,
  "zonder_reglement": false,
  "kort": "Midwest (Roeselare…)"
 },
 {
  "id": "noord-limburg",
  "naam": "Hulpverleningszone Noord-Limburg",
  "website": "https://noord-limburg.hulpverleningszone.be",
  "gemeenten": [
   "Bocholt",
   "Bree",
   "Hamont-Achel",
   "Hechtel-Eksel",
   "Leopoldsburg",
   "Lommel",
   "Peer",
   "Pelt"
  ],
  "bron_url": "https://noord-limburg.hulpverleningszone.be/storage/H8KDzUx4W2CE4fL1eM7kVaJlsGMFbVXFCHf1IrOF.pdf",
  "regels": {
   "personen_per_m2": 3,
   "cm_per_persoon": 1,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": 30,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": 200,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   },
   "uitgangen": {
    "tabel": [
     [
      99,
      1
     ],
     [
      499,
      2
     ],
     [
      999,
      3
     ]
    ],
    "daarna": {
     "basis": 2,
     "vanaf": 0,
     "per": 1000
    }
   }
  },
  "extra": [
   "tent met tafels en stoelen 1,5 p/m²; buiten 3 p/m² (1 dag) of 1,5 p/m² (meerdaags)",
   "uitgangen: 1 bij <100 p; 2 (diagonaal) bij 100-499 p; 3 bij 500-999 p; daarboven 2+n",
   "buiten: aantal personen /5 → 0,2 cm per persoon",
   "doodlopend max 15 m",
   "tent ≥6 m van gebouwen; bak- en frituurunit ≥5 m van de tent",
   "LPG max 350 L, max 5 flessen; slang max 5 m en 5 jaar",
   "heteluchtblazers 1 m (2 m als >40 °C)",
   "4×4 m komt uit de checklist: https://noord-limburg.hulpverleningszone.be/storage/hZWTvKhpyn13FZBc6ev5YaK8ojlT4veg6Mvol8Zv.pdf",
   "zonale richtlijnen versie 01-10-2018"
  ],
  "opmerking": "Bree 2013: https://www.bree.be/sites/default/files/public/Zonale%20richtlijnen%20Publiek%20toegankelijke%20inrichtingen%20-%2024.10.2013.pdf. 2 uitgangen geldt vanaf 100 p.",
  "zonder_reglement": false,
  "kort": "Noord-Limburg (Lommel…)"
 },
 {
  "id": "oost",
  "naam": "Brandweerzone Oost",
  "website": "https://oost.hulpverleningszone.be",
  "gemeenten": [
   "Berlare",
   "Buggenhout",
   "Dendermonde",
   "Hamme",
   "Lebbeke",
   "Lokeren",
   "Wichelen",
   "Zele"
  ],
  "bron_url": null,
  "regels": {
   "personen_per_m2": null,
   "cm_per_persoon": null,
   "min_uitgangen": null,
   "min_breedte_uitgang_cm": null,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": null,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": null,
   "brandweer": {
    "max_afstand_m": null,
    "breedte_m": null,
    "hoogte_m": null
   }
  },
  "extra": [],
  "opmerking": "Alleen een PTI-politieverordening (2019) gevonden, en die geldt niet voor evenementen of tenten: 2 p/m², 1 cm/p, 0,80 m, 30/60 m, 1/150 m², 60 m en 4×4 m voor gebouwen. Voor evenementen verwijst de zone naar de gemeentelijke politiereglementen.",
  "zonder_reglement": true,
  "kort": "Oost (Dendermonde…)"
 },
 {
  "id": "oost-vlaams-brabant",
  "naam": "Hulpverleningszone Oost Vlaams-Brabant",
  "website": "https://oost-vlaams-brabant.hulpverleningszone.be",
  "gemeenten": [
   "Aarschot",
   "Begijnendijk",
   "Bekkevoort",
   "Bertem",
   "Bierbeek",
   "Boortmeerbeek",
   "Boutersem",
   "Diest",
   "Geetbets",
   "Glabbeek",
   "Haacht",
   "Herent",
   "Hoegaarden",
   "Hoeilaart",
   "Holsbeek",
   "Huldenberg",
   "Kampenhout",
   "Keerbergen",
   "Kortenaken",
   "Landen",
   "Leuven",
   "Linter",
   "Lubbeek",
   "Oud-Heverlee",
   "Overijse",
   "Rotselaar",
   "Scherpenheuvel-Zichem",
   "Tervuren",
   "Tielt-Winge",
   "Tienen",
   "Tremelo",
   "Zoutleeuw"
  ],
  "bron_url": "https://oost-vlaams-brabant.hulpverleningszone.be/storage/fjQlr4NWYRVbCyHiIPAVfYX7Wt8CTqL0JeuPrBrB.pdf",
  "regels": {
   "personen_per_m2": 2.5,
   "cm_per_persoon": 1,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": 30,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": 150,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   },
   "uitgangen": {
    "tabel": [
     [
      99,
      1
     ],
     [
      499,
      2
     ]
    ]
   }
  },
  "extra": [
   "min 1,4 en max 2,5 p/m² netto",
   "uitgangen: 1 <100 p; 2 diagonaal bij 100-499 p; daarboven 2+n",
   "trappen ×1,25 / ×2",
   "toegangsweg draagt 15 t; draaistraal 11/15 m",
   "kooktoestellen ≥1,2 m van brandbaar materiaal; standverwarming ≥60 cm",
   "heteluchtblazers 1 m (2 m als >40 °C)",
   "LPG max 300 L; max 3 reserveflessen",
   "kraamrijen om de 30 m onderbroken; kramen ≥80 cm van gevels",
   ">3000 bezoekers: advies op maat",
   "versie 25-10-2021; in Rotselaar in werking sinds 1/6/2022"
  ],
  "opmerking": "In de lijst van 2026 hoort Kortenberg bij Vlaams-Brabant West.",
  "zonder_reglement": false,
  "kort": "Oost Vlaams-Brabant (Leuven…)"
 },
 {
  "id": "oost-limburg",
  "naam": "Brandweerzone Oost-Limburg (BWOL)",
  "website": "https://www.bwol.be",
  "gemeenten": [
   "As",
   "Bilzen-Hoeselt",
   "Dilsen-Stokkem",
   "Genk",
   "Houthalen-Helchteren",
   "Kinrooi",
   "Lanaken",
   "Maaseik",
   "Maasmechelen",
   "Oudsbergen",
   "Riemst",
   "Voeren",
   "Zutendaal"
  ],
  "bron_url": "https://www.bilzenhoeselt.be/brandweer-veiligheidsvoorschriften-per-type-evenement",
  "regels": {
   "personen_per_m2": 3,
   "cm_per_persoon": 1,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": null,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": null,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": null,
   "brandweer": {
    "max_afstand_m": null,
    "breedte_m": 4,
    "hoogte_m": null
   },
   "uitgangen": {
    "tabel": [
     [
      99,
      1
     ],
     [
      499,
      2
     ],
     [
      999,
      3
     ],
     [
      1999,
      4
     ],
     [
      2999,
      5
     ]
    ]
   }
  },
  "extra": [
   "binnen en in tenten: 3 p/m² staand, 1 cm uitgangsbreedte per persoon",
   "uitgangen: 1 bij 0-99 p; 2 bij 100-499; 3 bij 500-999; 4 bij 1000-1999; 5 bij 2000-2999",
   "groot festivalterrein: 1,5 p/m², 0,2 cm per persoon",
   "tent >200 m²: altijd controle door de brandweer",
   "openbare weg blijft over 4 m berijdbaar"
  ],
  "opmerking": "Cijfers van de evenementenpagina van Bilzen-Hoeselt (contact preventie@bwol.be); bwol.be publiceert zelf geen richtlijn. Niet bevestigd dat Maasmechelen dezelfde cijfers gebruikt. De BWOL-checklists (tent, openlucht, gebouw, zaal) konden niet worden opgehaald.",
  "zonder_reglement": false,
  "kort": "Oost-Limburg (Genk…)"
 },
 {
  "id": "rand",
  "naam": "Brandweer Zone Rand",
  "website": "https://www.brandweerzonerand.be",
  "gemeenten": [
   "Boechout",
   "Brasschaat",
   "Brecht",
   "Edegem",
   "Essen",
   "Hove",
   "Kalmthout",
   "Kapellen",
   "Kontich",
   "Lint",
   "Malle",
   "Mortsel",
   "Ranst",
   "Schilde",
   "Schoten",
   "Stabroek",
   "Wommelgem",
   "Wuustwezel",
   "Zandhoven",
   "Zoersel"
  ],
  "bron_url": "https://www.jaarmarktbroechem.be/wp-content/uploads/2025/09/1.Preventie_evenementenfiche_bereikbaarheid.pdf",
  "regels": {
   "personen_per_m2": null,
   "cm_per_persoon": null,
   "min_uitgangen": null,
   "min_breedte_uitgang_cm": null,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": null,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": null,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   }
  },
  "extra": [
   "toegangsweg 8 m breed bij doodlopend >30 m",
   "draaistraal 11/15 m; helling max 6%; aslast 13 t",
   "kleine tijdelijke inrichting: <150 m² en <100 p; groot: >150 m² of >100 p",
   "aanvraag evenement ≥45 dagen vooraf",
   "fiche bereikbaarheid versie 1, geldig tot 31/12/2025"
  ],
  "opmerking": "Enkel de fiche bereikbaarheid gevonden. De fiches voor kleine en grote tijdelijke inrichtingen staan op intranet.brandweerzonerand.be en konden niet worden opgehaald: geen cijfers voor uitgangen en personen.",
  "zonder_reglement": true,
  "kort": "Rand (Brasschaat, Kontich…)"
 },
 {
  "id": "rivierenland",
  "naam": "Brandweerzone Rivierenland",
  "website": "https://www.brandweerzonerivierenland.be",
  "gemeenten": [
   "Aartselaar",
   "Berlaar",
   "Bonheiden",
   "Boom",
   "Bornem",
   "Duffel",
   "Heist-op-den-Berg",
   "Hemiksem",
   "Lier",
   "Mechelen",
   "Niel",
   "Nijlen",
   "Putte",
   "Puurs-Sint-Amands",
   "Rumst",
   "Schelle",
   "Sint-Katelijne-Waver",
   "Willebroek"
  ],
  "bron_url": "https://www.schelle.be/wp-content/uploads/2024/07/standaard_brandweeradvies_voor_kleinschalige_evenementen.pdf",
  "regels": {
   "personen_per_m2": null,
   "cm_per_persoon": 1,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": null,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": 150,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   },
   "uitgangen": {
    "tabel": [
     [
      99,
      1
     ],
     [
      499,
      2
     ],
     [
      null,
      3
     ]
    ]
   }
  },
  "extra": [
   "standaardadvies voor <1500 p tegelijk; versie V20240515",
   "openlucht of open structuur: 0,5 cm per persoon",
   "uitgangen: 1 ≤99 p; 2 ≤499 p (in tegenovergestelde zones); ≥3 vanaf 500 p",
   "kraamrijen om de 30 m onderbroken door ≥1 m vrije doorgang",
   "draaistraal 11/15 m",
   "generatoren en kooktoestellen ≥120 cm van brandbaar materiaal en gebouwen",
   "gas: max 5 flessen, ≤350 L waterinhoud; slang max 2 m",
   "jerrycans max 50 L",
   "vuurkorf ≥10 m van andere vuren; kampvuur ≥100 m van woningen"
  ],
  "opmerking": "Mechelen heeft ook een eigen pagina met algemene regelgeving voor evenementen (niet bekeken).",
  "zonder_reglement": false,
  "kort": "Rivierenland (Mechelen…)"
 },
 {
  "id": "taxandria",
  "naam": "Hulpverleningszone Taxandria",
  "website": "https://www.hvztaxandria.be",
  "gemeenten": [
   "Arendonk",
   "Baarle-Hertog",
   "Beerse",
   "Hoogstraten",
   "Kasterlee",
   "Lille",
   "Merksplas",
   "Oud-Turnhout",
   "Ravels",
   "Rijkevorsel",
   "Turnhout",
   "Vosselaar"
  ],
  "bron_url": "https://www.ravels.be/standaardvoorwaarden-brandveiligheid-bij-kleinschalige-evenementen",
  "regels": {
   "personen_per_m2": null,
   "cm_per_persoon": null,
   "min_uitgangen": null,
   "min_breedte_uitgang_cm": null,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": null,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": null,
   "brandweer": {
    "max_afstand_m": null,
    "breedte_m": 4,
    "hoogte_m": null
   }
  },
  "extra": [
   "4 m vrije doorgang voor hulpdiensten (gids inplantingsplan: https://www.hvztaxandria.be/storage/files/20240226-preventie-evenementen-inplantingsplan-1720442587.pdf)",
   "categorie B (advies verplicht): >1000 bezoekers, tent >500 m², overnachting of open vuur; categorie C: >3000 bezoekers"
  ],
  "opmerking": "Pdf '3.0 standaardvoorwaarden HVZ Taxandria versie 20230113' bestaat (gelinkt op de sites van Ravels, Baarle-Hertog en Oud-Turnhout), maar was niet leesbaar (robots/provenance). Cijfers niet geverifieerd.",
  "zonder_reglement": true,
  "kort": "Taxandria (Turnhout…)"
 },
 {
  "id": "vlaams-brabant-west",
  "naam": "Brandweerzone Vlaams-Brabant West",
  "website": "https://www.vlaamsbrabantwest.be",
  "gemeenten": [
   "Affligem",
   "Asse",
   "Beersel",
   "Bever",
   "Dilbeek",
   "Drogenbos",
   "Grimbergen",
   "Halle",
   "Kapelle-op-den-Bos",
   "Kortenberg",
   "Kraainem",
   "Lennik",
   "Liedekerke",
   "Linkebeek",
   "Londerzeel",
   "Machelen",
   "Meise",
   "Merchtem",
   "Opwijk",
   "Pajottegem",
   "Pepingen",
   "Roosdaal",
   "Sint-Genesius-Rode",
   "Sint-Pieters-Leeuw",
   "Steenokkerzeel",
   "Ternat",
   "Vilvoorde",
   "Wemmel",
   "Wezembeek-Oppem",
   "Zaventem",
   "Zemst"
  ],
  "bron_url": "https://vlaamsbrabantwest.be/wp-content/uploads/2021/04/20210201_ZoRe_EVENEMENTEN_met_externe_toelichtingen.pdf",
  "regels": {
   "personen_per_m2": 3,
   "cm_per_persoon": 1,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": 45,
   "max_afstand_tweede_m": 80,
   "blusser_per_m2": 150,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   },
   "uitgangen": {
    "tabel": [
     [
      99,
      1
     ],
     [
      499,
      2
     ],
     [
      1000,
      3
     ],
     [
      2000,
      4
     ],
     [
      3000,
      5
     ],
     [
      4000,
      6
     ]
    ]
   }
  },
  "extra": [
   "zittend 1,5 p/m²",
   "openlucht: 5 personen per cm",
   "uitgangen: 1 ≤99 p; 2 bij 100-499 p; 3 bij 500-1000 p; 4 bij 1001-2000 p; 5 bij 2001-3000 p; 6 bij 3001-4000 p",
   "nooduitgangen in hekken ≥120 cm",
   "kraamrijen om de 30 m onderbroken door 1,2 m vrije doorgang",
   "draaistraal 11/15 m; aslast 13 t",
   "generatoren en verwarming ≥120 cm van brandbaar materiaal",
   "gas: max 5 flessen, 300 L per uitbatingseenheid; ≥3 m van brandbaar materiaal, ≥5 m van kelderopeningen; slang max 2 m",
   "vuurkorf max Ø60 cm × 90 cm hoog, ≥3 m afstand",
   "standaardregels voor <150 p",
   "ZoRe in werking sinds 1/2/2021"
  ],
  "opmerking": "Ook gepubliceerd via politie.be/5393 (Bijlage 1). De rekenvoorbeelden in C.1.1 spreken zichzelf tegen; gebruik de officiële tekst.",
  "zonder_reglement": false,
  "kort": "Vlaams-Brabant West (Halle, Vilvoorde…)"
 },
 {
  "id": "vlaamse-ardennen",
  "naam": "Brandweerzone Vlaamse Ardennen",
  "website": "https://www.bvlar.be",
  "gemeenten": [
   "Brakel",
   "Herzele",
   "Horebeke",
   "Kluisbergen",
   "Kruisem",
   "Lierde",
   "Maarkedal",
   "Oudenaarde",
   "Ronse",
   "Sint-Lievens-Houtem",
   "Wortegem-Petegem",
   "Zottegem",
   "Zwalm"
  ],
  "bron_url": "https://www.oudenaarde.be/sites/default/files/public/stad/Bestuur_en_beleid/ReglementenVerordeningen/Reglementen/RichtlijnenBrandweerTijdInst.pdf",
  "regels": {
   "personen_per_m2": 3,
   "cm_per_persoon": 1,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": 500,
    "breedte_cm": 240
   },
   "max_afstand_uitgang_m": 30,
   "max_afstand_tweede_m": 60,
   "blusser_per_m2": 150,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   }
  },
  "extra": [
   "uitgang hoogte 200 cm",
   "draaistraal 11 m binnen / 15 m buiten; helling max 6%; aslast 13 t",
   "trappen: ×1,25 cm/p dalend, ×2 stijgend; optrede ≤18 cm, aantrede ≥20 cm; leuning beide zijden >1,20 m, middenleuning ≥2,40 m",
   "tenten met verdieping: 2 trappen 51-250 p, 3 trappen 251-500 p, +1 per 500 p",
   "hoogteverschil >21 cm → trap of helling breedte uitgang +50 cm",
   "LPG max 130 kg/dag; lege flessen max 24 u; ≥3 m van kelderopeningen/riolen, ≥4 m van beglaasde gevels; slangen max 2 m, vervangen om 5 jaar",
   "noodverlichting ≥1 u; decoratie ≥2,5 m vrije hoogte",
   "verlengkabel max 50 m; differentieel ≤300 mA",
   "geen afstandsnorm voor generatoren (alleen verbod binnen in tent of gebouw)",
   "in werking sinds 1/1/2012"
  ],
  "opmerking": "Referentiemodel. Checklists 2024: https://www.oudenaarde.be/sites/default/files/2024-01/checklist%20brandweer%20tijdelijke%20inrichtingen.pdf en https://wortegem-petegem.be/sites/default/files/2024-12/Brandweerzone-Vlaamse-Ardennen-checklist-tijdelijke-inrichtingen.pdf bevestigen 240 cm, 30/60 m, 1/150 m², 60 m.",
  "zonder_reglement": false,
  "kort": "Vlaamse Ardennen (Oudenaarde…)"
 },
 {
  "id": "waasland",
  "naam": "Hulpverleningszone Waasland",
  "website": "https://www.hvzwaasland.be",
  "gemeenten": [
   "Beveren-Kruibeke-Zwijndrecht",
   "Sint-Gillis-Waas",
   "Sint-Niklaas",
   "Stekene",
   "Temse",
   "Waasmunster"
  ],
  "bron_url": "https://www.sint-niklaas.be/sites/portaal/files/2019-09/Stedelijke%20bepalingen%20inzake%20evenementenveiligheid.pdf",
  "regels": {
   "personen_per_m2": 3,
   "cm_per_persoon": null,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": 500,
    "breedte_cm": 240
   },
   "max_afstand_uitgang_m": null,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": 150,
   "brandweer": {
    "max_afstand_m": null,
    "breedte_m": 4,
    "hoogte_m": 4
   },
   "uitgangen": {
    "tabel": [
     [
      99,
      1
     ],
     [
      500,
      2
     ]
    ]
   }
  },
  "extra": [
   "uitgangen: 1 <100 p; 2 bij 100-500 p; ≥500 p: 2+n",
   "uitgang 80×200 cm",
   "1 blusser 6 kg ABC per 150 m² hal of tent",
   "draaistraal 11/15 m",
   "trappen ×1,25 / ×2; optrede ≤18 cm, aantrede ≥20 cm",
   "gasslang max 2 m en 5 jaar; 1 reservefles per toestel"
  ],
  "opmerking": "Dit is een stadsdocument van Sint-Niklaas; HVZ Waasland wordt er niet in genoemd. Kerncijfers komen overeen met Oudenaarde. Er staan geen afstanden 30/60 m in en geen 60 m-afstand voor de brandweer.",
  "zonder_reglement": false,
  "kort": "Waasland (Sint-Niklaas…)"
 },
 {
  "id": "westhoek",
  "naam": "Brandweer Westhoek",
  "website": "https://brandweerwesthoek.be",
  "gemeenten": [
   "Alveringem",
   "De Panne",
   "Diksmuide",
   "Heuvelland",
   "Houthulst",
   "Ieper",
   "Koekelare",
   "Koksijde",
   "Kortemark",
   "Langemark-Poelkapelle",
   "Lo-Reninge",
   "Mesen",
   "Nieuwpoort",
   "Poperinge",
   "Veurne",
   "Vleteren",
   "Wervik",
   "Zonnebeke"
  ],
  "bron_url": "https://brandweerwesthoek.be/preventie/brandveilig-samenleven/feesten/brandveilig-organiseren/evenementengids/",
  "regels": {
   "personen_per_m2": 3,
   "cm_per_persoon": 1,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": 240
   },
   "max_afstand_uitgang_m": null,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": 150,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   },
   "uitgangen": {
    "tabel": [
     [
      99,
      1
     ],
     [
      499,
      2
     ],
     [
      1000,
      3
     ],
     [
      2000,
      4
     ]
    ],
    "daarna": {
     "basis": 2,
     "vanaf": 0,
     "per": 1000
    }
   }
  },
  "extra": [
   "3 p/m² is netto; daarnaast max 0,8 p/m² bruto; zittend in theateropstelling 1,5 p/m²; banketopstelling 0,8 p/m²",
   "2 uitgangen vanaf 100 p (1 uitgang ≤99 p; 3 uitgangen 500-1000; 4 uitgangen 1001-2000; n uitgangen: (n×1000)-2000)",
   "openlucht: minimum 2 uitgangen; elke uitgang min 240 cm breed; 0,2 cm per persoon",
   "trappen 1,25 cm/p dalend, 2 cm/p stijgend",
   "draaistraal 11/15 m",
   "tent >100 m² ≥4 m van gebouwen; tijdelijke brandgevaarlijke installaties ≥4 m van gebouwen (1 m tegen blinde gevel)",
   "podium >50 m² en/of >80 cm hoog vraagt stabiliteitsattest",
   "noodverlichting ≥30 min en ≥1 lux",
   "LPG: alleen voorraad voor 1 dag; slang max 2 m en max 5 jaar oud; gastoestellen ≥120 cm van brandbaar materiaal",
   "generator buiten, op 'veilige afstand' zonder getal"
  ],
  "opmerking": "Prioriteit voor Ieper. Het is een webpagina, geen pdf. De 240 cm is de minimumbreedte van een openluchtuitgang, niet de 500-personenregel. Er staat geen maximale evacuatieafstand in.",
  "zonder_reglement": false,
  "kort": "Westhoek (Ieper…)"
 },
 {
  "id": "zone-1",
  "naam": "Hulpverleningszone 1 (Zone 1 West-Vlaanderen)",
  "website": "https://www.zone1.be",
  "gemeenten": [
   "Beernem",
   "Blankenberge",
   "Bredene",
   "Brugge",
   "Damme",
   "De Haan",
   "Gistel",
   "Ichtegem",
   "Jabbeke",
   "Knokke-Heist",
   "Middelkerke",
   "Oostende",
   "Oostkamp",
   "Oudenburg",
   "Torhout",
   "Zedelgem",
   "Zuienkerke"
  ],
  "bron_url": "https://www.zone1.be/assets/files/20260129-Organiseer-brandveilig.pdf",
  "regels": {
   "personen_per_m2": 2.6,
   "cm_per_persoon": 1,
   "min_uitgangen": 2,
   "min_breedte_uitgang_cm": 80,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": 45,
   "max_afstand_tweede_m": 80,
   "blusser_per_m2": 150,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   },
   "uitgangen": {
    "tabel": [
     [
      50,
      1
     ],
     [
      499,
      2
     ],
     [
      1000,
      3
     ],
     [
      2000,
      4
     ],
     [
      3000,
      5
     ],
     [
      4000,
      6
     ]
    ],
    "daarna": {
     "basis": 2,
     "vanaf": 0,
     "per": 1000
    }
   }
  },
  "extra": [
   "zittend 1,5 p/m²",
   "uitgangentabel: 1 uitgang ≤50 p; 2 uitgangen 50-499 p; 3 uitgangen 500-1000 p; 4 uitgangen 1001-2000 p; 5 uitgangen 2001-3000 p; 6 uitgangen 3001-4000 p; daarboven (n×1000)-2000",
   "buiten: 5 personen per cm; breedtes in veelvouden van 60 cm",
   "festivaluitzondering: 9000 bezoekers → 18 m nooduitgangen; 1 heraspaneel = 3 m voor 1500 p",
   "kleine tent ≤30 m²: max 50 p en 1 uitgang; ≤60 m²: max 100 p en 2 uitgangen",
   "doodlopend max 15 m; rijen om de 30 m onderbroken",
   "generatoren, koelwagens en verwarming ≥4 m van tent; tussen tenten ≥4 m; tent >60 m² krijgt rondom 4 m vrij",
   "verwarming en generator ≥2 m van brandbaar materiaal; foodtrucks ≥4 m van gebouwen en tenten",
   "gasflessen: max 1 dag voorraad, 1 fles per toestel, ≥3 m van kelderopeningen; slang max 2 m",
   "draaistraal 11/15 m; aslast 13 t; brandweg 4-10 m van de gevel",
   "kampvuur: Ø max 6 m, 100 m van woningen, 25 m van bos, 4 blussers van 6 kg",
   "veiligheidsplan vanaf 1500 bezoekers",
   "versie 2 januari 2026; in werking sinds 1/9/2025"
  ],
  "opmerking": "Prioriteit voor Brugge en Middelkerke. De oudere versie https://www.zone1.be/wp-content/uploads/2025/06/Voorwaarden-evenementen-2-06-2025.pdf kon niet geladen worden. Brugge heeft daarnaast een eigen stadsdocument (https://www.brugge.be/media/104586/download, versie 2 oktober 2026): 2,6 staand / 1,5 zittend p/m², 1 cm/p, uitgangen 80 cm in veelvouden van 60 cm, 2 uitgangen >60 m², 3 uitgangen >500 p, 4 uitgangen >1000 p, generator ≥4 m van een gebouw.",
  "zonder_reglement": false,
  "kort": "Zone 1 (Brugge, Oostende…)"
 },
 {
  "id": "zuid-oost",
  "naam": "Hulpverleningszone Zuid-Oost",
  "website": "https://www.zonezuidoost.be",
  "gemeenten": [
   "Aalst",
   "Denderleeuw",
   "Erpe-Mere",
   "Geraardsbergen",
   "Haaltert",
   "Lede",
   "Ninove"
  ],
  "bron_url": "https://www.ninove.be/politiereglement-2",
  "regels": {
   "personen_per_m2": null,
   "cm_per_persoon": null,
   "min_uitgangen": null,
   "min_breedte_uitgang_cm": null,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": null,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": null,
   "brandweer": {
    "max_afstand_m": 60,
    "breedte_m": 4,
    "hoogte_m": 4
   }
  },
  "extra": [
   "Ninove: brandweer ≤60 m, 4 m breed, 4 m vrije hoogte, draaistraal 11/15 m, helling 6%, aslast 13 t",
   "Ninove: uitlaat dieselgenerator ≥1 m boven de kraam en ≥4 m boven de grond",
   "Aalst: 4 m vrije doorgang op markten en kermissen; 1 blustoestel per kooktoestel plus branddeken; gasslang max 2 m"
  ],
  "opmerking": "De zone zegt dat elke gemeente een eigen politiereglement voor evenementen heeft (https://www.zonezuidoost.be/evenementen). Het zonaal PTI-reglement (sinds 1/1/2022) dekt geen evenementen; de pdf werd door robots geblokkeerd.",
  "zonder_reglement": true,
  "kort": "Zuid-Oost (Aalst…)"
 },
 {
  "id": "zuid-west-limburg",
  "naam": "Hulpverleningszone Zuid-West Limburg",
  "website": "https://www.zuidwestlimburg.be",
  "gemeenten": [
   "Alken",
   "Beringen",
   "Diepenbeek",
   "Gingelom",
   "Halen",
   "Hasselt",
   "Heers",
   "Herk-de-Stad",
   "Herstappe",
   "Heusden-Zolder",
   "Lummen",
   "Nieuwerkerken",
   "Sint-Truiden",
   "Tessenderlo-Ham",
   "Tongeren-Borgloon",
   "Wellen",
   "Zonhoven"
  ],
  "bron_url": "https://www.zuidwestlimburg.be/wat-kunnen-we-voor-je-doen/brandpreventie/tips-brandveiligheid/veilig-feesten",
  "regels": {
   "personen_per_m2": null,
   "cm_per_persoon": null,
   "min_uitgangen": null,
   "min_breedte_uitgang_cm": null,
   "brede_route": {
    "vanaf_personen": null,
    "breedte_cm": null
   },
   "max_afstand_uitgang_m": null,
   "max_afstand_tweede_m": null,
   "blusser_per_m2": null,
   "brandweer": {
    "max_afstand_m": null,
    "breedte_m": null,
    "hoogte_m": null
   }
  },
  "extra": [
   "kooktent (frituur) ≥5 m van tenten met podium of publiek",
   "kooktent: 1 blusser water/schuim 6 L, onderhoud max 1 jaar oud"
  ],
  "opmerking": "Prioriteit voor Zonhoven. Geen zonaal evenementenreglement gevonden. De evenementenpagina zegt dat de gemeente beslist of er advies nodig is en verwijst voor Zonhoven naar https://www.zonhoven.be/feestwijzer (niet opvraagbaar).",
  "zonder_reglement": true,
  "kort": "Zuid-West Limburg (Hasselt…)"
 }
];
