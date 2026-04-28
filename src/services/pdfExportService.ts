import html2pdf from 'html2pdf.js';
import type { OCTReportData } from '../types/report';

export interface PDFExportOptions {
  filename?: string;
}

export async function exportReportToPDF(
  reportElement: HTMLElement | null,
  reportData: OCTReportData,
  options: PDFExportOptions = {}
): Promise<void> {
  if (!reportElement) throw new Error('[pdfExportService] Élément rapport introuvable');

  const filename = options.filename ?? generatePDFFilename(reportData);

  // Clone pour ne pas toucher le DOM original
  const cloned = reportElement.cloneNode(true) as HTMLElement;

  // Supprimer les éléments non destinés à l'impression
  cloned.querySelectorAll('.no-print, button, [data-no-print]').forEach((el) => el.remove());

  const opt = {
    margin: [8, 8, 8, 8] as [number, number, number, number],
    filename,
    image: { type: 'jpeg' as const, quality: 0.97 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait' as const,
      compress: true,
    },
  };

  try {
    // .save() déclenche le téléchargement direct — aucune boîte de dialogue imprimer
    await html2pdf().set(opt).from(cloned).save();
  } catch (err) {
    console.error('[pdfExportService]', err);
    throw new Error('Erreur lors de la génération du PDF');
  }
}

export function generatePDFFilename(
  reportData: OCTReportData,
  template = 'CR_{{nom}}_{{date}}'
): string {
  const nom = (reportData.patient?.surname ?? 'Patient')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  const date = new Date().toISOString().split('T')[0];
  return (
    template
      .replace('{{nom}}', nom)
      .replace('{{date}}', date)
      .replace('{{medecin}}', reportData.signature?.doctorName ?? '')
      .replace('{{reportNumber}}', reportData.reportNumber ?? 'MV') + '.pdf'
  );
}
