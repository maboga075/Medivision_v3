import { useEffect, useRef, useState, lazy, Suspense } from "react";
import type Konva from "konva";
import { useStore } from "@/features/retinasketch/store/useStore";
import { generateReport } from "@/features/retinasketch/lib/report/generate";
import type { RetinaPrintInfo } from "@/features/retinasketch/lib/printInfo";
import type { Laterality } from "@/features/retinasketch/lib/types";
import BackgroundImage from "./BackgroundImage";
import ImagerySlotSvg from "@/components/reports/visual/ImagerySlotSvg";
import { getLesion } from "@/features/retinasketch/lib/ontology/lesions";

const RetinaStage = lazy(() => import("./RetinaStage"));

// Format paysage : panneaux larges pour occuper toute la largeur de la page A4.
const PANEL_W = 560;
const PANEL_H = 460;

// Styles d'impression : page A4 paysage, et seul l'aperçu RetinaSketch est imprimé.
const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  body * { visibility: hidden !important; }
  .retina-print-root, .retina-print-root * { visibility: visible !important; }
  .retina-print-root { position: fixed; inset: 0; overflow: visible; }
  .retina-print-root .no-print { display: none !important; }
}
`;

export default function DoubleEyeView({ printInfo }: { printInfo?: RetinaPrintInfo }) {
  const doubleView = useStore((s) => s.doubleView);
  const setDoubleView = useStore((s) => s.setDoubleView);
  const annotations = useStore((s) => s.annotations);
  const backgrounds = useStore((s) => s.backgrounds);

  const slotsMap = useStore((s) => s.slots);
  const selectSlot = useStore((s) => s.selectSlot);
  const activeSlot = useStore((s) => s.activeSlot);
  const slotStash = useStore((s) => s.slotStash);
  // Au moins une coupe complémentaire sélectionnée et pourvue d'une image ?
  const hasImagery = (["OD", "OS"] as Laterality[]).some((eye) =>
    slotsMap[eye].some((m) => {
      if (m.kind === "retino" || !m.printSelected) return false;
      const bg = m.id === activeSlot[eye] ? backgrounds[eye] : slotStash[m.id]?.background;
      return !!bg?.src;
    }),
  );

  // Réglages d'affichage du menu Imprimer (couches, anatomie, opacités).
  const layers = useStore((s) => s.layers);
  const setLayers = useStore((s) => s.setLayers);
  const anatomyVisible = useStore((s) => s.anatomyVisible);
  const setAnatomyVisible = useStore((s) => s.setAnatomyVisible);
  const annotationOpacity = useStore((s) => s.annotationOpacity);
  const setAnnotationOpacity = useStore((s) => s.setAnnotationOpacity);
  const overlayOpacity = useStore((s) => s.overlayOpacity);
  const setOverlayOpacity = useStore((s) => s.setOverlayOpacity);
  const savedLayers = useRef<Record<string, boolean> | null>(null);
  const anyLayerOn = Object.values(layers).some(Boolean);
  const toggleLayers = () => {
    if (anyLayerOn) {
      savedLayers.current = { ...layers };
      const allOff = Object.fromEntries(Object.keys(layers).map((k) => [k, false]));
      setLayers(allOff as typeof layers);
    } else {
      const restore = savedLayers.current ?? { ...layers, anatomy: true, nomenclature: true };
      setLayers(restore as typeof layers);
    }
  };

  const odStage = useRef<Konva.Stage>(null);
  const osStage = useRef<Konva.Stage>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Surcharges d'édition du menu Imprimer (items 6+7) : titres d'œil, descriptions
  // et libellés de coupe modifiables avant impression/export. Réinitialisées à
  // chaque ouverture de l'aperçu (la valeur par défaut reste le texte auto-généré).
  const DEFAULT_TITLES: Record<Laterality, string> = { OD: "Œil droit (OD)", OS: "Œil gauche (OG)" };
  const [titleOverrides, setTitleOverrides] = useState<Partial<Record<Laterality, string>>>({});
  const [reportOverrides, setReportOverrides] = useState<Partial<Record<Laterality, string>>>({});
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>({});
  useEffect(() => {
    if (doubleView) {
      setTitleOverrides({});
      setReportOverrides({});
      setLabelOverrides({});
    }
  }, [doubleView]);

  const effTitle = (eye: Laterality) => titleOverrides[eye] ?? DEFAULT_TITLES[eye];
  const effReport = (eye: Laterality) => reportOverrides[eye] ?? generateReport(annotations, eye);

  // À l'ouverture de l'aperçu impression : la rétinographie est prioritaire →
  // on rend le slot rétino actif de chaque œil (sinon l'aperçu affiche le slot
  // actif courant, potentiellement un B-scan/OCT-A « au hasard »).
  useEffect(() => {
    if (!doubleView) return;
    (["OD", "OS"] as const).forEach((eye) => {
      const retino = slotsMap[eye].find((s) => s.kind === "retino");
      if (retino) selectSlot(retino.id, eye);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doubleView]);

  if (!doubleView) return null;

  /**
   * Export PDF **WYSIWYG** : on capture l'aperçu réel (`.print-area`) → titres en
   * gras, coupes complémentaires sélectionnées ET légende sont inclus, identiques
   * à l'écran. (L'ancien export jsPDF ne rendait que la rétinographie.)
   */
  const onPdf = async () => {
    const el = printAreaRef.current;
    if (!el) return;
    setBusy(true);
    setError("");
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const name = (printInfo?.patientName ?? "compte-rendu").replace(/\s+/g, "_");
      // Objet passé par variable (et non littéral) pour éviter le contrôle strict
      // des propriétés excédentaires du typage html2pdf (pagebreak non déclaré).
      const opt = {
        margin: 6,
        filename: `retinasketch_${name}.pdf`,
        image: { type: "jpeg" as const, quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          // Capture sans décalage de scroll (évite le rognage du bord gauche) et à
          // la largeur exacte de l'élément (mappage 1:1 vers la page A4 paysage).
          scrollX: 0,
          scrollY: 0,
          windowWidth: 1123,
          width: el.scrollWidth,
          // Ignore les éléments non imprimables (sélecteurs de coupes, indices d'édition).
          ignoreElements: (node: Element) => node.classList?.contains("no-print"),
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" as const },
        // Respecte les break-before/inside CSS ; ne coupe jamais figure/légende/colonne.
        pagebreak: { mode: ["css", "legacy"], avoid: ["figure", "[data-legend]", "[data-eye-col]"] },
      };
      await html2pdf().set(opt).from(el).save();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'export PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="retina-print-root fixed inset-0 z-[60] flex flex-col overflow-auto bg-white">
      <style>{PRINT_CSS}</style>

      {/* Barre d'outils (masquée à l'impression) */}
      <div className="no-print shrink-0 border-b border-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight">
            Aperçu impression — rétinographie des deux yeux
          </span>
          {error && <span className="text-xs font-medium text-red-600">⚠ {error}</span>}
          <div className="flex-1" />
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Imprimer
          </button>
          <button
            onClick={onPdf}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? "Export…" : "Exporter PDF"}
          </button>
          <button
            onClick={() => setDoubleView(false)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            Fermer
          </button>
        </div>

        {/* Réglages d'affichage (appliqués à l'aperçu, à l'impression et à l'export). */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
          <button
            onClick={toggleLayers}
            className={`rounded-md border px-2.5 py-1 font-medium transition ${
              anyLayerOn ? "border-slate-300 bg-white text-slate-700" : "border-slate-300 bg-slate-100 text-slate-400"
            }`}
            title="Afficher/masquer les repères (couches anatomiques, nomenclature…)"
          >
            {anyLayerOn ? "Repères : affichés" : "Repères : masqués"}
          </button>
          <button
            onClick={() => setAnatomyVisible(!anatomyVisible)}
            className={`rounded-md border px-2.5 py-1 font-medium transition ${
              anatomyVisible ? "border-slate-300 bg-white text-slate-700" : "border-slate-300 bg-slate-100 text-slate-400"
            }`}
            title="Afficher/masquer la papille et la macula détectées"
          >
            {anatomyVisible ? "Papille/macula : affichées" : "Papille/macula : masquées"}
          </button>
          <label className="flex items-center gap-1.5">
            Opacité annotations
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={annotationOpacity}
              onChange={(e) => setAnnotationOpacity(Number(e.target.value))}
              className="w-28 accent-teal-600"
            />
            <span className="w-8 tabular-nums text-right">{Math.round(annotationOpacity * 100)}%</span>
          </label>
          <label className="flex items-center gap-1.5">
            Opacité repères
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className="w-28 accent-teal-600"
            />
            <span className="w-8 tabular-nums text-right">{Math.round(overlayOpacity * 100)}%</span>
          </label>
        </div>
      </div>

      {/* Zone imprimable : en-tête patient + OD | OG pleine largeur (paysage).
          Largeur fixe A4 paysage (≈1123px @96dpi) → mappage 1:1 propre au PDF. */}
      <div ref={printAreaRef} className="print-area mx-auto flex w-full max-w-[1123px] flex-col gap-4 p-6">
        {printInfo && <PrintHeader info={printInfo} />}

        {/* Légende en haut → toujours sur la 1ʳᵉ page et jamais coupée. */}
        <LesionLegend annotations={annotations} />

        {/* Rétinographies des 2 yeux (tiennent sur la page 1) */}
        <div className="flex items-start justify-center gap-6">
          <div data-eye-col className="flex flex-1 flex-col gap-3" style={{ breakInside: "avoid" }}>
            <EyePanel
              key={`od-${doubleView}`}
              eye="OD"
              title={effTitle("OD")}
              onTitleChange={(v) => setTitleOverrides((p) => ({ ...p, OD: v }))}
              stageRef={odStage}
              showBg={backgrounds.OD.src != null}
              report={effReport("OD")}
              onReportChange={(v) => setReportOverrides((p) => ({ ...p, OD: v }))}
            />
          </div>
          <div data-eye-col className="flex flex-1 flex-col gap-3" style={{ breakInside: "avoid" }}>
            <EyePanel
              key={`os-${doubleView}`}
              eye="OS"
              title={effTitle("OS")}
              onTitleChange={(v) => setTitleOverrides((p) => ({ ...p, OS: v }))}
              stageRef={osStage}
              showBg={backgrounds.OS.src != null}
              report={effReport("OS")}
              onReportChange={(v) => setReportOverrides((p) => ({ ...p, OS: v }))}
            />
          </div>
        </div>

        {/* Imagerie complémentaire (B-scan, OCT-A…) → nouvelle page, jamais coupée */}
        {hasImagery && (
          <div style={{ breakBefore: "page" }} className="pt-2">
            <div className="mb-2 border-b border-slate-200 pb-1 text-sm font-bold text-slate-800">
              Imagerie complémentaire
            </div>
            <div className="flex flex-wrap items-start gap-6">
              <div className="min-w-[45%] flex-1">
                <EyeImagery eye="OD" labelOverrides={labelOverrides} onLabelChange={(id, v) => setLabelOverrides((p) => ({ ...p, [id]: v }))} />
              </div>
              <div className="min-w-[45%] flex-1">
                <EyeImagery eye="OS" labelOverrides={labelOverrides} onLabelChange={(id, v) => setLabelOverrides((p) => ({ ...p, [id]: v }))} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Légende du code couleurs : liste des lésions effectivement annotées (validées,
 * hors flèches), avec pastille de couleur. Rien affiché si aucune lésion.
 */
function LesionLegend({ annotations }: { annotations: import("@/features/retinasketch/lib/types").Annotation[] }) {
  // Agrège TOUTES les lésions : slots actifs (`annotations`) + slots rangés
  // (stash) des deux yeux → la légende couvre aussi B-scan / OCT-A / etc.
  const slotStash = useStore((s) => s.slotStash);
  const all = [
    ...annotations,
    ...Object.values(slotStash).flatMap((d) => d.annotations),
  ];
  // Lésions distinctes présentes (couleur + nom), dans l'ordre d'apparition.
  const seen = new Map<string, { name: string; color: string }>();
  for (const a of all) {
    if (a.status !== "validated" || !a.lesionId || a.kind === "arrow") continue;
    if (seen.has(a.lesionId)) continue;
    const lesion = getLesion(a.lesionId);
    if (lesion) seen.set(a.lesionId, { name: lesion.name, color: lesion.color });
  }
  const items = [...seen.values()];
  if (items.length === 0) return null;

  return (
    <div data-legend className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5" style={{ breakInside: "avoid" }}>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Légende des annotations
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {items.map((it) => (
          <div key={it.name} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: it.color }}
            />
            <span className="text-xs font-medium text-slate-700">{it.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintHeader({ info }: { info: RetinaPrintInfo }) {
  return (
    <div className="flex items-end justify-between border-b-2 border-slate-800 pb-2">
      <div>
        <div className="text-lg font-bold tracking-tight text-slate-900">
          {info.patientName || "Patient"}
          {info.patientAge ? <span className="ml-2 text-sm font-medium text-slate-500">{info.patientAge} ans</span> : null}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
          {info.folderId && <span>Dossier : {info.folderId}</span>}
          {info.motifs && <span>Motif : {info.motifs}</span>}
        </div>
      </div>
      <div className="text-right text-xs text-slate-500">
        {info.clinic && <div className="font-semibold text-slate-700">{info.clinic}</div>}
        {info.doctor && <div>{info.doctor}</div>}
        {info.date && <div>{info.date}</div>}
      </div>
    </div>
  );
}

function EyePanel({
  eye,
  title,
  onTitleChange,
  stageRef,
  showBg,
  report,
  onReportChange,
}: {
  eye: "OD" | "OS";
  title: string;
  onTitleChange: (v: string) => void;
  stageRef: React.Ref<Konva.Stage>;
  showBg: boolean;
  report: string;
  onReportChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <EditableText
        initial={title}
        onCommit={onTitleChange}
        bold
        className="mb-2 text-[15px] font-extrabold text-slate-900"
      />
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white"
        style={{ maxWidth: PANEL_W, aspectRatio: `${PANEL_W} / ${PANEL_H}` }}
      >
        {showBg && (
          <BackgroundImage eye={eye} width={PANEL_W} height={PANEL_H} applyView={false} />
        )}
        <div className="relative z-10 h-full w-full">
          <Suspense fallback={null}>
            <RetinaStage
              width={PANEL_W}
              height={PANEL_H}
              eye={eye}
              readOnly
              stageRef={stageRef}
            />
          </Suspense>
        </div>
      </div>
      <EditableText
        initial={report}
        onCommit={onReportChange}
        multiline
        className="mt-3 w-full max-w-[540px] whitespace-pre-line text-left text-xs leading-relaxed text-slate-700"
      />
    </div>
  );
}

/**
 * Texte éditable pour le menu Imprimer (items 6+7). contentEditable non contrôlé :
 * le contenu initial est posé au montage, l'édition est remontée `onBlur`. À
 * l'écran, un léger soulignement pointillé (retiré à l'impression via `.print:…`)
 * indique que le texte est modifiable.
 */
function EditableText({
  initial,
  onCommit,
  className = "",
  multiline = false,
  bold = false,
}: {
  initial: string;
  onCommit: (v: string) => void;
  className?: string;
  multiline?: boolean;
  /** Force le gras via style inline (robuste à tout contexte CSS d'impression). */
  bold?: boolean;
}) {
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      title="Cliquer pour modifier"
      onBlur={(e) => onCommit(e.currentTarget.innerText.replace(/\n$/, ""))}
      style={bold ? { fontWeight: 800 } : undefined}
      className={`outline-none focus:bg-amber-50/40 print:bg-transparent rounded-sm decoration-dotted decoration-slate-300 underline-offset-4 hover:underline ${multiline ? "min-h-[1.5em]" : ""} ${className}`}
    >
      {initial}
    </div>
  );
}

/**
 * Imagerie complémentaire d'un œil dans l'aperçu impression : bande de
 * sélection (miniatures cliquables — masquée à l'impression) + rendu des scans
 * SÉLECTIONNÉS (B-scan/OCT-A/en-face). La sélection (`printSelected`) pilote à
 * la fois l'impression et le compte rendu.
 */
function EyeImagery({
  eye,
  labelOverrides,
  onLabelChange,
}: {
  eye: Laterality;
  labelOverrides: Record<string, string>;
  onLabelChange: (slotId: string, value: string) => void;
}) {
  const slots = useStore((s) => s.slots[eye]);
  const activeId = useStore((s) => s.activeSlot[eye]);
  const activeBg = useStore((s) => s.backgrounds[eye]);
  const activeAnns = useStore((s) => s.annotations);
  const stash = useStore((s) => s.slotStash);
  const toggleSlotPrint = useStore((s) => s.toggleSlotPrint);

  const side = eye === "OD" ? "OD" : "OG";
  const items = slots
    .filter((m) => m.kind !== "retino")
    .map((m) => {
      const active = m.id === activeId;
      const bg = active ? activeBg : stash[m.id]?.background;
      const anns = active ? activeAnns.filter((a) => a.laterality === eye) : stash[m.id]?.annotations ?? [];
      return { meta: m, bg, anns };
    })
    .filter((x) => x.bg?.src);

  if (items.length === 0) return null;
  const selected = items.filter((x) => x.meta.printSelected);

  return (
    <div className="w-full max-w-[560px]">
      {/* Sélecteur de coupes (non imprimé) */}
      <div className="no-print mb-2 flex flex-wrap gap-2">
        {items.map(({ meta, bg }) => (
          <button
            key={meta.id}
            type="button"
            onClick={() => toggleSlotPrint(meta.id, eye)}
            title={meta.printSelected ? `Retirer ${meta.label}` : `Ajouter ${meta.label}`}
            className={`flex items-center gap-1.5 rounded-lg border-2 p-1 pr-2 text-[11px] font-semibold transition ${
              meta.printSelected
                ? "border-teal-500 bg-teal-50 text-teal-800"
                : "border-slate-200 bg-white text-slate-400 opacity-70"
            }`}
          >
            <img
              src={bg!.src!}
              alt={meta.label}
              className={`h-8 w-8 rounded object-cover ${meta.printSelected ? "" : "grayscale"}`}
            />
            {meta.label}
          </button>
        ))}
      </div>

      {/* Scans sélectionnés (imprimés) */}
      {selected.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {selected.map(({ meta, bg, anns }) => (
            <figure key={meta.id} className="m-0" style={{ breakInside: "avoid" }}>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <ImagerySlotSvg
                  side={side}
                  geometry={meta.geometry}
                  background={bg}
                  annotations={anns}
                  frameHalfExtents={
                    meta.geometry === "free" && meta.frameHalfWMm != null && meta.frameHalfHMm != null
                      ? { halfW: meta.frameHalfWMm, halfH: meta.frameHalfHMm }
                      : null
                  }
                />
              </div>
              <EditableText
                key={`${meta.id}-${labelOverrides[meta.id] === undefined}`}
                initial={labelOverrides[meta.id] ?? `${meta.label} ${eye === "OD" ? "OD" : "OG"}`}
                onCommit={(v) => onLabelChange(meta.id, v)}
                bold
                className="mt-1 text-[11px] font-bold text-slate-700"
              />
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
