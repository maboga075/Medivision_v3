import { Stethoscope, Plus, X } from 'lucide-react';
import { HYPOTHESES_DIAGNOSTIQUES } from '../../../utils/constants';
import type { HypotheseDiagnostique, EyeState } from '../../../types/clinical';
import { processHypothesisAddition } from '../../../utils/hypothesisValidation';
import { useState, useCallback } from 'react';
import TextTagField from '../../../components/forms/TextTagField';

interface HypothesesSectionProps {
  hypothesesDiagnostiques: HypotheseDiagnostique[];
  onHypothesesChange: (h: HypotheseDiagnostique[]) => void;
  hypotheseLibre: string;
  onHypotheseLibreChange: (v: string) => void;
  selectedCat: string;
  onSelectedCatChange: (v: string) => void;
  selectedHyp: string;
  onSelectedHypChange: (v: string) => void;
  selectedLat: 'OD et OG' | 'OD' | 'OG';
  onSelectedLatChange: (v: 'OD et OG' | 'OD' | 'OG') => void;
  eyeOD: EyeState;
  eyeOG: EyeState;
  /** Suggestions mémorisées pour le champ « Hypothèse libre ». */
  hypothesesLibresSuggestions?: string[];
  /** Persiste une nouvelle note pour les prochaines sessions. */
  onPersistHypotheseLibre?: (item: string) => void;
}

export default function HypothesesSection({
  hypothesesDiagnostiques,
  onHypothesesChange,
  hypotheseLibre,
  onHypotheseLibreChange,
  selectedCat,
  onSelectedCatChange,
  selectedHyp,
  onSelectedHypChange,
  selectedLat,
  onSelectedLatChange,
  eyeOD,
  eyeOG,
  hypothesesLibresSuggestions = [],
  onPersistHypotheseLibre,
}: HypothesesSectionProps) {
  const [hypoError, setHypoError] = useState('');
  const [hypoWarning, setHypoWarning] = useState('');

  const handleAdd = useCallback(() => {
    setHypoError('');
    setHypoWarning('');
    const candidate: HypotheseDiagnostique = {
      categorie: selectedCat,
      libelle: selectedHyp,
      lateralite: selectedLat,
    };
    const result = processHypothesisAddition(hypothesesDiagnostiques, candidate, eyeOD, eyeOG);
    if (!result.isValid) {
      setHypoError(result.reason ?? '');
    } else {
      onHypothesesChange(result.newHypotheses ?? hypothesesDiagnostiques);
      if (result.warning) setHypoWarning(result.warning);
    }
  }, [selectedCat, selectedHyp, selectedLat, hypothesesDiagnostiques, eyeOD, eyeOG, onHypothesesChange]);

  const handleRemove = useCallback((libelle: string, lateralite: string) => {
    onHypothesesChange(
      hypothesesDiagnostiques.filter((h) => !(h.libelle === libelle && h.lateralite === lateralite))
    );
  }, [hypothesesDiagnostiques, onHypothesesChange]);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-10 w-full">
      <div className="flex items-center gap-2 mb-4">
        <Stethoscope className="w-5 h-5 text-teal-600" />
        <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">
          Hypothèse(s) diagnostique(s) du praticien
        </h3>
      </div>

      <div className="flex flex-row flex-wrap items-end gap-3 mb-4">
        <div className="w-full md:w-auto md:flex-[1.2] min-w-[150px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Catégorie
          </label>
          <select
            value={selectedCat}
            onChange={(e) => {
              onSelectedCatChange(e.target.value);
              onSelectedHypChange(HYPOTHESES_DIAGNOSTIQUES[e.target.value][0]);
            }}
            className="w-full p-2.5 lg:p-3 border-2 border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-700 outline-none focus:border-teal-400 focus:bg-white transition-colors"
          >
            {Object.keys(HYPOTHESES_DIAGNOSTIQUES).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-auto md:flex-[0.7] min-w-[100px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Latéralité
          </label>
          <select
            value={selectedLat}
            onChange={(e) => onSelectedLatChange(e.target.value as 'OD et OG' | 'OD' | 'OG')}
            className="w-full p-2.5 lg:p-3 border-2 border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-700 outline-none focus:border-teal-400 focus:bg-white transition-colors"
          >
            <option value="OD et OG">OD et OG</option>
            <option value="OD">OD</option>
            <option value="OG">OG</option>
          </select>
        </div>

        <div className="w-full md:w-auto md:flex-[2.5] min-w-[200px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Hypothèse clinique
          </label>
          <select
            value={selectedHyp}
            onChange={(e) => onSelectedHypChange(e.target.value)}
            className="w-full p-2.5 lg:p-3 border-2 border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-700 outline-none focus:border-teal-400 focus:bg-white transition-colors truncate"
          >
            {HYPOTHESES_DIAGNOSTIQUES[selectedCat].map((hyp) => (
              <option key={hyp} value={hyp}>
                {hyp}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-auto shrink-0">
          <button
            onClick={handleAdd}
            className="w-full md:w-auto px-5 py-2.5 lg:py-3 bg-teal-50 text-teal-700 font-bold rounded-xl hover:bg-teal-100 transition-colors border border-teal-200 flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </div>
      </div>

      {hypoError && (
        <div className="mb-4 text-sm font-bold text-red-500 bg-red-50 py-2.5 px-4 rounded-xl border border-red-100 flex items-center gap-2">
          <span className="text-lg">⚠️</span> {hypoError}
        </div>
      )}

      {hypoWarning && (
        <div className="mb-4 text-sm font-bold text-amber-600 bg-amber-50 py-2.5 px-4 rounded-xl border border-amber-200 flex items-center gap-2">
          <span className="text-lg">ℹ️</span> {hypoWarning}
        </div>
      )}

      {hypothesesDiagnostiques.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
          {hypothesesDiagnostiques.map((h, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white text-sm font-bold rounded-lg shadow-sm"
            >
              {h.libelle}, {h.lateralite}
              <button
                onClick={() => handleRemove(h.libelle, h.lateralite)}
                className="hover:bg-teal-700 bg-teal-500/50 p-1 rounded-full transition-colors active:scale-90"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-slate-100 pt-5">
        <TextTagField
          label={<span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hypothèse libre / note clinique</span>}
          value={hypotheseLibre}
          onChange={onHypotheseLibreChange}
          suggestions={hypothesesLibresSuggestions}
          onPersistNew={onPersistHypotheseLibre}
          placeholder="Nuance, réserve ou commentaire clinique…"
        />
      </div>
    </div>
  );
}
