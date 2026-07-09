import { useState } from 'react';
import { Pencil } from 'lucide-react';
import BubblePicker from './BubblePicker';
import RnflGclPicker from './RnflGclPicker';
import {
  BUBBLE_PICKER_SUGGESTIONS,
  EVOLUTION_OPTIONS,
} from '../../utils/constants';
import {
  createDefaultRnflSectors,
  createDefaultGclSectors,
  deriveRnflStatus,
  deriveGclStatus,
  type RnflSectors,
  type GclSectors,
} from '../../utils/rnflGcl';
import type { EyeState } from '../../types/clinical';

const PREDEFINED_CAUSES = [
  'Cataracte',
  'Nystagmus',
  'Opacité cornéenne',
  'Ptôse',
  'Miose',
  'Mydriase',
  'Mouvements du patient',
  'Pupille mal réactive',
  'Trouble vitréen',
  'Opacité des milieux transparents',
] as const;

// C/D vertical : toujours < 1, donc seul « 0, » est sous-entendu et l'on ne saisit
// que les décimales. La valeur reste stockée au format « 0.x » pour le reste du pipeline.
const CUP_DISC_MAX_DECIMALS = 2;

/** Décimales à afficher dans le champ (partie après « 0, »). */
function cupDiscDecimals(stored: string): string {
  if (!stored) return '';
  const dot = stored.replace(',', '.').indexOf('.');
  const digits = dot === -1 ? '' : stored.replace(',', '.').slice(dot + 1);
  return digits.replace(/\D/g, '').slice(0, CUP_DISC_MAX_DECIMALS);
}

/** Reconstruit la valeur stockée « 0.x » à partir des décimales saisies. */
function decimalsToCupDisc(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, CUP_DISC_MAX_DECIMALS);
  return digits ? `0.${digits}` : '';
}

interface EyeExamSectionProps {
  side: 'OD' | 'OG';
  eye: EyeState;
  onUpdate: (eye: EyeState) => void;
  isOCT?: boolean;
  showOpticNerve?: boolean;
  showAnterior?: boolean;
  octaDone?: boolean;
  /** Ouvre l'éditeur RetinaSketch double-œil (modale unique gérée par le parent). */
  onOpenRetina?: () => void;
  onNewSuggestion?: (category: 'macula' | 'papille' | 'peripherie', item: string) => void;
}

export default function EyeExamSection({
  side,
  eye,
  onUpdate,
  isOCT = true,
  showOpticNerve = false,
  showAnterior = false,
  octaDone = false,
  onOpenRetina,
}: EyeExamSectionProps) {
  const [customCause, setCustomCause] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const isImpossible = eye.acquisitionQuality === 'impossible';
  // Acquisition dégradée (faible ou impossible) → propose d'exclure RNFL/GCL.
  const isDegraded = eye.acquisitionQuality === 'faible' || eye.acquisitionQuality === 'impossible';
  const excludeRnflGcl = eye.excludeRnflGcl === true && isDegraded;
  const annotationCount = (eye.retinaAnnotations ?? []).filter((a) => a.status === 'validated').length;

  const update = <K extends keyof EyeState>(k: K, v: EyeState[K]) =>
    onUpdate({ ...eye, [k]: v });

  const handleAddObs = (
    field: 'observationsMacula' | 'observationsPapille' | 'observationsPeripherie' | 'obsAnterieur' | 'obsOCTA',
    item: string
  ) => {
    const current = (eye[field] as string[]) ?? [];
    if (!current.includes(item)) {
      const next: Partial<EyeState> = { [field]: [...current, item] };
      if (field === 'obsOCTA') next.octaPerformed = true;
      onUpdate({ ...eye, ...next });
    }
  };

  const handleRemoveObs = (
    field: 'observationsMacula' | 'observationsPapille' | 'observationsPeripherie' | 'obsAnterieur' | 'obsOCTA',
    item: string
  ) => {
    const next = ((eye[field] as string[]) ?? []).filter((x) => x !== item);
    const extra: Partial<EyeState> = field === 'obsOCTA' ? { octaPerformed: next.length > 0 } : {};
    onUpdate({ ...eye, [field]: next, ...extra });
  };

  const headerBg = side === 'OD' ? '#0C2233' : '#13344D';

  return (
    <div className="flex-1 min-w-[320px] bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* En-tête */}
      <div
        className="p-4 text-white font-extrabold text-sm tracking-widest flex items-center gap-2 justify-center"
        style={{ backgroundColor: headerBg }}
      >
        👁️ {side === 'OD' ? 'ŒIL DROIT' : 'ŒIL GAUCHE'}
      </div>

      <div className="p-5 sm:p-6 flex-1 space-y-6">
        {/* Qualité d'acquisition */}
        <div>
          <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">
            Qualité d'acquisition
          </div>
          <div className="flex flex-wrap gap-2">
            {(['bon', 'faible', 'impossible'] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => update('acquisitionQuality', q)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                  (eye.acquisitionQuality ?? 'bon') === q
                    ? q === 'bon'
                      ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-sm'
                      : q === 'faible'
                      ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm'
                      : 'bg-red-50 border-red-500 text-red-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'
                }`}
              >
                {q === 'bon' ? '✓ Bon' : q === 'faible' ? '⚠ Faible' : '✗ Impossible'}
              </button>
            ))}
          </div>

          {/* Box inline causes — visible dès que qualité est dégradée */}
          {eye.acquisitionQuality && eye.acquisitionQuality !== 'bon' && (
            <div className="mt-2 bg-orange-50 border border-orange-300 rounded-xl p-3 space-y-3 animate-in slide-in-from-top-2">
              <div className="text-xs font-black text-orange-600 uppercase tracking-wider">
                Cause(s) — qualité {eye.acquisitionQuality}
              </div>

              {/* Tags des causes sélectionnées */}
              {(eye.acquisitionQualityReasons ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(eye.acquisitionQualityReasons ?? []).map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500 text-white text-xs font-bold"
                    >
                      {r}
                      <button
                        type="button"
                        onClick={() =>
                          update(
                            'acquisitionQualityReasons',
                            (eye.acquisitionQualityReasons ?? []).filter((c) => c !== r)
                          )
                        }
                        className="opacity-70 hover:opacity-100 transition-opacity leading-none"
                        aria-label={`Supprimer ${r}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Ligne d'ajout : select prédéfini + bouton + custom */}
              <div className="flex gap-2 items-center">
                <select
                  className="flex-1 p-2 border border-orange-200 rounded-lg text-sm font-medium bg-white outline-none focus:border-orange-400"
                  value=""
                  onChange={(e) => {
                    const cause = e.target.value;
                    if (!cause) return;
                    const current = eye.acquisitionQualityReasons ?? [];
                    if (!current.includes(cause)) {
                      update('acquisitionQualityReasons', [...current, cause]);
                    }
                  }}
                >
                  <option value="">Sélectionner une cause…</option>
                  {PREDEFINED_CAUSES.filter(
                    (c) => !(eye.acquisitionQualityReasons ?? []).includes(c)
                  ).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCustomInput((v) => !v)}
                  title="Cause personnalisée"
                  className={`w-9 h-9 flex items-center justify-center rounded-full font-bold text-lg transition-all active:scale-95 flex-shrink-0 ${
                    showCustomInput
                      ? 'bg-orange-200 text-orange-700'
                      : 'bg-orange-500 hover:bg-orange-600 text-white'
                  }`}
                >
                  {showCustomInput ? '×' : '+'}
                </button>
              </div>

              {/* Input cause personnalisée */}
              {showCustomInput && (
                <div className="flex gap-2 animate-in slide-in-from-top-1">
                  <input
                    type="text"
                    value={customCause}
                    onChange={(e) => setCustomCause(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = customCause.trim();
                        if (v && !(eye.acquisitionQualityReasons ?? []).includes(v)) {
                          update('acquisitionQualityReasons', [...(eye.acquisitionQualityReasons ?? []), v]);
                        }
                        setCustomCause('');
                        setShowCustomInput(false);
                      }
                      if (e.key === 'Escape') { setShowCustomInput(false); setCustomCause(''); }
                    }}
                    placeholder="Cause personnalisée…"
                    autoFocus
                    className="flex-1 p-2 border border-orange-300 rounded-lg text-sm outline-none focus:border-orange-500"
                  />
                  <button
                    type="button"
                    disabled={!customCause.trim()}
                    onClick={() => {
                      const v = customCause.trim();
                      if (v && !(eye.acquisitionQualityReasons ?? []).includes(v)) {
                        update('acquisitionQualityReasons', [...(eye.acquisitionQualityReasons ?? []), v]);
                      }
                      setCustomCause('');
                      setShowCustomInput(false);
                    }}
                    className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold disabled:opacity-40 transition-colors"
                  >
                    OK
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bannière acquisition impossible */}
        {isImpossible && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 flex items-center gap-2">
            <span>✗</span>
            <span>Acquisition impossible — observations et mesures non disponibles.</span>
          </div>
        )}

        {/* Observations morphologiques */}
        <div className="space-y-5">
          <div className="text-xs font-black text-teal-600 uppercase tracking-widest border-b border-teal-100 pb-2">
            Observations morphologiques
          </div>

          {/* RetinaSketch — ouvre l'éditeur double-œil (OD + OG simultanés) */}
          <button
            type="button"
            onClick={() => onOpenRetina?.()}
            disabled={isImpossible}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/40 text-teal-700 font-bold text-sm hover:border-teal-400 hover:bg-teal-50 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Annoter la rétine (2 yeux)
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${annotationCount > 0 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {annotationCount > 0 ? `${annotationCount} lésion${annotationCount > 1 ? 's' : ''}` : 'aucune'}
            </span>
          </button>

          {/* Segment Antérieur — si activé au niveau consultation */}
          {showAnterior && (
            <div className="space-y-3 pt-2 border-t border-indigo-100">
              <div className="text-xs font-black text-indigo-600 uppercase tracking-wider pb-1">
                Cornée / Segment antérieur
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Épaisseur cornéenne (µm)
                </label>
                <input
                  type="number"
                  disabled={isImpossible}
                  className="w-full p-2.5 border-2 border-indigo-100 rounded-xl text-sm font-bold outline-none focus:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                  placeholder="Ex: 540"
                  value={eye.cornealThickness}
                  onChange={(e) => update('cornealThickness', e.target.value)}
                />
              </div>
              <BubblePicker
                title="Observations cornéennes"
                selectedItems={eye.obsAnterieur}
                suggestions={BUBBLE_PICKER_SUGGESTIONS.anterieur as unknown as string[]}
                onAdd={(item) => handleAddObs('obsAnterieur', item)}
                onRemove={(item) => handleRemoveObs('obsAnterieur', item)}
                disabled={isImpossible}
              />
            </div>
          )}

          {/* OCTA — si activé au niveau consultation */}
          {octaDone && isOCT && (
            <div className="space-y-2 pt-2 border-t border-purple-100">
              <div className="text-xs font-black text-purple-600 uppercase tracking-wider pb-1">
                OCTA
              </div>
              <BubblePicker
                title="Observations OCTA"
                selectedItems={eye.obsOCTA}
                suggestions={BUBBLE_PICKER_SUGGESTIONS.octa as unknown as string[]}
                onAdd={(item) => handleAddObs('obsOCTA', item)}
                onRemove={(item) => handleRemoveObs('obsOCTA', item)}
                disabled={isImpossible}
              />
            </div>
          )}

          {/* Divers — textarea libre */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="font-bold text-sm text-slate-700 flex items-center gap-2">
              <span className="text-slate-400">◈</span> Divers
            </label>
            <textarea
              value={eye.observationsDivers}
              onChange={(e) => update('observationsDivers', e.target.value)}
              disabled={isImpossible}
              placeholder="Observations libres (détails additionnels, anomalies non listées…)"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-teal-400 bg-slate-50 focus:bg-white transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              rows={3}
            />
          </div>
        </div>

        {/* Module RGB — Paramètres biométriques / nerf optique — toujours visible */}
        {(isOCT || showOpticNerve) && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="w-full flex items-center p-4 text-xs font-black text-teal-600 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
              <span>{isOCT ? 'Paramètres biométriques (OCT)' : 'Paramètres nerf optique'}</span>
            </div>

            <div className={`p-4 space-y-4 ${isImpossible ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                {/* Acquisition difficile : bouton pour exclure RNFL/GCL de l'interprétation.
                    Visible uniquement quand la qualité est Faible ou Impossible. */}
                {isOCT && isDegraded && (
                  <button
                    type="button"
                    onClick={() => update('excludeRnflGcl', !eye.excludeRnflGcl)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-[0.99] ${
                      excludeRnflGcl
                        ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                        : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    <span>
                      {excludeRnflGcl ? '✓ RNFL/GCL exclus de l’interprétation' : 'Ne pas interpréter RNFL/GCL'}
                    </span>
                    <span className="text-xs font-medium opacity-90">
                      acquisition {eye.acquisitionQuality}
                    </span>
                  </button>
                )}

                {/* Message affiché quand RNFL/GCL sont exclus */}
                {isOCT && excludeRnflGcl && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs font-semibold text-amber-700">
                    RNFL et GCL non interprétables en raison d'un indice d'acquisition faible.
                    Ces paramètres n'apparaîtront pas dans le compte rendu.
                  </div>
                )}

                {/* RNFL & GCL+ par secteurs — OCT uniquement, masqués si exclus */}
                {isOCT && !excludeRnflGcl && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      RNFL &amp; GCL+ <span className="text-slate-400 normal-case font-medium">— cliquer un secteur</span>
                    </label>
                    <RnflGclPicker
                      side={side}
                      rnfl={eye.rnflSectors ?? createDefaultRnflSectors()}
                      gcl={eye.gclSectors ?? createDefaultGclSectors()}
                      disabled={isImpossible}
                      onChange={({ rnflSectors, gclSectors }: { rnflSectors: RnflSectors; gclSectors: GclSectors }) =>
                        onUpdate({
                          ...eye,
                          rnflSectors,
                          gclSectors,
                          rnfl: deriveRnflStatus(rnflSectors),
                          gcl: deriveGclStatus(gclSectors),
                        })
                      }
                    />
                  </div>
                )}

                {/* C/D + Surface discale — toujours visible */}
                <div className="grid grid-cols-2 gap-4">
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
                        onChange={(e) => update('cupDisc', decimalsToCupDisc(e.target.value))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      Surface (mm²)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
                      placeholder="Ex: 2.1"
                      value={eye.discSurface}
                      onChange={(e) => update('discSurface', e.target.value)}
                    />
                  </div>
                </div>

                {/* Suivi RNFL/GCL — OCT uniquement, masqué si RNFL/GCL exclus */}
                {isOCT && !excludeRnflGcl && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Suivi RNFL/GCL</label>
                      <div className="flex gap-2">
                        {([true, false] as const).map((v) => (
                          <button
                            key={String(v)}
                            onClick={() =>
                              v
                                ? onUpdate({
                                    ...eye,
                                    hasFollowUp: true,
                                    // Défaut « Stable » pour que l'affichage corresponde au select
                                    rnflEvolution: eye.rnflEvolution || 'Stable',
                                    gclEvolution: eye.gclEvolution || 'Stable',
                                  })
                                : update('hasFollowUp', false)
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-black border transition-all active:scale-95 ${
                              eye.hasFollowUp === v
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
                    {eye.hasFollowUp && (
                      <div className="space-y-3 animate-in slide-in-from-top-2">
                        <input
                          type="date"
                          className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-teal-500 outline-none"
                          value={eye.followUpDate}
                          onChange={(e) => update('followUpDate', e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          {(['rnflEvolution', 'gclEvolution'] as const).map((field) => (
                            <div key={field}>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {field === 'rnflEvolution' ? 'Évol. RNFL' : 'Évol. GCL++'}
                              </label>
                              <select
                                className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500 bg-white"
                                value={eye[field]}
                                onChange={(e) => update(field, e.target.value)}
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
                    )}
                  </div>
                )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
