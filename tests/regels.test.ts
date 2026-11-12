import { describe, it, expect } from "vitest";
import { geldigeSlug, subdomein, isEigenDomein } from "../lib/org";
import { leesbaar, contrast, huisstijlVars } from "../lib/huisstijl";
import { linkAan, laagIdsVan, itemsVanOnderdeel, rijMetOnderdelen, onderdelenVan } from "../components/maps/ontvangers";

describe("adressen van organisaties", () => {
  it("Een gewone code is geldig, gereserveerde namen niet", () => {
    expect(geldigeSlug("flcs")).toBe(true);
    for (const s of ["login", "www", "test", "api", "beheer", "a", "Met Spatie", "-streep", ""]) expect(geldigeSlug(s)).toBe(false);
  });
  it("Het subdomein komt uit het adres", () => {
    expect(subdomein("flcs.toolen.be")).toBe("flcs");
    expect(subdomein("toolen.be")).toBe(null);
    expect(subdomein("a.b.toolen.be")).toBe(null);
    expect(subdomein("flcs.toolen.be.kwaad.com")).toBe(null);
  });
  it("Een vreemd domein is geen eigen domein", () => {
    expect(isEigenDomein("flcs.toolen.be")).toBe(true);
    expect(isEigenDomein("toolen.be.kwaad.com")).toBe(false);
  });
});

describe("huisstijl blijft leesbaar", () => {
  it("Een te lichte kleur wordt donkerder tot wit erop leesbaar is", () => {
    for (const k of ["#FFE600", "#7FDBFF", "#FFFFFF", "#28B571"]) expect(contrast(leesbaar(k), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
  it("Een donkere kleur blijft zoals ze is", () => {
    expect(leesbaar("#022056")).toBe("#022056");
  });
  it("Een ongeldige kleur geeft geen variabelen", () => {
    expect(huisstijlVars({ primair: "rood" })).toEqual({});
  });
});

describe("deellinks: wat een ontvanger ziet", () => {
  const lagen = [{ id: "a", printbaar: true }, { id: "b", printbaar: true, map: "Stroom" }, { id: "c", printbaar: false }];
  const items = [
    { id: "1", laag_id: "a", soort: "lijn" }, { id: "2", laag_id: "b", soort: "punt", element_id: "e1" },
    { id: "3", laag_id: "c", soort: "vlak" }, { id: "4", laag_id: "a", soort: "vlak", verborgen: true },
    { id: "5", laag_id: "a", soort: "punt", fase_ids: ["f2"] },
  ];
  it("Een ingetrokken of verlopen link staat uit", () => {
    expect(linkAan({})).toBe(true);
    expect(linkAan({ ingetrokken_op: "2026-01-01" })).toBe(false);
    expect(linkAan({ geldig_tot: "2020-01-01" })).toBe(false);
    expect(linkAan({ geldig_tot: "2999-01-01" })).toBe(true);
  });
  it("Zonder keuze: alle lagen die afgedrukt mogen worden", () => {
    expect(laagIdsVan({}, lagen)).toEqual(["a", "b"]);
  });
  it("Met gekozen lagen ziet de ontvanger enkel die lagen, nooit verborgen items", () => {
    const zicht = itemsVanOnderdeel({ laag_ids: ["a"] }, items, lagen).map((i: { id: string }) => i.id);
    expect(zicht).toEqual(["1", "5"]);
  });
  it("Een map neemt al haar lagen mee", () => {
    expect(laagIdsVan({ laag_ids: [], mappen: ["Stroom"] }, lagen)).toEqual(["b"]);
  });
  it("Een fase verbergt items van andere fasen", () => {
    expect(itemsVanOnderdeel({ laag_ids: ["a"], fase: "f1" }, items, lagen).map((i: { id: string }) => i.id)).toEqual(["1"]);
  });
  it("Verborgen elementen en items blijven weg", () => {
    expect(itemsVanOnderdeel({ laag_ids: ["a", "b"], verberg_elementen: ["e1"], verberg_items: ["1"] }, items, lagen).map((i: { id: string }) => i.id)).toEqual(["5"]);
  });
  it("De rij voor de databank bevat enkel de lagen van de plannen", () => {
    const r = rijMetOnderdelen({ opties: { pdf: true, drie: "x" } }, [{ id: "p", soort: "plan", laag_ids: ["b"] }, { id: "d", soort: "drie", item: "9" }], lagen);
    expect(r.laag_ids).toEqual(["b"]); expect(r.opties.drie).toBeUndefined(); expect(r.opties.pdf).toBe(true);
  });
  it("Een oude link zonder onderdelen wordt één plan", () => {
    expect(onderdelenVan({ laag_ids: ["a"], opties: {} })[0].soort).toBe("plan");
  });
});
