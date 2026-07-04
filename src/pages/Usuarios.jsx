import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import Spinner from '../components/Spinner'
import { corAvatar, iniciais } from '../lib/constants'

export default function Usuarios() {
  const { user } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState([])
  const [presenceMap, setPresenceMap] = useState({})
  const [busy, setBusy] = useState(null)

  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteMsg, setInviteMsg] = useState(null)

  async function carregar() {
    const [p, pr] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('presence').select('user_id, last_seen'),
    ])
    setProfiles(p.data || [])
    const m = {}
    ;(pr.data || []).forEach((r) => { m[r.user_id] = r.last_seen })
    setPresenceMap(m)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function alterarRole(p) {
    const novo = p.role === 'admin' ? 'operator' : 'admin'
    if (!window.confirm(`Alterar ${p.nome || p.email} para "${novo}"?`)) return
    setBusy(p.id)
    const { error } = await supabase.from('profiles').update({ role: novo }).eq('id', p.id)
    setBusy(null)
    if (error) return toast('Erro: ' + error.message)
    toast('Role atualizada')
    carregar()
  }

  async function alterarAtivo(p) {
    const novo = !p.ativo
    if (!window.confirm(`${novo ? 'Reativar' : 'Desativar'} o acesso de ${p.nome || p.email}?`)) return
    setBusy(p.id)
    const { error } = await supabase.from('profiles').update({ ativo: novo }).eq('id', p.id)
    setBusy(null)
    if (error) return toast('Erro: ' + error.message)
    toast(novo ? 'Usuário reativado' : 'Usuário desativado')
    carregar()
  }

  async function convidar(e) {
    e.preventDefault()
    setInviteMsg(null)
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    setInviteBusy(true)
    const { data, error } = await supabase.functions.invoke('invite-user', { body: { email } })
    setInviteBusy(false)
    if (error) {
      setInviteMsg({ ok: false, txt: 'Falha ao convidar: ' + (data?.error || error.message) })
      return
    }
    setInviteMsg({ ok: true, txt: `Convite enviado para ${email}.` })
    setInviteEmail('')
    carregar()
  }

  const ordenados = useMemo(
    () => [...profiles].sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, 'pt-BR')),
    [profiles]
  )

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div className="page-title" style={{ margin: 0 }}>Usuários</div>
        <button className="btn btn-prim" onClick={() => { setShowInvite(true); setInviteMsg(null) }}>+ Convidar novo usuário</button>
      </div>

      {loading ? (
        <Spinner label="Carregando usuários..." />
      ) : (
        <div className="data-table">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Usuário</th><th>E-mail</th><th>Cargo</th><th>Papel</th>
                  <th>Cadastro</th><th>Visto por último</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((p) => {
                  const eu = p.id === user.id
                  const nome = p.nome || '(sem nome)'
                  return (
                    <tr key={p.id} style={p.ativo === false ? { opacity: 0.6 } : undefined}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar sm" style={{ background: corAvatar(nome) }}>{iniciais(nome)}</div>
                          <span style={{ fontWeight: 600 }}>{nome}{eu && <span className="muted"> (você)</span>}{!p.onboarded && <span className="muted"> · pendente</span>}</span>
                        </div>
                      </td>
                      <td className="muted">{p.email}</td>
                      <td>{p.cargo || '—'}</td>
                      <td><span className={`chip chip-role-${p.role}`}>{p.role}</span></td>
                      <td className="muted">{p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="muted">{presenceMap[p.id] ? new Date(presenceMap[p.id]).toLocaleString('pt-BR') : '—'}</td>
                      <td>{p.ativo === false ? <span className="chip chip-para-vazio">Inativo</span> : <span className="chip chip-para-feito">Ativo</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sec" disabled={eu || busy === p.id} onClick={() => alterarRole(p)}>
                            {p.role === 'admin' ? '→ operator' : '→ admin'}
                          </button>
                          <button className={`btn ${p.ativo === false ? 'btn-grn' : 'btn-danger'}`} disabled={eu || busy === p.id} onClick={() => alterarAtivo(p)}>
                            {p.ativo === false ? 'Reativar' : 'Desativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showInvite && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowInvite(false) }}>
          <form className="modal" onSubmit={convidar}>
            <h2>Convidar novo usuário</h2>
            <p>Um e-mail de convite será enviado. Ao aceitar, a pessoa define a senha e completa o cadastro (entra como <strong>operator</strong>).</p>
            {inviteMsg && <div className={inviteMsg.ok ? 'auth-ok' : 'auth-error'}>{inviteMsg.txt}</div>}
            <div className="field">
              <label htmlFor="invemail">E-mail</label>
              <input id="invemail" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="pessoa@escritorio.com" required autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-sec" onClick={() => setShowInvite(false)}>Fechar</button>
              <button type="submit" className="btn btn-prim" disabled={inviteBusy}>{inviteBusy ? 'Enviando...' : 'Enviar convite'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
