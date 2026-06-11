/**
 * CDGauge — rapport cup/disc vertical (jauge) et surface papillaire,
 * pour le bloc neuro-rétinien du compte rendu.
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
    cupDiscFlag === 'critical' ? 'var(--crimson)' : cupDiscFlag === 'alert' ? 'var(--amber)' : 'var(--ink, #10262b)';

  return (
    <div className="cd-block">
      {hasValue && (
        <div className="cd">
          <div className="cd-top">
            <span>C/D vertical</span>
            <b style={{ color: valueColor }}>{value.toFixed(2)}</b>
          </div>
          <div className="gauge">
            <i style={{ left: `${pct}%` }} />
          </div>
          <div className="gauge-scale">
            <span>0</span><span>0.5</span><span>0.65</span><span>1.0</span>
          </div>
        </div>
      )}
      {discSurface && (
        <div className="disc-surface">
          <span>Surface papillaire</span>
          <b>{discSurface} mm²</b>
        </div>
      )}
    </div>
  );
}
