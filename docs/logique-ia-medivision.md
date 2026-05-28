# Logique IA de Medivision Studio

Document technique destiné à un programmeur qui doit comprendre, maintenir ou faire évoluer la génération IA des comptes rendus OCT / rétinographie.

## 1. Résumé fonctionnel

Medivision Studio ne demande pas directement à l'IA d'interpréter un écran ou un texte libre. L'application construit d'abord des données cliniques structurées à partir du formulaire de consultation, les nettoie, les normalise, ajoute une pré-analyse déterministe, puis envoie un payload JSON strict à une API serveur. Le serveur choisit le fournisseur IA configuré, transmet les données avec un prompt système médical, parse la réponse, valide son schéma, puis renvoie un résultat structuré au front-end.

Point important : le pipeline actif n'envoie pas un fichier Markdown brut à l'IA. Le flux réel est JSON -> IA -> JSON. Il existe seulement un nettoyage léger de Markdown dans l'affichage final, car certains modèles peuvent renvoyer des puces ou du gras Markdown dans les listes.

## 2. Chaîne de traitement globale

1. Le médecin remplit le formulaire de consultation.
2. `Consultation.tsx` construit un objet brut `rawInputJson`.
3. `normalizeClinicalData()` nettoie et normalise les données.
4. `buildClinicalSummary()` produit une pré-analyse clinique déterministe.
5. `buildAIPayload()` assemble le payload final envoyé à l'IA.
6. `callNativeAI()` poste ce payload vers `/api/ai/generate-report`.
7. L'API serveur lit la configuration IA, appelle OpenAI, Anthropic, DeepSeek ou Gemini.
8. Le serveur parse et valide le JSON retourné par l'IA.
9. Le front-end mappe le résultat IA vers le composant de compte rendu.
10. Le compte rendu est affiché, sauvegardé et exportable.

## 3. Fichiers clés

| Fichier | Rôle |
| --- | --- |
| `src/pages/Consultation.tsx` | Orchestrateur principal du pipeline IA côté interface. |
| `src/utils/clinicalPayload.ts` | Nettoyage, normalisation et suppression des champs vides. |
| `src/utils/clinicalSummary.ts` | Pré-analyse déterministe des anomalies et suspicions. |
| `src/utils/aiPayload.ts` | Construction du payload JSON envoyé au serveur IA. |
| `src/services/aiManager.ts` | Client HTTP qui appelle `/api/ai/generate-report`. |
| `api/ai/generate-report.ts` | API serveur : prompt système, fournisseurs IA, parsing, validation. |
| `src/utils/reportDataMapper.tsx` | Transformation du résultat IA en données exploitables par le compte rendu. |
| `src/components/reports/OCTReport.tsx` | Affichage final du compte rendu et nettoyage visuel léger. |
| `src/types/ai.ts` | Contrats TypeScript du payload et de la réponse IA. |
| `src/types/clinical.ts` | Contrats TypeScript des données cliniques brutes et normalisées. |

## 4. Étape 1 - construction des données brutes

Le point d'entrée est la fonction `soumettreIA()` dans `src/pages/Consultation.tsx`.

Elle construit `rawInputJson` à partir de trois sources :

- les informations patient sélectionnées dans la file d'attente ;
- les champs du formulaire de consultation ;
- les paramètres du compte rendu comme le type d'examen, OCTA, segment antérieur et qualité d'acquisition.

Structure simplifiée :

```ts
const rawInputJson = {
  patient: { nom, age, date_naissance },
  contexte: {
    prescripteur,
    motifs,
    antecedents,
    hypotheses_diagnostiques,
    hypothese_libre,
  },
  oeil_droit: form.eyeOD,
  oeil_gauche: form.eyeOG,
  reportType,
  anteriorSegmentDone,
  octaDone,
  acquisitionQualityOD,
  acquisitionQualityOG,
};
```

Cette étape est volontairement proche du formulaire : elle capture l'état clinique tel qu'il existe dans l'interface, sans demander encore à l'IA de raisonner.

## 5. Étape 2 - nettoyage et normalisation

La fonction `normalizeClinicalData()` transforme les données brutes en données propres et plus stables.

Les règles principales sont :

- `cleanString()` transforme les valeurs non textuelles en chaîne vide et supprime les espaces inutiles ;
- `cleanArray()` supprime les valeurs vides et les doublons ;
- `toNumberIfPossible()` convertit les nombres saisis en texte vers des nombres quand c'est possible ;
- `removeEmptyFields()` supprime récursivement les champs vides, nuls, tableaux vides et objets vides ;
- les observations plates du formulaire sont regroupées dans `observations`.

Exemple métier important :

- une acquisition "Bon" n'est pas envoyée, car elle est considérée comme implicite ;
- `octaPerformed: false` n'est pas envoyé, pour éviter que l'IA écrive "OCTA non réalisé" ;
- les statuts RNFL/GCL normaux ne sont pas transmis, pour concentrer la génération sur les anomalies utiles.

Cette étape réduit le bruit envoyé à l'IA et limite fortement le risque de phrases inutiles sur des données absentes.

## 6. Étape 3 - pré-analyse clinique déterministe

La fonction `buildClinicalSummary()` produit une analyse automatique locale avant l'appel IA. Elle ne génère pas de texte final, elle extrait des signaux.

Elle analyse chaque oeil avec des règles déterministes :

- suspicion glaucomateuse si Cup/Disc élevé, RNFL aminci ou excavation papillaire ;
- suspicion de rétinopathie diabétique si le contexte diabétique est associé à des signes compatibles ;
- suspicion DMLA si drusen ou remaniements maculaires ;
- membrane épirétinienne ou anomalie d'interface vitréo-maculaire selon les observations.

La sortie contient :

```ts
{
  analyse_clinique: {
    oeil_droit: { anomalies, patterns, suspicion },
    oeil_gauche: { anomalies, patterns, suspicion }
  },
  hypotheses_medecin
}
```

Cette pré-analyse sert de garde-fou : l'IA reçoit les données objectives et une synthèse logique déjà calculée par l'application.

## 7. Étape 4 - construction du payload IA

La fonction `buildAIPayload()` assemble le JSON final envoyé au serveur.

Le payload contient :

- `meta` : type de document, version de schéma, langue et libellé original ;
- `patient` : données patient normalisées ;
- `contexte` : prescripteur, motifs, antécédents, hypothèses ;
- `donnees_cliniques` : données OD/OG normalisées ;
- `analyse_clinique` : pré-analyse déterministe ;
- `hypotheses_medecin` : hypothèses explicites du médecin ;
- `instructions_generation` : contraintes de génération.

Les instructions importantes sont :

- style médical professionnel ;
- niveau synthétique ;
- ne pas inventer ;
- analyse clinique limitée à 4 phrases ;
- focus sur les anomalies significatives ;
- interdiction de mentions comme "non réalisé", "non transmis", "aucune donnée".

## 8. Étape 5 - appel front-end vers serveur IA

`callNativeAI()` dans `src/services/aiManager.ts` effectue un `POST` vers `/api/ai/generate-report`.

Le front-end n'appelle pas directement OpenAI, Gemini ou un autre fournisseur. Les clés API restent côté serveur.

En cas d'erreur HTTP, le service tente de lire un message serveur et lève une exception claire.

## 9. Étape 6 - API serveur et fournisseurs IA

Le fichier `api/ai/generate-report.ts` contient :

- le prompt système médical ;
- la liste des fournisseurs supportés : `openai`, `anthropic`, `deepseek`, `gemini` ;
- la lecture des variables d'environnement ;
- les adaptateurs propres à chaque fournisseur ;
- le parsing et la validation de la réponse.

Variables attendues :

- `AI_PROVIDER` : fournisseur actif ;
- `AI_MODEL` : modèle à utiliser ;
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY` ou `GEMINI_API_KEY` selon le fournisseur.

En local, le serveur peut charger `.env.local` ou `.env` si `AI_PROVIDER` n'est pas déjà présent.

## 10. Prompt système

Le prompt système impose à l'IA un rôle d'ophtalmologue senior et un format de sortie JSON strict.

La réponse attendue est :

```json
{
  "analyse_clinique": "3 à 4 phrases synthétiques orientées raisonnement clinique.",
  "conclusion": "Synthèse diagnostique pure.",
  "prevention": ["item 1", "item 2"],
  "suivi": ["item 1", "item 2"],
  "severite": "normal | surveillance | alerte"
}
```

Règles critiques :

- ne générer une section que si des données pertinentes sont transmises ;
- ne jamais inventer de données ;
- répondre uniquement en JSON strict ;
- ne pas signaler l'absence d'un examen ;
- ne pas répéter textuellement les valeurs brutes ;
- séparer diagnostic, prévention et suivi.

## 11. Étape 7 - parsing et validation de la réponse IA

La fonction `parseAndValidate()` reçoit le texte brut du modèle.

Elle applique deux protections :

1. Extraction d'un objet JSON même si le modèle a ajouté du texte autour.
2. Validation des champs obligatoires.

Champs obligatoires :

- `analyse_clinique` doit être une chaîne ;
- `conclusion` doit être une chaîne ;
- `prevention` doit être un tableau ;
- `suivi` doit être un tableau ;
- `severite` doit valoir `normal`, `surveillance` ou `alerte`.

Si le JSON est invalide, le serveur renvoie une erreur 502 avec un score rouge.

Si le JSON est exploitable mais incomplet, le serveur renvoie un résultat de secours et un score orange.

Si tout est conforme, le score est vert.

## 12. Étape 8 - mapping vers le compte rendu

Une fois le résultat IA reçu, `Consultation.tsx` appelle `mapAIResultToOCTReportData()`.

Ce mapping fusionne :

- les données cliniques brutes utiles à l'affichage ;
- le texte IA structuré ;
- les informations du médecin ;
- le numéro de dossier ;
- les badges éventuels ;
- le délai de contrôle éventuel.

Le composant `OCTReport.tsx` affiche ensuite :

- données patient ;
- indication et antécédents ;
- OD/OG ;
- analyse clinique ;
- conclusion ;
- prévention ;
- suivi ;
- signature.

Le rapport est ensuite sauvegardé via `saveReport()`, le brouillon est supprimé, et l'interface bascule vers la vue compte rendu.

## 13. Nettoyage du Markdown en sortie

Le composant `OCTReport.tsx` contient `stripItem()`.

Cette fonction supprime uniquement des artefacts visuels fréquents :

- tirets ou puces au début d'un item ;
- gras Markdown `**texte**`.

Ce nettoyage ne transforme pas la logique médicale. Il sert seulement à rendre propres les listes `prevention` et `suivi` si le modèle n'a pas parfaitement respecté le JSON sans Markdown.

## 14. Gestion des erreurs

Le pipeline gère explicitement plusieurs erreurs :

- absence de patient sélectionné ;
- échec de normalisation clinique ;
- échec de construction du résumé clinique ;
- payload IA vide ou insuffisant ;
- serveur IA non configuré ;
- fournisseur IA inconnu ;
- modèle absent ;
- clé API absente ;
- erreur fournisseur ;
- réponse IA non parsable ;
- réponse IA incomplète.

Côté utilisateur, les erreurs sont actuellement affichées par `alert()`. Côté développeur, elles sont loggées avec `[IA] Erreur pipeline:`.

## 15. Responsabilités médicales

Le système est conçu pour limiter les hallucinations :

- les données normales implicites sont souvent omises ;
- les données absentes ne doivent pas être commentées ;
- les hypothèses du médecin sont transmises mais ne doivent pas écraser les données objectives ;
- l'IA doit synthétiser les anomalies, pas inventer un diagnostic complet sans support ;
- le résultat doit rester cohérent avec le payload d'entrée.

Le point sensible reste que la cohérence médicale finale dépend du modèle. La validation actuelle vérifie surtout la forme JSON, pas la vérité médicale phrase par phrase.

## 16. Pseudo-code du flux

```ts
async function soumettreIA() {
  const rawInputJson = collecterDonneesFormulaireEtPatient();
  const normalizedJson = normalizeClinicalData(rawInputJson);
  const clinicalSummary = buildClinicalSummary(normalizedJson);
  const aiPayload = buildAIPayload(normalizedJson, clinicalSummary, reportType);

  const { result, validation } = await callNativeAI(aiPayload);

  const reportData = mapAIResultToOCTReportData(
    rawInputJson,
    result,
    practitioner,
    folderId
  );

  setJsonValidation(validation);
  setOctReportData(reportData);
  saveReport(reportData);
  deleteDraft(patientId);
  showReportView();
}
```

## 17. Points d'attention pour un programmeur

- Ne pas envoyer de texte libre ou Markdown à la place du JSON sans revoir tout le contrat serveur.
- Ne pas supprimer `removeEmptyFields()` sans risque d'augmenter les mentions inutiles dans les comptes rendus.
- Ne pas mélanger conclusion et suivi : le prompt impose une séparation stricte.
- Ne pas exposer les clés API côté front-end.
- Toute nouvelle donnée clinique doit être ajoutée dans les types, la normalisation, le payload IA et le mapping d'affichage si elle doit apparaître dans le rapport.
- Toute nouvelle règle médicale déterministe devrait idéalement être ajoutée dans `clinicalSummary.ts`, pas seulement dans le prompt.
- La validation actuelle est structurelle ; une validation médicale plus poussée nécessiterait des règles supplémentaires.

## 18. Améliorations possibles

1. Ajouter une validation JSON plus stricte par schéma partagé entre front-end et serveur.
2. Journaliser le payload IA anonymisé pour audit technique.
3. Ajouter une validation de cohérence entre les anomalies d'entrée et les phrases de sortie.
4. Remplacer les `alert()` par une UI d'erreur médicale plus professionnelle.
5. Ajouter des tests unitaires sur `normalizeClinicalData()`, `buildClinicalSummary()` et `parseAndValidate()`.
6. Versionner explicitement le prompt système pour tracer les changements de génération.
7. Prévoir un mode "prévisualisation payload" pour les développeurs, sans données patient identifiantes.

## 19. Conclusion

La logique IA de Medivision Studio repose sur une architecture prudente : l'application prépare les données, réduit le bruit, produit une pré-analyse déterministe, puis demande à l'IA de rédiger une synthèse JSON strictement encadrée. Le modèle n'est donc pas la source unique de vérité ; il intervient comme moteur rédactionnel contrôlé par des données structurées, un prompt médical et une validation de schéma.
