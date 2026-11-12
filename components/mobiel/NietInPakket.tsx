"use client";

// Gsm zonder module "Gsm-app": uitleggen en de volledige versie aanbieden.
export default function NietInPakket({ naam }: { naam: string }) {
  const volledig = () => { try { sessionStorage.setItem("fm-volledig", "1"); } catch { /* */ } location.href = "/maps"; };
  return (
    <div>
      <h2 className="t-titel" style={{ fontSize: 28, marginBottom: 6 }}>Gsm-app niet beschikbaar</h2>
      <p className="t-sub" style={{ marginBottom: 18 }}>
        De gsm-app zit niet in het pakket van {naam}. Vraag je beheerder om ze toe te voegen, of open de volledige versie. Die werkt best op een computer.
      </p>
      <button type="button" className="t-knop hoofd" style={{ height: 46, fontSize: 14.5, width: "100%" }} onClick={volledig}>Volledige versie openen</button>
    </div>
  );
}
