import { useState } from 'react';
import { FileDown, FolderOpen, Save, CheckCircle } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';

function isFilePickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export default function ExportTab() {
  const { settings, updateExport } = useSettings();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleUpdate = async (updates: Parameters<typeof updateExport>[0]) => {
    setSaving(true);
    try {
      await updateExport(updates);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('[ExportTab]', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectFolder = async () => {
    if (!isFilePickerSupported()) return;
    try {
      const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<{ name: string }> }).showDirectoryPicker();
      await handleUpdate({ exportFolderName: dirHandle.name });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[ExportTab] showDirectoryPicker', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-slate-100 rounded-xl">
          <FileDown className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Préférences d'export</h2>
          <p className="text-sm text-slate-500">Format, nom de fichier et dossier de destination.</p>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold px-4 py-2.5 rounded-xl">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Enregistré
        </div>
      )}

      {/* Format par défaut */}
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
                checked={(settings?.export?.formatParDefaut ?? 'pdf') === fmt}
                onChange={() => handleUpdate({ formatParDefaut: fmt })}
                className="sr-only"
              />
              <div
                className={`px-5 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                  (settings?.export?.formatParDefaut ?? 'pdf') === fmt
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
          key={settings?.export?.templateNomFichier}
          defaultValue={settings?.export?.templateNomFichier ?? 'CR_{{nom}}_{{date}}'}
          onBlur={(e) => handleUpdate({ templateNomFichier: e.target.value })}
          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-mono font-bold outline-none focus:border-teal-500"
          placeholder="CR_{{nom}}_{{date}}"
        />
        <p className="mt-2 text-xs text-slate-400">
          Placeholders : <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{'{{nom}}'}</code>{' '}
          <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{'{{date}}'}</code>{' '}
          <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{'{{medecin}}'}</code>
        </p>
      </div>

      {/* Dossier d'export */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          Dossier d'export favori
        </label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 p-3 border-2 border-slate-200 rounded-xl bg-slate-50">
            <FolderOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className={`text-sm truncate ${settings?.export?.exportFolderName ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}`}>
              {settings?.export?.exportFolderName ?? 'Aucun dossier sélectionné'}
            </span>
          </div>
          {isFilePickerSupported() ? (
            <button
              type="button"
              onClick={handleSelectFolder}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex-shrink-0"
            >
              <FolderOpen className="w-4 h-4" />
              Choisir
            </button>
          ) : (
            <div className="flex items-center px-4 py-3 bg-slate-100 text-slate-400 rounded-xl text-xs font-medium flex-shrink-0">
              Non supporté
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {isFilePickerSupported()
            ? 'Le navigateur utilisera ce dossier comme suggestion lors de l\'export.'
            : '⚠ Votre navigateur (Safari) ne supporte pas la sélection de dossier. Utilisez Chrome ou Edge pour cette option.'}
        </p>
      </div>

      {/* Option sélecteur fichier */}
      <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <input
          type="checkbox"
          id="useFilePicker"
          checked={settings?.export?.useFilePicker ?? true}
          onChange={(e) => handleUpdate({ useFilePicker: e.target.checked })}
          disabled={!isFilePickerSupported()}
          className="mt-0.5 w-4 h-4 accent-teal-600 cursor-pointer flex-shrink-0 disabled:opacity-40"
        />
        <div>
          <label htmlFor="useFilePicker" className={`text-sm font-semibold cursor-pointer ${!isFilePickerSupported() ? 'text-slate-400' : 'text-slate-700'}`}>
            Afficher le sélecteur de fichier à chaque export
            {!isFilePickerSupported() && <span className="text-xs font-normal ml-1">(non supporté par ce navigateur)</span>}
          </label>
          <p className="text-xs text-slate-400 mt-1">
            Si activé, une fenêtre vous permet de choisir le nom et l'emplacement exacts. Sinon, le fichier est téléchargé directement.
          </p>
        </div>
      </div>

      {/* Bouton sauvegarder */}
      <div className="pt-2">
        <button
          onClick={() => handleUpdate({})}
          disabled={saving}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-60"
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Enregistré !' : saving ? 'Sauvegarde…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
