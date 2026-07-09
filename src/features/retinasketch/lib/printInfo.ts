/**
 * Informations cliniques/patient affichées en en-tête lors de l'impression et de
 * l'export PDF de RetinaSketch. Fournies par l'application hôte (consultation).
 */
export interface RetinaPrintInfo {
  patientName?: string;
  patientAge?: string;
  folderId?: string;
  date?: string;
  motifs?: string;
  doctor?: string;
  clinic?: string;
}
