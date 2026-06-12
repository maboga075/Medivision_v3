/**
 * CDGauge — barre verticale C/D compacte, sans titre.
 *
 * Disposition (cf. maquette) :
 *   – valeur C/D vertical AU-DESSUS de la barre (arrondie au dixième)
 *   – barre verticale (curseur = valeur)
 *   – surface discale (cup area) EN DESSOUS de la barre
 * Les labels descriptifs ("C/D vertical", "Cup area") sont affichés
 * une seule fois au centre par VisualClinicalSection.
 *
 * Barre « intelligente » : les zones de couleur dépendent de la surface
 * discale. La limite haute de normalité du C/D vertical varie avec la taille
 * du disque (un grand disque tolère physiologiquement un C/D plus élevé).
 * Réf. bibliographiques : González de la Rosa 2025 (percentiles C/D vs surface
 * discale : ~0,5 petit disque / ~0,6 taille courante / ~0,7 grand disque),
 * Jonas 2000 et Quigley 1991 (nécessité de corriger le C/D de la taille du disque).
 */

interface Props {
  cupDisc?: string;
  cupDiscFlag?: 'alert' | 'critical';
  discSurface?: string;
}

/** Extrait le 1er nombre décimal d'une chaîne ("0,70 ⚠" → 0.7, "2.0 mm²" → 2). */
function parseNum(s?: string): number {
  if (!s) return NaN;
  const m = s.replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

/**
 * Limite haute de normalité du C/D vertical selon la surface discale (mm²).
 * Interpolation linéaire bornée 0,5 → 0,7.
 */
function normalCDLimit(discAreaMm2: number): number {
  if (!isFinite(discAreaMm2) || discAreaMm2 <= 0) return 0.6; // taille moyenne par défaut
  if (discAreaMm2 <= 1.5) return 0.5;                          // petit disque (microdisque)
  if (discAreaMm2 <= 2.0) return 0.5 + (discAreaMm2 - 1.5) * 0.2;  // 1,5→2,0 : 0,5→0,6
  if (discAreaMm2 <= 2.8) return 0.6 + (discAreaMm2 - 2.0) * 0.125; // 2,0→2,8 : 0,6→0,7
  return 0.7;                                                  // grand disque (macrodisque)
}

/** Gradient vertical vert→ambre→rouge dont les seuils suivent la limite de normalité. */
function gaugeGradient(limit: number): string {
  const greenEnd = Math.round(Math.max(0, limit - 0.1) * 100); // fin du vert franc
  const amber = Math.round(limit * 100);                        // zone limite
  const redStart = Math.round(Math.min(1, limit + 0.1) * 100);  // début du rouge franc
  return `linear-gradient(to top, #9ed8b9 0%, #9ed8b9 ${greenEnd}%, #eccf93 ${amber}%, #d98b7e ${redStart}%, #cf7d6f 100%)`;
}

export default function CDGauge({ cupDisc, cupDiscFlag, discSurface }: Props) {
  const value = parseNum(cupDisc);
  const hasValue = !isNaN(value);
  // 0 = bas (normal, vert), 1 = haut (critique, rouge)
  const pct = hasValue ? Math.max(0, Math.min(1, value)) * 100 : 0;

  const discArea = parseNum(discSurface);
  const gradient = gaugeGradient(normalCDLimit(discArea));

  const valueColor =
    cupDiscFlag === 'critical' ? 'var(--crimson)' :
    cupDiscFlag === 'alert'    ? 'var(--amber)'   :
    'var(--ink, #10262b)';

  if (!hasValue && !discSurface) return null;

  // Surface : on affiche la valeur numérique seule (l'unité « mm² » est dans le label centre)
  const surfNum = !isNaN(discArea) ? String(discArea) : discSurface;

  return (
    <div className="cd-bar-block">
      {hasValue && (
        <span className="cd-bar-val" style={{ color: valueColor }}>{value.toFixed(1)}</span>
      )}
      <div className="cd-bar-vert" style={{ background: gradient }}>
        {hasValue && <div className="cd-bar-cursor" style={{ bottom: `${pct}%` }} />}
      </div>
      {discSurface && (
        <span className="cd-bar-surf">{surfNum}</span>
      )}
    </div>
  );
}
