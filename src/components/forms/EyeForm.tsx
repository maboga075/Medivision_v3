import { useState } from 'react';
import { X, Star } from 'lucide-react';
import ChipGroup from '../shared/ChipGroup';
import CollapsibleSection from '../shared/CollapsibleSection';
import ImageUploader from '../shared/ImageUploader';
import {
  RNFL_OPTIONS,
  EVOLUTION_OPTIONS,
  LOC_PAPILLAIRE,
  LOC_MACULAIRE,
  EXCLUSIONS,
  DEFAULT_PREFS,
} from '../../utils/constants';
import { needsLocalisation } from '../../utils/clinicalData';
import type { EyeState } from '../../types/clinical';
import type { UserPrefs, PrefsKey } from '../../types/prefs';

interface EyeFormProps {
  side: 'OD' | 'OG';
  label: string;
  color: string;
  eye: EyeState;
  onChange: (eye: EyeState) => void;
  isOCT: boolean;
  prefs: UserPrefs;
  updatePrefs: (key: PrefsKey, value: string) => void;
  showAnterior: boolean;
  showPosterior: boolean;
}

export default function EyeForm({
  side: _side,
  label,
  color,
  eye,
  onChange,
  isOCT,
  prefs,
  updatePrefs,
  showAnterior,
  showPosterior,
}: EyeFormProps) {
  const update = <K extends keyof EyeState>(k: K, v: EyeState[K]) => onChange({ ...eye, [k]: v });

  const [showAddAcqMotif, setShowAddAcqMotif] = useState(false);
  const [newAcqMotif, setNewAcqMotif] = useState('');

  const handleAddAcqMotif = () => {
    if (newAcqMotif.trim()) {
      updatePrefs('acqMotifs', newAcqMotif.trim());
      update('acquisitionMotif', newAcqMotif.trim());
      setNewAcqMotif('');
      setShowAddAcqMotif(false);
    }
  };

  return (
    <div className="flex-1 min-w-[320px] bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div
        className="p-4 text-white font-extrabold text-sm tracking-widest flex items-center gap-2 justify-center"
        style={{ backgroundColor: color }}
      >
        👁️ {label}
      </div>

      <div className="p-5 sm:p-6 flex-1 space-y-6">
        {/* Indice d'acquisition */}
        <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
          <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            📊 Indice d'acquisition
          </div>
          <div className="flex flex-wrap gap-3">
            {(['Bon', 'Faible', 'Impossible'] as const).map((status) => (
              <button
                key={status}
                onClick={() => onChange({ ...eye, acquisitionStatus: status, acquisitionMotif: status === 'Bon' ? '' : eye.acquisitionMotif })}
                className={`px-5 py-3 rounded-2xl text-sm font-bold border transition-all active:scale-95 ${
                  eye.acquisitionStatus === status
                    ? status === 'Bon'
                      ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-sm'
                      : status === 'Faible'
                      ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm'
                      : 'bg-red-50 border-red-500 text-red-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'
                }`}
              >
                {status === 'Bon' ? '✓ Bon' : status === 'Faible' ? '⚠ Faible' : '❌ Impossible'}
              </button>
            ))}
          </div>

          {eye.acquisitionStatus !== 'Bon' && (
            <div className="mt-4 animate-in slide-in-from-top-2">
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  className="flex-1 p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500 bg-white"
                  value={eye.acquisitionMotif}
                  onChange={(e) => update('acquisitionMotif', e.target.value)}
                >
                  <option value="">— Préciser le motif —</option>
                  {prefs.acqMotifs.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                {showAddAcqMotif ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className="w-full sm:w-32 px-3 py-3 border-2 border-teal-300 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
                      placeholder="Motif..."
                      value={newAcqMotif}
                      onChange={(e) => setNewAcqMotif(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddAcqMotif();
                        if (e.key === 'Escape') setShowAddAcqMotif(false);
                      }}
                    />
                    <button
                      onClick={handleAddAcqMotif}
                      className="bg-teal-500 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-teal-600 transition-colors"
                    >
                      OK
                    </button>
                    <button onClick={() => setShowAddAcqMotif(false)} className="text-slate-400 hover:text-slate-600 p-2">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddAcqMotif(true)}
                    className="px-5 py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:bg-white flex items-center justify-center font-bold text-lg leading-none transition-colors"
                  >
                    ＋
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* OCT Suivi + Mesures */}
        {isOCT && eye.acquisitionStatus !== 'Impossible' && showPosterior && (
          <div className="space-y-6">
            <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="text-xs font-black text-teal-600 uppercase tracking-widest">Suivi RNFL / GCL</div>
                <div className="flex gap-2">
                  {([true, false] as const).map((v) => (
                    <button
                      key={String(v)}
                      onClick={() => update('hasFollowUp', v)}
                      className={`px-4 py-2 rounded-xl text-xs font-black border transition-all active:scale-95 ${
                        eye.hasFollowUp === v
                          ? v ? 'bg-teal-500 border-teal-500 text-white' : 'bg-slate-200 border-slate-300 text-slate-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {v ? 'OUI' : 'NON'}
                    </button>
                  ))}
                </div>
              </div>

              {eye.hasFollowUp && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date ancien examen</label>
                    <input
                      type="date"
                      className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-teal-500 outline-none"
                      value={eye.followUpDate}
                      onChange={(e) => update('followUpDate', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(['rnflEvolution', 'gclEvolution'] as const).map((field) => (
                      <div key={field}>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                          Évolution {field === 'rnflEvolution' ? 'RNFL' : 'GCL++'}
                        </label>
                        <select
                          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500 bg-white"
                          value={eye[field]}
                          onChange={(e) => update(field, e.target.value)}
                        >
                          {EVOLUTION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-black text-teal-600 uppercase tracking-widest mb-3 border-b border-teal-100 pb-2">
                Mesures actuelles OCT
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">RNFL</label>
                  <select
                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500 bg-white"
                    value={eye.rnfl}
                    onChange={(e) =>
                      onChange({ ...eye, rnfl: e.target.value, rnflLoc: needsLocalisation(e.target.value) ? eye.rnflLoc : '' })
                    }
                  >
                    {RNFL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {needsLocalisation(eye.rnfl) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Localisation RNFL</label>
                    <select
                      className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold bg-white"
                      value={eye.rnflLoc}
                      onChange={(e) => update('rnflLoc', e.target.value)}
                    >
                      <option value="">— Préciser —</option>
                      {LOC_PAPILLAIRE.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">GCL++</label>
                  <select
                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500 bg-white"
                    value={eye.gcl}
                    onChange={(e) =>
                      onChange({ ...eye, gcl: e.target.value, gclLoc: needsLocalisation(e.target.value) ? eye.gclLoc : '' })
                    }
                  >
                    {RNFL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {needsLocalisation(eye.gcl) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Localisation GCL</label>
                    <select
                      className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold bg-white"
                      value={eye.gclLoc}
                      onChange={(e) => update('gclLoc', e.target.value)}
                    >
                      <option value="">— Préciser —</option>
                      {LOC_MACULAIRE.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* OCT Segment Antérieur */}
        {isOCT && eye.acquisitionStatus !== 'Impossible' && showAnterior && (
          <div className="border border-indigo-100 rounded-2xl p-5 bg-indigo-50/30">
            <div className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4 border-b border-indigo-100 pb-2">
              OCT Segment Antérieur
            </div>
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Épaisseur cornéenne (µm)</label>
                <input
                  type="number"
                  className="w-full p-3 border-2 border-indigo-100 rounded-xl text-sm font-bold outline-none focus:border-indigo-400 bg-white"
                  placeholder="Ex: 540"
                  value={eye.cornealThickness}
                  onChange={(e) => update('cornealThickness', e.target.value)}
                />
              </div>
              <ChipGroup
                label="Signes Cornéens"
                chips={prefs.obsAnterieur || DEFAULT_PREFS.obsAnterieur}
                selected={eye.obsAnterieur}
                onToggle={(v) => update('obsAnterieur', v)}
                exclusions={EXCLUSIONS['obsAnterieur']}
              />
            </div>
          </div>
        )}

        {/* Disque optique */}
        {eye.acquisitionStatus !== 'Impossible' && showPosterior && (
          <div>
            <div className="text-xs font-black text-teal-600 uppercase tracking-widest mb-3 border-b border-teal-100 pb-2">
              Disque optique
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Surface (mm²)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
                  placeholder="Ex: 2.1"
                  value={eye.discSurface}
                  onChange={(e) => update('discSurface', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">C/D vertical</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
                  placeholder="Ex: 0.4"
                  value={eye.cupDisc}
                  onChange={(e) => update('cupDisc', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Observations morphologiques */}
        {showPosterior && (
          <>
            <div className="text-xs font-black text-teal-600 uppercase tracking-widest mb-4 border-b border-teal-100 pb-2 mt-2">
              Observations Morphologiques
            </div>
            <div className="mb-6">
              <ChipGroup
                label="Favoris"
                icon={<Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                chips={prefs.obsFavoris}
                selected={eye.obsFavoris}
                onToggle={(v) => update('obsFavoris', v)}
                onAddCustom={(v) => updatePrefs('obsFavoris', v)}
              />
            </div>

            <div className="space-y-3">
              <CollapsibleSection title="Papille" icon="◉" selectedData={eye.obsPapille}>
                <ChipGroup
                  label=""
                  chips={prefs.obsPapille}
                  selected={eye.obsPapille}
                  onToggle={(v) => update('obsPapille', v)}
                  onAddCustom={(v) => updatePrefs('obsPapille', v)}
                  exclusions={EXCLUSIONS['obsPapille']}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Macula" icon="◎" selectedData={eye.obsMacula}>
                <ChipGroup
                  label=""
                  chips={prefs.obsMacula}
                  selected={eye.obsMacula}
                  onToggle={(v) => update('obsMacula', v)}
                  onAddCustom={(v) => updatePrefs('obsMacula', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Vascularisation" icon="⟡" selectedData={eye.obsVasc}>
                <ChipGroup
                  label=""
                  chips={prefs.obsVasc}
                  selected={eye.obsVasc}
                  onToggle={(v) => update('obsVasc', v)}
                  onAddCustom={(v) => updatePrefs('obsVasc', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Périphérie" icon="○" selectedData={eye.obsPeriph}>
                <ChipGroup
                  label=""
                  chips={prefs.obsPeriph}
                  selected={eye.obsPeriph}
                  onToggle={(v) => update('obsPeriph', v)}
                  onAddCustom={(v) => updatePrefs('obsPeriph', v)}
                />
              </CollapsibleSection>

              {isOCT && (
                <CollapsibleSection title="OCTA" icon="🔬" selectedData={eye.obsOCTA}>
                  <div className="flex items-center gap-4 mb-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="text-sm font-bold text-slate-600">Examen OCTA réalisé ?</div>
                    <div className="flex gap-2">
                      {([true, false] as const).map((v) => (
                        <button
                          key={String(v)}
                          onClick={() => update('octaPerformed', v)}
                          className={`px-4 py-2 rounded-xl text-xs font-black border transition-all active:scale-95 ${
                            eye.octaPerformed === v
                              ? v ? 'bg-teal-500 border-teal-500 text-white' : 'bg-slate-200 border-slate-300 text-slate-700'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {v ? 'OUI' : 'NON'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {eye.octaPerformed && (
                    <div className="animate-in slide-in-from-top-2">
                      <ChipGroup
                        label=""
                        chips={prefs.obsOCTA}
                        selected={eye.obsOCTA}
                        onToggle={(v) => update('obsOCTA', v)}
                        onAddCustom={(v) => updatePrefs('obsOCTA', v)}
                        exclusions={EXCLUSIONS['obsOCTA']}
                      />
                    </div>
                  )}
                </CollapsibleSection>
              )}
            </div>
          </>
        )}

        {/* Notes libres */}
        <div className="mt-8 border-t-2 border-slate-100 pt-6">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
            Notes additionnelles du praticien
          </label>
          <textarea
            className="w-full p-4 border-2 border-slate-200 rounded-2xl text-sm h-28 outline-none focus:border-teal-500 bg-slate-50 focus:bg-white transition-all shadow-inner"
            placeholder="Ex: Patient peu coopératif, suivi difficile..."
            value={eye.obsFree}
            onChange={(e) => update('obsFree', e.target.value)}
          />
        </div>

        <ImageUploader
          images={eye.images}
          onUpload={(img) => update('images', [...eye.images, img])}
          onRemove={(idx) => update('images', eye.images.filter((_, i) => i !== idx))}
        />
      </div>
    </div>
  );
}
