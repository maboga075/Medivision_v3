import { useState, type ChangeEvent } from 'react';
import { Save, CheckCircle, FileDown } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import type { AppSettings } from '../../types/settings';

interface Props { settings: AppSettings }

export default function ExportTab({ settings }: Props) {
  const { updateExport } = useSettings();
  const [form, setForm] = useState(settings.export);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateExport(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-slate-100 rounded-xl">
          <FileDown className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Préférences d'export</h2>
          <p className="text-sm text-slate-500">Format des comptes rendus exportés.</p>
        </div>
      </div>

      {/* Format */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Format par défaut
        </label>
        <div className="flex flex-wrap gap-3">
          {(['pdf', 'docx'] as const).map((fmt) => (
            <label key={fmt} className="cursor-pointer">
              <input
                type="radio"
                name="formatParDefaut"
                value={fmt}
                checked={form.formatParDefaut === fmt}
                onChange={handleChange}
                className="sr-only"
              />
              <div
                className={`px-5 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                  form.formatParDefaut === fmt
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-slate-200 text-slate-600 hover:border-teal-300'
                }`}
              >
                {fmt === 'pdf' ? '📄 PDF' : '📋 Word (.docx)'}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Template nom fichier */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          Template de nom de fichier
        </label>
        <input
          type="text"
          name="templateNomFichier"
          value={form.templateNomFichier}
          onChange={handleChange}
          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-mono font-bold outline-none focus:border-teal-500"
          placeholder="CR_{{nom}}_{{date}}"
        />
        <p className="mt-2 text-xs text-slate-400">
          Placeholders disponibles : <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{'{{nom}}'}</code>{' '}
          <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{'{{date}}'}</code>{' '}
          <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{'{{medecin}}'}</code>
        </p>
      </div>

      {/* Info dossier */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <strong>Dossier d'export</strong> — le navigateur demandera le dossier de destination à chaque export via la boîte de dialogue d'impression native.
      </div>

      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-60"
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Sauvegardé !' : saving ? 'Sauvegarde…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
