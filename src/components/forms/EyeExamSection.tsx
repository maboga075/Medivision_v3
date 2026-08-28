import { useState } from 'react';
import BubblePicker from './BubblePicker';
import RnflGclPicker from './RnflGclPicker';
import TextTagField from './TextTagField';
import { BUBBLE_PICKER_SUGGESTIONS } from '../../utils/constants';
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

interface EyeExamSectionProps {
  side: 'OD' | 'OG';
  eye: EyeState;
  onUpdate: (eye: EyeState) => void;
  isOCT?: boolean;
  showAnterior?: boolean;
  onNewSuggestion?: (category: 'macula' | 'papille' | 'peripherie', item: string) => void;
  /** Suggestions mémorisées pour le champ « Divers ». */
  diversSuggestions?: string[];
  /** Persiste une nouvelle observation « Divers » pour les prochaines sessions. */
  onPersistDivers?: (item: string) => void;
}

export default function EyeExamSection({
  side,
  eye,
  onUpdate,
  isOCT = true,
  showAnterior = false,
  diversSuggestions = [],
  onPersistDivers,
}: EyeExamSectionProps) {
  const [customCause, setCustomCause] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const isImpossible = eye.acquisitionQuality === 'impossible';
  // Exclusions facultatives — le praticien peut retirer RNFL/GCL et/ou les
  // paramètres du disque, quel que soit l'indice d'acquisition.
  const excludeRnflGcl = eye.excludeRnflGcl === true;

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

          {/* RetinaSketch : bouton unique déplacé entre les colonnes OD/OG
              (géré par le parent Consultation), plus de bouton par œil. */}

          {/* Segment Antérieur — affiché dès qu'une coupe cornée/angle existe */}
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

          {/* OCTA : plus de champ dédié — l'observation passe désormais par une
              coupe OCTA dans RetinaSketch ou par le champ Divers ci-dessous. */}

          {/* Divers — champ à tags (auto-complétion + mémoire), stocké en texte */}
          <div className="pt-2 border-t border-slate-100">
            <TextTagField
              label={<span className="flex items-center gap-2"><span className="text-slate-400">◈</span> Divers</span>}
              value={eye.observationsDivers}
              onChange={(v) => update('observationsDivers', v)}
              suggestions={diversSuggestions}
              onPersistNew={onPersistDivers}
              placeholder="Symptôme ou observation libre…"
              disabled={isImpossible}
            />
          </div>
        </div>

        {/* Module RNFL/GCL par secteurs — OCT uniquement.
            Le disque (surface + C/D) et le suivi RNFL/GCL sont désormais dans
            l'encadré commun aux 2 yeux (SharedDiscFollowUpSection). */}
        {isOCT && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="w-full flex items-center p-4 text-xs font-black text-teal-600 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
              <span>RNFL &amp; GCL+ (OCT)</span>
            </div>

            <div className={`p-4 space-y-4 ${isImpossible ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                {/* Exclusion facultative RNFL/GCL */}
                <button
                  type="button"
                  onClick={() => update('excludeRnflGcl', !eye.excludeRnflGcl)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-[0.99] ${
                    excludeRnflGcl
                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                      : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {excludeRnflGcl ? '✓ RNFL/GCL exclus' : 'Ne pas interpréter RNFL/GCL'}
                </button>

                {excludeRnflGcl && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs font-semibold text-amber-700">
                    RNFL et GCL exclus de l'interprétation : ces paramètres n'apparaîtront pas dans le compte rendu.
                  </div>
                )}

                {/* RNFL & GCL+ par secteurs — masqués si exclus */}
                {!excludeRnflGcl && (
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
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
