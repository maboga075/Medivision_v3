import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import BubblePicker from './BubblePicker';
import RnflGclPicker from './RnflGclPicker';
import RetinaEditor from '../../features/retinasketch/components/RetinaEditor';
import type { Annotation } from '../../features/retinasketch/lib/types';
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
] as const;

interface EyeExamSectionProps {
  side: 'OD' | 'OG';
  eye: EyeState;
  onUpdate: (eye: EyeState) => void;
  isOCT?: boolean;
  showOpticNerve?: boolean;
  showAnterior?: boolean;
  octaDone?: boolean;
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
}: EyeExamSectionProps) {
  const [showMesures, setShowMesures] = useState(false);
  const [customCause, setCustomCause] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showRetinaEditor, setShowRetinaEditor] = useState(false);

  const isImpossible = eye.acquisitionQuality === 'impossible';
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

          {/* RetinaSketch — annotation du schéma rétinien */}
          <button
            type="button"
            onClick={() => setShowRetinaEditor(true)}
            disabled={isImpossible}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/40 text-teal-700 font-bold text-sm hover:border-teal-400 hover:bg-teal-50 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Annoter la rétine
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

        {/* Paramètres biométriques / nerf optique — section dépliable */}
        {(isOCT || showOpticNerve) && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowMesures(!showMesures)}
              className="w-full flex items-center justify-between p-4 text-xs font-black text-teal-600 uppercase tracking-widest hover:bg-slate-50 transition-colors"
            >
              <span>{isOCT ? 'Paramètres biométriques (OCT)' : 'Paramètres nerf optique'}</span>
              <span className="text-slate-400 text-sm font-bold">{showMesures ? '▲' : '▼'}</span>
            </button>

            {showMesures && (
              <div className={`p-4 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 ${isImpossible ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                {/* RNFL & GCL+ par secteurs — OCT uniquement */}
                {isOCT && (
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
                    <input
                      type="number"
                      step="0.1"
                      className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
                      placeholder="Ex: 0.4"
                      value={eye.cupDisc}
                      onChange={(e) => update('cupDisc', e.target.value)}
                    />
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

                {/* Suivi RNFL/GCL — OCT uniquement */}
                {isOCT && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Suivi RNFL/GCL</label>
                      <div className="flex gap-2">
                        {([true, false] as const).map((v) => (
                          <button
                            key={String(v)}
                            onClick={() => update('hasFollowUp', v)}
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
            )}
          </div>
        )}

      </div>

      {/* Modale RetinaSketch */}
      {showRetinaEditor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="relative flex flex-col w-full max-w-5xl h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-teal-600" />
                Annotation de la rétine — {side === 'OD' ? 'Œil droit' : 'Œil gauche'}
              </h3>
              <button
                type="button"
                onClick={() => setShowRetinaEditor(false)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all active:scale-95"
              >
                <X className="w-4 h-4" /> Terminer
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <RetinaEditor
                side={side}
                value={eye.retinaAnnotations ?? []}
                onChange={(annotations: Annotation[]) => update('retinaAnnotations', annotations)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
