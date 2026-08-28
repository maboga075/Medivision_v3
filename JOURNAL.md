# Journal de développement — Medivision Studio

> Ce fichier est mis à jour à chaque session de travail.
> Il sert de fil conducteur entre Claude et le développeur.

---

## État général du projet

**Branche active :** `main` (→ Vercel `medivision-v3`)  
**Dernière session :** 2026-08-28  
**Build :** ✅ `tsc --noEmit` 0 erreur, **24 tests Vitest verts**, `vite build` OK  
**Stack :** React + TypeScript + Vite · Firebase (Auth + Firestore) · Tailwind CSS · Konva + ONNX Runtime Web (RetinaSketch) · Framer Motion · jsPDF · Fonctions serverless Vercel (`api/ai`)

---

## 🧾 Récapitulatif session 2026-08-14 (détails dans les entrées ci-dessous)

Grosse session, 4 chantiers (tous ✅, `tsc`/tests/build verts). Non vérifiés visuellement en mobile connecté (app derrière login Firebase).

1. **Infra / Vercel** — Push initial, fusion `feat/retinasketch-v2-port` → `main`, déploiement production `medivision-v3.vercel.app`. Clarification des 3 « noms » (dossier / repo / projet Vercel), lien `.vercel` corrigé, remote `medivision-v1` retiré, ancien dépôt `MEDIVISION_IA_V1` **archivé**. Combobox médecin prescripteur en auto-complétion triée (Accueil + PatientEditModal) → [`PrescriberCombobox`](src/components/forms/PrescriberCombobox.tsx).
2. **Refonte UX Consultation (Lots 1–5)** — Divers & Hypothèse libre en tags mémorisés ([`TextTagField`](src/components/forms/TextTagField.tsx)) ; cases OCT antérieur/OCTA supprimées → dérivées des coupes RetinaSketch ; bouton RetinaSketch **unique** entre OD/OG ; presets RNFL supprimés ; **encadré commun disque** (surface→C/D, ordre Tab) + **suivi RNFL mutualisé** ([`SharedDiscFollowUpSection`](src/components/forms/SharedDiscFollowUpSection.tsx)).
3. **Moteur d'attribution des lésions multi-coupe (Étapes A–E)** — Attributs typés par contexte de coupe (union discriminée `retino/bscan/cornea/octa`), `computeAttributes(centroid, kind)`, saisie manuelle de la **couche** (RNFL→EPR / cornéenne) avec emplacement IA réservé, `generateReport` par contexte, payload IA par coupe (`obs.bscan`/`cornea`) + consigne prompt, **légendes de coupe éditables** dans le CR. Recherche P1 : modèles ONNX de segmentation de couches (rétine/cornée) documentés pour plus tard.
4. **Responsive / mobile** — Consultation utilisable en mobile (sidebar → `<select>` patient), header non débordant, grille identité Accueil empilée, cartes salle d'attente tronquées.

**Note projet :** app en développement → **pas de rétrocompatibilité** à assurer (anciens CR archivés).

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

### Session 2026-08-28 (suite 3) — Vague 2 (fin) : pachymétrie (13) + template libre/crop (9) + angle IC Shaffer (12)

**Demandé par :** Yoan (UX validée : crop = cadre fixe redimensionnable ; angle = 3 points → Shaffer) · **Statut :** ✅ Vague 2 terminée → **13/13 items faits**. `tsc` 0, **33 tests verts** (2 nouveaux fichiers de tests), `vite build` OK. **Non vérifié visuellement** (RSK derrière login).

- **Item 13 — Pachymétrie sous coupe OCT antérieur.** Store RSK : `cornealThickness: EyeMap<string>` + `setCornealThickness` ([`store/useStore.ts`](src/features/retinasketch/store/useStore.ts)). Champ µm affiché sous l'image quand le slot actif est `cornea` ([`EyePane.tsx`](src/features/retinasketch/components/EyePane.tsx)). Seed au montage + remontée au commit ([`RetinaEditor.tsx`](src/features/retinasketch/components/RetinaEditor.tsx)) → `eye.cornealThickness` (alimente déjà `pachymetrie` dans le payload IA). ⚠ `EyeMap` indexé `OD`/`OS` (pas `OG`).
- **Item 9 — Template libre + rognage dynamique.** Nouveau `ImageKind "free"` + géométrie `"free"`. Dimensions custom par slot (`SlotMeta.frameHalfWMm/HMm`), threadées via `fieldHalfExtentsMm(geometry, override)` / `fieldShape(...)` ([`geometry/template.ts`](src/features/retinasketch/lib/geometry/template.ts)) dans [`RetinaStage`](src/features/retinasketch/components/RetinaStage.tsx) + [`BackgroundImage`](src/features/retinasketch/components/BackgroundImage.tsx) + impression [`ImagerySlotSvg`](src/components/reports/visual/ImagerySlotSvg.tsx). Sliders L/H sous l'image (`EyePane`) → `setActiveSlotFrame`. Sérialisé dans `RetinaSlotSnapshot`. Slots `free` exclus des observations cliniques ([`clinicalPayload.ts`](src/utils/clinicalPayload.ts)).
- **Item 12 — Angle IC : 3 points → Shaffer.** Helper [`geometry/angle.ts`](src/features/retinasketch/lib/geometry/angle.ts) (`computeAngleDeg`, `shafferFromAngle`, `SHAFFER_LABEL`). Overlay interactif [`AngleOverlay.tsx`](src/features/retinasketch/components/AngleOverlay.tsx) en vue mono (apex + 2 parois → angle) ; points stockés en fractions de largeur (redessin robuste). Bandeau sous l'image (`EyePane`) : angle + select Shaffer 0–4 modifiable (retour « auto »). Store : `angleMeasure`/`shafferOverride` par œil. Bridge commit → `eye.iridoCornealAngle` → payload `angle_irido_corneen`. **Limite** : les points dessinés ne sont pas re-seedés à la réouverture de RSK (seul le texte angle+Shaffer persiste dans le CR).

**Questions 10/11 (IA reco couches / angle) :** répondu — pas de modèle libre fiable ; les outils livrés sont des **mesures déterministes** (pachymétrie saisie, angle 3 points), conformes à la règle « sorties déterministes et traçables ».

---

### Session 2026-08-28 (suite 2) — Vague 2 (début) : menu Imprimer éditable (6+7) + template 4:3 (8)

**Demandé par :** Yoan · **Statut :** ✅ items 6+7 et 8 faits. `tsc` 0, 29 tests, `vite build` OK. **Non vérifié visuellement** (RSK derrière login).

- **Item 8 — Template rectangulaire 4:3 (suivi épaisseurs).** Additif : nouveau `ImageKind` `"thickness"` + géométrie `"rect43"` (halfH = R·0.75) dans [`lib/types.ts`](src/features/retinasketch/lib/types.ts) / [`geometry/template.ts`](src/features/retinasketch/lib/geometry/template.ts) ; ajouté à `ADD_KINDS` ([`SlotGallery.tsx`](src/features/retinasketch/components/SlotGallery.tsx)). `attrContextForKind("thickness") = "bscan"` (référentiel coupe rétinienne, sélection de couche). Aspect dérivé automatiquement par `fieldHalfExtentsMm` → géré partout (stage, impression `ImagerySlotSvg`, glyphe).
- **Items 6+7** — Dans l'aperçu Imprimer ([`DoubleEyeView.tsx`](src/features/retinasketch/components/DoubleEyeView.tsx)) : titres d'œil (« Œil droit (OD) »…) passés en **gras**, et **tous** les textes (titres, descriptions/rapport par œil, libellés de coupe « B-scan OD », « OCT-A OD ») rendus **éditables** via un composant `EditableText` (contentEditable non contrôlé, commit `onBlur`, soulignement pointillé à l'écran retiré à l'impression). Les surcharges sont réinitialisées à chaque ouverture de l'aperçu. Titres + descriptions édités sont **repris dans l'export PDF** ([`export/pdf.ts`](src/features/retinasketch/lib/export/pdf.ts) : nouveaux champs `titles`/`reports`, titres en gras `helvetica bold`). NB : l'export jsPDF ne rend pas les coupes complémentaires (B-scan/OCT-A) — leurs libellés édités n'apparaissent que dans `window.print()` (comportement pré-existant).

**Reste Vague 2 :** 8 (template rect 4:3), 13 (pachymétrie sous coupe OCT antérieur), 9 (template libre + crop redimensionnable — UX validée : cadre fixe redimensionnable), 12 (mesure angle IC 3 points → Shaffer modifiable — UX validée).

---

### Session 2026-08-28 (suite) — Vague 3 : nomenclature topographique 8 zones (rétino / OCT-A / OCT de face)

**Demandé par :** Yoan (images de nomenclature fournies) · **Statut :** ✅ terminé. `tsc` 0, **29 tests verts** (dont nouveau `engine.test.ts`), `vite build` OK.

Nouvelle localisation des lésions demandée par le praticien : 8 zones définies par 2 repères (fovéa/macula + papille) — priorité au cercle maculaire (MS/MI).

- **Item 4 — Classifieur 8 zones.** Nouveau type `TopoZone` + `TOPO_ZONE_LABEL` ([`lib/types.ts`](src/features/retinasketch/lib/types.ts)). Fonction `topoZone(pt)` dans [`engine.ts`](src/features/retinasketch/lib/geometry/engine.ts) : supérieur/inférieur = côté de la ligne fovéa–papille (produit vectoriel) ; colonnes = temporal (x≥0) / nasal-macula (disc.x≤x<0) / nasal-papille (x<disc.x) ; priorité cercle maculaire → MS/MI. Ajouté à `RetinoAttributes` et `OctaAttributes` (couvre octa + en-face), calculé dans `computeAttributes`.
- **Phrases de rapport** ([`report/generate.ts`](src/features/retinasketch/lib/report/generate.ts)) : `sentenceRetino`/`sentenceOcta` réécrites autour de `topoZone` (« … en secteur NS-M (Nasal Supérieur de la Macula) »). **Se propage automatiquement à l'IA** (le payload `obs.retina/octa` consomme ces lignes). Anciennes tables `ZONE_PHRASE`/`QUADRANT_LABEL` supprimées ; `anatomicalLabel()` (chips) affiche la zone topo. Attributs géométriques historiques (quadrant/ETDRS/vasculaire) conservés dans le modèle (non-cassants).
- **Item 5 — Menu Couches réduit** ([`FloatingControls.tsx`](src/features/retinasketch/components/FloatingControls.tsx)) : ne reste que « Zones anatomiques » + nouvelle entrée « Nouvelle nomenclature (8 zones) » (retrait quadrants/fovéa/ETDRS/périphérie/vaisseaux du menu). Nouveau calque `nomenclature` (`LayerKey` store + `RetinaLayers` type). Overlay dessiné dans [`RetinaStage.tsx`](src/features/retinasketch/components/RetinaStage.tsx) : axes fovéal + papillaire, ligne fovéa–papille, cercle maculaire + libellés des 8 zones (`nomenclatureLabels`).
- **Limite** : overlay visuel rendu en contexte rétino (`isRetino`) ; la classification s'applique aussi à OCT-A/en-face (via le classifieur), sans overlay dédié sur ces coupes carrées. **Non vérifié visuellement dans le harness** (RSK derrière login Firebase) — à contrôler sur le serveur de dev.

---

### Session 2026-08-28 — Vague 1 : DateInput mobile, traitements auto-complétés, bouton rétine pleine largeur

**Demandé par :** Yoan (lot de 13 corrections, hiérarchisé en 3 vagues) · **Statut :** ✅ Vague 1 terminée. `tsc --noEmit` 0 erreur, `vite build` OK. **Non vérifié visuellement dans le harness** (serveur Vite de l'utilisateur sur port 51449, le harness ciblait 5173 — à contrôler sur la fenêtre déjà ouverte).

- **Item 2 — Saisie date de naissance au clavier (mobile).** Nouveau composant [`DateInput`](src/components/forms/DateInput.tsx) : champ texte `inputMode="numeric"` format `JJ/MM/AAAA` auto-formaté (insertion des `/` à la frappe, validation jour/mois/année bissextile), contrat ISO `AAAA-MM-JJ` inchangé côté parent + bouton calendrier (`showPicker()`) pour le sélecteur natif. Remplace `<input type="date">` dans [`Accueil`](src/pages/Accueil.tsx) et [`PatientEditModal`](src/components/modals/PatientEditModal.tsx). Résout le défilement année par année pénible (patients âgés).
- **Item 3 — Traitements en champ à mémoire.** Suppression du toggle Oui/Non + textarea. Réutilisation de [`TagAutocomplete`](src/components/forms/TagAutocomplete.tsx) (chips + création à la volée + « garder ») avec nouvelle catégorie `medicaments` dans `formulario` (persistée via `updateBulles`). Vide → indice « Traitement non renseigné ». **Modèle patient** : `hasTraitement: boolean` + `traitementTexte?: string` → **`traitements: string[]`** ([`types/patient.ts`](src/types/patient.ts), [`types/settings.ts`](src/types/settings.ts)). Champs anciens **non consommés en aval** (aucun impact IA/CR) — pas de migration (app en dev).
- **Item 1 — Bouton « Annoter la rétine » repensé.** Passé d'une colonne étroite entre OD/OG à une **barre pleine largeur** au-dessus des deux colonnes ([`Consultation.tsx`](src/pages/Consultation.tsx)). État visuel piloté par les annotations validées : dashed teal « Annoter la rétine » si vide → **plein emerald + ✓ « Rétine annotée »** dès qu'une lésion est validée, avec **résumé par œil** (`summarizeEye` → `getLesion(a.lesionId).name`, comptage `×N`).

**Reste à faire (mêmes 13 demandes) :**
- **Vague 2 (RetinaSketch)** : items 6+7 (titres menu Imprimer `B-SCAN OD`/`OCT-A OD` en gras + éditables, descriptions éditables — cf. [`DoubleEyeView`](src/features/retinasketch/components/DoubleEyeView.tsx)), 8 (template rect 4:3 suivi épaisseurs), 9 (template libre + rognage dynamique), 13 (épaisseur cornéenne sous coupe OCT antérieur), 12 (template angle IC : mesure d'angle + Shaffer modifiable).
- **Vague 3 (BLOQUÉE ⛔)** : items 4 (nouvelle nomenclature localisation rétino/OCTA/OCT de face) + 5 (onglet Couches : ne garder que zones anatomiques + nouvelle nomenclature) — **attend l'image de nomenclature** non fournie.
- **Questions 10/11 (IA couches B-scan / angle AOD-TISA)** : pas de modèle libre fiable → recommandation d'outils de **mesure déterministes** plutôt que reconnaissance auto.

---

### Session 2026-08-14 (suite 3) — Corrections responsive / vue mobile

**Demandé par :** Yoan (captures iPhone) · **Statut :** ✅ corrigé. `tsc` 0, 24 tests, `vite build` OK. **Non vérifié visuellement en mobile connecté** (app derrière login Firebase — login mobile OK, sans overflow-x).
**Cause racine transverse :** conteneurs flex sans `min-w-0`/`truncate`/`overflow-x-hidden` → débordements horizontaux décalant toute la page.

- **Bug 1 (critique) — Consultation invisible en mobile.** [`Consultation.tsx`](src/pages/Consultation.tsx) : `main` était `hidden sm:block`. Désormais visible en mobile ; la sidebar salle d'attente ([`WaitingQueue`](src/features/consultation/components/WaitingQueue.tsx)) passe `hidden sm:flex` et est **remplacée en mobile par un `<select>` de patient** en tête du formulaire (sticky). Barre d'actions rendue `flex-wrap` (plus de débordement).
- **Bug 2 — Header ([`MainLayout`](src/layouts/MainLayout.tsx)) débordait en mobile.** Texte « MEDIVISION » `hidden sm:block`, nav mobile compacte (`NavItem compact`, `p-2`, icônes w-5), `overflow-x-hidden` sur le racine, `min-w-0` sur les groupes flex.
- **Bug 3 — Grille identité [`Accueil`](src/pages/Accueil.tsx).** `grid-cols-2 md:grid-cols-4` → `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` (le champ `type=date` ne déborde plus).
- **Bug 4 — Cartes salle d'attente.** Nom patient `min-w-0 truncate`, badge heure `shrink-0`.

---

### Session 2026-08-14 (suite 2) — Moteur d'attribution des lésions multi-coupe

**Demandé par :** Yoan · **Statut :** ✅ terminé (Étapes A–E). `tsc` 0, **24 tests verts**, `vite build` OK, console propre.
**Problème identifié :** l'attribution des lésions était **mono-contexte** — `computeAttributes` (moteur `engine.ts`) appliquait *toujours* le référentiel rétinographie de face (fovéa/quadrant/ETDRS/arcades), même sur un B-scan ou une cornée → attributs cliniquement faux hors rétino. De plus le payload IA (`clinicalPayload`) n'interprète que les lésions du slot rétino (`obs.retina`), pas celles des coupes.
**Recherche (P1) :** modèles IA de segmentation de couches exportables ONNX existants — rétine : CCU-INSEG (U-Net compressé), ENet, DeepGPET (MobileNetV3), U-Net+ResNet34 ; cornée AS-OCT : CUNEX (nnU-Net), CorneaNet, ScLNet. Faisable via l'infra ONNX Runtime Web déjà en place ; points d'attention : poids du modèle, licence *research-only*, conversion PyTorch→ONNX. **Décision : moteur d'abord, détection IA plus tard** (couche saisie manuellement, emplacement réservé).

- [x] **Étape A — Modèle de données + moteur multi-coupe.** [`types.ts`](src/features/retinasketch/lib/types.ts) : `DerivedAttributes` devient une **union discriminée** par famille d'attribution (`AttrContext` = retino | bscan | cornea | octa, mappée depuis `ImageKind` via `attrContextForKind`) ; variantes `Retino/Bscan/Cornea/OctaAttributes` ; enums `RetinalLayer`/`CornealLayer`/`TransverseZone` ; helper `anatomicalLabel`. **Compat** : `z.preprocess` rattache à `retino` les annotations sans `context` (dossiers déjà enregistrés inchangés). [`engine.ts`](src/features/retinasketch/lib/geometry/engine.ts) : `computeAttributes(centroid, kind)` **dispatch** (rétino = inchangé ; coupes = position transverse centrale/paracentrale/périphérique, `layer` null à saisir). [`useStore.ts`](src/features/retinasketch/store/useStore.ts) : `buildAnnotation` reçoit le `kind` du slot actif (`activeKind`). Consommateurs adaptés (`SelectionToolbar`/`SelectionPicker` via `anatomicalLabel` ; `generate.ts` restreint au contexte rétino pour l'instant → comportement rétino identique).
- [x] **Étape B — Saisie manuelle de la couche (UI).** Action store `setAnnotationLayer(id, layer)` ([`useStore.ts`](src/features/retinasketch/store/useStore.ts)) qui écrit `attrs.layer` selon le contexte (bscan → `RetinalLayer`, cornea → `CornealLayer`). Sélecteur de couche ajouté dans [`SelectionToolbar`](src/features/retinasketch/components/SelectionToolbar.tsx) — visible uniquement sur une lésion de coupe B-scan/cornée, alimenté par `RetinalLayer.options`/`CornealLayer.options` ; **bouton « ✨ IA » désactivé = emplacement réservé** à la future détection automatique. La couche persiste dans l'annotation (donc dans `retinaSlots`).
- [x] **Étape C — `generateReport` par contexte.** [`generate.ts`](src/features/retinasketch/lib/report/generate.ts) refondu : regroupement par **(contexte, lésion)** puis dispatch de la phrase — `retino` (référentiel de face, **sortie strictement identique** à l'existant), `bscan` (« … sur le B-scan, couche X, en région Y »), `cornea` (« … sur la coupe de cornée, couche X, en région Y »), `octa` (« … en OCT-angiographie »). Helpers factorisés (`presenceCount`, `finalize`, `dominantLayer`). Comportement rétino inchangé (18 tests verts). Les phrases de coupe ne s'afficheront qu'une fois l'Étape D branchée (agrégation des slots).
- [x] **Étape D — Payload IA multi-coupe.** [`clinicalPayload.ts`](src/utils/clinicalPayload.ts) : `buildObservations` agrège désormais les lésions de **tous les slots** — rétino (`obs.retina`, slot principal) + coupes non-rétino via `eye.retinaSlots` réparties par contexte dans `obs.bscan` / `obs.cornea` / `obs.octa` (extraction factorisée `lesionLines`). Nouvelles clés `bscan?`/`cornea?` sur `ObservationsNormalisees` ([`clinical.ts`](src/types/clinical.ts)). Consigne ajoutée au `SYSTEM_PROMPT` ([`api/ai/generate-report.ts`](api/ai/generate-report.ts)) : chaque coupe interprétée dans SON référentiel (couche rétinienne pour bscan, couche cornéenne pour cornea), sans transposition de localisation.
- [x] **Nettoyage (consigne « pas de rétrocompat »)** : `z.preprocess` de compat retiré de `DerivedAttributes` ([`types.ts`](src/features/retinasketch/lib/types.ts)) → `discriminatedUnion` pur, `context` requis. Voir mémoire [[no-backward-compat]].
- [x] **Étape E — Légendes de coupe dans le CR (éditables) + tests.** Le mapper ([`reportDataMapper.tsx`](src/utils/reportDataMapper.tsx)) génère une `caption` par slot de coupe (`slotCaption` via `generateReport`, interprétée par contexte) ; nouveau champ `caption?` sur `ReportImageSlot` ([`report.ts`](src/types/report.ts)). [`OCTReport`](src/components/reports/OCTReport.tsx) affiche la légende sous chaque image en **`contentEditable`** (modifiable en place, capturée à l'export comme le reste du CR), avec placeholder CSS quand vide ([`OCTReport.css`](src/components/reports/OCTReport.css)). **Tests** : nouveau [`generate.test.ts`](src/features/retinasketch/lib/report/__tests__/generate.test.ts) (5 cas : rétino/bscan/cornée/sans couche/groupement) + cas `obs.bscan` ajouté à `clinicalPayload.test.ts`. Total 24 tests verts.

**Bilan :** le moteur d'attribution est désormais multi-coupe de bout en bout (saisie → attribution → texte → payload IA → CR éditable). Détection IA de la couche = évolution future (emplacement « ✨ IA » déjà en place, cf. Étape B ; modèles candidats documentés dans la recherche P1).

---

### Session 2026-08-14 (suite) — Refonte UX Consultation (par lots)

**Demandé par :** Yoan · **Statut :** ✅ terminé (Lots 1–5). `tsc --noEmit` 0 erreur, 18 tests Vitest verts, `vite build` OK, console/preview sans erreur.
**Objectif :** rendre l'onglet Consultation plus minimaliste (moins de répétitions OD/OG, auto-complétion partout).
**Décisions (validées) :** segment antérieur affiché auto selon coupe RetinaSketch (cornea/angle) ; suivi RNFL commun (toggle+date communs, évolutions par œil) ; Divers & Hypothèse libre en tags type Antécédents.
**Non vérifié visuellement** (app derrière login Firebase — pas de saisie d'identifiants).

- [x] **Lot 1 — Divers & Hypothèse libre en auto-complétion mémorisée.** Nouveau [`TextTagField.tsx`](src/components/forms/TextTagField.tsx) : adaptateur `string ↔ tags` autour de `TagAutocomplete` (**stockage reste `string`** → zéro impact CR/payload/dossiers existants ; conversion sur virgules). Branché dans [`EyeExamSection`](src/components/forms/EyeExamSection.tsx) (Divers, par œil) et [`HypothesesSection`](src/features/consultation/components/HypothesesSection.tsx). Nouvelles catégories `divers` / `hypothesesLibres` ([`defaultSuggestions.ts`](src/constants/defaultSuggestions.ts), [`settings.ts`](src/types/settings.ts)), mémoire via `updateBulles` (helper `persistSuggestion` dans [`Consultation.tsx`](src/pages/Consultation.tsx)).
- [x] **Lot 2 — Retrait des cases OCT antérieur/OCTA + dérivation auto.** [`ExamTypeSelector`](src/features/consultation/components/ExamTypeSelector.tsx) réduit au type d'examen + médecin. Dans [`useConsultationForm`](src/features/consultation/hooks/useConsultationForm.ts), `octaDone`/`showAnterior` deviennent **dérivés** des `retinaSlots` des 2 yeux (coupe `octa` ⇒ OCTA ; `cornea`/`angle` ⇒ segment antérieur) — states `forceShowAnterior`/`forceShowPosterior`/`octaDone` supprimés ; `ConsultationDraft.forceShowAnterior`/`octaDone` passés optionnels (compat brouillons). BubblePicker « Observations OCTA » retiré d'`EyeExamSection`. Flags CR (`anteriorSegmentDone`/`octaDone` du payload) inchangés.
- [x] **Lot 3 — Bouton RetinaSketch unique.** Boutons par œil retirés d'`EyeExamSection` (props `onOpenRetina`/`octaDone`, import `Pencil`, `annotationCount` supprimés) ; un seul bouton central entre les colonnes dans `Consultation` avec badge du total de lésions validées (`retinaLesionCount`).
- [x] **Lot 4 — Suppression des presets RNFL.** Boutons « Tout normal / Arciforme inf/sup / Miroir N↔T » et fonctions `preset`/`mirror` retirés de [`RnflGclPicker`](src/components/forms/RnflGclPicker.tsx). Le cercle central « tout » (cycle) est conservé.
- [x] **Lot 5 — Encadré commun disque + suivi.** Nouveau [`SharedDiscFollowUpSection`](src/components/forms/SharedDiscFollowUpSection.tsx) sous les colonnes : disque OD/OG (exclusion + **surface puis C/D**, ordre Tab Surface OD→C/D OD→Surface OG→C/D OG) et suivi RNFL/GCL mutualisé (interrupteur + date communs via helpers `setFollowUpEnabled`/`setFollowUpDate` du hook ; évolutions par œil). Helpers C/D extraits dans [`utils/cupDisc.ts`](src/utils/cupDisc.ts). `EyeExamSection` allégé (ne garde qu'exclusion RNFL/GCL + picker, `isOCT` only) ; sync suivi alambiquée retirée des `onUpdate` OD/OG.

---

### Session 2026-08-14 — Synchro Vercel + combobox médecin prescripteur (Accueil/Modif patient)

**Demandé par :** Yoan
**Statut :** ✅ Terminé — `tsc --noEmit` 0 erreur. Vite compile, aucune erreur console/serveur. Vérif UI live non faite (app derrière l'écran de connexion Firebase → pas de saisie d'identifiants).
**Branche :** `feat/retinasketch-v2-port` → fusionnée dans `main`.

#### Synchronisation Git/Vercel
- Push des 4 commits en attente vers `origin` (`Medivision_v3`), puis fusion fast-forward dans `main` + push → déploiement **production** sur `medivision-v3.vercel.app`.
- Clarification des environnements : le dossier `MEDIVISION v3 IA` a longtemps eu 2 remotes (`origin` = `Medivision_v3` ; `medivision-v1` = `MEDIVISION_IA_V1`) alimentant 2 projets Vercel (`medivision-v3`, `medivision-ia-v1`). **Environnement actif retenu = v3.**
- Nettoyage : `.vercel/project.json` local repointé vers `medivision-v3` ; remote `medivision-v1` supprimé ; dépôt GitHub `MEDIVISION_IA_V1` **archivé** (lecture seule, réversible). Suppression des projets Vercel obsolètes = à faire manuellement dans le dashboard (hors outillage).

#### Correctif — champ « Médecin prescripteur »
- **Cause** : le Lot A n'avait remplacé le `<select>` natif que dans `ExamTypeSelector`. Deux autres écrans utilisaient encore un `<select>` HTML (non trié, saut à la 1re lettre du texte « Dr. » inclus).
- [x] Nouveau composant [`PrescriberCombobox.tsx`](src/components/forms/PrescriberCombobox.tsx) : jumeau de `DoctorCombobox` mais opérant sur `string[]` (source `settings.prescripteurs`). Filtrage clavier insensible casse/accents, tri alphabétique en occultant `Dr.`/`Pr.` (`stripTitle`), navigation ↑/↓/↵/échap, option « — Non spécifié — », bouton effacer.
- [x] Branché dans [`Accueil.tsx`](src/pages/Accueil.tsx) et [`PatientEditModal.tsx`](src/components/modals/PatientEditModal.tsx), en conservant le bouton « + » d'ajout de médecin.
- **Note dette technique** : deux modèles de « médecin » coexistent — objets `Doctor{id,prenom,nom}` (`settings.doctors`, via `DoctorCombobox`) vs noms libres `string[]` (`settings.prescripteurs`, via `PrescriberCombobox`). À unifier ultérieurement.

---

### Session 2026-08-13 — Lot A : combobox médecins + exclusions RNFL/GCL & disque

**Demandé par :** Yoan
**Statut :** ✅ Terminé — `tsc --noEmit` 0 erreur, 18 tests Vitest verts. Vérif UI live des 2 features non faite (nécessite une consultation avec patient en salle d'attente → éviter de polluer Firestore).
**Branche :** `feat/retinasketch-v2-port`
**Contexte :** premier des 3 lots planifiés (Lot A = saisie ; Lot B = RetinaSketch multi-images cercle/carré/rectangle ; Lot C = rapport OCT multipage).

#### A1 — Combobox médecins (recherche + tri alphabétique)
- [x] Nouveau composant [`DoctorCombobox.tsx`](src/components/forms/DoctorCombobox.tsx) : choix unique, filtrage au clavier (nom/prénom, insensible casse+accents), navigation ↑/↓/↵/échap, bouton effacer. Tri alphabétique sur `nom` en **occultant** tout préfixe civilité (`Dr.`/`Pr.`/`Docteur`/`Professeur`) via `stripTitle`, tri secondaire sur le prénom.
- [x] [`ExamTypeSelector.tsx`](src/features/consultation/components/ExamTypeSelector.tsx) : le `<select>` médecin est remplacé par `<DoctorCombobox>`. Source unique = `settings.doctors` (la liste en dur de `constants.ts` reste ignorée).

#### A2 — Exclure RNFL/GCL et disque quel que soit l'indice d'acquisition
- [x] **Découplage de l'indice d'acquisition** : la condition `&& (acquisitionQuality === 'faible' | 'impossible')` est retirée. Les exclusions agissent désormais même en acquisition « bon ». Impacté : [`reportDataMapper.tsx`](src/utils/reportDataMapper.tsx), [`clinicalPayload.ts`](src/utils/clinicalPayload.ts), [`EyeExamSection.tsx`](src/components/forms/EyeExamSection.tsx).
- [x] **Deux cases indépendantes** : nouveau champ `excludeDisc` (à côté de `excludeRnflGcl`) dans [`types/clinical.ts`](src/types/clinical.ts) + défaut `false` dans [`clinicalData.ts`](src/utils/clinicalData.ts). UI : deux boutons-bascule dans `EyeExamSection` (RNFL/GCL toujours dispo en OCT ; disque dispo en OCT/nerf optique) ; le bloc C/D + surface est masqué si le disque est exclu.
- [x] **Propagation compte rendu** : `excludeDisc` → `discSurface`/`cupDisc`/`cupDiscFlag` mis à `undefined` dans le mapper (les jauges C/D disparaissent naturellement du CR) ; flag `discExcluded` ajouté à `EyeData` ([`types/report.ts`](src/types/report.ts)).
- [x] **Propagation payload IA** : `discExcluded` → clé `disque_non_interpretable: true`, `cup_disc_vertical`/`discSurface` retirés du payload quand exclus.
- [x] **Compatibilité** : `excludeDisc` optionnel à défaut `false` → dossiers déjà enregistrés inchangés.

#### Lot B (en cours) — RetinaSketch galerie multi-images (cercle/carré/rectangle)
**Décision d'architecture (Yoan)** : refonte unifiée (pas de feature « OCTSketch » séparée) ; la rétino devient le 1er slot d'une galerie de N images/œil, chacune avec sa géométrie. Pas de migration des anciens scans (logiciel en dev). Livraison **par phases vérifiables**.
- [x] **Phase 1 — modèle + store** : types `ImageKind`/`ImageGeometry` + mapping type→forme (rétino = cercle ; OCT-A + en-face = carré ; B-scan = rectangle) dans [`lib/types.ts`](src/features/retinasketch/lib/types.ts). Store [`useStore.ts`](src/features/retinasketch/store/useStore.ts) : chaque œil porte `slots: SlotMeta[]` + `activeSlot` + `slotStash`. Mécanisme d'**échange** : les données du slot actif restent dans les champs existants (`backgrounds`/`anatomy`/`views`/`annotations`), les inactifs sont rangés dans le stash → **aucun des 15 composants consommateurs n'est touché**, comportement identique (1 slot rétino/œil au départ). Actions `addSlot`/`selectSlot`/`removeSlot`/`updateSlotMeta` ; `resetAll` réinitialisé. Vérif : `tsc` 0, 18 tests verts, Vite compile.
- [x] **Phase 2a — galerie UI** : nouveau [`SlotGallery.tsx`](src/features/retinasketch/components/SlotGallery.tsx) (bande de miniatures sous chaque œil, pastille de forme, bouton « + » → menu 4 types, sélection/suppression). [`EyePane.tsx`](src/features/retinasketch/components/EyePane.tsx) restructuré en colonne flex (zone de dessin + galerie).
- [x] **Phase 2b — persistance multi-slots** : `RetinaSlotSnapshot` + `EyeState.retinaSlots` ([`clinical.ts`](src/types/clinical.ts)) ; `RetinaCommit` enrichi (`odSlots`/`ogSlots`) + sérialisation de toute la galerie à la fermeture via `collectEyeSlots`, restauration via `hydrateEyeSlots` ([`RetinaEditor.tsx`](src/features/retinasketch/components/RetinaEditor.tsx), [`useStore.ts`](src/features/retinasketch/store/useStore.ts)) ; [`Consultation.tsx`](src/pages/Consultation.tsx) passe/persiste `retinaSlots` (+ pont slot rétino → `retinaBackground`/`retinaAnnotations` pour le CR actuel). ⚠️ **Risque taille Firestore** : N images JPEG par consultation → un document pourrait dépasser ~1 Mo (stockage image hors-document à prévoir).
- [x] **Phase 3 — stage géométrique** : helpers `fieldShape`/`fieldHalfExtentsMm` ([`template.ts`](src/features/retinasketch/lib/geometry/template.ts)). [`RetinaStage.tsx`](src/features/retinasketch/components/RetinaStage.tsx) : contour + `clipFunc` cercle/carré/rectangle selon la géométrie du slot actif ; repères rétiniens (périphérie/fovéa/quadrants/ETDRS/anatomie/vaisseaux + anatomie détectée) réservés au type rétino. [`BackgroundImage.tsx`](src/features/retinasketch/components/BackgroundImage.tsx) : clip d'image rond (masque radial) pour cercle, net pour carré/rectangle. `EyePane` : recadrage auto sauté hors rétino.
- [x] **Phase 4 — remontée CR** : type `ReportImageSlot` + `EyeData.imagerySlots` ([`report.ts`](src/types/report.ts)) ; [`reportDataMapper.tsx`](src/utils/reportDataMapper.tsx) remonte les slots complémentaires (B-scan/OCT-A/en-face + image + annotations) hors rétino. **Pont prêt pour le Lot C** (rendu multipage à venir ; les images ne sont pas encore affichées dans le CR).

**Vérifs Lot B** : `tsc --noEmit` 0, 18 tests Vitest verts, `vite build` OK. ⚠️ Non vérifié visuellement (éditeur accessible seulement via une consultation avec patient — non créée pour ne pas polluer Firestore).

#### Lot B — correctifs post-recette (retours Yoan)
- [x] **OCT-A carré** : `GEOMETRY_FOR_KIND.octa` passe de `circle` à `square` (acquisition carrée comme l'en-face) — [`types.ts`](src/features/retinasketch/lib/types.ts).
- [x] **Menu « + » masqué** : la bande galerie clippait son menu (`overflow-x-auto`) et passait derrière la zone de dessin. [`SlotGallery.tsx`](src/features/retinasketch/components/SlotGallery.tsx) : miniatures dans un conteneur scrollable interne, bouton « + » HORS scroll, bande en `relative z-30`, menu `z-50`.
- [x] **Barre « à identifier ↵ » disparue** : la `DraftBar` (`bottom-6 z-20`) était recouverte par la galerie (`z-30`). Remontée à `bottom-28 z-40` — [`DraftBar.tsx`](src/features/retinasketch/components/DraftBar.tsx).
- [x] **Overlay de dépôt rond sur slots carrés/rect** : forme de l'overlay adaptée à la géométrie du slot actif — [`EyePane.tsx`](src/features/retinasketch/components/EyePane.tsx).
- [x] **Flèche non effaçable après identification** : au clic simple, une flèche (brouillon OU validée) sous le curseur est désormais effacée ; limite de dessin (`insideField`) adaptée à la forme cercle/carré/rectangle — [`RetinaStage.tsx`](src/features/retinasketch/components/RetinaStage.tsx).
- [x] **Identification multi-images en une fois** : `assignLesion` valide tous les brouillons de la galerie (slots actifs + rangés, deux yeux) → une même lésion marquée sur B-scan + rétino + œil controlatéral s'identifie d'un geste. Décompte « à identifier » via `countAllDrafts` (actifs + rangés) dans `DraftBar`/`Workspace`/`CommandPalette` — [`useStore.ts`](src/features/retinasketch/store/useStore.ts).
- [x] **Responsive barre d'outils** : `header` en `flex-wrap` + `min-h-12` → « Terminer » reste visible sur petit écran (plus de débordement) — [`Workspace.tsx`](src/features/retinasketch/components/Workspace.tsx).
- [ ] **Impression multi-vues selon les coupes sélectionnées** (traité au **Lot C**, décisions ci-dessous).

#### Lot C (en cours) — Rapport OCT multipage
**Décisions (Yoan)** : layout **option 1** (B-scan sous chaque rétino, vignettes OCT-A/en-face à part) ; la **sélection des coupes se fait dans le menu impression RetinaSketch** (miniatures cliquables) et pilote **impression ET compte rendu**.
- [x] **C1 — structure multipage + rendu imagerie** : [`OCTReport.tsx`](src/components/reports/OCTReport.tsx) refactoré en sections partagées (`Masthead`/`MetaSection`/`ClinicalTextBlocks`/`SignatureFooter`) + `ImagerySection`. **Conditionnel** : mono-page si aucune imagerie (inchangé), sinon page 1 (header+meta+schémas+imagerie) / page 2 (Analyse+Conclusion+Synthèse+signature) avec en-tête compact de continuité. B-scan (rect) sous chaque œil, vignettes OCT-A/en-face (carré) à part. CSS : styles imagerie + sauts de page print ([`OCTReport.css`](src/components/reports/OCTReport.css)). Vérif : `tsc` 0, 18 tests, compile. ⚠️ Non vérifié visuellement (nécessite une consultation + génération).
- [x] **C2 — annotations reproduites** : nouveau [`ImagerySlotSvg.tsx`](src/components/reports/visual/ImagerySlotSvg.tsx) (variante géométrique rect/carré de `RetinaSchemaSvg`) — image alignée + colorimétrie + annotations (flèches/spots/surfaces) projetées sous le même transform que l'éditeur, clip rect/carré. `ReportImageSlot` enrichi du snapshot complet (`background`) au lieu du seul `src` ([`report.ts`](src/types/report.ts), [`reportDataMapper.tsx`](src/utils/reportDataMapper.tsx)).
- [x] **C3 — sélection des coupes** : flag `printSelected` par slot (défaut true) dans `SlotMeta` + action `toggleSlotPrint`, persisté (`RetinaSlotSnapshot.printSelected`, commit/restore). Le CR filtre `imagerySlots` sur `printSelected`. [`DoubleEyeView.tsx`](src/features/retinasketch/components/DoubleEyeView.tsx) : composant `EyeImagery` = bande de miniatures cliquables (toggle, masquée à l'impression) + rendu des scans sélectionnés via `ImagerySlotSvg`. Une seule sélection → impression **et** compte rendu.
- [x] **C4 — export PDF multipage** : [`pdfExportService.ts`](src/services/pdfExportService.ts) capture le conteneur entier si plusieurs `.page` (chaque page = 297mm → une feuille A4), blocs imagerie ajoutés à `avoid`. L'impression navigateur ([`printService.ts`](src/services/printService.ts)) fonctionne déjà via le `@media print { .page { break-after: page } }` de [`OCTReport.css`](src/components/reports/OCTReport.css).

**Vérifs Lot C** : `tsc --noEmit` 0, 18 tests Vitest verts, `vite build` OK. ⚠️ Non vérifié visuellement (rapport visible seulement après consultation + génération).

#### Lot C — corrections post-recette (retours Yoan)
- [x] **Priorité rétino à l'impression** : l'aperçu `DoubleEyeView` affichait le slot *actif* (aléatoire). Un `useEffect` force désormais le slot **rétino** actif de chaque œil à l'ouverture du menu impression — [`DoubleEyeView.tsx`](src/features/retinasketch/components/DoubleEyeView.tsx).
- [x] **Restructuration du rapport** (inversion de la mise en page) : **page 1 = résumé clinique** (infos patient + encadré RNFL/GCL/disc/CD + Analyse + Conclusion + Synthèse & suivi + signature) ; **annexe (pages ≥ 2) = images** (rétinographies puis B-scan/OCT-A/en-face/cornée/angle IC). Sous chaque image : **légende des lésions (codes couleurs) en évidence** (`LesionLegend`). `VisualClinicalSection` rendu modulaire (`mode` : `neuro` page 1 / `schema` annexe / `full` legacy) — [`OCTReport.tsx`](src/components/reports/OCTReport.tsx), [`VisualClinicalSection.tsx`](src/components/reports/visual/VisualClinicalSection.tsx), [`OCTReport.css`](src/components/reports/OCTReport.css).
- [x] **Nouveaux types d'images** : `cornea` (OCT antérieur cornée) et `angle` (OCT antérieur angle irido-cornéen), tous deux **rectangulaires** — ajoutés à `ImageKind`/`GEOMETRY_FOR_KIND`/`LABEL_FOR_KIND` ([`types.ts`](src/features/retinasketch/lib/types.ts)) et au menu « + » ([`SlotGallery.tsx`](src/features/retinasketch/components/SlotGallery.tsx)).

**Vérifs corrections** : `tsc --noEmit` 0, 18 tests verts, `vite build` OK.

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
