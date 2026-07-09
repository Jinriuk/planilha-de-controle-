import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

const MAX_TENTATIVAS = 15 // ~1 minuto de retries de 4s antes de pedir ação manual

// Guarda de rota autenticada:
//   !session            → /login
//   session && !ativo   → desloga (login bloqueado, §8.3)
//   session && !onboarded → /onboarding
export default function ProtectedRoute() {
  const { session, profile, loading, signOut, refreshProfile } = useAuth()

  const blocked = profile && profile.ativo === false

  useEffect(() => {
    if (blocked) signOut()
  }, [blocked, signOut])

  // Sessão válida mas profile ausente (falha de rede transitória ou trigger de
  // convite ainda criando a linha): retenta sozinho em vez de deixar o usuário
  // preso para sempre no spinner até um F5 manual. setTimeout (não setInterval)
  // para nunca sobrepor requests, e com teto de tentativas para não martelar a
  // API indefinidamente.
  const [tentativas, setTentativas] = useState(0)
  const semProfile = !loading && !!session && !profile
  useEffect(() => {
    if (!semProfile || tentativas >= MAX_TENTATIVAS) return
    const t = setTimeout(async () => {
      await refreshProfile()
      setTentativas((n) => n + 1)
    }, 4000)
    return () => clearTimeout(t)
  }, [semProfile, tentativas, refreshProfile])

  if (loading) return <Spinner full label="Carregando sessão..." />
  if (!session) return <Navigate to="/login" replace />
  if (blocked) return <Navigate to="/login" replace state={{ blocked: true }} />

  // profile ainda carregando logo após convite
  if (!profile) {
    if (tentativas >= MAX_TENTATIVAS) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 60 }}>
          <p style={{ color: '#64748b' }}>Não foi possível carregar seu perfil. Verifique a conexão.</p>
          <button className="btn btn-prim" onClick={() => setTentativas(0)}>Tentar novamente</button>
        </div>
      )
    }
    return <Spinner full label="Preparando seu acesso..." />
  }

  if (!profile.onboarded) return <Navigate to="/onboarding" replace />

  return <Outlet />
}
