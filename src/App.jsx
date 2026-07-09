import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Planilha from './pages/Planilha'
import Anexos from './pages/Anexos'
import Parcelamentos from './pages/Parcelamentos'
import Notificacoes from './pages/Notificacoes'
import Dashboard from './pages/Dashboard'
import Auditoria from './pages/Auditoria'
import Usuarios from './pages/Usuarios'
import Clientes from './pages/Clientes'

// Redireciona a raiz conforme sessão.
function RootRedirect() {
  const { session, loading } = useAuth()
  if (loading) return null
  return <Navigate to={session ? '/app/planilha' : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Onboarding />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<Layout />}>
          <Route index element={<Navigate to="planilha" replace />} />
          <Route path="planilha" element={<Planilha />} />
          <Route path="anexos" element={<Anexos />} />
          <Route path="parcelamentos" element={<Parcelamentos />} />
          <Route path="notificacoes" element={<Notificacoes />} />
          <Route element={<AdminRoute />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="auditoria" element={<Auditoria />} />
            <Route path="usuarios" element={<Usuarios />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
