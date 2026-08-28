
import { useEffect } from "react";
import { useStore, countAllDrafts } from "@/features/retinasketch/store/useStore";
import FloatingControls from "./FloatingControls";
import DetectAnatomyButton from "./DetectAnatomyButton";
import InfoPanel from "./InfoPanel";
import DraftBar from "./DraftBar";
import CommandPalette from "./CommandPalette";

import type { RetinaPrintInfo } from "@/features/retinasketch/lib/printInfo";
import EyePane from "./EyePane";
import DrawToolControls from "./DrawToolControls";
import BackgroundControls from "./BackgroundControls";
import AlignOverlay from "./AlignOverlay";
import AdjustImageOverlay from "./AdjustImageOverlay";
import AnatomyOverlay from "./AnatomyOverlay";
import AngleOverlay from "./AngleOverlay";
import ZoomControl from "./ZoomControl";
import DoubleEyeView from "./DoubleEyeView";
import LearningPanel from "./LearningPanel";
import SamOverlay from "./SamOverlay";
import SelectionToolbar from "./SelectionToolbar";

interface WorkspaceProps {
  onClose?: () => void;
  /** Crée et enregistre une lésion personnalisée depuis la palette d'identification. */
  onCreateLesion?: (name: string, color?: string) => Promise<{ id: string } | null>;
  /** Infos patient/clinique pour l'en-tête d'impression et d'export. */
  printInfo?: RetinaPrintInfo;
}

export default function Workspace({ onClose, onCreateLesion, printInfo }: WorkspaceProps) {
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const paletteOpen = useStore((s) => s.paletteOpen);
  const setDoubleView = useStore((s) => s.setDoubleView);
  const layout = useStore((s) => s.layout);
  const setLayout = useStore((s) => s.setLayout);
  const laterality = useStore((s) => s.laterality);
  const selectMode = useStore((s) => s.selectMode);
  const setSelectMode = useStore((s) => s.setSelectMode);
  const selectedAnnotationId = useStore((s) => s.selectedAnnotationId);
  const selectAnnotation = useStore((s) => s.selectAnnotation);
  const deleteAnnotation = useStore((s) => s.deleteAnnotation);
  const overlapPick = useStore((s) => s.overlapPick);
  const setOverlapPick = useStore((s) => s.setOverlapPick);
  const draftCount = useStore(countAllDrafts);
  // Taille exacte de la zone de dessin plein cadre (publiée par EyePane) — pilote
  // les overlays de précision pour un alignement parfait avec RetinaStage.
  const paneSize = useStore((s) => s.paneSize);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // On ignore les raccourcis pendant une saisie — champs classiques ET zones
      // éditables (contentEditable) comme les titres/descriptions du menu Imprimer,
      // sinon Entrée y ouvre la palette au lieu d'ajouter une ligne.
      const t = e.target;
      const typing =
        t instanceof HTMLElement &&
        (["INPUT", "TEXTAREA"].includes(t.tagName) || t.isContentEditable);
      if (typing) return;
      // Suppr / Retour arrière → supprime la lésion sélectionnée (mode Sélection).
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAnnotationId) {
        e.preventDefault();
        deleteAnnotation(selectedAnnotationId);
        return;
      }
      // « / » ou Entrée → ouvre la palette : édite la lésion sélectionnée si une
      // sélection existe, sinon identifie les brouillons.
      if ((e.key === "/" || e.key === "Enter") && (selectedAnnotationId || draftCount > 0)) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        else if (overlapPick) setOverlapPick(null);
        else if (selectedAnnotationId) selectAnnotation(null);
        else if (selectMode) setSelectMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    setPaletteOpen,
    paletteOpen,
    draftCount,
    selectedAnnotationId,
    deleteAnnotation,
    selectAnnotation,
    overlapPick,
    setOverlapPick,
    selectMode,
    setSelectMode,
  ]);

  const mono = layout === "mono";

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      {/* Barre supérieure (les menus déroulants doivent passer au-dessus du canvas).
          `flex-wrap` : sur petit écran la barre s'enroule → « Terminer » reste
          toujours visible au lieu de déborder hors cadre. */}
      <header className="relative z-50 flex min-h-12 shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-slate-200 bg-white px-4 py-1.5">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-slate-900 text-[11px] font-bold text-white">
            R
          </div>
          <span className="hidden text-sm font-semibold tracking-tight sm:block">
            RetinaSketch
          </span>
        </div>

        <div className="mx-1 h-5 w-px shrink-0 bg-slate-200" />

        {/* Contrôles déplacés dans la barre : OD/OG + Couches + Détection anatomie
            (2 yeux) + Image de fond + Lésions */}
        <FloatingControls />
        <DetectAnatomyButton />
        <BackgroundControls />
        <InfoPanel />

        <div className="flex-1" />
        <span className="mr-1 hidden text-xs text-slate-400 xl:block">
          Clic = spot · clic glissé = surface ·{" "}
          <kbd className="rounded bg-slate-100 px-1">Espace</kbd> = diamètre · molette = zoom image ·{" "}
          <kbd className="rounded bg-slate-100 px-1">Maj</kbd>+glisser = déplacer l’image
        </span>

        {/* Outil de tracé (Lésion / Flèche) + opacité des annotations */}
        <DrawToolControls />

        {/* Bascule Dessiner / Sélectionner (sélection des couches superposées) */}
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          <button
            onClick={() => setSelectMode(false)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              !selectMode ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
            title="Dessiner des lésions (clic)"
          >
            Dessiner
          </button>
          <button
            onClick={() => setSelectMode(true)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              selectMode ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
            title="Sélectionner une lésion (clic) — choix si superposées"
          >
            Sélection
          </button>
        </div>

        {/* Bascule disposition : 2 yeux / 1 œil */}
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          <button
            onClick={() => setLayout("dual")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              !mono ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
            title="Afficher les deux yeux"
          >
            2 yeux
          </button>
          <button
            onClick={() => setLayout("mono")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              mono ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
            title="Afficher un seul œil"
          >
            1 œil
          </button>
        </div>

        <button
          onClick={() => setDoubleView(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:text-slate-900"
          title="Aperçu impression / export PDF"
        >
          <PrinterIcon />
          Imprimer
        </button>
        <LearningPanel />
        {onClose && (
          <button
            onClick={onClose}
            className="ml-1 flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700"
            title="Terminer et revenir à la consultation"
          >
            <CheckIcon />
            Terminer
          </button>
        )}
      </header>

      {/* Espace de travail */}
      <main className="relative min-h-0 flex-1 bg-white">
        {/* Panneaux : 2 yeux côte à côte, ou 1 œil plein cadre */}
        <div className="absolute inset-0 flex">
          {mono ? (
            <EyePane eye={laterality} active layout="mono" />
          ) : (
            <>
              <EyePane eye="OD" active={laterality === "OD"} layout="dual" />
              <div className="w-px shrink-0 bg-slate-200" />
              <EyePane eye="OS" active={laterality === "OS"} layout="dual" />
            </>
          )}
        </div>

        {/* Outils de précision : actifs sur l'œil affiché en vue mono uniquement.
            On utilise la taille EXACTE de la zone de dessin publiée par EyePane
            (`paneSize`) — et non la taille de `<main>` — pour que les overlays
            projettent comme RetinaStage (poignées alignées sur le rendu). */}
        {mono && paneSize.w > 0 && (
          <>
            <AlignOverlay width={paneSize.w} height={paneSize.h} />
            <AdjustImageOverlay width={paneSize.w} height={paneSize.h} />
            <AnatomyOverlay width={paneSize.w} height={paneSize.h} />
            <AngleOverlay width={paneSize.w} height={paneSize.h} />
            <SamOverlay width={paneSize.w} height={paneSize.h} />
          </>
        )}

        <ZoomControl />
        <DraftBar />
        <SelectionToolbar />
      </main>

      <CommandPalette onCreateLesion={onCreateLesion} />
      <DoubleEyeView printInfo={printInfo} />
    </div>
  );
}

const PrinterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </svg>
);

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
