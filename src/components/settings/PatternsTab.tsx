import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import type { ClinicalPattern, SeverityGrade } from '../../types/settings';

/* ── Constantes ──────────────────────────────────────── */

const RNFL_KEYS = ['S', 'I', 'N', 'T'] as const;
const GCL_KEYS  = ['S', 'ST', 'IT', 'I', 'IN', 'SN'] as const;

const GRADE_COLORS: Record<0 | SeverityGrade, string> = {
  0: '#e2e8f0',
  1: '#e6b566',
  2: '#d98b7e',
  3: '#c0392b',
};
const GRADE_LABELS: Record<0 | SeverityGrade, string> = {
  0: 'Normal',
  1: 'Limite',
  2: 'Hors norme',
  3: 'Critique',
};

type RnflKey = typeof RNFL_KEYS[number];
type GclKey  = typeof GCL_KEYS[number];

/* ── Sous-composant : sélecteur de secteur ──────────── */

function SectorButton({
  label,
  grade,
  onChange,
}: {
  label: string;
  grade: 0 | SeverityGrade;
  onChange: (g: 0 | SeverityGrade) => void;
}) {
  const next = ((grade + 1) % 4) as 0 | SeverityGrade;
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={GRADE_LABELS[grade]}
      style={{ background: GRADE_COLORS[grade] }}
      className="w-11 h-11 rounded-lg text-xs font-black text-slate-700 border border-slate-200 transition-all hover:scale-105"
    >
      {label}
    </button>
  );
}

/* ── Légende grades ─────────────────────────────────── */

function GradeLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">
      {(Object.entries(GRADE_LABELS) as [string, string][]).map(([g, lbl]) => (
        <span key={g} className="flex items-center gap-1.5">
          <span
            style={{ background: GRADE_COLORS[Number(g) as 0 | SeverityGrade] }}
            className="inline-block w-3 h-3 rounded border border-slate-200"
          />
          {lbl}
        </span>
      ))}
      <span className="text-slate-400 italic">Cliquer pour faire défiler les niveaux</span>
    </div>
  );
}

/* ── Formulaire ajout / édition ─────────────────────── */

type DraftPattern = Omit<ClinicalPattern, 'id'> & { id?: string };

const EMPTY_DRAFT: DraftPattern = {
  name: '',
  type: 'RNFL',
  rnflSectors: {},
  gclSectors: {},
  description: '',
};

function PatternForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: DraftPattern;
  onSave: (p: DraftPattern) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<DraftPattern>(initial);

  const rnfl = draft.rnflSectors ?? {};
  const gcl  = draft.gclSectors  ?? {};

  const setRnfl = (k: RnflKey, g: 0 | SeverityGrade) => {
    const next = { ...rnfl };
    if (g === 0) delete next[k]; else next[k] = g;
    setDraft((d) => ({ ...d, rnflSectors: next }));
  };
  const setGcl  = (k: GclKey,  g: 0 | SeverityGrade) => {
    const next = { ...gcl };
    if (g === 0) delete next[k]; else next[k] = g;
    setDraft((d) => ({ ...d, gclSectors: next }));
  };

  const showRnfl = draft.type === 'RNFL' || draft.type === 'RNFL+GCL';
  const showGcl  = draft.type === 'GCL'  || draft.type === 'RNFL+GCL';

  return (
    <div className="border-2 border-teal-200 rounded-2xl p-5 space-y-5 bg-teal-50/40">
      {/* Nom */}
      <div>
        <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
          Nom de la forme clinique
        </label>
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Ex : Déficit arciforme supérieur RNFL"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
          Module concerné
        </label>
        <div className="flex gap-2">
          {(['RNFL', 'GCL', 'RNFL+GCL'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, type: t }))}
              className={`px-4 py-1.5 rounded-lg text-xs font-black border transition-all ${
                draft.type === t
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Secteurs RNFL */}
      {showRnfl && (
        <div>
          <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
            Secteurs RNFL (S / I / N / T)
          </label>
          <div className="flex gap-2">
            {RNFL_KEYS.map((k) => (
              <SectorButton
                key={k}
                label={k}
                grade={(rnfl[k] ?? 0) as 0 | SeverityGrade}
                onChange={(g) => setRnfl(k, g)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Secteurs GCL */}
      {showGcl && (
        <div>
          <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
            Secteurs GCL+ (S / ST / IT / I / IN / SN)
          </label>
          <div className="flex gap-2 flex-wrap">
            {GCL_KEYS.map((k) => (
              <SectorButton
                key={k}
                label={k}
                grade={(gcl[k] ?? 0) as 0 | SeverityGrade}
                onChange={(g) => setGcl(k, g)}
              />
            ))}
          </div>
        </div>
      )}

      <GradeLegend />

      {/* Description */}
      <div>
        <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
          Note clinique (optionnel)
        </label>
        <textarea
          value={draft.description ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="Description clinique, orientation diagnostique…"
          rows={2}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={!draft.name.trim()}
          onClick={() => onSave(draft)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-all"
        >
          <Check className="w-4 h-4" />
          {draft.id ? 'Enregistrer' : 'Ajouter'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition-all"
        >
          <X className="w-4 h-4" />
          Annuler
        </button>
      </div>
    </div>
  );
}

/* ── Carte de présentation d'une forme ──────────────── */

function PatternCard({
  pattern,
  onEdit,
  onDelete,
}: {
  pattern: ClinicalPattern;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeColors: Record<ClinicalPattern['type'], string> = {
    RNFL:       'bg-indigo-100 text-indigo-700',
    GCL:        'bg-teal-100   text-teal-700',
    'RNFL+GCL': 'bg-violet-100 text-violet-700',
  };

  const affectedRnfl = Object.entries(pattern.rnflSectors ?? {}) as [RnflKey, SeverityGrade][];
  const affectedGcl  = Object.entries(pattern.gclSectors  ?? {}) as [GclKey,  SeverityGrade][];

  return (
    <div className="border border-slate-200 rounded-2xl p-4 bg-white hover:border-teal-200 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${typeColors[pattern.type]}`}>
              {pattern.type}
            </span>
            <span className="text-sm font-bold text-slate-800 truncate">{pattern.name}</span>
          </div>

          {/* Secteurs affectés */}
          {(affectedRnfl.length > 0 || affectedGcl.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {affectedRnfl.map(([k, g]) => (
                <span
                  key={`rnfl-${k}`}
                  style={{ background: GRADE_COLORS[g] }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black text-slate-700"
                >
                  RNFL·{k}
                </span>
              ))}
              {affectedGcl.map(([k, g]) => (
                <span
                  key={`gcl-${k}`}
                  style={{ background: GRADE_COLORS[g] }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black text-slate-700"
                >
                  GCL·{k}
                </span>
              ))}
            </div>
          )}

          {pattern.description && (
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{pattern.description}</p>
          )}
        </div>

        <div className="flex gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
            title="Modifier"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Composant principal ────────────────────────────── */

export default function PatternsTab() {
  const { settings, updateClinicalPatterns } = useSettings();
  const patterns: ClinicalPattern[] = settings?.clinicalPatterns ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (draft: DraftPattern) => {
    setSaving(true);
    try {
      if (draft.id) {
        const next = patterns.map((p) =>
          p.id === draft.id ? { ...draft, id: draft.id } as ClinicalPattern : p
        );
        await updateClinicalPatterns(next);
        setEditingId(null);
      } else {
        const newPattern: ClinicalPattern = {
          ...draft,
          id: `pat_${Date.now()}`,
          name: draft.name.trim(),
        };
        await updateClinicalPatterns([...patterns, newPattern]);
        setShowForm(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette forme clinique ?')) return;
    await updateClinicalPatterns(patterns.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Formes cliniques</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Patterns arciformes et sectoriels fréquents pour RNFL et GCL+.
            Servent de référence lors de l'interprétation des secteurs.
          </p>
        </div>
      </div>

      {/* Formulaire d'ajout */}
      {showForm && !editingId && (
        <PatternForm
          initial={{ ...EMPTY_DRAFT }}
          onSave={(d) => void handleSave(d)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Bouton ajouter */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl transition-all"
        >
          <Plus className="w-4 h-4" />
          Ajouter une forme clinique
        </button>
      )}

      {/* Liste */}
      {patterns.length === 0 && !showForm && (
        <div className="text-center py-10 text-slate-400 text-sm font-medium border-2 border-dashed border-slate-200 rounded-2xl">
          Aucune forme clinique définie.<br />
          <span className="text-slate-300 text-xs">Déficit arciforme, NORB, glaucome avancé…</span>
        </div>
      )}

      <div className="space-y-3">
        {patterns.map((p) =>
          editingId === p.id ? (
            <PatternForm
              key={p.id}
              initial={{ ...p }}
              onSave={(d) => void handleSave(d)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <PatternCard
              key={p.id}
              pattern={p}
              onEdit={() => { setEditingId(p.id); setShowForm(false); }}
              onDelete={() => void handleDelete(p.id)}
            />
          )
        )}
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-sm text-teal-600 font-medium">
          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          Enregistrement…
        </div>
      )}
    </div>
  );
}
