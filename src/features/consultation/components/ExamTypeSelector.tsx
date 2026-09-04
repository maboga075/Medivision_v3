import type { Doctor } from '../../../types/settings';
import DoctorCombobox from '../../../components/forms/DoctorCombobox';

interface ExamTypeSelectorProps {
  selectedDoctorId: string;
  onDoctorChange: (id: string) => void;
  doctors?: Doctor[];
}

/**
 * Sélecteur du médecin examinateur. Le « Type d'examen » a été retiré : les
 * options (OCTA, segment antérieur…) sont désormais déduites automatiquement des
 * templates ajoutés dans RetinaSketch.
 */
export default function ExamTypeSelector({
  selectedDoctorId,
  onDoctorChange,
  doctors,
}: ExamTypeSelectorProps) {
  if (!doctors || doctors.length === 0) return null;
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-center gap-4">
      <label className="text-sm font-black uppercase text-slate-500 tracking-wider">
        Médecin examinateur
      </label>
      <DoctorCombobox
        doctors={doctors}
        selectedId={selectedDoctorId}
        onChange={onDoctorChange}
      />
    </div>
  );
}
