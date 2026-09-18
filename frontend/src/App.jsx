import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import TopBar from './components/TopBar';
import Login from './pages/Login';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import DocumentDetail from './pages/DocumentDetail';

function RequireAuth({ children }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { session } = useAuth();

  return (
    <>
      <TopBar />
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<RequireAuth><Clients /></RequireAuth>} />
        <Route path="/clients/:clientId" element={<RequireAuth><ClientDetail /></RequireAuth>} />
        <Route path="/documents/:docId" element={<RequireAuth><DocumentDetail /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
