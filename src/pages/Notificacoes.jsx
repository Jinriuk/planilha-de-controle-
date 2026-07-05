import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import Spinner from '../components/Spinner'
import { corAvatar, iniciais } from '../lib/constants'

export default function Notificacoes() {
  const { user, profile, isAdmin } = useAuth()
  const toast = useToast()
  const nome = profile?.nome || user?.email || ''

  const [loading, setLoading] = useState(true)
  const [recebidas, setRecebidas] = useState([])
  const [lidas, setLidas] = useState(new Set())
  const [enviadas, setEnviadas] = useState([])
  const [operadores, setOperadores] = useState([])
  const [readCounts, setReadCounts] = useState({})
  // ids que chegaram não-lidos nesta sessão — mantêm o selo "novo" visível
  const novasSessao = useRef(new Set())

  // form (admin)
  const [dest, setDest] = useState('todos')
  const [tipo, setTipo] = useState('mensagem')
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)

  const carregar = useCallback(async () => {
    const reqs = [
      supabase
        .from('notifications')
        .select('*')
        .or(`recipient_id.eq.${user.id},recipient_id.is.null`)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('notification_reads').select('notification_id').eq('user_id', user.id),
    ]
    if (isAdmin) {
      reqs.push(
        supabase.from('notifications').select('*').eq('sender_id', user.id).order('created_at', { ascending: false }).limit(100)
      )
      reqs.push(
        supabase.from('profiles').select('id, nome, email, role, ativo').order('nome')
      )
    }
    const res = await Promise.all(reqs)
    setRecebidas(res[0].data || [])
    setLidas(new Set((res[1].data || []).map((r) => r.notification_id)))
    if (isAdmin) {
      const sent = res[2].data || []
      setEnviadas(sent)
      setOperadores((res[3].data || []).filter((p) => p.role === 'operator'))
      // recibos de leitura das enviadas (policy "admin read all reads")
      if (sent.length) {
        const { data: rds } = await supabase
          .from('notification_reads')
          .select('notification_id')
          .in('notification_id', sent.map((n) => n.id))
        const m = {}
        ;(rds || []).forEach((r) => { m[r.notification_id] = (m[r.notification_id] || 0) + 1 })
        setReadCounts(m)
      } else {
        setReadCounts({})
      }
    }
    setLoading(false)
  }, [user.id, isAdmin])

  useEffect(() => {
    carregar()
    const canal = supabase
      .channel('notif-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => carregar())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [carregar])

  // Marca como lidas as não lidas (limpa o badge), mas preserva o selo "novo"
  // durante a sessão para o usuário perceber o que acabou de chegar.
  useEffect(() => {
    if (loading) return
    const naoLidas = recebidas.filter((n) => !lidas.has(n.id))
    if (naoLidas.length === 0) return
    naoLidas.forEach((n) => novasSessao.current.add(n.id))
    const rows = naoLidas.map((n) => ({ notification_id: n.id, user_id: user.id }))
    supabase
      .from('notification_reads')
      .upsert(rows, { onConflict: 'notification_id,user_id', ignoreDuplicates: true })
      .then(() => setLidas((prev) => new Set([...prev, ...naoLidas.map((n) => n.id)])))
  }, [loading, recebidas, lidas, user.id])

  async function enviar(e) {
    e.preventDefault()
    if (!mensagem.trim()) return toast('Escreva a mensagem')
    setEnviando(true)
    const { error } = await supabase.from('notifications').insert({
      sender_id: user.id,
      sender_nome: nome,
      recipient_id: dest === 'todos' ? null : dest,
      titulo: titulo.trim() || null,
      mensagem: mensagem.trim(),
      tipo,
    })
    setEnviando(false)
    if (error) return toast('Erro: ' + error.message)
    toast('✅ Notificação enviada!')
    setTitulo('')
    setMensagem('')
    setDest('todos')
    setTipo('mensagem')
    carregar()
  }

  const nomeDestino = useMemo(() => {
    const m = { null: 'Todos os operadores' }
    operadores.forEach((o) => { m[o.id] = o.nome || o.email })
    return m
  }, [operadores])

  if (loading) return <Spinner full label="Carregando notificações..." />

  return (
    <div className="page">
      <div className="page-title">Notificações</div>

      {isAdmin && (
        <form className="card" style={{ marginBottom: 18 }} onSubmit={enviar}>
          <div style={{ fontWeight: 700, color: 'var(--azul)', marginBottom: 10 }}>Enviar mensagem / tarefa</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="ctrl-label">Para</label>
              <select value={dest} onChange={(e) => setDest(e.target.value)}
                style={{ border: '1px solid var(--cinza3)', borderRadius: 6, padding: '6px 10px', minWidth: 200 }}>
                <option value="todos">📢 Todos os operadores</option>
                {operadores.map((o) => (
                  <option key={o.id} value={o.id}>{o.nome || o.email}{o.ativo === false ? ' (inativo)' : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="ctrl-label">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                style={{ border: '1px solid var(--cinza3)', borderRadius: 6, padding: '6px 10px' }}>
                <option value="mensagem">💬 Mensagem</option>
                <option value="tarefa">✅ Tarefa</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
              <label className="ctrl-label">Título (opcional)</label>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80}
                placeholder="Ex: Prazo das guias" style={{ border: '1px solid var(--cinza3)', borderRadius: 6, padding: '6px 10px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            <label className="ctrl-label">Mensagem</label>
            <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={3} maxLength={1000}
              placeholder="Escreva a mensagem ou a tarefa..."
              style={{ border: '1px solid var(--cinza3)', borderRadius: 6, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
          </div>
          <button className="btn btn-prim" type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar notificação'}
          </button>
        </form>
      )}

      <div style={{ fontWeight: 700, color: 'var(--azul)', margin: '4px 0 10px' }}>
        {isAdmin ? 'Recebidas por você' : 'Suas notificações'}
      </div>
      {recebidas.length === 0 ? (
        <div className="muted" style={{ padding: 16 }}>Nenhuma notificação por aqui.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recebidas.map((n) => (
            <NotifCard key={n.id} n={n} novo={!lidas.has(n.id) || novasSessao.current.has(n.id)} />
          ))}
        </div>
      )}

      {isAdmin && (
        <>
          <div style={{ fontWeight: 700, color: 'var(--azul)', margin: '22px 0 10px' }}>Enviadas por você</div>
          {enviadas.length === 0 ? (
            <div className="muted" style={{ padding: 16 }}>Você ainda não enviou notificações.</div>
          ) : (
            <div className="data-table">
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>Quando</th><th>Para</th><th>Tipo</th><th>Título</th><th>Mensagem</th><th>Leituras</th></tr>
                  </thead>
                  <tbody>
                    {enviadas.map((n) => (
                      <tr key={n.id}>
                        <td className="muted">{new Date(n.created_at).toLocaleString('pt-BR')}</td>
                        <td>{nomeDestino[n.recipient_id ?? 'null'] || (n.recipient_id ? '—' : 'Todos os operadores')}</td>
                        <td>{n.tipo === 'tarefa' ? '✅ Tarefa' : '💬 Mensagem'}</td>
                        <td>{n.titulo || '—'}</td>
                        <td>{n.mensagem}</td>
                        <td>
                          {readCounts[n.id]
                            ? <span className="chip chip-para-feito">✓ {readCounts[n.id]} leu{readCounts[n.id] > 1 ? 'ram' : ''}</span>
                            : <span className="chip chip-de">não lida</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function NotifCard({ n, novo }) {
  const isTarefa = n.tipo === 'tarefa'
  return (
    <div className="card" style={{ borderLeft: `4px solid ${isTarefa ? 'var(--verde)' : 'var(--azul2)'}`, background: novo ? '#f0f7ff' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div className="avatar sm" style={{ background: corAvatar(n.sender_nome), width: 26, height: 26, fontSize: 11 }}>
          {iniciais(n.sender_nome)}
        </div>
        <strong style={{ fontSize: 13 }}>{isTarefa ? '✅' : '💬'} {n.titulo || (isTarefa ? 'Tarefa' : 'Mensagem')}</strong>
        {novo && <span className="chip chip-para-andamento" style={{ marginLeft: 4 }}>novo</span>}
        <span className="muted" style={{ marginLeft: 'auto' }}>{new Date(n.created_at).toLocaleString('pt-BR')}</span>
      </div>
      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', paddingLeft: 34 }}>{n.mensagem}</div>
      <div className="muted" style={{ paddingLeft: 34, marginTop: 4 }}>
        de {n.sender_nome || '—'}{n.recipient_id == null ? ' · para todos os operadores' : ''}
      </div>
    </div>
  )
}
