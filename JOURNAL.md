# Journal de développement — Medivision Studio

> Ce fichier est mis à jour à chaque session de travail.
> Il sert de fil conducteur entre Claude et le développeur.

---

## État général du projet

**Branche active :** `feat/retinasketch-v2-port`  
**Dernière session :** 2026-08-12  
**Build :** ✅ Compilé sans erreurs (`tsc` app + node, 18 tests Vitest verts, `vite build` OK)  
**Stack :** React + TypeScript + Vite · Firebase (Auth + Firestore) · Tailwind CSS · Konva + ONNX Runtime Web (RetinaSketch) · Framer Motion · jsPDF · Fonctions serverless Vercel (`api/ai`)

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
│   └── retinasketch/   RetinaEditor, RetinaStage, CommandPalette, DrawToolControls,
│                       BackgroundControls/Image, RetinaImageFilters, store, ontologie,
│                       lib/image/filters (tons+netteté), lib/ai (SAM, disque/cup ONNX)
├── hooks/              useSettings, useConsultationDrafts, useSuggestions…
├── pages/              Parametres, Patients, Login
├── services/           firebase, aiManager, pdfExportService, printService…
├── types/              clinical, report, settings, ai…
└── utils/              aiPayload, rnflGcl, clinicalPayload…

api/ai/generate-report  Fonction serverless (OpenAI/Anthropic/Gemini/DeepSeek).
                        En dev, servie par le pont `api/**` de vite.config.ts.
```

---

## Historique des sessions

---

### Session 2026-08-12 — RetinaSketch : colorimétrie, annotations, + 3 correctifs

**Demandé par :** Yoan
**Statut :** ✅ Terminé — `tsc --noEmit` (app + node) 0 erreur, 18 tests Vitest verts, `vite build` OK
**Branche :** `feat/retinasketch-v2-port`

#### RetinaSketch — évolutions (colorimétrie & annotations)
- [x] **Fix décalage annotations / photo à l'impression** : dans l'éditeur les annotations sont rendues SOUS le transform de la photo (elles suivent zoom/pan/rotation), mais le compte rendu n'appliquait ce transform qu'à l'image. → [`RetinaSchemaSvg.tsx`](src/components/reports/visual/RetinaSchemaSvg.tsx) : un `alignTransform` unique enveloppe désormais l'image ET les annotations (clip circulaire conservé à l'extérieur). Le PDF Konva était déjà correct (capture du Stage).
- [x] **Netteté + tons** (Netteté, Hautes lumières, Ombres, Point blanc, Point noir) : non exprimables en `filter` CSS natif. Nouveau module unique [`lib/image/filters.ts`](src/features/retinasketch/lib/image/filters.ts) (courbe tonale `feComponentTransfer` + noyau de netteté `feConvolveMatrix` + chaîne CSS + pré-passe canvas) et composant [`RetinaImageFilters.tsx`](src/features/retinasketch/components/RetinaImageFilters.tsx). Temps réel via filtre SVG (éditeur + CR), export PDF via pré-passe pixels. 5 curseurs section « Tons & netteté » dans `BackgroundControls`.
- [x] **Couleur choisie à la création d'une lésion** : `CommandPalette` propose une rangée de pastilles + sélecteur libre ; signature `onCreateLesion(name, color)` propagée jusqu'à `Consultation.tsx`. Palette `RETINA_LESION_COLORS` déplacée dans `ontology/lesions.ts` (DRY, était dupliquée).
- [x] **Opacité globale des annotations** : nouvel en-tête [`DrawToolControls.tsx`](src/features/retinasketch/components/DrawToolControls.tsx) (curseur), appliquée à l'écran (RetinaStage) et persistée jusqu'au CR via la chaîne `retinaAnnotationOpacity` (clinical/report/mapper/RetinaEditor commit).
- [x] **Outil flèche** (couleur de la lésion) : `kind: "arrow"` ajouté au modèle Zod, store (`drawTool`, `addArrow`), tracé + rendu Konva `Arrow` + hit-test sélection, rendu SVG dans le CR (`renderArrow`). Les flèches sont EXCLUES des décomptes du texte clinique (`generate.ts`) — pure désignation.
- [x] **Compatibilité** : tous les champs ajoutés (tons, opacité, flèche) sont optionnels à défaut neutre → les CR déjà enregistrés restent valides.

#### Outillage — tenue du journal
- [x] **Rattrapage de ce journal** : les sessions 2026-07-09→08-12 n'avaient pas été consignées ; ajoutées rétroactivement.
- [x] **Hook `Stop`** ([`.claude/settings.json`](.claude/settings.json) → [`.claude/hooks/journal-reminder.sh`](.claude/hooks/journal-reminder.sh)) : rappelle à Claude de mettre à jour `JOURNAL.md` en fin de tâche si `src/`/`api/` ont changé sans le journal. Anti-boucle via `stop_hook_active` (un seul rappel) + condition qui s'éteint dès que le journal est touché.

#### Correctifs
- [x] **Boutons Sexe débordant en mobile** : section « Identité » en `grid-cols-2` (mobile) → « Homme »/« Femme » débordent. Simplifiés en **H / F** + `min-w-0` + `aria-label`/`title` (accessibilité), dans `Accueil.tsx` et `PatientEditModal.tsx`.
- [x] **RetinaSketch « Terminé » avec lésion en cours** : `f3c97d7` avait rendu le `window.confirm` bloquant ET supprimait les brouillons. → [`RetinaEditor.tsx`](src/features/retinasketch/components/RetinaEditor.tsx) : confirmation rétablie (« Voulez-vous quand même fermer ? »), *Annuler* revient à l'éditeur, *OK* ferme SANS supprimer (brouillons conservés, inertes dans les CR).
- [x] **Serveur IA cassé en dev local** : depuis la sécurisation de l'IA (`62e17e9`), les appels passent par la fonction serverless `/api/ai/generate-report` ; `vite dev` n'exécute pas `api/*` et aucun proxy n'existait → `/api/...` tombait sur le fallback SPA (HTML). → plugin Vite **dev-only** dans [`vite.config.ts`](vite.config.ts) qui exécute `api/**` localement (adaptateur req/res au contrat Vercel). Vérifié : ping `200 {configured:true, provider:"openai", model:"gpt-5.5"}`. Aucun impact prod (`apply:'serve'`).
  - ⚠️ Si l'IA est aussi cassée sur le **déploiement Vercel**, cause distincte : `.env.local` n'est pas déployé → vérifier `AI_PROVIDER`/`AI_MODEL`/clé dans les *Environment Variables* du projet Vercel.

---

### Session 2026-07-09 → 07-11 — Port RetinaSketch v2 (IA papille/cup, SAM, 3 comptes rendus)

**Demandé par :** Yoan
**Statut :** ✅ Terminé (commits `245c17b`, `58d259c`, `f3c97d7`)
**Note :** session reconstituée a posteriori depuis les messages de commit (journal non tenu à l'époque).

- [x] **Port RetinaSketch v2** (`245c17b`) : recadrage automatique à l'import (centre + remplit le champ, supprime le liseré noir), overlays SAM / anatomie / alignement, double vue, contrôles de fond, panneau d'apprentissage. Ajout des dépendances `jspdf` et `onnxruntime-web`. Création de `vercel.json` (`framework: vite`).
- [x] **Détection IA papille/cup + SAM** (`58d259c`) : modèles ONNX (W-Net disque + excavation), segmentation au clic.
- [x] **Comptes rendus** (`245c17b`, `f3c97d7`) : gras réservé aux noms de maladies/symptômes, latéralité explicite « œil droit/gauche », rétinographie A4 paysage (images pleine largeur en haut, texte dessous), indice d'acquisition faible en bulle unique, spots transparents, garde-fou lésions, papille/macula détectées séparément, 3 variantes de comptes rendus.
- [x] **IA** : directives de mise en forme (gras maladies uniquement) + prise en compte de l'indice d'acquisition (nuancer/exclure RNFL-GCL si qualité faible).

---

### Session 2026-06-14 — Audit + combobox motifs/antécédents + fiabilisation + tests

**Demandé par :** Yoan
**Statut :** ✅ Terminé — `tsc --noEmit` 0 erreur, build OK, **18 tests Vitest verts**

#### Combobox motifs / antécédents (nouveau composant)
- [x] **`TagAutocomplete`** ([components/forms/TagAutocomplete.tsx](src/components/forms/TagAutocomplete.tsx)) : champ de saisie + liste déroulante filtrée (façon RetinaSketch), chips supprimables, navigation clavier (↑↓ ↵ échap), création « Ajouter / garder », exclusivité « Sans particularité ».
- [x] Intégré dans **`Accueil`** et **`PatientEditModal`** (remplace le mur de boutons + « Autre », supprime la duplication de logique). États morts retirés (customMotifs/showAddMotif/…).

#### Audit — nettoyage
- [x] **Code mort supprimé** : `Medivision_Monolith.jsx` (1477 l.) + `hooks/useSuggestions.ts`.
- [x] Note : les champs `signature.dateLabel/clinicLine/city` ne sont **pas** morts (utilisés par `PatientReport` + `ComptesRendus`) → conservés.

#### Fiabilisation erreurs + Firestore
- [x] **Toast global** ([components/shared/ToastProvider.tsx](src/components/shared/ToastProvider.tsx)) wired dans `App` ; les **7 `alert()`** remplacés par `notify(..., 'error')` (Accueil, PatientEditModal, Consultation, Patients, WaitingQueue).
- [x] **Requête patients bornée** : `Patients.tsx` ajoute `limit(300)` (évite de lire toute la collection).

#### Tests (Vitest — mise en place)
- [x] `vitest` + scripts `test`/`test:watch`. 4 fichiers, 18 tests :
  - `cdGauge` : `normalCDLimit` (seuils 0,5/0,6/0,7), `parseNum`, `gaugeGradient`
  - `lesions` : `searchLesions` (exact, fuzzy, limite)
  - `clinicalSummary` : interprétation du suivi (aggravation) + lésions RSK → anomalies
  - `clinicalPayload` : **régression latéralité** OG→OS (symptômes RSK transmis à l'IA)
- [x] `normalCDLimit`/`gaugeGradient`/`parseNum` exportés depuis `CDGauge` pour testabilité.

#### Audit — pistes restantes (non traitées, pour mémoire)
- Bundle ~2 Mo monolithique → code-splitting (`manualChunks` + `React.lazy` par route).
- Validation métier : borner le C/D (0–1) et la surface à la saisie.
- Vérifier les **règles Firestore** côté console (sécurité données patient).
- Découper les gros composants (`Consultation`, `EyeExamSection`, `reportDataMapper`).

---

### Session 2026-06-13 (suite 2) — Création de lésion RSK rétablie

**Demandé par :** Yoan
**Statut :** ✅ Terminé, `tsc --noEmit` 0 erreur, build OK

- [x] **Bouton « Créer « x » » de RetinaSketch quasi invisible** : `CommandPalette` ne l'affichait que si `searchLesions` ne renvoyait **aucun** résultat — or la recherche est tolérante (repli par sous-séquence, score 20), donc elle trouve presque toujours une correspondance approximative. → Le bouton « Créer » apparaît désormais dès qu'aucune lésion ne correspond **exactement** au terme saisi (même si des résultats approchants existent). Limitation présente depuis l'origine (3ecc530/3ea03aa), pas une régression récente.

---

### Session 2026-06-13 (suite) — Cadres bleus, suivi, mise en page 1 page

**Demandé par :** Yoan (avec screenshot + 2 PDF : export direct & impression navigateur)
**Statut :** ✅ Terminé, `tsc --noEmit` 0 erreur, build OK

#### Cadres bleus + incohérence navigateur/PDF (cause racine trouvée)
- [x] Les « cadres bleus » autour des anneaux = **collision de la classe CSS `ring` avec l'utilitaire Tailwind `.ring`** (halo bleu de focus). Visibles dans le navigateur ET le PDF d'impression (box-shadow préservé), absents du PDF export direct (html2canvas ignore les box-shadow) → exactement l'incohérence signalée. → classe renommée `ring` → `neuro-ring` dans `NeuroRings` + CSS.

#### Suivi RNFL/GCL
- [x] **Date saisie une seule fois** : `Consultation.tsx` propage la `followUpDate` d'un œil à l'autre (sync bidirectionnel, sans écraser).
- [x] **Évolution centrée sous chaque cercle** : le badge RNFL est sous le cercle RNFL, le badge GCL sous le cercle GCL (déplacé dans `NeuroRings`). La date reste centrée entre les deux yeux.
- [x] **« Stable » désormais affiché** : la valeur par défaut était `''` (le select montrait « Stable » sans que l'état le soit). À l'activation du suivi, `EyeExamSection` initialise `rnflEvolution`/`gclEvolution` à « Stable ».

#### Mise en page — tenir sur une seule page
- [x] **Pied de page épuré** : suppression de « Fait à … » + ligne clinique (déjà en en-tête). E-mail + téléphone affichés en petit sous le nom du praticien.
- [x] **En-tête compacté** : logo 46→38px, titres 22→19px, paddings réduits (page 14/12mm → 9/8mm, méta, masthead).
- [x] **`.page` : `overflow: hidden` → `visible` + `min-height`** : le navigateur ne tronque plus le bas → cohérence avec PDF/impression.
- [x] Anneaux du compte rendu légèrement réduits (96 → 90px).

---

### Session 2026-06-13 — Mise à jour V3 v3 (correctifs RSK/IA, suivi, légendes, PDF)

**Demandé par :** Yoan
**Statut :** ✅ Terminé, `tsc --noEmit` 0 erreur, build OK

#### Correctifs IA (bugs critiques)
- [x] **Symptômes RetinaSketch ignorés par l'IA** : `clinicalPayload.ts` passait `'OG'` à `generateReport`, qui filtre `a.laterality === laterality` — or l'œil gauche est tagué `'OS'` ([`RetinaEditor.tsx:35`](src/features/retinasketch/components/RetinaEditor.tsx)). → mapping `OG→OS`. C'était l'erreur `tsc` historique.
- [x] **Lésions RSK intégrées à l'analyse** : `clinicalSummary.ts` remonte désormais `obs.retina` dans les anomalies + détection diabète/DMLA étendue aux lésions dessinées.
- [x] **Suivi RNFL/GCL interprété par l'IA** : `clinicalSummary.ts` détecte « Diminution/amincissement » → anomalie « aggravation au suivi » + pattern `aggravation_suivi`.

#### Affichage du suivi (compte rendu)
- [x] `EyeData.followUp` ({ date, rnflEvolution, gclEvolution }) renseigné par `reportDataMapper`.
- [x] `VisualClinicalSection` : bandeau de suivi sous les anneaux — « Diminué » (rouge) / « Stable » (vert) / « Augmenté »/« Fluctuant » (ambre) par œil, **date au centre des 2 yeux**.

#### Anneaux & légendes
- [x] **Double libellé supprimé** : `NeuroRings` n'affiche plus le `<span>` RNFL/GCL sous le cercle (le `<text>` dans le cercle suffit).
- [x] **Légende sur une seule ligne** : sévérité (Normal/Limite/Hors norme) + définitions simplifiées (« RNFL : fibres nerveuses péripapillaires », « GCL : complexe cellules ganglionnaires ») fusionnées dans `.vc-sev-legend`.
- [x] **« Sans particularité » encadré** par 2 barres, même police que la légende des symptômes (`.vc-lesion-legend-ras`).
- [x] **2 cadres bleus** du module de saisie RNFL/GCL retirés (`RnflGclPicker` : cartes `border` → sans bordure).

#### Export PDF
- [x] **Rapport coupé / >1 page corrigé** : `pdfExportService` passe `margin:0` (les marges + 297mm débordaient sur une 2e page), neutralise `overflow:hidden`/ombre/décor `::before` via `<style>` injecté dans le clone, capture la `.page` seule, et ajoute `pagebreak.avoid` pour ne jamais couper un bloc.

#### Divers
- [x] Bug `tsc` résiduel corrigé : `FormulaireTab` ouvrait une catégorie inexistante (`'macula'` → `'motifs'`).

---

### Session 2026-06-12 — Mise à jour V3 (rapport visuel + sexe patient)

**Demandé par :** Yoan
**Statut :** ✅ Terminé, build OK (0 erreurs introduites)

#### Rapport visuel (NeuroRings / CDGauge / VisualClinicalSection + CSS)
- [x] **Espacement des anneaux** RNFL ↔ GCL : `gap` 8 → 18px (`.neuro-rings`)
- [x] **Cadre bleu supprimé** : c'était la **sélection de texte native** sur les `<text>` SVG des anneaux → `user-select: none` sur `.neuro-rings`, `.cd-bar-block`, `.vc-neuro-center`
- [x] **Repositionnement barre C/D** : valeur C/D **au-dessus** de la barre, surface discale **en dessous** (CDGauge), labels « C/D vertical » (haut) / « Cup area » (bas) alignés via `justify-content: space-between` + `align-self: stretch`
- [x] **C/D arrondi au dixième** : `toFixed(2)` → `toFixed(1)`
- [x] **Barre C/D « intelligente »** : seuils de couleur calculés selon la surface discale. Limite haute de normalité interpolée 0,5 (≤1,5 mm²) → 0,6 (~2,0 mm²) → 0,7 (≥2,8 mm²). Fondé sur la biblio : González de la Rosa 2025 (percentiles C/D vs surface discale), Jonas 2000 & Quigley 1991 (correction du C/D par la taille du disque)
- [x] **Légende des symptômes RetinaSketch** encadrée par **2 lignes de démarcation** (`border-top`/`border-bottom` sur `.vc-lesion-legend`)
- [x] **Suppression de la répétition rouge** : `eyeFinding` ne répète plus les lésions déjà listées dans la légende (retourne `null` si seules des lésions sont présentes) → fin de la redondance
- [x] **Définitions des sigles** RNFL et GCL ajoutées sous la légende code-couleur (`.vc-sev-defs`)

#### Sexe patient (formulaire d'accueil)
- [x] **`types/patient.ts`** : type `Sexe = 'M' | 'F'`, champ `sexe` ajouté à `PatientFirestore` (optionnel) et `PatientFormData`
- [x] **`Accueil.tsx`** : sélecteur Homme/Femme obligatoire (validation) dans la section identité
- [x] **`PatientEditModal.tsx`** : sélecteur sexe ajouté (corriger les anciens dossiers)
- [x] **Propagation** : `RawConsultationData.patient.sexe` → `Consultation.tsx` → `reportDataMapper` (remplace le `sex: 'M'` codé en dur, repli `'M'` pour les anciens dossiers)

---

### Session 2026-06-11 (suite) — Mise à jour V2

**Demandé par :** Yoan  
**Statut :** ✅ Terminé, build OK (0 erreurs)

#### RetinaSketch — corrections

- [x] **Touche Espace** : la touche Espace est maintenant bloquée uniquement hors champ input/textarea. L'utilisateur peut saisir des noms de lésions avec plusieurs mots (ex : "déchirure rétinienne")
- [x] **Clic hors rétine** : les clics en dehors de l'ellipse rétinienne ne déclenchent plus de création d'annotation (test par équation elliptique `x²/rx² + y²/ry² > 1`)
- [x] **Annotations → payload IA** : `clinicalPayload.ts` inclut désormais les annotations RSK validées via `generateReport()` → `obs.retina: string[]`. Bug critique corrigé.
- [x] **Avertissement sortie sans validation** : si des annotations sont en statut `draft` lors du clic "Terminer", une confirmation est demandée (`window.confirm`)

#### Module RGB (compte rendu visuel)

- [x] **Cadre bleu supprimé** définitivement sur les anneaux RNFL et GCL (stroke `#fff` uniforme, même grade 3)
- [x] **Anneaux agrandis** : 80px → 96px (CSS `.neuro-rings .ring svg`)
- [x] **Paramètres biométriques** sans toggle (section toujours visible)
- [x] **Layout 3 colonnes** :  
  - Col gauche : anneaux OD + barre C/D (barre à droite des anneaux, côté centre)  
  - Col centre : labels "C/D vertical" / "Cup area (mm²)" une seule fois pour les 2 yeux  
  - Col droite : barre C/D + anneaux OG (barre à gauche des anneaux, côté centre)
- [x] CSS : nouvelles classes `.vc-neuro-row`, `.vc-neuro-half`, `.vc-neuro-od/og`, `.vc-neuro-center`, `.vc-nc-label`

#### Paramètres — Formes cliniques (nouveau module)

- [x] **`types/settings.ts`** : interface `ClinicalPattern` (id, name, type RNFL/GCL/RNFL+GCL, rnflSectors, gclSectors, description) + `SeverityGrade` + champ `clinicalPatterns?` dans `AppSettings`
- [x] **`useSettings.ts`** : callback `updateClinicalPatterns()` exposé
- [x] **`PatternsTab.tsx`** (nouveau composant) :  
  - CRUD complet : ajout, édition inline, suppression avec confirmation  
  - Sélecteur de secteurs interactif : boutons S/I/N/T (RNFL) et S/ST/IT/I/IN/SN (GCL) qui cyclent entre les grades (Normal → Limite → Hors norme → Critique)  
  - Couleurs cohérentes avec les anneaux du compte rendu (`GRADE_COLORS`)  
  - Carte de résumé avec badges colorés par secteur affecté  
  - Note clinique libre par forme  
- [x] **`Parametres.tsx`** : onglet "Formes clin." ajouté (icône `Activity`)

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
- [ ] Vérifier visuellement le layout 3 colonnes (OD rings + barre C/D | labels | barre C/D + OG rings)
- [ ] Tester la création de lésion en live dans RetinaSketch (CommandPalette)
- [ ] Vérifier que les formes cliniques se créent et se sauvegardent bien (onglet Formes clin.)

### Priorité normale
- [ ] Export PDF : vérifier que les nouveaux styles CSS (3 colonnes, anneaux 96px) s'impriment correctement
- [ ] Tester la compatibilité des anciens rapports sauvegardés (sans secteurs RNFL/GCL)
- [ ] Connecter les formes cliniques à l'interprétation IA (future V3 : détection automatique du pattern)
- [ ] Le formulaire "Divers" → vérifier que son contenu est bien transmis à l'IA dans le payload

### Idées à discuter
- [ ] Ajouter un indicateur "%" de remplissage sur les secteurs RNFL/GCL (ex: 3/4 secteurs hors norme)
- [ ] Mode comparaison : afficher côte à côte deux visites pour le même patient
- [ ] Export image du schéma rétinien seul (PNG) pour intégration dans d'autres CR
- [ ] Utiliser les formes cliniques comme aide à l'interprétation : mettre en évidence si le pattern observé correspond à une forme connue

---

## Décisions architecturales importantes

| Date | Décision | Raison |
|------|----------|--------|
| 2026-06-11 | Lésions custom stockées dans Firestore (settings doc) | Cohérence avec le reste des paramètres, pas de collection séparée |
| 2026-06-11 | Registre `_customLesions` en module-level (non React) | `getLesion()` est appelée depuis des utilitaires sans contexte React |
| 2026-06-11 | Sync registre dans `useSettings.persist()` | Évite un contexte React dédié, garantit la cohérence après toute écriture |
| 2026-08-12 | Contrat de fidélité `alignTransform` (éditeur = CR = PDF) | Les annotations doivent suivre le zoom/pan/rotation de la photo à l'identique sur les 3 rendus |
| 2026-08-12 | Netteté/tons via filtre SVG (affichage) + pré-passe canvas (PDF) | `ctx.filter: url(#…)` peu fiable sur canvas (Safari) ; le SVG couvre le temps réel |
| 2026-08-12 | Opacité des annotations globale (pas par lésion) | Choix produit (simplicité), persistée via `retinaAnnotationOpacity` |
| 2026-08-12 | Flèches exclues des décomptes du texte clinique (`generate.ts`) | Ce sont de pures désignations visuelles, pas des occurrences de lésion |
| 2026-08-12 | Pont API dev dans `vite.config.ts` (`apply:'serve'`) | Exécuter `api/**` sous `vite dev` sans dépendre de `vercel dev`, sans impacter la prod |

---

## Bugs connus / Points de vigilance

- **`onNewSuggestion` prop** gardée dans l'interface (compatibilité descendante) mais plus appelée en interne
- **Chunk size warning** au build (>500 KB, + WASM ONNX ~26 Mo) — non bloquant ; envisager `manualChunks` / lazy
- **IA sur Vercel** : `.env.local` n'est pas déployé → les variables `AI_PROVIDER`/`AI_MODEL`/clé doivent être définies dans les *Environment Variables* du projet Vercel, sinon l'onglet IA reste rouge en prod
- **IDs de filtre SVG dupliqués** possibles si l'aperçu double-œil et l'espace de travail sont montés simultanément (mêmes `rsk-ed-adj-*`) — sans conséquence visuelle (filtres identiques), à surveiller si un jour les réglages divergent par instance

---

## Notes de session

### 2026-06-11
- Explication fournie de la logique IA : les annotations dessinées sont converties en phrases cliniques structurées par `generate.ts`, intégrées dans le payload JSON envoyé à l'IA. L'IA ne voit pas l'image — elle travaille sur les attributs géométriques calculés (zone anatomique, quadrant, secteur ETDRS).
- Lésions custom créées en live dans la palette ont exactement le même traitement que les lésions intégrées.

---

*Tenu à jour par Claude à la fin de chaque tâche modifiant le code (rappel via hook `Stop` dans `.claude/settings.json`) · Format : Markdown*
