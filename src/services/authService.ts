import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
  type NextOrObserver,
} from 'firebase/auth';
import { auth } from './firebase';

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
      return 'La clé Firebase configurée dans l’application est invalide.';
    case 'auth/app-not-authorized':
    case 'auth/unauthorized-domain':
      return 'Ce domaine n’est pas autorisé dans Firebase Authentication.';
    case 'auth/configuration-not-found':
      return 'La configuration Firebase Authentication est introuvable pour ce projet.';
    case 'auth/operation-not-allowed':
      return "La connexion e-mail / mot de passe n'est pas activée dans Firebase Authentication.";
    case 'auth/invalid-email':
      return 'Adresse e-mail invalide.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Identifiants incorrects.';
    case 'auth/user-disabled':
      return 'Ce compte a été désactivé.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessayez dans quelques minutes.';
    case 'auth/network-request-failed':
      return 'Erreur réseau. Vérifiez votre connexion.';
    default:
      return code
        ? `Une erreur Firebase est survenue (${code}).`
        : 'Une erreur est survenue. Veuillez réessayer.';
  }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? '';
    throw new Error(mapFirebaseError(code));
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    throw new Error('Erreur lors de la déconnexion.');
  }
}

export function subscribeToAuthState(observer: NextOrObserver<User>): () => void {
  return onAuthStateChanged(auth, observer);
}
