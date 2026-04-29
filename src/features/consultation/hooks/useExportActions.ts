import { useState, useRef, useEffect, useCallback } from 'react';
import { printReport } from '../../../services/printService';
import { exportReportToPDF } from '../../../services/pdfExportService';
import { sendViaWhatsApp, sendViaEmail } from '../../../services/communication';
import type { PatientFirestore } from '../../../types/patient';
import type { OCTReportData } from '../../../types/report';

interface Params {
  selectedPatient: PatientFirestore | null;
  octReportData: OCTReportData | null;
  reportRef: React.RefObject<HTMLDivElement | null>;
}

export function useExportActions({ selectedPatient, octReportData, reportRef }: Params) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportMenuOpen]);

  const buildFilename = useCallback((ext: string): string => {
    const sanitize = (s: string) => s.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const parts = [
      sanitize(selectedPatient?.folderId ?? ''),
      sanitize(selectedPatient?.nom ?? 'Patient'),
      selectedPatient?.dateExamen ?? new Date().toISOString().split('T')[0],
    ].filter(Boolean);
    return parts.join('_') + '.' + ext;
  }, [selectedPatient]);

  const handlePrint = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    printReport(reportRef.current, {
      title: buildFilename('pdf').replace(/\.pdf$/, ''),
      paperSize: 'A4',
      orientation: 'portrait',
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
    });
  }, [reportRef, buildFilename]);

  const handleExportPDF = useCallback(async () => {
    setExportMenuOpen(false);
    if (!octReportData) return;
    try {
      await exportReportToPDF(reportRef.current, octReportData, { filename: buildFilename('pdf') });
    } catch (err) {
      console.error('[handleExportPDF]', err);
    }
  }, [octReportData, reportRef, buildFilename]);

  const handleExportWord = useCallback(() => {
    setExportMenuOpen(false);
    if (!reportRef.current) return;
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((n) => n.outerHTML)
      .join('\n');
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'>${styles}</head><body>${reportRef.current.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-word;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFilename('doc');
    a.click();
    URL.revokeObjectURL(url);
  }, [reportRef, buildFilename]);

  const handleExportJSON = useCallback(() => {
    setExportMenuOpen(false);
    if (!octReportData) return;
    const blob = new Blob([JSON.stringify(octReportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFilename('json').replace(/\.json$/, '') + '_data.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [octReportData, buildFilename]);

  const handleWhatsApp = useCallback(() => {
    if (selectedPatient?.tel) sendViaWhatsApp(selectedPatient.tel, '#');
  }, [selectedPatient]);

  const handleEmail = useCallback(() => {
    if (selectedPatient?.email) sendViaEmail(selectedPatient.email, '#');
  }, [selectedPatient]);

  return {
    exportMenuOpen, setExportMenuOpen, exportMenuRef,
    handlePrint, handleExportPDF, handleExportWord, handleExportJSON,
    handleWhatsApp, handleEmail,
  };
}
