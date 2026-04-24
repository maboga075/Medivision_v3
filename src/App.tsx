import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Accueil from './pages/Accueil';
import Consultation from './pages/Consultation';
import Patients from './pages/Patients';
import Parametres from './pages/Parametres';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/accueil" replace />} />
          <Route path="accueil" element={<Accueil />} />
          <Route path="consultation" element={<Consultation />} />
          <Route path="patients" element={<Patients />} />
          <Route path="parametres" element={<Parametres />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
