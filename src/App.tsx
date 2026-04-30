import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Accueil from './pages/Accueil';
import Consultation from './pages/Consultation';
import ComptesRendus from './pages/ComptesRendus';
import Patients from './pages/Patients';
import Parametres from './pages/Parametres';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
}
