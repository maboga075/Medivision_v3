import { create } from "zustand";
import type { Annotation, Laterality } from "../lib/types";
import { computeAttributes, geometryMetrics, smoothFreeform } from "../lib/geometry/engine";
import { getLesion } from "../lib/ontology/lesions";

export type LayerKey =
  | "anatomy"
  | "quadrants"
  | "fovea"
  | "etdrs"
  | "periphery"
  | "vessels";

export const SPOT_MIN_MM = 0.15;
export const SPOT_MAX_MM = 4;

interface State {
  laterality: Laterality;
  layers: Record<LayerKey, boolean>;
  annotations: Annotation[];
  hiddenLesionIds: string[];
  paletteOpen: boolean;
  spotRadiusMm: number;
  author: string;

  setLaterality: (l: Laterality) => void;
  toggleLayer: (k: LayerKey) => void;
  setPaletteOpen: (open: boolean) => void;
  setSpotRadius: (mm: number) => void;
  adjustSpotRadius: (deltaMm: number) => void;

  addSpot: (mx: number, my: number) => void;
  addFreeform: (points: number[]) => void;

  /** Valide TOUS les brouillons avec la lésion choisie. */
  assignLesion: (lesionId: string) => void;
  deleteAnnotation: (id: string) => void;
  deleteLesionGroup: (lesionId: string) => void;
  toggleLesionVisibility: (lesionId: string) => void;
  clearAll: () => void;

  /** V3 — amorçage/lecture par œil depuis la Consultation. */
  loadAnnotations: (anns: Annotation[]) => void;
  resetAll: () => void;
}

let counter = 0;
const newId = () => `a${Date.now().toString(36)}${(counter++).toString(36)}`;
const clampRadius = (mm: number) =>
  Math.max(SPOT_MIN_MM, Math.min(SPOT_MAX_MM, mm));

function buildAnnotation(
  kind: "point" | "polygon",
  points: number[],
  radiusMm: number | null,
  laterality: Laterality,
  author: string,
): Annotation {
  const { centroid, areaMm2 } = geometryMetrics(kind, points);
  return {
    id: newId(),
    kind,
    points,
    radiusMm,
    centroidMm: centroid,
    areaMm2:
      kind === "point" && radiusMm
        ? Math.round(Math.PI * radiusMm * radiusMm * 100) / 100
        : areaMm2,
    laterality,
    lesionId: null,
    status: "draft",
    attrs: computeAttributes(centroid),
    author,
    createdAt: new Date().toISOString(),
  };
}

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  anatomy: true,
  quadrants: false,
  fovea: false,
  etdrs: false,
  periphery: false,
  vessels: false,
};

export const useStore = create<State>((set) => ({
  laterality: "OD",
  layers: { ...DEFAULT_LAYERS },
  annotations: [],
  hiddenLesionIds: [],
  paletteOpen: false,
  spotRadiusMm: 0.5,
  author: "Dr. Utilisateur",

  setLaterality: (l) => set({ laterality: l }),
  toggleLayer: (k) =>
    set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setSpotRadius: (mm) => set({ spotRadiusMm: clampRadius(mm) }),
  adjustSpotRadius: (deltaMm) =>
    set((s) => ({ spotRadiusMm: clampRadius(s.spotRadiusMm + deltaMm) })),

  addSpot: (mx, my) =>
    set((s) => ({
      annotations: [
        ...s.annotations,
        buildAnnotation("point", [mx, my], s.spotRadiusMm, s.laterality, s.author),
      ],
    })),

  addFreeform: (points) => {
    const smoothed = smoothFreeform(points);
    if (smoothed.length < 6) return;
    set((s) => ({
      annotations: [
        ...s.annotations,
        buildAnnotation("polygon", smoothed, null, s.laterality, s.author),
      ],
    }));
  },

  assignLesion: (lesionId) =>
    set((s) => {
      if (!getLesion(lesionId)) return {};
      const hasDraft = s.annotations.some((a) => a.status === "draft");
      if (!hasDraft) return {};
      return {
        annotations: s.annotations.map((a) =>
          a.status === "draft"
            ? { ...a, lesionId, status: "validated" as const }
            : a,
        ),
        paletteOpen: false,
      };
    }),

  deleteAnnotation: (id) =>
    set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) })),

  deleteLesionGroup: (lesionId) =>
    set((s) => ({
      annotations: s.annotations.filter((a) => a.lesionId !== lesionId),
    })),

  toggleLesionVisibility: (lesionId) =>
    set((s) => ({
      hiddenLesionIds: s.hiddenLesionIds.includes(lesionId)
        ? s.hiddenLesionIds.filter((x) => x !== lesionId)
        : [...s.hiddenLesionIds, lesionId],
    })),

  clearAll: () => set({ annotations: [] }),

  loadAnnotations: (anns) =>
    set({ annotations: Array.isArray(anns) ? [...anns] : [], hiddenLesionIds: [], paletteOpen: false }),

  resetAll: () =>
    set({
      annotations: [],
      hiddenLesionIds: [],
      paletteOpen: false,
      spotRadiusMm: 0.5,
      layers: { ...DEFAULT_LAYERS },
    }),
}));
