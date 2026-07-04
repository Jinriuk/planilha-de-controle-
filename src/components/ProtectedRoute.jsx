import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

// Guarda de rota autenticada:
//   !session            → /login
//   session && !ativo   → desloga (login bloqueado, §8.3)
//   session && !onboarded → /onboarding
export default function ProtectedRoute() {
  const { session, profile, loading, signOut } = useAuth()

  const blocked = profile && profile.ativo === false

  useEffect(() => {
    if (blocked) signOut()
  }, [blocked, signOut])

  if (loading) return <Spinner full label="Carregando sessão..." />
  if (!session) return <Navigate to="/login" replace />
  if (blocked) return <Navigate to="/login" replace state={{ blocked: true }} />

  // profile ainda carregando logo após convite
  if (!profile) return <Spinner full label="Preparando seu acesso..." />

  if (!profile.onboarded) return <Navigate to="/onboarding" replace />

  return <Outlet />
}
