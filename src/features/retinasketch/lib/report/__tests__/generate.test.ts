import { describe, it, expect } from "vitest";
import { generateReport } from "../generate";
import type { Annotation, DerivedAttributes } from "../../types";

/** Fabrique une annotation validée minimale pour les tests. */
function ann(attrs: DerivedAttributes, lesionId = "drusen"): Annotation {
  return {
    id: `a${Math.random().toString(36).slice(2)}`,
    kind: "point",
    points: [0, 0],
    radiusMm: 0.5,
    centroidMm: { x: 0, y: 0 },
    areaMm2: null,
    laterality: "OD",
    lesionId,
    status: "validated",
    attrs,
    author: "test",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("generateReport — interprétation par type de coupe", () => {
  it("rétinographie : localisation anatomique de face (comportement historique)", () => {
    const a = ann({
      context: "retino",
      anatomicalZone: "Papille",
      quadrant: "TS",
      foveaBand: "3-6mm",
      distanceToFoveaMm: 4,
      etdrsSector: null,
      distanceToDiscMm: 0.5,
      vascularRelation: { nearVessel: false, distanceToVesselMm: null },
    });
    const out = generateReport([a], "OD");
    expect(out).toContain("Œil droit (OD)");
    expect(out).toContain("papille");
    expect(out).not.toContain("B-scan");
  });

  it("B-scan : mentionne le support, la couche et la région transverse", () => {
    const a = ann({ context: "bscan", transverseZone: "centrale", layer: "OPL" });
    const out = generateReport([a], "OD");
    expect(out).toContain("sur le B-scan");
    expect(out).toContain("couche OPL");
    expect(out).toContain("région centrale");
  });

  it("B-scan sans couche renseignée : pas de mention de couche", () => {
    const a = ann({ context: "bscan", transverseZone: "périphérique", layer: null });
    const out = generateReport([a], "OD");
    expect(out).toContain("sur le B-scan");
    expect(out).not.toContain("couche");
  });

  it("cornée : mentionne la coupe de cornée et la couche cornéenne", () => {
    const a = ann({ context: "cornea", transverseZone: "paracentrale", layer: "Stroma" });
    const out = generateReport([a], "OD");
    expect(out).toContain("coupe de cornée");
    expect(out).toContain("couche Stroma");
    expect(out).toContain("région paracentrale");
  });

  it("groupe séparément une même lésion sur rétino et sur B-scan", () => {
    const retino = ann({
      context: "retino",
      anatomicalZone: "Macula",
      quadrant: "TI",
      foveaBand: "1-3mm",
      distanceToFoveaMm: 2,
      etdrsSector: "TI",
      distanceToDiscMm: 5,
      vascularRelation: { nearVessel: false, distanceToVesselMm: null },
    });
    const bscan = ann({ context: "bscan", transverseZone: "centrale", layer: "ONL" });
    const lines = generateReport([retino, bscan], "OD")
      .split("\n")
      .filter((l) => l.startsWith("•"));
    expect(lines).toHaveLength(2);
    expect(lines.some((l) => l.includes("B-scan"))).toBe(true);
    expect(lines.some((l) => l.includes("maculaire") || l.includes("région maculaire"))).toBe(true);
  });
});
