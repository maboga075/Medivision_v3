import { useState, type ChangeEvent } from 'react';
import { Save, CheckCircle, Building2 } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import type { AppSettings } from '../../types/settings';

interface Props { settings: AppSettings }

export default function ClinicTab({ settings }: Props) {
  const { updateClinic } = useSettings();
  const [form, setForm] = useState(settings.clinic);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setForm((p) => ({ ...p, logo: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateClinic(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-teal-50 rounded-xl">
          <Building2 className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Informations de la clinique</h2>
          <p className="text-sm text-slate-500">Affichées sur tous les comptes rendus imprimés.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Nom de la clinique
          </label>
          <input
            type="text"
            name="nom"
            value={form.nom}
            onChange={handleChange}
            className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
            placeholder="Clinique Medivision"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Téléphone
          </label>
          <input
            type="tel"
            name="telephone"
            value={form.telephone}
            onChange={handleChange}
            className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
            placeholder="+241 76 51 50 12"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
            placeholder="contact@clinique.com"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Adresse
          </label>
          <textarea
            name="adresse"
            value={form.adresse}
            onChange={handleChange}
            rows={2}
            className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500 resize-none"
            placeholder="Libreville, Gabon"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Logo (optionnel)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleLogo}
            className="w-full p-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 cursor-pointer file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 file:font-bold file:text-xs hover:border-teal-300 transition-colors"
          />
          {form.logo && (
            <div className="mt-3 flex items-center gap-3">
              <img
                src={form.logo}
                alt="Logo"
                className="h-14 w-auto rounded-lg border border-slate-200 object-contain"
              />
              <button
                onClick={() => setForm((p) => ({ ...p, logo: undefined }))}
                className="text-xs text-red-500 hover:text-red-700 font-bold"
              >
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
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
