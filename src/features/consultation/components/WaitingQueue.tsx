import { useState } from 'react';
import { Users, Clock, UserPlus, Trash2 } from 'lucide-react';
import { archiveAllWaitingPatients } from '../../../services/waitingRoomService';
import { useToast } from '../../../components/shared/ToastProvider';
import type { PatientFirestore } from '../../../types/patient';

interface WaitingQueueProps {
  patients: PatientFirestore[];
  selectedPatient: PatientFirestore | null;
  isAnalyzing: boolean;
  onSelectPatient: (p: PatientFirestore) => void;
  onNewDayConfirmed: () => void;
}

export default function WaitingQueue({
  patients,
  selectedPatient,
  isAnalyzing,
  onSelectPatient,
  onNewDayConfirmed,
}: WaitingQueueProps) {
  const [showModal, setShowModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [toast, setToast] = useState('');
  const { notify } = useToast();

  const handleConfirmNewDay = async () => {
    setIsPurging(true);
    try {
      const result = await archiveAllWaitingPatients();
      onNewDayConfirmed();
      setShowModal(false);
      const n = result.archived;
      setToast(`${n} patient${n > 1 ? 's' : ''} archivé${n > 1 ? 's' : ''} — nouvelle journée démarrée`);
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      console.error('[WaitingQueue] Erreur nouvelle journée:', err);
      setShowModal(false);
      notify("Erreur lors de l'archivage des patients.", 'error');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <>
      <aside className="w-full sm:w-80 md:w-96 lg:w-[400px] bg-white border-r border-slate-200 h-full flex flex-col z-10 shrink-0">
        <div className="p-6 border-b border-slate-200 bg-white flex items-center justify-between sticky top-0">
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
            <Users className="w-6 h-6 text-teal-600" /> Salle d'attente
          </h2>
          <div className="flex items-center gap-2">
            {patients.length > 0 && (
              <button
                onClick={() => setShowModal(true)}
                title="Nouvelle journée — archiver tous les patients"
                className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <span className="bg-teal-100 text-teal-800 text-sm font-bold px-3 py-1 rounded-full">
              {patients.length}
            </span>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4 bg-slate-50/50">
          {patients.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center">
              <UserPlus className="w-12 h-12 text-slate-300 mb-4" />
              <div className="text-slate-500 font-medium">Aucun patient en attente.</div>
            </div>
          ) : (
            patients.map((p) => (
              <div
                key={p.id}
                onClick={() => !isAnalyzing && onSelectPatient(p)}
                className={`p-5 rounded-2xl border-2 transition-all select-none ${
                  isAnalyzing
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer active:scale-95'
                } ${
                  selectedPatient?.id === p.id
                    ? 'bg-teal-50 border-teal-500 shadow-sm'
                    : 'bg-white border-transparent shadow-sm hover:border-teal-200 hover:shadow'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-extrabold text-slate-800 text-lg sm:text-xl">{p.nom}</h3>
                  <span className="text-sm font-bold text-slate-400 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg">
                    <Clock className="w-4 h-4" />{' '}
                    {p.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-500 mb-3">
                  {p.age} ans {p.folderId && `• Dossier : ${p.folderId}`}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.motifs?.slice(0, 2).map((m) => (
                    <span
                      key={m}
                      className="px-3 py-1.5 bg-orange-50/80 text-orange-700 text-xs font-bold rounded-lg"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full">
            <h3 className="text-xl font-extrabold text-slate-800 mb-2">Nouvelle journée ?</h3>
            <p className="text-slate-500 text-sm font-medium mb-1">
              {patients.length} patient{patients.length > 1 ? 's' : ''} en attente
              {patients.length > 1 ? ' seront archivés' : ' sera archivé'}.
            </p>
            <p className="text-red-500 text-xs font-bold mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={isPurging}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmNewDay}
                disabled={isPurging}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isPurging ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Archivage…
                  </>
                ) : (
                  'Confirmer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}
