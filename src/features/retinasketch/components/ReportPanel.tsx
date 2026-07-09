
import { useMemo, useState } from "react";
import { useStore } from "@/features/retinasketch/store/useStore";
import { generateReport } from "@/features/retinasketch/lib/report/generate";

export default function ReportPanel() {
  const annotations = useStore((s) => s.annotations);
  const laterality = useStore((s) => s.laterality);
  const [copied, setCopied] = useState(false);

  const report = useMemo(
    () => generateReport(annotations, laterality),
    [annotations, laterality],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papier indisponible */
    }
  };

  return (
    <div className="flex flex-col border-t border-slate-200">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Compte rendu</h2>
        <button
          onClick={copy}
          className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
        >
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <pre className="mx-3 mb-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-[13px] leading-relaxed text-slate-600">
        {report}
      </pre>
    </div>
  );
}
