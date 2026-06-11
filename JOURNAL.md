# Journal de développement — Medivision Studio

> Ce fichier est mis à jour à chaque session de travail.
> Il sert de fil conducteur entre Claude et le développeur.

---

## État général du projet

**Branche active :** `v3`  
**Dernière session :** 2026-06-11  
**Build :** ✅ Compilé sans erreurs  
**Stack :** React + TypeScript + Vite · Firebase (Auth + Firestore) · Tailwind CSS · Konva (RetinaSketch) · Framer Motion

---

## Architecture — Vue rapide

```
src/
├── components/
│   ├── forms/          EyeExamSection, BubblePicker, RnflGclPicker
│   ├── reports/
│   │   ├── visual/     VisualClinicalSection, NeuroRings, CDGauge, RetinaSchemaSvg
│   │   └── OCTReport.css
│   ├── settings/       ClinicTab, DoctorsTab, FormulaireTab, LesionsTab (new), ExportTab
│   └── shared/
├── features/
│   └── retinasketch/   RetinaEditor, RetinaStage, CommandPalette, store, ontologie
├── hooks/              useSettings, useConsultationDrafts, useSuggestions…
├── pages/              Parametres, Patients, Login
├── services/           firebase, aiManager, pdfExportService, printService…
├── types/              clinical, report, settings, ai…
└── utils/              aiPayload, rnflGcl, clinicalPayload…
```

---

## Historique des sessions

---

### Session 2026-06-11 — Mise à jour V1

**Demandé par :** Yoan  
**Statut :** ✅ Terminé, build OK

#### Rapport visuel (VisualClinicalSection + NeuroRings + CDGauge + CSS)
- [x] **C/D** transformé de jauge horizontale en **petite barre verticale compacte** (CDGauge.tsx)
  - Gradient vert (0) → rouge (1) de bas en haut
  - Curseur horizontal mobile selon la valeur
  - Titre "C/D" + valeur en mono sous la barre
  - Placé à l'extrémité droite des anneaux, séparé par une fine ligne
- [x] **Anneaux RNFL et GCL agrandis** : 62px → 80px (OCTReport.css)
- [x] **Labels de localisation** ajoutés sur les deux anneaux : S · I · T · N  
  (miroir nasal/temporal selon OD/OG — NeuroRings.tsx)
- [x] **Encadrement supprimé** autour du bloc RNFL/GCL (`.vc-neuro` sans border)
- [x] **Encadrement `.vc-schema`** allégé (plus de border)
- [x] **Légende des lésions** déplacée sous le schéma rétinien de chaque œil (par œil)
- [x] **Légende sévérité** RNFL/GCL (Normal/Limite/Hors norme) placée une fois en bas, partagée

#### Formulaire (EyeExamSection)
- [x] Suppression des **BubblePicker Macula / Papille / Périphérie**
- [x] Suppression de **Notes additionnelles** (`obsFree`)
- [x] Conservé : RetinaSketch · Segment antérieur (optionnel) · OCTA (optionnel) · **Divers**

#### Paramètres (Parametres.tsx + FormulaireTab + nouveau LesionsTab)
- [x] Suppression des catégories Macula / Papille / Périphérie dans **FormulaireTab**
  - Conservées : Motifs médicaux · Antécédents · Diagnostics fréquents
- [x] **Nouvel onglet "Lésions"** dans Paramètres (LesionsTab.tsx)
  - Visualisation des 15 lésions intégrées (lecture seule + couleur)
  - CRUD des lésions personnalisées (nom · couleur · catégorie)
  - Sauvegarde Firebase via `updateCustomLesions()`

#### RetinaSketch — CommandPalette
- [x] **Création en live** : si aucune lésion trouvée → bouton "Créer « x »"
  - Mini-formulaire inline : sélecteur couleur + catégorie
  - Assignation immédiate à l'annotation en brouillon
  - Sauvegarde async Firebase

#### Architecture lésions — extension dynamique
- [x] `lesions.ts` : registre `_customLesions` + `setCustomLesions()` + `getAllLesions()`
- [x] `getLesion()` cherche dans built-in + custom
- [x] `searchLesions()` inclut les lésions custom
- [x] `useSettings` : synchro automatique du registre au chargement + à chaque persist
- [x] `types/settings.ts` : interface `CustomLesion` + champ `customLesions?` dans `AppSettings`

---

## Tâches en attente / Idées futures

> Mettre à jour cette section à chaque session

### Priorité haute
- [ ] **Vérifier visuellement** le rendu de la barre C/D verticale et des anneaux agrandis  
  (démarrer le dev server et screenshot)
- [ ] Tester la création de lésion en live dans RetinaSketch (CommandPalette)
- [ ] Vérifier que les lésions custom apparaissent bien dans la palette de recherche après rechargement

### Priorité normale
- [ ] Le formulaire "Divers" → vérifier que son contenu est bien transmis à l'IA dans le payload
- [ ] OCTA et Segment antérieur : tester les toggles dans le formulaire consultation
- [ ] Export PDF : vérifier que les nouveaux styles CSS (barre C/D, anneaux 80px) s'impriment correctement
- [ ] Tester la compatibilité des anciens rapports sauvegardés (sans secteurs RNFL/GCL)

### Idées à discuter
- [ ] Ajouter un indicateur "%" de remplissage sur les secteurs RNFL/GCL (ex: 3/4 secteurs hors norme)
- [ ] Mode comparaison : afficher côte à côte deux visites pour le même patient
- [ ] Export image du schéma rétinien seul (PNG) pour intégration dans d'autres CR

---

## Décisions architecturales importantes

| Date | Décision | Raison |
|------|----------|--------|
| 2026-06-11 | Lésions custom stockées dans Firestore (settings doc) | Cohérence avec le reste des paramètres, pas de collection séparée |
| 2026-06-11 | Registre `_customLesions` en module-level (non React) | `getLesion()` est appelée depuis des utilitaires sans contexte React |
| 2026-06-11 | Sync registre dans `useSettings.persist()` | Évite un contexte React dédié, garantit la cohérence après toute écriture |

---

## Bugs connus / Points de vigilance

- **`useSuggestions` hook** importé dans `EyeExamSection` mais plus utilisé (BubblePicker Macula/Papille/Péri supprimés) → peut être retiré si aucun autre usage
- **`onNewSuggestion` prop** gardée dans l'interface (compatibilité descendante) mais plus appelée en interne
- **Chunk size warning** au build (>500 KB) — existait avant nos changements, non bloquant

---

## Notes de session

### 2026-06-11
- Explication fournie de la logique IA : les annotations dessinées sont converties en phrases cliniques structurées par `generate.ts`, intégrées dans le payload JSON envoyé à l'IA. L'IA ne voit pas l'image — elle travaille sur les attributs géométriques calculés (zone anatomique, quadrant, secteur ETDRS).
- Lésions custom créées en live dans la palette ont exactement le même traitement que les lésions intégrées.

---

*Mis à jour automatiquement par Claude · Format : Markdown*
