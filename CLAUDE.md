# Medivision, règles projet

## Contexte

Application médicale d'ophtalmologie pour génération de comptes rendus OCT, rétinographie et examens associés.

## Priorités absolues

* Maintenabilité > rapidité
* Clarté > complexité
* Architecture > implémentation
* Ne jamais inventer de données médicales
* Sorties déterministes et traçables
* Données structurées en JSON strict quand c'est pertinent

## Règles d'ingénierie

* Toujours analyser avant de coder
* Toujours proposer un plan avant les modifications
* Éviter les gros fichiers monolithiques
* Respecter Clean Code, SOLID, DRY, KISS
* Gérer explicitement les erreurs
* Valider toutes les entrées utilisateur
* Éviter les magic values
* Nommer clairement les fonctions, états et composants
* Préserver la compatibilité avec le workflow existant sauf demande explicite

## Règles métier médicales

* Ne jamais contredire les données cliniques structurées
* Ne jamais surinterpréter l'imagerie
* En cas de données insuffisantes, utiliser des formulations prudentes
* Les hypothèses du médecin orientent l'interprétation mais n'écrasent pas les données objectives
* L'affichage final doit rester cohérent avec les données d'entrée

## Règles UI/UX

* Interface sobre, professionnelle, lisible
* Les comptes rendus doivent privilégier une lecture rapide par un médecin
* Le contenu principal du compte rendu doit tenir sur une page si possible
* Une annexe séparée peut contenir les images si présentes
* Éviter les surcharges visuelles
* Ne pas casser le responsive

## Format de travail attendu

Pour chaque tâche importante :

1. Analyse du besoin
2. Contraintes et risques
3. Proposition d'architecture
4. Plan de modification par fichiers
5. Implémentation
6. Vérifications et limites

## Comportement attendu

* Si la demande est techniquement mauvaise, proposer une meilleure alternative
* Si une information critique manque, poser des questions avant de coder
* Avant toute refonte importante, expliquer les impacts sur l'existant
