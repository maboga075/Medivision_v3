import { useState } from 'react';
import BubblePicker from './BubblePicker';
import {
  BUBBLE_PICKER_SUGGESTIONS,
  RNFL_STATUSES,
  RNFL_LOCATIONS,
  EVOLUTION_OPTIONS,
} from '../../utils/constants';
import { needsLocalisation } from '../../utils/clinicalData';
import { useSuggestions } from '../../hooks/useSuggestions';
import type { EyeState, RNFLGCLStatus } from '../../types/clinical';

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
  showAnterior?: boolean;
  octaDone?: boolean;
  onNewSuggestion?: (category: 'macula' | 'papille' | 'peripherie', item: string) => void;
}

export default function EyeExamSection({
  side,
  eye,
  onUpdate,
  isOCT = true,
  showAnterior = false,
  octaDone = false,
  onNewSuggestion,
}: EyeExamSectionProps) {
  const suggestions = useSuggestions();
  const [showMesures, setShowMesures] = useState(false);
  const [customCause, setCustomCause] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const isImpossible = eye.acquisitionQuality === 'impossible';

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

          <BubblePicker
            title="Macula"
            selectedItems={eye.observationsMacula}
            suggestions={suggestions.macula}
            onAdd={(item) => {
              handleAddObs('observationsMacula', item);
              if (!suggestions.macula.includes(item)) onNewSuggestion?.('macula', item);
            }}
            onRemove={(item) => handleRemoveObs('observationsMacula', item)}
            disabled={isImpossible}
          />

          <BubblePicker
            title="Papille"
            selectedItems={eye.observationsPapille}
            suggestions={suggestions.papille}
            onAdd={(item) => {
              handleAddObs('observationsPapille', item);
              if (!suggestions.papille.includes(item)) onNewSuggestion?.('papille', item);
            }}
            onRemove={(item) => handleRemoveObs('observationsPapille', item)}
            disabled={isImpossible}
          />

          <BubblePicker
            title="Périphérie"
            selectedItems={eye.observationsPeripherie}
            suggestions={suggestions.peripherie}
            onAdd={(item) => {
              handleAddObs('observationsPeripherie', item);
              if (!suggestions.peripherie.includes(item)) onNewSuggestion?.('peripherie', item);
            }}
            onRemove={(item) => handleRemoveObs('observationsPeripherie', item)}
            disabled={isImpossible}
          />

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

        {/* Paramètres biométriques — section dépliable */}
        {isOCT && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowMesures(!showMesures)}
              className="w-full flex items-center justify-between p-4 text-xs font-black text-teal-600 uppercase tracking-widest hover:bg-slate-50 transition-colors"
            >
              <span>Paramètres biométriques (OCT)</span>
              <span className="text-slate-400 text-sm font-bold">{showMesures ? '▲' : '▼'}</span>
            </button>

            {showMesures && (
              <div className={`p-4 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 ${isImpossible ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                {/* RNFL */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">RNFL</label>
                  <select
                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500 bg-white"
                    value={eye.rnfl?.status ?? 'normal'}
                    onChange={(e) =>
                      onUpdate({
                        ...eye,
                        rnfl: {
                          status: e.target.value as RNFLGCLStatus,
                          location: needsLocalisation(e.target.value as RNFLGCLStatus)
                            ? (eye.rnfl?.location ?? '')
                            : undefined,
                        },
                      })
                    }
                  >
                    {RNFL_STATUSES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {needsLocalisation(eye.rnfl?.status) && (
                    <select
                      className="w-full p-2.5 mt-2 border-2 border-slate-200 rounded-xl text-sm font-bold bg-white"
                      value={eye.rnfl?.location ?? ''}
                      onChange={(e) =>
                        onUpdate({
                          ...eye,
                          rnfl: { status: eye.rnfl!.status, location: e.target.value },
                        })
                      }
                    >
                      <option value="">— Localisation RNFL —</option>
                      {RNFL_LOCATIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* GCL++ */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">GCL++</label>
                  <select
                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500 bg-white"
                    value={eye.gcl?.status ?? 'normal'}
                    onChange={(e) =>
                      onUpdate({
                        ...eye,
                        gcl: {
                          status: e.target.value as RNFLGCLStatus,
                          location: needsLocalisation(e.target.value as RNFLGCLStatus)
                            ? (eye.gcl?.location ?? '')
                            : undefined,
                        },
                      })
                    }
                  >
                    {RNFL_STATUSES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {needsLocalisation(eye.gcl?.status) && (
                    <select
                      className="w-full p-2.5 mt-2 border-2 border-slate-200 rounded-xl text-sm font-bold bg-white"
                      value={eye.gcl?.location ?? ''}
                      onChange={(e) =>
                        onUpdate({
                          ...eye,
                          gcl: { status: eye.gcl!.status, location: e.target.value },
                        })
                      }
                    >
                      <option value="">— Localisation GCL —</option>
                      {RNFL_LOCATIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* C/D + Surface discale */}
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

                {/* Suivi RNFL/GCL */}
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
              </div>
            )}
          </div>
        )}

        {/* Notes additionnelles */}
        <div className="border-t border-slate-100 pt-4">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
            Notes additionnelles
          </label>
          <textarea
            className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm h-20 outline-none focus:border-teal-500 bg-slate-50 focus:bg-white transition-all"
            placeholder="Ex: Patient peu coopératif, suivi difficile…"
            value={eye.obsFree}
            onChange={(e) => update('obsFree', e.target.value)}
          />
        </div>
      </div>

    </div>
  );
}
