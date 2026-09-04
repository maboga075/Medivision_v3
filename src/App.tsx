import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/shared/ToastProvider';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './layouts/MainLayout';

// Pages en chargement paresseux : chaque route devient un chunk séparé. Le lourd
// (Consultation → RetinaSketch/Konva/jsPDF/html2pdf) n'est plus dans le bundle
// d'entrée → démarrage bien plus rapide (utile sur connexion lente).
const Login = lazy(() => import('./pages/Login'));
const Accueil = lazy(() => import('./pages/Accueil'));
const Consultation = lazy(() => import('./pages/Consultation'));
const ComptesRendus = lazy(() => import('./pages/ComptesRendus'));
const Patients = lazy(() => import('./pages/Patients'));
const Parametres = lazy(() => import('./pages/Parametres'));

/** Écran d'attente pendant le chargement d'un chunk de page. */
function RouteFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-500" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />

              {/* Routes protégées */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<MainLayout />}>
                  <Route index element={<Navigate to="/accueil" replace />} />
                  <Route path="accueil" element={<Accueil />} />
                  <Route path="consultation" element={<Consultation />} />
                  <Route path="comptes-rendus" element={<ComptesRendus />} />
                  <Route path="patients" element={<Patients />} />
                  <Route path="parametres" element={<Parametres />} />
                </Route>
              </Route>

              {/* Toute route inconnue → accueil */}
              <Route path="*" element={<Navigate to="/accueil" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
