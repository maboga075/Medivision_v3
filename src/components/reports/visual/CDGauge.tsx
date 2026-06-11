/**
 * CDGauge — rapport C/D sous forme de petite barre verticale compacte.
 * Placée à l'extrémité droite du bloc neuro (RNFL + GCL).
 * 0 = normal (bas, vert), 1 = critique (haut, rouge).
 */

interface Props {
  cupDisc?: string;
  cupDiscFlag?: 'alert' | 'critical';
  discSurface?: string;
}

export default function CDGauge({ cupDisc, cupDiscFlag, discSurface }: Props) {
  const value = cupDisc ? parseFloat(cupDisc.replace(',', '.')) : NaN;
  const hasValue = !isNaN(value);
  const pct = hasValue ? Math.max(0, Math.min(1, value)) * 100 : 0;

  const valueColor =
    cupDiscFlag === 'critical' ? 'var(--crimson)' :
    cupDiscFlag === 'alert'    ? 'var(--amber)'   :
    'var(--ink, #10262b)';

  if (!hasValue && !discSurface) return null;

  return (
    <div className="cd-bar-block">
      {hasValue && (
        <>
          <span className="cd-bar-title">C/D</span>
          <div className="cd-bar-vert">
            <div className="cd-bar-cursor" style={{ bottom: `${pct}%` }} />
          </div>
          <span className="cd-bar-val" style={{ color: valueColor }}>{value.toFixed(2)}</span>
        </>
      )}
      {discSurface && (
        <div className="cd-bar-surf">
          <span className="cd-bar-title">S.p.</span>
          <span className="cd-bar-val">{discSurface}</span>
        </div>
      )}
    </div>
  );
}
