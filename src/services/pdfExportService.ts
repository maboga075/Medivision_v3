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

  // On capture la page A4 elle-même (sans le wrapper).
  const page = (cloned.querySelector('.page') as HTMLElement) ?? cloned;

  // Neutraliser ce qui casse le rendu html2canvas et provoque coupure / 2e page :
  //  - `.page` a height:297mm + overflow:hidden → clippe le contenu (rapport « coupé »)
  //  - le décor `::before` et les ombres sont mal rendus par html2canvas
  // On laisse la hauteur s'adapter au contenu et on s'appuie sur pagebreak pour
  // ne jamais couper un bloc au milieu.
  const override = document.createElement('style');
  override.textContent = `
    .page { height: auto !important; min-height: auto !important; overflow: visible !important;
            box-shadow: none !important; margin: 0 !important; }
    .page::before { display: none !important; }
    [contenteditable="true"] { outline: none !important; background: transparent !important; }
  `;
  page.prepend(override);

  // Rétinographie → PDF paysage (schémas agrandis) ; OCT → portrait.
  const landscape = reportData.layout === 'landscape';

  const opt = {
    margin: 0,
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: landscape ? 1123 : 794, // 297 mm / 210 mm @ 96 dpi
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: (landscape ? 'landscape' : 'portrait') as 'portrait' | 'landscape',
      compress: true,
    },
    // Empêche de couper un bloc clinique au milieu si le contenu déborde sur une 2e page.
    pagebreak: {
      mode: ['css', 'legacy'] as string[],
      avoid: ['.section', '.clin-block', '.clin-sections', '.sign-block', '.visual-clinical', '.vc-col', '.vc-neuro-row', '.masthead', '.meta'],
    },
  };

  try {
    // .save() déclenche le téléchargement direct — aucune boîte de dialogue imprimer
    await html2pdf().set(opt).from(page).save();
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
