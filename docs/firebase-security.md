# Sécurité Firebase — Medivision

## État actuel (audit du 2026-04-30)

### Collections Firestore utilisées

| Collection | Document(s) | Opérations |
|---|---|---|
| `patients` | Multi-documents | CREATE, READ, UPDATE (pas de DELETE) |
| `settings` | `clinic` (singleton) | READ, WRITE (setDoc) |

### Opérations par collection

#### `patients`

| Opération | Fichier | Détail |
|---|---|---|
| CREATE | `src/pages/Accueil.tsx:130` | Ajout d'un nouveau patient (`statut: en_attente`) |
| READ liste | `src/pages/Patients.tsx:26` | Tous les patients, triés par date |
| READ temps réel | `src/pages/Consultation.tsx:58` | Salle d'attente (`statut == en_attente`), `onSnapshot` |
| READ filtré | `src/services/waitingRoomService.ts:5` | Patients en attente avant archivage |
| UPDATE info | `src/components/modals/PatientEditModal.tsx:127` | Modification des données patient |
| UPDATE statut | `src/pages/Patients.tsx:61` | Remise en salle d'attente |
| UPDATE batch | `src/services/waitingRoomService.ts:11` | Archivage en masse (`statut: traite`) |

#### `settings`

| Opération | Fichier | Détail |
|---|---|---|
| READ | `src/hooks/useSettings.ts:60` | Chargement des paramètres clinique/médecins/formulaires |
| WRITE | `src/hooks/useSettings.ts:69,87` | Création ou mise à jour complète (setDoc) |

### Persistance hors Firestore

| Donnée | Stockage | Fichier |
|---|---|---|
| Comptes rendus sauvegardés | `localStorage` | `src/services/reportStorage.ts` |
| Brouillons de consultation | `sessionStorage` | `src/hooks/useConsultationDrafts.ts` |
| Cache paramètres | `localStorage` | `src/hooks/useSettings.ts` (clé `medivision_settings_cache`) |

---

## Risques identifiés

### Risque 1 — Absence de Firebase Auth ⚠️ CRITIQUE

**Situation :** Aucune authentification n'est implémentée. L'application accède à Firestore
sans que l'utilisateur soit identifié.

**Impact potentiel :** Si les règles Firestore actuelles du projet Firebase sont en mode
`allow read, write: if true` (règles par défaut de développement), n'importe qui connaissant
l'`apiKey` du projet peut lire ou modifier tous les patients et paramètres.

**Vérification :** Consulter la console Firebase → Firestore → Règles pour voir les règles
actuellement actives.

### Risque 2 — Credentials hardcodés dans le code source

**Fichier :** `src/services/firebase.ts` lignes 23–29

Les clés Firebase (`apiKey`, `projectId`, etc.) sont directement dans le code source.
Si le dépôt est public ou partagé, ces identifiants sont exposés.

> Note : l'`apiKey` Firebase est techniquement semi-publique (nécessaire côté client),
> mais les règles Firestore sont la vraie barrière de sécurité. Sans règles strictes,
> l'exposition de la clé est critique.

**Correction :** Déplacer vers `.env.local` :
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### Risque 3 — Données patient en localStorage

Les comptes rendus générés sont stockés localement (`localStorage`).
Ils ne bénéficient d'aucun chiffrement ni contrôle d'accès côté navigateur.

---

## Plan de sécurisation en 2 étapes

### Étape A — Préparation (actuelle, sans impact sur l'app)

**Objectif :** Préparer les règles sans les déployer.

- [x] Créer `firebase.json`
- [x] Créer `firestore.rules` sécurisées (non déployées)
- [x] Créer `firestore.indexes.json` avec les index existants
- [x] Créer cette documentation

**Les règles créées dans `firestore.rules` sont strictes mais NON actives.**
L'application continue de fonctionner avec les règles actuelles de la console Firebase.

---

### Étape B — Vraie sécurisation (Phase 2)

#### B1 — Intégration Firebase Auth

Ajouter l'authentification par email/mot de passe :

```bash
# Le SDK Firebase Auth est déjà inclus dans le package firebase
# Pas besoin d'installation supplémentaire
```

Fichiers à créer :
- `src/services/auth.ts` — initialisation `getAuth`, fonctions `signIn`, `signOut`
- `src/hooks/useAuth.ts` — état d'authentification global
- `src/pages/Login.tsx` — page de connexion
- `src/components/ProtectedRoute.tsx` — wrapper de protection des routes

#### B2 — Custom Claims pour les rôles

Les rôles sont définis via Firebase Admin SDK (backend uniquement) :

```typescript
// Exemple via Cloud Function ou script d'admin
await admin.auth().setCustomUserClaims(uid, { role: 'medecin' });
```

Rôles prévus :

| Rôle | Accès patients | Accès paramètres |
|---|---|---|
| `admin` | lecture + écriture + suppression | lecture + écriture |
| `medecin` | lecture + écriture | lecture seule |
| `assistant` | lecture + écriture (sans suppression) | lecture seule |

#### B3 — Déploiement des règles Firestore

**Prérequis avant déploiement :**
1. Firebase Auth intégré et fonctionnel dans l'app
2. Au moins un compte `admin` créé avec le bon custom claim
3. Tests validés sur l'émulateur Firebase

**Commandes à lancer à ce moment-là :**

```bash
# Installer Firebase CLI si absent
npm install -g firebase-tools

# Se connecter
firebase login

# Lier le projet (une seule fois)
firebase use medivision-187ed

# Tester en local avec l'émulateur AVANT de déployer
firebase emulators:start --only firestore

# Déployer les règles
firebase deploy --only firestore:rules

# Déployer les index
firebase deploy --only firestore:indexes
```

#### B4 — Migration des comptes rendus

Les comptes rendus actuellement en `localStorage` devront être migrés vers Firestore
(nouvelle collection `rapports`) ou rester locaux avec une stratégie d'export.

Structure suggérée pour la collection `rapports` :
```
rapports/{rapportId}
  ├── patientId: string (référence vers patients/)
  ├── type: 'oct' | 'retinographie' | ...
  ├── contenu: string (texte du rapport)
  ├── createdAt: Timestamp
  ├── createdBy: string (uid Firebase Auth)
  └── medecin: string (nom affiché)
```

---

## Règles Firestore proposées — Résumé

Voir le fichier `firestore.rules` pour les règles complètes.

### Logique des règles

```
Tout refuser par défaut
└── /patients/{id}
    ├── read   → admin, medecin, assistant
    ├── create → admin, medecin, assistant (avec validation de structure)
    ├── update → admin, medecin, assistant (avec validation de structure)
    └── delete → admin uniquement

└── /settings/{id}
    ├── read   → tout utilisateur authentifié
    └── write  → admin uniquement
```

### Impact si ces règles sont déployées maintenant (sans Auth)

> **RÉSULTAT : Application complètement bloquée.**
>
> - La liste patients ne se chargerait plus (getDocs refusé)
> - La salle d'attente serait vide (onSnapshot refusé)
> - Les paramètres clinique seraient inaccessibles (getDoc refusé)
> - L'ajout d'un patient échouerait silencieusement (addDoc refusé)
>
> **Ne déployer qu'après la Phase 2.**

---

## Prochaine étape recommandée

**Phase 2 : Intégration Firebase Auth**

1. Créer `src/services/auth.ts` et `src/hooks/useAuth.ts`
2. Ajouter une page `/login` avec formulaire email/mot de passe
3. Protéger toutes les routes existantes avec un composant `<ProtectedRoute>`
4. Créer le premier compte admin via la console Firebase
5. Déployer les règles `firestore.rules` déjà préparées

**Durée estimée :** 1 à 2 sessions de développement.

---

## Références

- [Firebase Authentication — Documentation officielle](https://firebase.google.com/docs/auth)
- [Firestore Security Rules — Guide](https://firebase.google.com/docs/firestore/security/get-started)
- [Custom Claims — Contrôle d'accès par rôle](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
