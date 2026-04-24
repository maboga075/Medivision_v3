import { useState } from 'react';
import BubblePicker from './BubblePicker';
import {
  BUBBLE_PICKER_SUGGESTIONS,
  RNFL_OPTIONS,
  LOC_PAPILLAIRE,
  LOC_MACULAIRE,
  EVOLUTION_OPTIONS,
} from '../../utils/constants';
import { needsLocalisation } from '../../utils/clinicalData';
import type { EyeState } from '../../types/clinical';

interface EyeExamSectionProps {
  side: 'OD' | 'OG';
  eye: EyeState;
  onUpdate: (eye: EyeState) => void;
  isOCT?: boolean;
  showAnterior?: boolean;
  octaDone?: boolean;
}

export default function EyeExamSection({
  side,
  eye,
  onUpdate,
  isOCT = true,
  showAnterior = false,
  octaDone = false,
}: EyeExamSectionProps) {
  const [showMesures, setShowMesures] = useState(false);

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
        </div>

        {/* Observations morphologiques */}
        <div className="space-y-5">
          <div className="text-xs font-black text-teal-600 uppercase tracking-widest border-b border-teal-100 pb-2">
            Observations morphologiques
          </div>

          <BubblePicker
            title="Macula"
            selectedItems={eye.observationsMacula}
            suggestions={BUBBLE_PICKER_SUGGESTIONS.macula as unknown as string[]}
            onAdd={(item) => handleAddObs('observationsMacula', item)}
            onRemove={(item) => handleRemoveObs('observationsMacula', item)}
          />

          <BubblePicker
            title="Papille"
            selectedItems={eye.observationsPapille}
            suggestions={BUBBLE_PICKER_SUGGESTIONS.papille as unknown as string[]}
            onAdd={(item) => handleAddObs('observationsPapille', item)}
            onRemove={(item) => handleRemoveObs('observationsPapille', item)}
          />

          <BubblePicker
            title="Périphérie"
            selectedItems={eye.observationsPeripherie}
            suggestions={BUBBLE_PICKER_SUGGESTIONS.peripherie as unknown as string[]}
            onAdd={(item) => handleAddObs('observationsPeripherie', item)}
            onRemove={(item) => handleRemoveObs('observationsPeripherie', item)}
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
                  className="w-full p-2.5 border-2 border-indigo-100 rounded-xl text-sm font-bold outline-none focus:border-indigo-400"
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
              placeholder="Observations libres (détails additionnels, anomalies non listées…)"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-teal-400 bg-slate-50 focus:bg-white transition-all resize-none"
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
              <div className="p-4 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2">
                {/* RNFL */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">RNFL</label>
                  <select
                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500 bg-white"
                    value={eye.rnfl}
                    onChange={(e) =>
                      onUpdate({
                        ...eye,
                        rnfl: e.target.value,
                        rnflLoc: needsLocalisation(e.target.value) ? eye.rnflLoc : '',
                      })
                    }
                  >
                    {RNFL_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  {needsLocalisation(eye.rnfl) && (
                    <select
                      className="w-full p-2.5 mt-2 border-2 border-slate-200 rounded-xl text-sm font-bold bg-white"
                      value={eye.rnflLoc}
                      onChange={(e) => update('rnflLoc', e.target.value)}
                    >
                      <option value="">— Localisation RNFL —</option>
                      {LOC_PAPILLAIRE.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* GCL++ */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">GCL++</label>
                  <select
                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500 bg-white"
                    value={eye.gcl}
                    onChange={(e) =>
                      onUpdate({
                        ...eye,
                        gcl: e.target.value,
                        gclLoc: needsLocalisation(e.target.value) ? eye.gclLoc : '',
                      })
                    }
                  >
                    {RNFL_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  {needsLocalisation(eye.gcl) && (
                    <select
                      className="w-full p-2.5 mt-2 border-2 border-slate-200 rounded-xl text-sm font-bold bg-white"
                      value={eye.gclLoc}
                      onChange={(e) => update('gclLoc', e.target.value)}
                    >
                      <option value="">— Localisation GCL —</option>
                      {LOC_MACULAIRE.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
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
