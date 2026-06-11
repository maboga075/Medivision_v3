import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Eye,
  Trash2,
  Download,
  FileDown,
  RefreshCw,
  ChevronLeft,
  Search,
} from 'lucide-react';
import { useReports } from '../features/reports/hooks/useReports';
import OCTReport from '../components/reports/OCTReport';
import PatientReport from '../components/reports/PatientReport';
import ReportAudienceToggle, { type ReportAudience } from '../components/reports/ReportAudienceToggle';
import ValidationBadge from '../components/shared/ValidationBadge';
import { printReport } from '../services/printService';
import { exportReportToPDF } from '../services/pdfExportService';
import type { SavedReport } from '../types/savedReport';

export default function ComptesRendus() {
  const { reports, deleteReport } = useReports();
  const navigate = useNavigate();

  const [selected, setSelected] = useState<SavedReport | null>(null);
  const [reportAudience, setReportAudience] = useState<ReportAudience>('medecin');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  const filtered = reports.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.patientNom.toLowerCase().includes(q) ||
      (r.folderId?.toLowerCase().includes(q) ?? false) ||
      r.reportType.toLowerCase().includes(q)
    );
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const buildFilename = (r: SavedReport, ext: string) => {
    const sanitize = (s: string) => s.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const parts = [
      sanitize(r.folderId ?? ''),
      sanitize(r.patientNom),
      r.data.signature?.dateLabel?.replace(/\s+/g, '_') ?? r.createdAt.split('T')[0],
    ].filter(Boolean);
    return parts.join('_') + '.' + ext;
  };

  const handlePrint = () => {
    if (!selected) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    printReport(reportRef.current, {
      title: buildFilename(selected, 'pdf').replace(/\.pdf$/, ''),
      paperSize: 'A4',
      orientation: 'portrait',
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
    });
  };

  const handleExportPDF = async () => {
    if (!selected) return;
    setExportMenuOpen(false);
    try {
      await exportReportToPDF(reportRef.current, selected.data, {
        filename: buildFilename(selected, 'pdf'),
      });
    } catch (err) {
      console.error('[ComptesRendus] exportPDF:', err);
    }
  };

  const handleExportWord = () => {
    if (!selected || !reportRef.current) return;
    setExportMenuOpen(false);
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((n) => n.outerHTML)
      .join('\n');
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'>${styles}</head><body>${reportRef.current.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-word;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFilename(selected, 'doc');
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReload = (r: SavedReport) => {
    navigate('/consultation', { state: { reloadReport: r } });
  };

  const handleConfirmDelete = (id: string) => {
    deleteReport(id);
    setConfirmDeleteId(null);
    if (selected?.id === id) setSelected(null);
  };

  if (selected) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        {/* Barre d'actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 no-print sticky top-0 z-20">
          <button
            onClick={() => setSelected(null)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center gap-2 transition-all active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" /> Retour à la liste
          </button>

          <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
            <span className="font-black text-slate-800">{selected.patientNom}</span>
            {selected.folderId && (
              <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{selected.folderId}</span>
            )}
            <span className="text-slate-400">·</span>
            <span>{formatDate(selected.createdAt)}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleReload(selected)}
              className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-xl flex items-center gap-2 border border-teal-200 transition-all active:scale-95"
              title="Recharger dans la consultation pour modifier"
            >
              <RefreshCw className="w-4 h-4" /> Modifier
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center gap-2 transition-all active:scale-95"
            >
              <FileDown className="w-4 h-4" /> Imprimer PDF
            </button>

            <div className="relative">
              <button
                onClick={() => setExportMenuOpen((o) => !o)}
                className="px-4 py-2 bg-white border border-slate-200 hover:border-amber-300 text-slate-700 font-bold rounded-xl flex items-center gap-2 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" /> Export
              </button>
              {exportMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2">
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <FileDown className="w-4 h-4 text-red-500" /> PDF
                  </button>
                  <button
                    onClick={handleExportWord}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 border-t border-slate-100"
                  >
                    <FileDown className="w-4 h-4 text-blue-500" /> Word (.doc)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rapport */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 no-print flex items-center justify-between gap-4 flex-wrap">
            <ValidationBadge validation={null} />
            <ReportAudienceToggle value={reportAudience} onChange={setReportAudience} />
          </div>
          <div ref={reportRef}>
            {reportAudience === 'medecin' ? (
              <OCTReport data={selected.data} />
            ) : (
              <PatientReport data={selected.data} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* En-tête */}
      <div className="px-6 py-5 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
            <FileText className="w-6 h-6 text-teal-600" />
            Comptes rendus
          </h1>
          <span className="bg-teal-100 text-teal-800 text-sm font-bold px-3 py-1 rounded-full">
            {reports.length}
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, dossier, type d'examen…"
            className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-400 bg-slate-50 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
            <FileText className="w-16 h-16 text-slate-200" />
            <p className="text-lg font-bold">
              {reports.length === 0
                ? 'Aucun compte rendu enregistré.'
                : 'Aucun résultat pour cette recherche.'}
            </p>
            {reports.length === 0 && (
              <p className="text-sm text-slate-400">
                Les comptes rendus générés depuis la Consultation apparaîtront ici.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between gap-4 hover:border-teal-200 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-extrabold text-slate-800 text-lg truncate">
                      {r.patientNom}
                    </span>
                    {r.folderId && (
                      <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                        {r.folderId}
                      </span>
                    )}
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        r.status === 'final'
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {r.status === 'final' ? 'Final' : 'Brouillon'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                    <span>{r.reportType}</span>
                    <span className="text-slate-300">·</span>
                    <span>{formatDate(r.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelected(r)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50 text-slate-500 hover:text-teal-600 border border-slate-200 hover:border-teal-200 transition-colors"
                    title="Consulter"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleReload(r)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 transition-colors"
                    title="Modifier dans la consultation"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setSelected(r);
                      setTimeout(handlePrint, 100);
                    }}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-600 border border-slate-200 hover:border-amber-200 transition-colors"
                    title="Exporter PDF"
                  >
                    <FileDown className="w-4 h-4" />
                  </button>

                  {confirmDeleteId === r.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleConfirmDelete(r.id)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(r.id)}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-200 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
