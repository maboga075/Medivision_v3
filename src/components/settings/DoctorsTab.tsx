import { useState, type ChangeEvent } from 'react';
import { UserPlus, Trash2, Star, StarOff, Stethoscope } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import type { AppSettings, Doctor } from '../../types/settings';

interface Props { settings: AppSettings }

const EMPTY_FORM = { nom: '', prenom: '', specialite: 'Ophtalmologiste', numeroOrdre: '' };

export default function DoctorsTab({ settings }: Props) {
  const { addDoctor, deleteDoctor, setDefaultPrescriber } = useSettings();
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleAdd = async () => {
    if (!form.nom.trim() || !form.prenom.trim()) {
      showToast('Nom et prénom requis');
      return;
    }
    setAdding(true);
    try {
      await addDoctor(form);
      setForm(EMPTY_FORM);
      showToast('Médecin ajouté');
    } catch {
      showToast('Erreur lors de l\'ajout');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (d: Doctor) => {
    if (!window.confirm(`Supprimer Dr. ${d.prenom} ${d.nom} ?`)) return;
    try {
      await deleteDoctor(d.id);
      showToast('Médecin supprimé');
    } catch {
      showToast('Erreur lors de la suppression');
    }
  };

  const handleToggleDefault = async (d: Doctor) => {
    const next =
      settings.medecinPrescripteurParDefaut === d.id ? undefined : d.id;
    await setDefaultPrescriber(next);
    showToast(next ? `Dr. ${d.prenom} ${d.nom} défini comme prescripteur par défaut` : 'Prescripteur par défaut retiré');
  };

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl animate-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}

      {/* Formulaire ajout */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-teal-600" />
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Ajouter un médecin</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nom</label>
            <input
              type="text" name="nom" value={form.nom} onChange={handleChange}
              className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
              placeholder="MBOUSSOU"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Prénom</label>
            <input
              type="text" name="prenom" value={form.prenom} onChange={handleChange}
              className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
              placeholder="Yoan"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Spécialité</label>
            <input
              type="text" name="specialite" value={form.specialite} onChange={handleChange}
              className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
              placeholder="Ophtalmologiste"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">N° Ordre</label>
            <input
              type="text" name="numeroOrdre" value={form.numeroOrdre} onChange={handleChange}
              className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
              placeholder="GA-12345"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={adding}
          className="mt-4 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-60"
        >
          <UserPlus className="w-4 h-4" />
          {adding ? 'Ajout…' : 'Ajouter'}
        </button>
      </div>

      {/* Liste */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Stethoscope className="w-5 h-5 text-slate-500" />
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
            Équipe médicale ({settings.doctors.length})
          </h3>
        </div>

        {settings.doctors.length === 0 ? (
          <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucun médecin enregistré.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {settings.doctors.map((d) => {
              const isDefault = settings.medecinPrescripteurParDefaut === d.id;
              return (
                <div
                  key={d.id}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-colors ${
                    isDefault ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div>
                    <div className="font-extrabold text-slate-800 flex items-center gap-2">
                      Dr. {d.prenom} {d.nom}
                      {isDefault && (
                        <span className="text-[10px] font-black text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Prescripteur par défaut
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 font-medium mt-0.5">
                      {d.specialite}{d.numeroOrdre && ` · ${d.numeroOrdre}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleDefault(d)}
                      title={isDefault ? 'Retirer comme prescripteur par défaut' : 'Définir comme prescripteur par défaut'}
                      className={`p-2 rounded-xl transition-colors ${
                        isDefault
                          ? 'text-teal-600 bg-teal-100 hover:bg-teal-200'
                          : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                      }`}
                    >
                      {isDefault ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
