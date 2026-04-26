import { forwardRef } from 'react';
import { CheckCircle, Stethoscope } from 'lucide-react';
import { EditableInline, EditableSection, EditableBlock } from '../shared/EditableText';
import ReportDataTable from '../reports/ReportDataTable';
import type { ReportData, ReportEdits } from '../../types/report';

interface ReportTemplateProps {
  data: ReportData;
  edits: ReportEdits;
  onEdit: (field: string, value: string) => void;
}

// Couleurs selon sévérité
const SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: string; label: string }> = {
  normal: {
    border: 'border-green-200',
    bg: 'bg-green-50',
    icon: 'text-green-600',
    label: 'Examen dans les normes',
  },
  surveillance: {
    border: 'border-orange-200',
    bg: 'bg-orange-50',
    icon: 'text-orange-600',
    label: 'Surveillance recommandée',
  },
  alerte: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    icon: 'text-red-600',
    label: 'Anomalie significative',
  },
};

const getVal = (edits: ReportEdits, field: string, fallback: string | undefined): string =>
  edits[field] !== undefined ? edits[field] : (fallback ?? '—');

// ─── Page 1 : Compte rendu principal ───────────────────────────────────────

const ReportPage = forwardRef<HTMLDivElement, ReportTemplateProps>(
  ({ data, edits, onEdit }, ref) => {
    const { context, eyes, aiResult } = data;
    const { oeilDroit, oeilGauche } = eyes;
    const safeInterp = aiResult.interpretation ?? {};
    const safeRecos = aiResult.recommandations ?? { hygiene: '—', suivi: '—' };
    const severite = aiResult.severite ?? 'normal';
    const sevStyle = SEVERITY_STYLES[severite] ?? SEVERITY_STYLES['normal'];

    return (
      <div
        ref={ref}
        className="report-page bg-white shadow-2xl mx-auto w-full max-w-[210mm] p-[10mm] text-slate-900 border border-slate-100 flex flex-col relative box-border mb-8 print:mb-0"
      >
        {/* Filigrane */}
        <div className="absolute top-8 right-8 opacity-[0.03] pointer-events-none no-print">
          <Stethoscope className="w-48 h-48" />
        </div>

        {/* En-tête */}
        <div className="flex justify-between items-start border-b-4 border-[#0C2233] pb-2 mb-3">
          <div>
            <h1 className="text-3xl font-black text-[#0C2233] leading-none">CLINIQUE MEDIVISION</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
              Ophtalmologie · Libreville, Gabon
            </p>
          </div>
          <div className="text-right">
            <div className="text-teal-600 font-bold text-lg">
              <EditableInline value={getVal(edits, 'type_cr', context.typeExamen)} field="type_cr" onEdit={onEdit} />
            </div>
            <div className="text-slate-400 text-xs font-medium mt-0.5">
              <EditableInline value={getVal(edits, 'date_examen', new Date(context.dateExamen + 'T12:00:00').toLocaleDateString('fr-FR'))} field="date_examen" onEdit={onEdit} />
            </div>
          </div>
        </div>

        {/* Bandeau patient */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 grid grid-cols-4 gap-2 mb-3">
          <div>
            <p className="text-[10px] font-bold text-[#0C2233] uppercase mb-0.5">Patient</p>
            <div className="text-[11px] text-slate-600 font-semibold">
              <EditableInline value={getVal(edits, 'patient_nom', context.patientNom)} field="patient_nom" onEdit={onEdit} />
              {' — '}
              <EditableInline value={getVal(edits, 'patient_age', String(context.patientAge))} field="patient_age" onEdit={onEdit} />
              {' ans'}
            </div>
          </div>
          <div className="border-l border-slate-200 pl-2">
            <p className="text-[10px] font-bold text-[#0C2233] uppercase mb-0.5">Prescripteur</p>
            <div className="text-[11px] text-slate-600 font-semibold">
              <EditableInline value={getVal(edits, 'prescripteur', context.prescripteur ?? '—')} field="prescripteur" onEdit={onEdit} />
            </div>
          </div>
          <div className="border-l border-slate-200 pl-2">
            <p className="text-[10px] font-bold text-[#0C2233] uppercase mb-0.5">Motif(s)</p>
            <div className="text-[11px] text-slate-600 italic leading-tight">
              <EditableInline value={getVal(edits, 'motifs', context.motifs.join(' · ') || '—')} field="motifs" onEdit={onEdit} />
            </div>
          </div>
          <div className="border-l border-slate-200 pl-2">
            <p className="text-[10px] font-bold text-[#0C2233] uppercase mb-0.5">Antécédents</p>
            <div className="text-[11px] text-slate-600 italic leading-tight">
              <EditableInline value={getVal(edits, 'antecedents', context.antecedents.join(', ') || '—')} field="antecedents" onEdit={onEdit} />
            </div>
          </div>
        </div>

        {/* Tableaux de données cliniques */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          {context.showAnterior && (
            <ReportDataTable
              title="Segment Antérieur"
              edits={edits}
              onEdit={onEdit}
              rows={[
                {
                  label: 'Pachymétrie',
                  od: oeilDroit.cornealThickness ? oeilDroit.cornealThickness + ' µm' : '—',
                  og: oeilGauche.cornealThickness ? oeilGauche.cornealThickness + ' µm' : '—',
                  fieldOD: 'ant_pachy_od',
                  fieldOG: 'ant_pachy_og',
                },
                {
                  label: 'Cornée',
                  od: (oeilDroit.obsAnterieur ?? []).join(', ') || '—',
                  og: (oeilGauche.obsAnterieur ?? []).join(', ') || '—',
                  fieldOD: 'ant_obs_od',
                  fieldOG: 'ant_obs_og',
                },
              ]}
            />
          )}

          {context.showPosterior && (
            <ReportDataTable
              title="Mesures OCT / RNFL"
              edits={edits}
              onEdit={onEdit}
              rows={[
                { label: 'RNFL', od: oeilDroit.rnfl?.status ?? '—', og: oeilGauche.rnfl?.status ?? '—', fieldOD: 'oct_rnfl_od', fieldOG: 'oct_rnfl_og' },
                { label: 'GCL++', od: oeilDroit.gcl?.status ?? '—', og: oeilGauche.gcl?.status ?? '—', fieldOD: 'oct_gcl_od', fieldOG: 'oct_gcl_og' },
                { label: 'Cup/Disc (V)', od: oeilDroit.cupDisc || '—', og: oeilGauche.cupDisc || '—', fieldOD: 'oct_cd_od', fieldOG: 'oct_cd_og', isCupDisc: true },
                { label: 'Surface Disque', od: oeilDroit.discSurface ? oeilDroit.discSurface + ' mm²' : '—', og: oeilGauche.discSurface ? oeilGauche.discSurface + ' mm²' : '—', fieldOD: 'oct_surf_od', fieldOG: 'oct_surf_og', isSurface: true },
              ]}
            />
          )}

          {context.showPosterior && (
            <ReportDataTable
              title="Analyse Fond d'Œil"
              edits={edits}
              onEdit={onEdit}
              rows={[
                { label: 'Papille', od: (oeilDroit.observationsPapille ?? []).join(', ') || '—', og: (oeilGauche.observationsPapille ?? []).join(', ') || '—', fieldOD: 'ret_papille_od', fieldOG: 'ret_papille_og' },
                { label: 'Macula', od: (oeilDroit.observationsMacula ?? []).join(', ') || '—', og: (oeilGauche.observationsMacula ?? []).join(', ') || '—', fieldOD: 'ret_macula_od', fieldOG: 'ret_macula_og' },
              ]}
            />
          )}
        </div>

        {/* Interprétation médicale IA */}
        <div className="mb-3 interpretation-block">
          <div className="text-[11px] font-extrabold text-[#2A9D8F] uppercase tracking-wider mb-1 border-b-2 border-[#2A9D8F33] pb-1">
            Interprétation Médicale
          </div>
          <div className="space-y-0">
            {safeInterp.segment_anterieur && (
              <EditableSection label="Segment Antérieur" value={getVal(edits, 'segment_anterieur', safeInterp.segment_anterieur)} field="segment_anterieur" onEdit={onEdit} />
            )}
            {safeInterp.macula_od && (
              <EditableSection label="Macula OD" value={getVal(edits, 'macula_od', safeInterp.macula_od)} field="macula_od" onEdit={onEdit} />
            )}
            {safeInterp.macula_og && (
              <EditableSection label="Macula OG" value={getVal(edits, 'macula_og', safeInterp.macula_og)} field="macula_og" onEdit={onEdit} />
            )}
            {safeInterp.papille_od && (
              <EditableSection label="Papille OD" value={getVal(edits, 'papille_od', safeInterp.papille_od)} field="papille_od" onEdit={onEdit} />
            )}
            {safeInterp.papille_og && (
              <EditableSection label="Papille OG" value={getVal(edits, 'papille_og', safeInterp.papille_og)} field="papille_og" onEdit={onEdit} />
            )}
            {safeInterp.rnfl_od && (
              <EditableSection label="RNFL OD" value={getVal(edits, 'rnfl_od', safeInterp.rnfl_od)} field="rnfl_od" onEdit={onEdit} />
            )}
            {safeInterp.rnfl_og && (
              <EditableSection label="RNFL OG" value={getVal(edits, 'rnfl_og', safeInterp.rnfl_og)} field="rnfl_og" onEdit={onEdit} />
            )}
            {safeInterp.gcl_od && (
              <EditableSection label="GCL++ OD" value={getVal(edits, 'gcl_od', safeInterp.gcl_od)} field="gcl_od" onEdit={onEdit} />
            )}
            {safeInterp.gcl_og && (
              <EditableSection label="GCL++ OG" value={getVal(edits, 'gcl_og', safeInterp.gcl_og)} field="gcl_og" onEdit={onEdit} />
            )}
            {safeInterp.peripherie && (
              <EditableSection label="Périphérie" value={getVal(edits, 'peripherie', safeInterp.peripherie)} field="peripherie" onEdit={onEdit} />
            )}
            {safeInterp.octa && (
              <EditableSection label="OCTA" value={getVal(edits, 'octa', safeInterp.octa)} field="octa" onEdit={onEdit} />
            )}
          </div>
        </div>

        {/* Conclusion */}
        <div className={`conclusion-block p-2.5 rounded-xl mb-3 border-2 ${sevStyle.bg} ${sevStyle.border}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className={`w-3.5 h-3.5 ${sevStyle.icon}`} />
            <span className="text-[10px] font-bold text-[#0C2233] uppercase">Conclusion</span>
            <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full ${sevStyle.bg} ${sevStyle.icon} border ${sevStyle.border}`}>
              {sevStyle.label}
            </span>
          </div>
          <EditableBlock
            value={getVal(edits, 'conclusion', aiResult.conclusion)}
            field="conclusion"
            onEdit={onEdit}
            className="text-[11px] italic text-slate-800 leading-relaxed p-1 rounded"
          />
        </div>

        {/* Recommandations */}
        <div className="recommandations-block grid grid-cols-2 gap-3 mb-2">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <p className="text-[10px] font-bold text-[#0C2233] uppercase mb-1">Hygiène & Prévention</p>
            <EditableBlock
              value={getVal(edits, 'hygiene', safeRecos.hygiene)}
              field="hygiene"
              onEdit={onEdit}
              className="text-[11px] text-slate-600 leading-snug"
            />
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <p className="text-[10px] font-bold text-[#0C2233] uppercase mb-1">Suivi Recommandé</p>
            <EditableBlock
              value={getVal(edits, 'suivi', safeRecos.suivi)}
              field="suivi"
              onEdit={onEdit}
              className="text-[11px] text-slate-600 leading-snug"
            />
          </div>
        </div>

        {/* Pied de page */}
        <div className="w-full mt-auto pt-2 border-t border-slate-100 flex justify-between items-end pb-1">
          <p className="text-[8px] text-slate-400">Libreville · Document généré par Medivision</p>
          <div className="text-right">
            <p className="text-sm font-bold text-[#0C2233]">Dr. Yoan MBOUSSOU</p>
            <p className="text-[9px] text-slate-500 tracking-tighter uppercase">Imagerie Rétinienne</p>
          </div>
        </div>
      </div>
    );
  }
);

ReportPage.displayName = 'ReportPage';

// ─── Page 2 : Annexes iconographiques ──────────────────────────────────────

interface AnnexesPageProps {
  data: ReportData;
}

export const AnnexesPage = forwardRef<HTMLDivElement, AnnexesPageProps>(({ data }, ref) => {
  const { context, eyes } = data;
  const { oeilDroit, oeilGauche } = eyes;
  const hasImages = oeilDroit.images.length > 0 || oeilGauche.images.length > 0;

  if (!hasImages) return null;

  return (
    <div
      ref={ref}
      className="report-page bg-white shadow-2xl mx-auto w-full max-w-[210mm] p-[10mm] text-slate-900 border border-slate-100 flex flex-col relative box-border mt-8 print:mt-0"
    >
      <div className="border-b-4 border-[#0C2233] pb-2 mb-4">
        <h2 className="text-2xl font-black text-[#0C2233]">Annexes Iconographiques</h2>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
          Patient : {context.patientNom} · Date : {new Date(context.dateExamen + 'T12:00:00').toLocaleDateString('fr-FR')}
        </p>
      </div>

      {oeilDroit.images.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-teal-700 uppercase mb-3 border-b border-teal-100 pb-1">
            Œil Droit (OD)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {oeilDroit.images.map((img, i) => (
              <div key={i} className="border border-slate-200 p-2 rounded-lg bg-slate-50">
                <img src={img.data} alt={`OD-${i + 1}`} className="w-full h-auto object-contain rounded" style={{ maxHeight: 250 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {oeilGauche.images.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-teal-700 uppercase mb-3 border-b border-teal-100 pb-1">
            Œil Gauche (OG)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {oeilGauche.images.map((img, i) => (
              <div key={i} className="border border-slate-200 p-2 rounded-lg bg-slate-50">
                <img src={img.data} alt={`OG-${i + 1}`} className="w-full h-auto object-contain rounded" style={{ maxHeight: 250 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="w-full mt-auto pt-2 border-t border-slate-100 flex justify-between items-end pb-1">
        <p className="text-[8px] text-slate-400">Libreville · Annexes</p>
        <div className="text-right">
          <p className="text-sm font-bold text-[#0C2233]">Dr. Yoan MBOUSSOU</p>
          <p className="text-[9px] text-slate-500 tracking-tighter uppercase">Imagerie Rétinienne</p>
        </div>
      </div>
    </div>
  );
});

AnnexesPage.displayName = 'AnnexesPage';

export default ReportPage;
