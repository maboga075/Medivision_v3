import { useRef, useState, lazy, Suspense } from "react";
import type Konva from "konva";
import { useStore } from "@/features/retinasketch/store/useStore";
import { generateReport } from "@/features/retinasketch/lib/report/generate";
import { exportDoubleEyePDF } from "@/features/retinasketch/lib/export/pdf";
import type { RetinaPrintInfo } from "@/features/retinasketch/lib/printInfo";
import BackgroundImage from "./BackgroundImage";

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

  const odStage = useRef<Konva.Stage>(null);
  const osStage = useRef<Konva.Stage>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!doubleView) return null;

  const onPdf = async () => {
    setBusy(true);
    setError("");
    try {
      await exportDoubleEyePDF({
        annotations,
        backgrounds,
        size: { width: PANEL_W, height: PANEL_H },
        stages: { OD: odStage.current, OS: osStage.current },
        info: printInfo,
      });
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
      <div className="no-print flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-2.5">
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

      {/* Zone imprimable : en-tête patient + OD | OG pleine largeur (paysage) */}
      <div className="print-area mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-4 p-6">
        {printInfo && <PrintHeader info={printInfo} />}

        <div className="flex flex-1 items-start justify-center gap-6">
          <EyePanel
            eye="OD"
            title="Œil droit (OD)"
            stageRef={odStage}
            showBg={backgrounds.OD.src != null}
            report={generateReport(annotations, "OD")}
          />
          <EyePanel
            eye="OS"
            title="Œil gauche (OG)"
            stageRef={osStage}
            showBg={backgrounds.OS.src != null}
            report={generateReport(annotations, "OS")}
          />
        </div>
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
  stageRef,
  showBg,
  report,
}: {
  eye: "OD" | "OS";
  title: string;
  stageRef: React.Ref<Konva.Stage>;
  showBg: boolean;
  report: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <h2 className="mb-2 text-sm font-semibold text-slate-800">{title}</h2>
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
      <pre className="mt-3 w-full max-w-[540px] whitespace-pre-line text-left text-xs leading-relaxed text-slate-700">
        {report}
      </pre>
    </div>
  );
}
