import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'

// Primeiro acesso (§3.2): nome + cargo + definição de senha.
// A senha é necessária porque o convite (inviteUserByEmail) cria o usuário
// sem senha — sem definir uma aqui, o operador não conseguiria logar depois.
export default function Onboarding() {
  const { session, user, profile, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!session) navigate('/login', { replace: true })
    else if (profile?.onboarded) navigate('/app/planilha', { replace: true })
  }, [session, profile, loading, navigate])

  useEffect(() => {
    if (profile?.nome) setNome(profile.nome)
    if (profile?.cargo) setCargo(profile.cargo)
  }, [profile])

  if (loading || !session) return <Spinner full label="Carregando..." />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!nome.trim()) return setError('Informe seu nome completo.')
    if (password.length < 6) return setError('A senha deve ter ao menos 6 caracteres.')
    if (password !== password2) return setError('As senhas não conferem.')

    setBusy(true)
    // 1) define a senha de acesso
    const { error: pwErr } = await supabase.auth.updateUser({ password })
    if (pwErr) {
      setBusy(false)
      return setError(pwErr.message)
    }
    // 2) grava o profile (role permanece 'operator'; admin altera depois)
    const { error: pErr } = await supabase
      .from('profiles')
      .update({
        nome: nome.trim(),
        cargo: cargo.trim() || null,
        email: user.email,
        onboarded: true,
      })
      .eq('id', user.id)
    setBusy(false)
    if (pErr) return setError(pErr.message)

    const updated = await refreshProfile()
    navigate(updated?.role === 'admin' ? '/app/planilha' : '/app/planilha', { replace: true })
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>👋 Bem-vindo!</h2>
        <p className="hint">
          Complete seu cadastro para acessar o controle. Estes dados identificam
          suas ações para a equipe.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <div className="field">
          <label htmlFor="nome">Nome completo</label>
          <input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
            maxLength={60}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="cargo">Cargo / função</label>
          <input
            id="cargo"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Ex: Analista fiscal"
            maxLength={60}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Criar senha de acesso</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password2">Confirmar senha</label>
          <input
            id="password2"
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="Repita a senha"
            required
          />
        </div>

        <button className="btn btn-prim btn-block" type="submit" disabled={busy}>
          {busy ? 'Salvando...' : 'Concluir cadastro'}
        </button>
      </form>
    </div>
  )
}
