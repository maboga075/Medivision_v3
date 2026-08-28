import { describe, it, expect } from "vitest";
import { computeAttributes } from "../engine";

/**
 * Nomenclature topographique 8 zones (rétino / OCT-A / OCT de face).
 * Espace mm modèle OD : +x temporal, -x nasal, +y inférieur, -y supérieur ;
 * fovéa à l'origine, papille ≈ (-4.76, -0.34), cercle maculaire ≈ 2,6 mm.
 */
const topo = (x: number, y: number) => {
  const a = computeAttributes({ x, y }, "retino");
  if (a.context !== "retino") throw new Error("contexte inattendu");
  return a.topoZone;
};

describe("topoZone — découpage 8 zones", () => {
  it("cercle maculaire prioritaire → MS / MI", () => {
    expect(topo(0, -1)).toBe("MS"); // dans la macula, au-dessus de la fovéa
    expect(topo(0, 1)).toBe("MI"); // dans la macula, au-dessous
    // Priorité : un point temporal MAIS dans le cercle maculaire reste MS/MI.
    expect(topo(1.5, -1)).toBe("MS");
  });

  it("temporal à l'axe fovéal → TS-M / TI-M", () => {
    expect(topo(5, -4)).toBe("TS-M");
    expect(topo(5, 4)).toBe("TI-M");
  });

  it("entre axes fovéal et papillaire → NS-M / NI-M", () => {
    expect(topo(-2, -4)).toBe("NS-M");
    expect(topo(-2, 4)).toBe("NI-M");
  });

  it("nasal à l'axe papillaire → NS-P / NI-P", () => {
    expect(topo(-6, -4)).toBe("NS-P");
    expect(topo(-6, 4)).toBe("NI-P");
  });

  it("OCT-A partage la même nomenclature", () => {
    const a = computeAttributes({ x: 5, y: -4 }, "octa");
    if (a.context !== "octa") throw new Error("contexte inattendu");
    expect(a.topoZone).toBe("TS-M");
  });
});
