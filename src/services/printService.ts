export interface PrintOptions {
  title?: string;
  paperSize?: 'A4' | 'A3' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export function printReport(
  target: HTMLElement | string | null,
  options: PrintOptions = {}
): void {
  const {
    title = 'Compte rendu OCT',
    paperSize = 'A4',
    orientation = 'portrait',
    margins = { top: 10, right: 10, bottom: 10, left: 10 },
  } = options;

  const element =
    typeof target === 'string'
      ? document.getElementById(target)
      : target;

  if (!element) {
    console.error('[printService] Élément introuvable :', target);
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:absolute;left:-9999px;width:210mm;height:297mm;border:none;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  // Construire les balises <link> et <style> du document parent pour les transférer dans l'iframe
  const styleNodes: string[] = [];
  Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach((node) => {
    styleNodes.push(node.outerHTML);
  });

  const marginCss = `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${styleNodes.join('\n  ')}
  <style>
    @page {
      size: ${paperSize} ${orientation};
      margin: ${marginCss};
    }
    html, body {
      background: #fff !important;
      margin: 0;
      padding: 0;
    }
    /* Le .page est conçu pour 210mm×297mm — on le laisse tel quel */
    .page {
      margin: 0 auto !important;
      box-shadow: none !important;
      height: auto !important;
      overflow: visible !important;
    }
    /* Forcer reproduction exacte des couleurs (pills, RNFL, GCL) */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    /* Éviter les coupures dans les sections clés */
    .section,
    .conclusion,
    .interpretation,
    .recommendations,
    .sign-block {
      page-break-inside: avoid;
    }
    /* Watermark / décoration de fond non nécessaire à l'impression */
    .page::before {
      display: none !important;
    }
  </style>
</head>
<body>
  ${element.innerHTML}
</body>
</html>`;

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  const cleanup = () => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  };

  iframe.onload = () => {
    // Laisser le navigateur finir le rendu (fonts, images)
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(cleanup, 1500);
    }, 300);
  };

  // Fallback si onload ne se déclenche pas (certains navigateurs)
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      iframe.contentWindow?.print();
      setTimeout(cleanup, 1500);
    }
  }, 800);
}
