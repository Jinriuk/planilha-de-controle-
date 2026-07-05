import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, profile, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const blocked = location.state?.blocked

  // Já autenticado → manda pro app (ou onboarding).
  useEffect(() => {
    if (loading || !session) return
    if (profile && !profile.onboarded) navigate('/onboarding', { replace: true })
    else if (profile?.ativo !== false) navigate('/app/planilha', { replace: true })
  }, [session, profile, loading, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message
      )
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo">Controle de Apuração</div>
        <div className="auth-sub">AM Assessoria e Consultoria Tributária</div>

        {blocked && (
          <div className="auth-error">
            Seu acesso foi desativado. Fale com um administrador.
          </div>
        )}
        {error && <div className="auth-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@escritorio.com"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button className="btn btn-prim btn-block" type="submit" disabled={busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="hint" style={{ marginTop: 16, marginBottom: 0 }}>
          O acesso é criado pelo administrador do escritório.
          Esqueceu a senha? Peça ao administrador para redefinir em
          <strong> Usuários → 🔑 Senha</strong>.
        </p>
      </form>
    </div>
  )
}
