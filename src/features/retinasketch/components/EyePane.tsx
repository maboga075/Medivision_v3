
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useStore } from "@/features/retinasketch/store/useStore";
import type { Laterality } from "@/features/retinasketch/lib/types";
import BackgroundImage from "./BackgroundImage";
import SelectionPicker from "./SelectionPicker";
import SlotGallery from "./SlotGallery";
import { computeAutoFrame } from "@/features/retinasketch/lib/geometry/autoframe";
import { TEMPLATE } from "@/features/retinasketch/lib/geometry/template";
import { shafferFromAngle, SHAFFER_LABEL } from "@/features/retinasketch/lib/geometry/angle";

// Konva nécessite le DOM : chargement paresseux (équivalent du `dynamic` Next).
const RetinaStage = lazy(() => import("./RetinaStage"));
const StageFallback = (
  <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
    Chargement du schéma…
  </div>
);

interface Props {
  eye: Laterality;
  /** True si c'est l'œil actif (reçoit l'import et les outils). */
  active: boolean;
  /** En vue mono, on masque le bouton « plein cadre » et l'état actif. */
  layout: "dual" | "mono";
}

/**
 * Un panneau de travail pour un œil : schéma + image de fond + annotations de
 * cet œil. Cliquer le panneau le rend « actif » (cible de l'import et des
 * outils). Le dessin, lui, est toujours rattaché à l'œil du panneau survolé.
 */
export default function EyePane({ eye, active, layout }: Props) {
  const setLaterality = useStore((s) => s.setLaterality);
  const setLayout = useStore((s) => s.setLayout);
  const setBackgroundImage = useStore((s) => s.setBackgroundImage);
  const updateBackground = useStore((s) => s.updateBackground);
  const fileName = useStore((s) => s.backgrounds[eye].fileName);
  // Type du slot actif : le recadrage auto ne s'applique qu'aux rétinographies.
  const activeKind = useStore((s) => {
    const id = s.activeSlot[eye];
    return s.slots[eye].find((sl) => sl.id === id)?.kind ?? "retino";
  });
  // Géométrie du slot actif : forme de l'overlay de dépôt (cercle/carré/rectangle).
  const activeGeometry = useStore((s) => {
    const id = s.activeSlot[eye];
    return s.slots[eye].find((sl) => sl.id === id)?.geometry ?? "circle";
  });
  // Pachymétrie (µm) de cet œil — champ affiché sous une coupe OCT antérieur (cornée).
  const cornealThickness = useStore((s) => s.cornealThickness[eye]);
  const setCornealThickness = useStore((s) => s.setCornealThickness);
  // Cadre custom du slot actif (template libre) — demi-dimensions mm, redimensionnables.
  const activeFrame = useStore((s) => {
    const id = s.activeSlot[eye];
    const m = s.slots[eye].find((sl) => sl.id === id);
    return { w: m?.frameHalfWMm, h: m?.frameHalfHMm };
  });
  const setActiveSlotFrame = useStore((s) => s.setActiveSlotFrame);
  // Mesure d'angle iridocornéen (template angle IC) + override Shaffer de cet œil.
  const angleMeasure = useStore((s) => s.angleMeasure[eye]);
  const shafferOverride = useStore((s) => s.shafferOverride[eye]);
  const setShafferOverride = useStore((s) => s.setShafferOverride);

  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Glisser-déposer d'une rétinographie directement dans le cercle de CET œil
  // (OD/OG indépendants). Le bouton fichier classique reste disponible par ailleurs.
  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setLaterality(eye);
    const img = new Image();
    img.onload = () => {
      setBackgroundImage(url, file.name, eye);
      // Recadrage automatique (centre + remplit le champ, retire le liseré noir)
      // — calibré pour les rétinographies rondes ; neutre pour les autres types.
      const frame = activeKind === "retino" ? computeAutoFrame(img) : null;
      updateBackground(
        { natW: img.naturalWidth, natH: img.naturalHeight, ...(frame ?? {}) },
        eye,
      );
    };
    img.onerror = () => setBackgroundImage(url, file.name, eye);
    img.src = url;
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const dual = layout === "dual";
  const label = eye === "OD" ? "Œil droit · OD" : "Œil gauche · OG";

  return (
    <div
      className={`flex h-full min-w-0 flex-1 flex-col bg-white transition-[box-shadow] ${
        dual && active ? "shadow-[inset_0_0_0_2px_rgb(37,99,235)]" : ""
      }`}
    >
      {/* Zone de dessin (occupe l'espace restant au-dessus de la galerie) */}
      <div className="relative min-h-0 flex-1">
      {/* Le survol active l'œil (user-friendly) : le clic sert alors uniquement
          à dessiner, et changer d'œil ne crée plus de lésion par mégarde. */}
      <div
        ref={ref}
        onPointerEnter={() => setLaterality(eye)}
        onContextMenu={(e) => {
          // Clic droit sur le canvas → ouvre le panneau « Image de fond » au
          // curseur, ciblé sur CET œil. Évite le menu contextuel natif.
          e.preventDefault();
          setLaterality(eye);
          window.dispatchEvent(
            new CustomEvent("retina:open-bg-panel", {
              detail: { x: e.clientX, y: e.clientY, eye },
            }),
          );
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={(e) => {
          // Ignore les passages sur les enfants : ne réagit qu'à la sortie réelle du panneau.
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={onDrop}
        className="absolute inset-0 overflow-hidden"
      >
        {size.w > 0 && (
          <>
            <BackgroundImage eye={eye} width={size.w} height={size.h} />
            <div className="relative z-10 h-full w-full">
              <Suspense fallback={StageFallback}>
                <RetinaStage eye={eye} width={size.w} height={size.h} />
              </Suspense>
            </div>
          </>
        )}

        {/* Retour visuel du glisser-déposer — forme selon la géométrie du slot. */}
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-blue-50/40">
            <div
              className={`border-4 border-dashed border-blue-400/80 ${
                activeGeometry === "circle"
                  ? "aspect-square h-[88%] rounded-full"
                  : activeGeometry === "square"
                    ? "aspect-square h-[80%] rounded-lg"
                    : "h-[55%] w-[92%] rounded-lg"
              }`}
            />
            <span className="absolute rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
              Déposer l'image · {eye === "OD" ? "OD" : "OG"}
            </span>
          </div>
        )}
      </div>

      {/* En-tête du panneau : label + nom de fichier + plein cadre */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur transition ${
            dual && active
              ? "bg-blue-600 text-white"
              : "bg-white/90 text-slate-600"
          }`}
        >
          {label}
        </span>
        {fileName && (
          <span className="max-w-[160px] truncate rounded-full bg-white/90 px-2 py-1 text-[10px] text-slate-400 shadow-sm backdrop-blur">
            {fileName}
          </span>
        )}
      </div>

      {/* Bouton plein cadre / réduire */}
      <button
        onClick={() => {
          setLaterality(eye);
          setLayout(dual ? "mono" : "dual");
        }}
        className="absolute right-3 top-3 z-20 rounded-lg border border-slate-200 bg-white/90 p-1.5 text-slate-500 shadow-sm backdrop-blur transition hover:text-slate-900"
        title={dual ? "Plein cadre (mono)" : "Revenir à la vue double"}
      >
        {dual ? <ExpandIcon /> : <CollapseIcon />}
      </button>

      {/* Choix d'une lésion parmi plusieurs superposées (mode Sélection) */}
      <SelectionPicker eye={eye} />
      </div>

      {/* Épaisseur cornéenne (pachymétrie) — sous une coupe OCT antérieur (cornée). */}
      {activeKind === "cornea" && (
        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
          <label className="text-xs font-semibold text-slate-600">
            Épaisseur cornéenne
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={cornealThickness}
            onChange={(e) => {
              setLaterality(eye);
              setCornealThickness(e.target.value, eye);
            }}
            placeholder="—"
            className="w-24 rounded-md border border-slate-300 px-2 py-1 text-center text-sm outline-none focus:border-teal-500"
          />
          <span className="text-xs text-slate-500">µm</span>
        </div>
      )}

      {/* Template libre : rognage dynamique — sliders largeur/hauteur du cadre. */}
      {activeKind === "free" && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs font-semibold text-slate-600">Taille du cadre</span>
          <FrameSlider
            label="L"
            valueMm={activeFrame.w ?? TEMPLATE.retina.halfWidthMm * 0.9}
            onChange={(w) => {
              setLaterality(eye);
              setActiveSlotFrame(w, activeFrame.h ?? TEMPLATE.retina.halfWidthMm * 0.6, eye);
            }}
          />
          <FrameSlider
            label="H"
            valueMm={activeFrame.h ?? TEMPLATE.retina.halfWidthMm * 0.6}
            onChange={(h) => {
              setLaterality(eye);
              setActiveSlotFrame(activeFrame.w ?? TEMPLATE.retina.halfWidthMm * 0.9, h, eye);
            }}
          />
        </div>
      )}

      {/* Angle iridocornéen (template angle IC) : résultat mesuré + Shaffer modifiable. */}
      {activeKind === "angle" && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs font-semibold text-slate-600">Angle IC</span>
          {angleMeasure ? (
            <span className="text-xs text-slate-700">
              <b>{angleMeasure.angleDeg}°</b>
            </span>
          ) : (
            <span className="text-xs italic text-slate-400">
              non mesuré · plein cadre pour mesurer
            </span>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Shaffer
            <select
              value={shafferOverride ?? (angleMeasure ? shafferFromAngle(angleMeasure.angleDeg) : "")}
              onChange={(e) => {
                setLaterality(eye);
                setShafferOverride(e.target.value === "" ? null : Number(e.target.value), eye);
              }}
              className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs outline-none focus:border-teal-500"
            >
              <option value="">—</option>
              {([0, 1, 2, 3, 4] as const).map((g) => (
                <option key={g} value={g}>
                  {g} · {SHAFFER_LABEL[g]}
                </option>
              ))}
            </select>
          </label>
          {shafferOverride != null && (
            <button
              onClick={() => setShafferOverride(null, eye)}
              className="text-[11px] text-slate-400 underline hover:text-slate-600"
              title="Revenir à la valeur automatique"
            >
              auto
            </button>
          )}
        </div>
      )}

      {/* Galerie multi-images de cet œil (rétino / OCT-A / en-face / B-scan) */}
      <SlotGallery eye={eye} />
    </div>
  );
}

/** Slider d'une demi-dimension du cadre libre (mm), borné à [2, halfWidthMm]. */
function FrameSlider({
  label,
  valueMm,
  onChange,
}: {
  label: string;
  valueMm: number;
  onChange: (mm: number) => void;
}) {
  const MAX = TEMPLATE.retina.halfWidthMm;
  const MIN = 2;
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="font-bold text-slate-600">{label}</span>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={0.1}
        value={Math.min(MAX, Math.max(MIN, valueMm))}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 accent-teal-600"
      />
      <span className="w-10 text-right tabular-nums">{(valueMm * 2).toFixed(1)} mm</span>
    </label>
  );
}

const ExpandIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
);

const CollapseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
  </svg>
);
