// Types pour les données patient

import { Timestamp } from 'firebase/firestore';

export type Sexe = 'M' | 'F';

export interface PatientFirestore {
  id: string;
  folderId?: string;
  nom: string;
  sexe?: Sexe;
  age: number | string;
  dateNaissance: string;
  motifs: string[];
  antecedents: string[];
  tel?: string;
  email?: string;
  /** Traitements en cours (noms libres). Vide = « traitement non renseigné ». */
  traitements: string[];
  medecinPrescripteur?: string;
  dateExamen: string;
  statut: 'en_attente' | 'traite';
  createdAt: Timestamp | null;
  date: Date;
}

export interface PatientFormData {
  folderId: string;
  nom: string;
  sexe: '' | Sexe;
  dateNaissance: string;
  motifs: string[];
  antecedents: string[];
  tel: string;
  email: string;
  /** Traitements en cours (noms libres). Vide = « traitement non renseigné ». */
  traitements: string[];
  medecinPrescripteur: string;
  dateExamen: string;
}
