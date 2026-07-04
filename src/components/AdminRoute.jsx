import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Rota exclusiva de admin. Operadores são redirecionados à planilha (§7).
export default function AdminRoute() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/app/planilha" replace />
  return <Outlet />
}
