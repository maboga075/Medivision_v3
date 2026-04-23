export default function PrintStyles() {
  return (
    <style>{`
      @media print {
        body, html {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        nav, .no-print, button, .print\\:hidden { display: none !important; }

        @page { size: A4 portrait; margin: 0; }

        .report-page {
          box-shadow: none !important;
          border: none !important;
          width: 210mm !important;
          height: 296mm !important;
          margin: 0 auto !important;
          padding: 10mm 12mm !important;
          box-sizing: border-box !important;
          page-break-after: always;
          overflow: hidden;
        }

        .report-page:last-child { page-break-after: auto; }

        .report-page table,
        .report-page .conclusion-block,
        .report-page .interpretation-block,
        .report-page .recommandations-block {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        [contenteditable]:hover,
        [contenteditable]:focus {
          background: transparent !important;
          border-color: transparent !important;
        }

        .bg-\\[\\#0C2233\\] { background-color: #0C2233 !important; }
        th { background-color: #0C2233 !important; color: white !important; }
      }
    `}</style>
  );
}
