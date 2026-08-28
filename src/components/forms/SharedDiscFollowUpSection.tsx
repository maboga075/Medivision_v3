/**
 * SharedDiscFollowUpSection — encadré commun aux deux yeux pour :
 *  1. les paramètres du disque optique (surface puis C/D vertical), regroupés
 *     dans un seul cadre afin que la touche Tab enchaîne
 *     Surface OD → C/D OD → Surface OG → C/D OG ;
 *  2. le suivi RNFL/GCL, mutualisé (un seul interrupteur + une seule date pour
 *     les deux yeux), les évolutions restant saisies par œil.
 *
 * Remplace les blocs auparavant dupliqués dans chaque colonne EyeExamSection.
 */

import { EVOLUTION_OPTIONS } from '../../utils/constants';
import { CUP_DISC_MAX_DECIMALS, cupDiscDecimals, decimalsToCupDisc } from '../../utils/cupDisc';
import type { EyeState } from '../../types/clinical';

interface SharedDiscFollowUpSectionProps {
  eyeOD: EyeState;
  eyeOG: EyeState;
  onUpdateOD: (eye: EyeState) => void;
  onUpdateOG: (eye: EyeState) => void;
  isOCT: boolean;
  showOpticNerve: boolean;
  /** Active/désactive le suivi sur les deux yeux simultanément. */
  onSetFollowUpEnabled: (enabled: boolean) => void;
  /** Date de suivi commune aux deux yeux. */
  onSetFollowUpDate: (date: string) => void;
}

const SIDES: ReadonlyArray<{ side: 'OD' | 'OG'; label: string }> = [
  { side: 'OD', label: 'Œil droit' },
  { side: 'OG', label: 'Œil gauche' },
];

export default function SharedDiscFollowUpSection({
  eyeOD,
  eyeOG,
  onUpdateOD,
  onUpdateOG,
  isOCT,
  showOpticNerve,
  onSetFollowUpEnabled,
  onSetFollowUpDate,
}: SharedDiscFollowUpSectionProps) {
  // Le cadre n'a de sens qu'en présence de paramètres du disque (OCT ou nerf optique).
  if (!isOCT && !showOpticNerve) return null;

  const eyeFor = (side: 'OD' | 'OG') => (side === 'OD' ? eyeOD : eyeOG);
  const updateFor = (side: 'OD' | 'OG') => (side === 'OD' ? onUpdateOD : onUpdateOG);
  const update = (side: 'OD' | 'OG', patch: Partial<EyeState>) =>
    updateFor(side)({ ...eyeFor(side), ...patch });

  const followUpActive = eyeOD.hasFollowUp || eyeOG.hasFollowUp;
  const followUpDate = eyeOD.followUpDate || eyeOG.followUpDate || '';

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
      {/* ── Disque optique ─────────────────────────────────────────────── */}
      <div className="p-4 text-xs font-black text-teal-600 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
        Disque optique — OD &amp; OG
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {SIDES.map(({ side, label }) => {
          const eye = eyeFor(side);
          const excludeDisc = eye.excludeDisc === true;
          return (
            <div key={side} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-700">{label}</span>
                <button
                  type="button"
                  onClick={() => update(side, { excludeDisc: !excludeDisc })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
                    excludeDisc
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {excludeDisc ? '✓ Disque exclu' : 'Ne pas interpréter'}
                </button>
              </div>

              {excludeDisc ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs font-semibold text-amber-700">
                  Disque exclu : C/D et surface n'apparaîtront pas dans le compte rendu.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Surface d'abord, puis C/D (ordre de saisie demandé) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      Surface disque (mm²)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
                      placeholder="Ex: 2.1"
                      value={eye.discSurface}
                      onChange={(e) => update(side, { discSurface: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      C/D vertical
                    </label>
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 select-none"
                      >
                        0,
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={CUP_DISC_MAX_DECIMALS}
                        className="w-full p-2.5 pl-9 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
                        placeholder="9"
                        value={cupDiscDecimals(eye.cupDisc)}
                        onChange={(e) => update(side, { cupDisc: decimalsToCupDisc(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Suivi RNFL/GCL commun (OCT uniquement) ─────────────────────── */}
      {isOCT && (
        <div className="px-5 pb-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-black text-slate-500 uppercase tracking-wider">
              Suivi RNFL/GCL (2 yeux)
            </label>
            <div className="flex gap-2">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => onSetFollowUpEnabled(v)}
                  className={`px-3 py-1 rounded-lg text-xs font-black border transition-all active:scale-95 ${
                    followUpActive === v
                      ? v
                        ? 'bg-teal-500 border-teal-500 text-white'
                        : 'bg-slate-200 border-slate-300 text-slate-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {v ? 'OUI' : 'NON'}
                </button>
              ))}
            </div>
          </div>

          {followUpActive && (
            <div className="space-y-3 animate-in slide-in-from-top-2">
              <input
                type="date"
                className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-teal-500 outline-none"
                value={followUpDate}
                onChange={(e) => onSetFollowUpDate(e.target.value)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {SIDES.map(({ side, label }) => {
                  const eye = eyeFor(side);
                  if (eye.excludeRnflGcl === true) {
                    return (
                      <div key={side} className="text-xs text-slate-400 italic self-center">
                        {label} : RNFL/GCL exclus
                      </div>
                    );
                  }
                  return (
                    <div key={side} className="space-y-2">
                      <div className="text-xs font-black text-slate-600">{label}</div>
                      <div className="grid grid-cols-2 gap-3">
                        {(['rnflEvolution', 'gclEvolution'] as const).map((field) => (
                          <div key={field}>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                              {field === 'rnflEvolution' ? 'Évol. RNFL' : 'Évol. GCL++'}
                            </label>
                            <select
                              className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500 bg-white"
                              value={eye[field]}
                              onChange={(e) => update(side, { [field]: e.target.value })}
                            >
                              {EVOLUTION_OPTIONS.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
