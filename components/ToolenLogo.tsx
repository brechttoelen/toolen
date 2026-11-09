// Het Toolen-teken: vier afgeronde vierkanten in een ruit. Boven blauw, rechts groen,
// links en onder in de grondkleur (wit op navy, navy op licht).
export function ToolenTeken({ grootte = 22, op = "navy" }: { grootte?: number; op?: "navy" | "licht" }) {
  const grond = op === "navy" ? "#FFFFFF" : "#022056";
  const s = 8.6; // zijde van een vierkant in een vak van 32
  const vak = (cx: number, cy: number, kleur: string) => (
    <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={2.2} fill={kleur} transform={`rotate(45 ${cx} ${cy})`} />
  );
  return (
    <svg width={grootte} height={grootte} viewBox="0 0 32 32" aria-hidden="true">
      {vak(16, 7, "#108AED")}
      {vak(25, 16, "#28B571")}
      {vak(7, 16, grond)}
      {vak(16, 25, grond)}
    </svg>
  );
}

export function ToolenWoordmerk({ op = "navy", product }: { op?: "navy" | "licht"; product?: string }) {
  const kleur = op === "navy" ? "#FFFFFF" : "#022056";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, color: kleur }}>
      <ToolenTeken op={op} />
      <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>
        toolen{product && <span style={{ fontWeight: 400, opacity: 0.75 }}> {product}</span>}
      </span>
    </span>
  );
}
