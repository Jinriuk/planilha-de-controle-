import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase, fetchAllRows } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import Spinner from '../components/Spinner'
import {
  TAREFAS, CICLO, CICLO_LABEL, CICLO_CLS, CAT_HDR, CAT_LABEL,
  PERIODOS_ANO_ATUAL, PERIODOS_ANO_ANT, ANO_ATUAL, ANO_ANT, periodoLabel, PERIODO_ATUAL,
  corAvatar, statusEmpresa, STATUS_CORES, STATUS_CLS,
  atividadeVencida, atividadeProxima, hojeISO, fmtData,
} from '../lib/constants'

const POLL_MS = 20_000
// Janela em que uma escrita otimista fica protegida contra o polling que releu
// o banco antes do commit. Curta: passado isso, confia-se no banco (evita que
// um pendente "encalhe" e mascare para sempre a edição de outra pessoa).
const PENDING_GRACE_MS = 4_000
const vkey = (cod, task) => `${cod}__${task}`

export default function Planilha() {
  const { user, profile } = useAuth()
  const toast = useToast()

  const [companies, setCompanies] = useState([])
  const [equipe, setEquipe] = useState([])
  const [periodo, setPeriodo] = useState(PERIODO_ATUAL)
  const [valores, setValores] = useState({}) // { cod__task: {valor,nome,at,responsavel_nome,prazo,data_conclusao,observacoes} }
  const [resp, setResp] = useState({})
  const [loading, setLoading] = useState(true)

  const [busca, setBusca] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fGrupo, setFGrupo] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fResp, setFResp] = useState('')
  const [soVencidas, setSoVencidas] = useState(false)

  const [detalhe, setDetalhe] = useState(null) // { company, taskKey }
  // Clique pendente aguardando distinção de duplo-clique: { cod, task, timer }.
  const clickPend = useRef(null)

  const valoresRef = useRef(valores)
  valoresRef.current = valores
  const respRef = useRef(resp)
  respRef.current = resp
  // Escritas otimistas ainda não confirmadas: protegem a edição em voo do
  // polling/realtime que releu o banco antes do commit. Cada pendente tem um
  // timer de expiração (grace) para NUNCA mascarar para sempre o valor real.
  const pendingWrites = useRef(new Map()) // k -> célula otimista
  const pendingTimers = useRef(new Map()) // k -> timeout id
  const dropPending = useCallback((k) => {
    const t = pendingTimers.current.get(k)
    if (t) clearTimeout(t)
    pendingTimers.current.delete(k)
    pendingWrites.current.delete(k)
  }, [])

  const nome = profile?.nome || user?.email || ''

  // ── Empresas + equipe (uma vez) ──
  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('companies').select('*'),
      supabase.from('profiles').select('id, nome, email, role, ativo').order('nome'),
    ]).then(([c, p]) => {
      if (!active) return
      if (c.error) return toast('Erro ao carregar empresas')
      setCompanies((c.data || []).sort((a, b) => (Number(a.cod) || 0) - (Number(b.cod) || 0)))
      setEquipe((p.data || []).filter((m) => m.ativo !== false))
    })
    return () => { active = false }
  }, [toast])

  // ── Apuração + responsáveis do período ──
  const carregarPeriodo = useCallback(async (per, showSpinner = false) => {
    if (showSpinner) setLoading(true)
    const [ap, re] = await Promise.all([
      fetchAllRows((sb) =>
        sb.from('apuracao')
          .select('company_cod, task_key, valor, updated_by_nome, updated_at, responsavel_nome, prazo, data_conclusao, observacoes')
          .eq('periodo', per)
          .order('company_cod', { ascending: true })
          .order('task_key', { ascending: true }) // desempate único p/ paginação estável
      ),
      fetchAllRows((sb) =>
        sb.from('responsavel_empresa')
          .select('company_cod, user_nome, started_at')
          .eq('periodo', per)
          .order('company_cod', { ascending: true })
      ),
    ])
    if (ap.error || re.error) {
      toast('Erro ao carregar o período')
      setLoading(false)
      return
    }
    const vmap = {}
    for (const r of ap.data || []) {
      vmap[vkey(r.company_cod, r.task_key)] = {
        valor: r.valor || '',
        nome: r.updated_by_nome,
        at: r.updated_at,
        responsavel_nome: r.responsavel_nome,
        prazo: r.prazo,
        data_conclusao: r.data_conclusao,
        observacoes: r.observacoes,
      }
    }
    // Sobrepõe as edições otimistas ainda dentro da janela de grace (protege a
    // edição em voo). Fora da grace o pendente já foi descartado pelo timer, e
    // o valor do banco — inclusive uma alteração feita por outra pessoa — vale.
    for (const [k, v] of pendingWrites.current) vmap[k] = v
    const rmap = {}
    for (const r of re.data || []) rmap[r.company_cod] = { user_nome: r.user_nome, started_at: r.started_at }
    setValores(vmap)
    setResp(rmap)
    setLoading(false)
  }, [toast])

  useEffect(() => { carregarPeriodo(periodo, true) }, [periodo, carregarPeriodo])

  // ── Realtime + polling ──
  useEffect(() => {
    const canal = supabase
      .channel(`planilha:${periodo}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'apuracao', filter: `periodo=eq.${periodo}` },
        (payload) => {
          const row = payload.new?.company_cod ? payload.new : payload.old
          if (!row) return
          const k = vkey(row.company_cod, row.task_key)
          // Não mexe no pendente aqui: o timer de grace (curto) é quem o expira.
          // Enquanto durar a grace, o polling reaplica a edição em voo; passada
          // a grace, o valor do banco (inclusive de outra pessoa) prevalece.
          setValores((prev) => {
            if (payload.eventType === 'DELETE') {
              const cp = { ...prev }; delete cp[k]; return cp
            }
            const n = payload.new
            return {
              ...prev,
              [k]: {
                valor: n.valor || '', nome: n.updated_by_nome, at: n.updated_at,
                responsavel_nome: n.responsavel_nome, prazo: n.prazo,
                data_conclusao: n.data_conclusao, observacoes: n.observacoes,
              },
            }
          })
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'responsavel_empresa', filter: `periodo=eq.${periodo}` },
        (payload) => {
          setResp((prev) => {
            const cp = { ...prev }
            if (payload.eventType === 'DELETE') delete cp[payload.old.company_cod]
            else cp[payload.new.company_cod] = { user_nome: payload.new.user_nome, started_at: payload.new.started_at }
            return cp
          })
        })
      .subscribe()
    const poll = setInterval(() => carregarPeriodo(periodo), POLL_MS)
    return () => {
      supabase.removeChannel(canal)
      clearInterval(poll)
      // Troca de período/desmontagem: descarta pendentes (as chaves não têm
      // período, então não poderiam vazar para outro mês).
      for (const t of pendingTimers.current.values()) clearTimeout(t)
      pendingTimers.current.clear()
      pendingWrites.current.clear()
    }
  }, [periodo, carregarPeriodo])

  // ── Persistência de uma célula (status e/ou detalhes) ──
  const salvarCelula = useCallback(async (company, taskKey, patch) => {
    const k = vkey(company.cod, taskKey)
    const atual = valoresRef.current[k] || {}
    const novo = { ...atual, ...patch }

    // Regras de conclusão automática
    if (patch.valor !== undefined) {
      if (patch.valor === 'feito' && !novo.data_conclusao) novo.data_conclusao = hojeISO()
      if (patch.valor === '') novo.data_conclusao = null
    }

    const optimistic = { ...novo, nome, at: new Date().toISOString() }
    pendingWrites.current.set(k, optimistic)
    const prevT = pendingTimers.current.get(k)
    if (prevT) clearTimeout(prevT)
    pendingTimers.current.set(k, setTimeout(() => dropPending(k), PENDING_GRACE_MS))
    const novoMapa = { ...valoresRef.current, [k]: optimistic }
    setValores(novoMapa)

    const { error } = await supabase.from('apuracao').upsert(
      {
        company_cod: company.cod,
        task_key: taskKey,
        periodo,
        valor: novo.valor || '',
        responsavel_id: novo.responsavel_id ?? null,
        responsavel_nome: novo.responsavel_nome ?? null,
        prazo: novo.prazo || null,
        data_conclusao: novo.data_conclusao || null,
        observacoes: novo.observacoes || null,
        updated_by: user.id,
        updated_by_nome: nome,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_cod,task_key,periodo' }
    )
    if (error) {
      dropPending(k)
      toast('Erro ao salvar — recarregando')
      carregarPeriodo(periodo)
      return false
    }

    // Responsável da empresa no período (primeira atividade / limpeza total)
    const temAtividade = TAREFAS.some((t) => (novoMapa[vkey(company.cod, t[0])]?.valor || '') !== '')
    const jaTemResp = !!respRef.current[company.cod]
    if (!temAtividade && jaTemResp) {
      setResp((prev) => { const cp = { ...prev }; delete cp[company.cod]; return cp })
      await supabase.from('responsavel_empresa').delete()
        .eq('company_cod', company.cod).eq('periodo', periodo)
    } else if (temAtividade && !jaTemResp) {
      setResp((prev) => ({ ...prev, [company.cod]: { user_nome: nome, started_at: new Date().toISOString() } }))
      await supabase.from('responsavel_empresa').upsert(
        { company_cod: company.cod, periodo, user_id: user.id, user_nome: nome, started_at: new Date().toISOString() },
        { onConflict: 'company_cod,periodo', ignoreDuplicates: true }
      )
    }
    return true
  }, [periodo, user, nome, toast, carregarPeriodo, dropPending])

  // Clique simples: cicla o status
  const handleClick = useCallback(async (company, taskKey) => {
    const atual = valoresRef.current[vkey(company.cod, taskKey)]?.valor || ''
    const prox = CICLO[(CICLO.indexOf(atual) + 1) % CICLO.length]
    const ok = await salvarCelula(company, taskKey, { valor: prox })
    if (ok) toast(`${CICLO_LABEL[prox]} — salvo!`)
  }, [salvarCelula, toast])

  // Espera 230ms antes de ciclar: se vier o duplo clique, cancela e abre os
  // detalhes SEM mudar o status (senão o duplo clique avançaria o status 2x).
  // Ao clicar em OUTRA célula antes dos 230ms, descarrega o clique anterior na
  // hora — assim cliques em células diferentes nunca se perdem.
  const cellClick = useCallback((company, taskKey) => {
    const pend = clickPend.current
    if (pend) {
      clearTimeout(pend.timer)
      if (pend.cod !== company.cod || pend.task !== taskKey) handleClick(pend.company, pend.task)
    }
    const timer = setTimeout(() => { clickPend.current = null; handleClick(company, taskKey) }, 230)
    clickPend.current = { cod: company.cod, task: taskKey, company, timer }
  }, [handleClick])

  const cellDetail = useCallback((company, taskKey) => {
    if (clickPend.current) { clearTimeout(clickPend.current.timer); clickPend.current = null }
    setDetalhe({ company, taskKey })
  }, [])

  // ── Filtros ──
  const grupos = useMemo(
    () => [...new Set(companies.map((c) => c.grupo).filter(Boolean))].sort(),
    [companies]
  )
  const responsaveis = useMemo(() => {
    const set = new Set()
    Object.values(valores).forEach((v) => { if (v.responsavel_nome) set.add(v.responsavel_nome) })
    Object.values(resp).forEach((r) => { if (r.user_nome) set.add(r.user_nome) })
    equipe.forEach((m) => { if (m.nome) set.add(m.nome) })
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [valores, resp, equipe])

  const empresaTemVencida = useCallback((c) => {
    return TAREFAS.some((t) => atividadeVencida(valores[vkey(c.cod, t[0])]))
  }, [valores])

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase()
    return companies.filter((c) => {
      if (q && !c.empresa.toLowerCase().includes(q) && !String(c.cod).includes(q) && !(c.grupo || '').toLowerCase().includes(q)) return false
      if (fTipo && c.tipo !== fTipo) return false
      if (fGrupo && c.grupo !== fGrupo) return false
      if (fResp) {
        const temResp =
          resp[c.cod]?.user_nome === fResp ||
          TAREFAS.some((t) => valores[vkey(c.cod, t[0])]?.responsavel_nome === fResp)
        if (!temResp) return false
      }
      if (soVencidas && !empresaTemVencida(c)) return false
      if (fStatus) {
        const vmap = valoresMapaEmpresa(c.cod, valores)
        if (statusEmpresa(c, vmap).st !== fStatus) return false
      }
      return true
    })
  }, [companies, busca, fTipo, fGrupo, fStatus, fResp, soVencidas, valores, resp, empresaTemVencida])

  // ── Stats + alertas ──
  const stats = useMemo(() => {
    const cnt = { Finalizado: 0, 'Em andamento': 0, 'Não iniciado': 0, 'Não se aplica': 0 }
    filtradas.forEach((c) => {
      const vmap = valoresMapaEmpresa(c.cod, valores)
      cnt[statusEmpresa(c, vmap).st]++
    })
    return cnt
  }, [filtradas, valores])

  const alertas = useMemo(() => {
    let vencidas = 0
    let proximas = 0
    companies.forEach((c) => {
      TAREFAS.forEach((t) => {
        const cell = valores[vkey(c.cod, t[0])]
        if (atividadeVencida(cell)) vencidas++
        else if (atividadeProxima(cell)) proximas++
      })
    })
    return { vencidas, proximas }
  }, [companies, valores])

  function limparFiltros() {
    setBusca(''); setFTipo(''); setFGrupo(''); setFStatus(''); setFResp(''); setSoVencidas(false)
  }

  function exportarCSV() {
    const header = ['Cód', 'Empresa', 'Tipo', 'Grupo', 'Responsável', ...TAREFAS.map((t) => `${CAT_LABEL[t[2]]} - ${t[1]}`), 'Status']
    const rows = [header]
    filtradas.forEach((c) => {
      const vmap = valoresMapaEmpresa(c.cod, valores)
      const { st } = statusEmpresa(c, vmap)
      const vals = TAREFAS.map((t) => CICLO_LABEL[vmap[t[0]] || ''])
      rows.push([c.cod, c.empresa, c.tipo || '', c.grupo || '', resp[c.cod]?.user_nome || '', ...vals, st])
    })
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(csv)
    a.download = `controle_${periodo}.csv`
    a.click()
  }

  const catSpans = useMemo(() => {
    const out = []
    let prev = ''
    let count = 0
    TAREFAS.forEach((t, i) => {
      if (t[2] !== prev) { if (prev) out.push({ cat: prev, count }); prev = t[2]; count = 1 }
      else count++
      if (i === TAREFAS.length - 1) out.push({ cat: prev, count })
    })
    return out
  }, [])

  if (loading) return <Spinner full label="Carregando controle..." />

  return (
    <>
      <div className="barra">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="ctrl-label">Competência:</label>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}
            style={{ fontWeight: 700, color: 'var(--azul)', borderColor: 'var(--azul2)' }}>
            <optgroup label={`── ${ANO_ATUAL} ──`}>
              {PERIODOS_ANO_ATUAL.map((p) => <option key={p} value={p}>{periodoLabel(p)}</option>)}
            </optgroup>
            <optgroup label={`── ${ANO_ANT} ──`}>
              {PERIODOS_ANO_ANT.map((p) => <option key={p} value={p}>{periodoLabel(p)}</option>)}
            </optgroup>
          </select>
        </div>

        <input className="busca" placeholder="Buscar cliente ou grupo..."
          value={busca} onChange={(e) => setBusca(e.target.value)} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="ctrl-label">Tipo:</label>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option value="">Todos</option>
            <option>Comércio</option>
            <option>Serviços</option>
            <option>Comércio / Serviços</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="ctrl-label">Grupo:</label>
          <select value={fGrupo} onChange={(e) => setFGrupo(e.target.value)}>
            <option value="">Todos</option>
            {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="ctrl-label">Responsável:</label>
          <select value={fResp} onChange={(e) => setFResp(e.target.value)}>
            <option value="">Todos</option>
            {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="ctrl-label">Status:</label>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="Não iniciado">Não iniciado</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Finalizado">Finalizado</option>
            <option value="Não se aplica">Não se aplica</option>
          </select>
        </div>
        <button className="btn btn-sec" onClick={limparFiltros}>Limpar</button>
        <div className="ml-auto" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-grn" onClick={exportarCSV}>⬇ CSV</button>
          <button className="btn btn-prim" onClick={() => { carregarPeriodo(periodo, true); toast('↻ Atualizado') }}>↻ Atualizar</button>
        </div>
      </div>

      {(alertas.vencidas > 0 || alertas.proximas > 0) && (
        <div className={`alert-bar${alertas.vencidas === 0 ? ' warn' : ''}`}>
          {alertas.vencidas > 0 && <span>🔴 {alertas.vencidas} atividade{alertas.vencidas > 1 ? 's' : ''} vencida{alertas.vencidas > 1 ? 's' : ''}</span>}
          {alertas.proximas > 0 && <span style={{ color: '#92400e' }}>🟡 {alertas.proximas} vence{alertas.proximas > 1 ? 'm' : ''} em até 3 dias</span>}
          <button className="btn btn-sec" style={{ marginLeft: 'auto', padding: '3px 10px' }}
            onClick={() => setSoVencidas((v) => !v)}>
            {soVencidas ? 'Mostrar todas' : 'Ver só com vencidas'}
          </button>
        </div>
      )}

      <div className="stats">
        <div className="stat"><strong>{filtradas.length}</strong>&nbsp;clientes</div>
        {Object.entries(stats).map(([s, n]) => (
          <div className="stat" key={s}>
            <span className="dot" style={{ background: STATUS_CORES[s] }} />
            <strong>{n}</strong>&nbsp;{s}
          </div>
        ))}
        <div className="stat" style={{ marginLeft: 'auto', color: '#94a3b8' }}>
          💡 clique = muda status · duplo clique = detalhes (responsável, prazo, obs)
        </div>
      </div>

      <div className="tabela-wrap">
        {filtradas.length === 0 ? (
          <div className="sem-resultado">Nenhum cliente encontrado com os filtros selecionados.</div>
        ) : (
          <table className="planilha">
            <thead>
              <tr>
                <th className="th-grupo-id" rowSpan={2} style={{ width: 32 }}>#</th>
                <th className="th-grupo-id" rowSpan={2} style={{ width: 36 }}>Cód</th>
                <th className="th-grupo-id th-emp" rowSpan={2}>Cliente</th>
                <th className="th-grupo-id" rowSpan={2} style={{ width: 80 }}>Tipo</th>
                <th className="th-grupo-id" rowSpan={2} style={{ width: 80 }}>Grupo</th>
                <th className="th-grupo-id" rowSpan={2} style={{ width: 100 }}>Responsável</th>
                {catSpans.map((c) => (
                  <th key={c.cat} className={CAT_HDR[c.cat]} colSpan={c.count} style={{ fontSize: 11 }}>
                    {CAT_LABEL[c.cat]}
                  </th>
                ))}
                <th className="th-grupo-status" rowSpan={2} style={{ width: 120 }}>Progresso</th>
                <th className="th-grupo-status" rowSpan={2} style={{ width: 110 }}>Status</th>
              </tr>
              <tr>
                {TAREFAS.map((t) => (
                  <th key={t[0]} className={CAT_HDR[t[2]]} style={{ width: 78, fontSize: 9, fontWeight: 500 }}>
                    {t[1]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c, idx) => (
                <LinhaEmpresa key={c.cod} idx={idx} company={c} valores={valores}
                  resp={resp[c.cod]} onClick={cellClick}
                  onDetalhe={(taskKey) => cellDetail(c, taskKey)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detalhe && (
        <DetalheModal
          company={detalhe.company}
          taskKey={detalhe.taskKey}
          cell={valores[vkey(detalhe.company.cod, detalhe.taskKey)] || {}}
          equipe={equipe}
          onClose={() => setDetalhe(null)}
          onSave={async (patch) => {
            const ok = await salvarCelula(detalhe.company, detalhe.taskKey, patch)
            if (ok) { toast('Detalhes salvos!'); setDetalhe(null) }
          }}
        />
      )}
    </>
  )
}

function valoresMapaEmpresa(cod, valores) {
  const out = {}
  for (const t of TAREFAS) {
    const v = valores[vkey(cod, t[0])]
    if (v) out[t[0]] = v.valor
  }
  return out
}

function LinhaEmpresa({ idx, company, valores, resp, onClick, onDetalhe }) {
  const vmap = valoresMapaEmpresa(company.cod, valores)
  const { total, resolvidos, pct, st } = statusEmpresa(company, vmap)
  const saiu = company.ativo === false

  return (
    <tr style={saiu ? { opacity: 0.55 } : undefined}>
      <td className="td-num">{idx + 1}</td>
      <td className="td-num" style={{ fontWeight: 600, color: '#475569' }}>{company.cod}</td>
      <td className="td-emp" title={`${company.empresa}${saiu ? ' — SAIU (inativa)' : ''}`}>
        {company.empresa}
        {saiu && <span className="tag-saiu"> (SAIU)</span>}
      </td>
      <td className="td-tipo">{company.tipo}</td>
      <td className="td-grp">{company.grupo ? <span className="grp-chip">{company.grupo}</span> : ''}</td>
      <td style={{ fontSize: 10 }}>
        {resp?.user_nome ? (
          <span style={{ fontWeight: 600, color: corAvatar(resp.user_nome) }}
            title={`Iniciado por ${resp.user_nome}${resp.started_at ? ' em ' + new Date(resp.started_at).toLocaleString('pt-BR') : ''}`}>
            {resp.user_nome}
          </span>
        ) : ''}
      </td>

      {TAREFAS.map((t) => {
        const aplica = t[3](company)
        const cell = valores[vkey(company.cod, t[0])]
        const val = cell?.valor || ''
        const vencida = atividadeVencida(cell)
        const proxima = !vencida && atividadeProxima(cell)
        const dicas = [CICLO_LABEL[val]]
        if (cell?.responsavel_nome) dicas.push(`Responsável: ${cell.responsavel_nome}`)
        if (cell?.prazo) dicas.push(`Prazo: ${fmtData(cell.prazo)}${vencida ? ' ⚠ VENCIDA' : ''}`)
        if (cell?.data_conclusao) dicas.push(`Concluída: ${fmtData(cell.data_conclusao)}`)
        if (cell?.observacoes) dicas.push(`Obs: ${cell.observacoes}`)
        if (cell?.nome) dicas.push(`Últ. alteração: ${cell.nome}`)
        dicas.push('Clique: muda status · Duplo clique: detalhes')
        return (
          <td key={t[0]}>
            <span
              className={`cel ${CICLO_CLS[val]}${aplica ? '' : ' cel-naoaplic'}${vencida ? ' cel-vencida' : ''}${proxima ? ' cel-proxima' : ''}`}
              onClick={() => onClick(company, t[0])}
              onDoubleClick={(e) => { e.preventDefault(); onDetalhe(t[0]) }}
              title={dicas.join('\n')}
            >
              {val ? CICLO_LABEL[val] : ''}
              {(cell?.prazo || cell?.responsavel_nome) && (
                <span className="cel-meta">
                  {vencida ? '⚠ ' : ''}{cell?.prazo ? fmtData(cell.prazo) : ''}
                  {cell?.responsavel_nome ? ` · ${cell.responsavel_nome.split(' ')[0]}` : ''}
                </span>
              )}
            </span>
          </td>
        )
      })}

      <td>
        <span style={{ fontSize: 10, color: '#64748b' }}>{resolvidos}/{total}</span>
        <div className="prog-bar-bg">
          <div className="prog-bar-fill" style={{ width: `${pct}%`, background: STATUS_CORES[st] }} />
        </div>
      </td>
      <td><span className={`status-chip ${STATUS_CLS[st]}`}>{st}</span></td>
    </tr>
  )
}

// ── Modal de detalhes da atividade ──
function DetalheModal({ company, taskKey, cell, equipe, onClose, onSave }) {
  const tarefa = TAREFAS.find((t) => t[0] === taskKey)
  const [valor, setValor] = useState(cell.valor || '')
  const [respId, setRespId] = useState('')
  const [respNome, setRespNome] = useState(cell.responsavel_nome || '')
  const [prazo, setPrazo] = useState(cell.prazo || '')
  const [conclusao, setConclusao] = useState(cell.data_conclusao || '')
  const [obs, setObs] = useState(cell.observacoes || '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const m = equipe.find((e) => e.nome === cell.responsavel_nome)
    if (m) setRespId(m.id)
  }, [equipe, cell.responsavel_nome])

  async function salvar(e) {
    e.preventDefault()
    setBusy(true)
    const membro = equipe.find((m) => m.id === respId)
    await onSave({
      valor,
      responsavel_id: respId || null,
      responsavel_nome: membro?.nome || respNome || null,
      prazo: prazo || null,
      data_conclusao: conclusao || null,
      observacoes: obs.trim() || null,
    })
    setBusy(false)
  }

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal lg" onSubmit={salvar}>
        <h2>{CAT_LABEL[tarefa[2]]} — {tarefa[1]}</h2>
        <p style={{ marginBottom: 14 }}>{company.cod} · {company.empresa}</p>

        <div className="field-row">
          <div className="field">
            <label>Status</label>
            <select value={valor} onChange={(e) => {
              const v = e.target.value
              setValor(v)
              if (v === 'feito' && !conclusao) setConclusao(hojeISO())
              if (v === '') setConclusao('')
            }}>
              {CICLO.map((v) => <option key={v} value={v}>{CICLO_LABEL[v]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Responsável</label>
            <select value={respId} onChange={(e) => setRespId(e.target.value)}>
              <option value="">— sem responsável —</option>
              {equipe.map((m) => <option key={m.id} value={m.id}>{m.nome || m.email}</option>)}
            </select>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Prazo</label>
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          <div className="field">
            <label>Data de conclusão</label>
            <input type="date" value={conclusao} onChange={(e) => setConclusao(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Observações</label>
          <textarea rows={3} maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)}
            placeholder="Anotações sobre esta atividade..." />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-sec" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-prim" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}
