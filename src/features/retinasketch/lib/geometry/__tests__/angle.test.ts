import { describe, it, expect } from "vitest";
import { computeAngleDeg, shafferFromAngle } from "../angle";

describe("computeAngleDeg", () => {
  it("angle droit = 90°", () => {
    expect(computeAngleDeg([0, 0], [1, 0], [0, 1])).toBe(90);
  });
  it("bras alignés = 180°", () => {
    expect(computeAngleDeg([0, 0], [1, 0], [-1, 0])).toBe(180);
  });
  it("angle aigu ~30°", () => {
    // v1 = (1,0) ; v2 à 30° → (cos30, sin30)
    const a = computeAngleDeg([0, 0], [1, 0], [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)]);
    expect(a).toBe(30);
  });
});

describe("shafferFromAngle", () => {
  it("classe selon les seuils Shaffer", () => {
    expect(shafferFromAngle(40)).toBe(4); // grand ouvert
    expect(shafferFromAngle(28)).toBe(3); // ouvert
    expect(shafferFromAngle(15)).toBe(2); // modérément étroit
    expect(shafferFromAngle(6)).toBe(1); // très étroit
    expect(shafferFromAngle(0)).toBe(0); // fermé
  });
});
