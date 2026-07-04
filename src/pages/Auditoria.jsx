import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'
import {
  TASK_LABEL, PERIODOS_2026, PERIODOS_2025, periodoLabel, statusEmpresa,
} from '../lib/constants'

const PERIODO_PADRAO = '2026-06'
const POR_PAGINA = 50

// Rótulos de valor para a auditoria
const VAL_TXT = { '': 'Vazio', andamento: 'Andamento', feito: 'Feito', na: 'N/A' }
const VAL_CHIP = { '': 'chip-para-vazio', andamento: 'chip-para-andamento', feito: 'chip-para-feito', na: 'chip-para-na' }

function valTxt(v) {
  if (v === null || v === undefined) return '—'
  return VAL_TXT[v] ?? v
}

// tipo de mudança (filtro) → valor_depois
const TIPO_MUDANCA = {
  iniciado: 'andamento',
  concluido: 'feito',
  na: 'na',
  desmarcado: '',
}

export default function Auditoria() {
  const [periodo, setPeriodo] = useState(PERIODO_PADRAO)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState([])
  const [apuracao, setApuracao] = useState([])
  const [logs, setLogs] = useState([])
  const [responsaveis, setResponsaveis] = useState([])

  const [aba, setAba] = useState('log') // log | operador | empresa
  const [fOperador, setFOperador] = useState('')
  const [fEmpresa, setFEmpresa] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    supabase.from('companies').select('cod, empresa, tipo, iss, icms, sf, sc, ativo')
      .then(({ data }) => setCompanies(data || []))
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setPagina(1)
    Promise.all([
      supabase.from('apuracao').select('company_cod, task_key, valor, updated_by_nome').eq('periodo', periodo),
      supabase.from('audit_log').select('*').eq('periodo', periodo).order('ts', { ascending: false }).limit(10000),
      supabase.from('responsavel_empresa').select('company_cod, user_nome, started_at').eq('periodo', periodo),
    ]).then(([ap, lg, re]) => {
      if (!active) return
      setApuracao(ap.data || [])
      setLogs(lg.data || [])
      setResponsaveis(re.data || [])
      setLoading(false)
    })
    return () => { active = false }
  }, [periodo])

  const empresaNome = useMemo(() => {
    const m = {}
    companies.forEach((c) => { m[c.cod] = c.empresa })
    return m
  }, [companies])

  // ── Cards de resumo ──
  const cards = useMemo(() => {
    const concluidas = apuracao.filter((r) => r.valor === 'feito').length
    const andamento = apuracao.filter((r) => r.valor === 'andamento').length

    // empresas 100% concluídas
    const porEmpresa = {}
    apuracao.forEach((r) => {
      porEmpresa[r.company_cod] = porEmpresa[r.company_cod] || {}
      porEmpresa[r.company_cod][r.task_key] = r.valor
    })
    let empresas100 = 0
    companies.forEach((c) => {
      const vmap = porEmpresa[c.cod] || {}
      const { st, total } = statusEmpresa(c, vmap)
      if (total > 0 && st === 'Concluído') empresas100++
    })

    // operador com mais tarefas concluídas (eventos feito no período)
    const feitoPorOp = {}
    logs.forEach((l) => {
      if (l.valor_depois === 'feito') {
        const n = l.user_nome || '—'
        feitoPorOp[n] = (feitoPorOp[n] || 0) + 1
      }
    })
    let topOp = '—'
    let topN = 0
    Object.entries(feitoPorOp).forEach(([n, q]) => { if (q > topN) { topN = q; topOp = n } })

    return { concluidas, andamento, empresas100, topOp, topN }
  }, [apuracao, companies, logs])

  // ── Filtro do log ──
  const logsFiltrados = useMemo(() => {
    return logs.filter((l) => {
      if (fOperador && (l.user_nome || '') !== fOperador) return false
      if (fEmpresa && l.company_cod !== fEmpresa) return false
      if (fTipo) {
        const alvo = TIPO_MUDANCA[fTipo]
        if ((l.valor_depois ?? '') !== alvo) return false
      }
      return true
    })
  }, [logs, fOperador, fEmpresa, fTipo])

  const totalPaginas = Math.max(1, Math.ceil(logsFiltrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const logsPagina = logsFiltrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  const operadores = useMemo(
    () => [...new Set(logs.map((l) => l.user_nome).filter(Boolean))].sort(),
    [logs]
  )
  const empresasComLog = useMemo(
    () => [...new Set(logs.map((l) => l.company_cod))].sort((a, b) => (Number(a) || 0) - (Number(b) || 0)),
    [logs]
  )

  // ── Agregação por operador ──
  const porOperador = useMemo(() => {
    const m = {}
    logs.forEach((l) => {
      const n = l.user_nome || '—'
      m[n] = m[n] || { nome: n, iniciadas: 0, concluidas: 0, na: 0, desmarcadas: 0, ultima: null }
      if (l.valor_depois === 'andamento') m[n].iniciadas++
      else if (l.valor_depois === 'feito') m[n].concluidas++
      else if (l.valor_depois === 'na') m[n].na++
      else if (l.valor_depois === '') m[n].desmarcadas++
      if (!m[n].ultima || l.ts > m[n].ultima) m[n].ultima = l.ts
    })
    return Object.values(m).sort((a, b) => b.concluidas - a.concluidas)
  }, [logs])

  // ── Agregação por empresa ──
  const porEmpresa = useMemo(() => {
    const respMap = {}
    responsaveis.forEach((r) => { respMap[r.company_cod] = r.user_nome })
    const m = {}
    logs.forEach((l) => {
      const cod = l.company_cod
      m[cod] = m[cod] || { cod, concluidas: 0, desmarcadas: 0, eventos: 0 }
      m[cod].eventos++
      if (l.valor_depois === 'feito') m[cod].concluidas++
      else if (l.valor_depois === '') m[cod].desmarcadas++
    })
    return Object.values(m)
      .map((e) => ({ ...e, empresa: empresaNome[e.cod] || e.cod, responsavel: respMap[e.cod] || '—' }))
      .sort((a, b) => (Number(a.cod) || 0) - (Number(b.cod) || 0))
  }, [logs, responsaveis, empresaNome])

  const seletorPeriodo = (
    <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}
      style={{ fontWeight: 700, color: 'var(--azul)', borderColor: 'var(--azul2)', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--cinza3)' }}>
      <optgroup label="── 2026 ──">
        {PERIODOS_2026.map((p) => <option key={p} value={p}>{periodoLabel(p)}</option>)}
      </optgroup>
      <optgroup label="── 2025 ──">
        {PERIODOS_2025.map((p) => <option key={p} value={p}>{periodoLabel(p)}</option>)}
      </optgroup>
    </select>
  )

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div className="page-title" style={{ margin: 0 }}>Auditoria</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ctrl-label">Período:</span>
          {seletorPeriodo}
        </div>
      </div>

      {loading ? (
        <Spinner label="Carregando auditoria..." />
      ) : (
        <>
          <div className="cards">
            <Card label="Tarefas concluídas" value={cards.concluidas} sub="no período selecionado" />
            <Card label="Tarefas em andamento" value={cards.andamento} sub="no período selecionado" />
            <Card label="Empresas 100% concluídas" value={cards.empresas100} sub={`de ${companies.length} empresas`} />
            <Card label="Operador destaque" value={cards.topOp} sub={cards.topN ? `${cards.topN} conclusões` : 'sem conclusões'} small />
          </div>

          <div className="tabs">
            <button className={`tab${aba === 'log' ? ' active' : ''}`} onClick={() => setAba('log')}>Registro de mudanças</button>
            <button className={`tab${aba === 'operador' ? ' active' : ''}`} onClick={() => setAba('operador')}>Por Operador</button>
            <button className={`tab${aba === 'empresa' ? ' active' : ''}`} onClick={() => setAba('empresa')}>Por Empresa</button>
          </div>

          {aba === 'log' && (
            <>
              <div className="barra" style={{ position: 'static', border: 'none', padding: '0 0 12px', background: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label className="ctrl-label">Operador:</label>
                  <select value={fOperador} onChange={(e) => { setFOperador(e.target.value); setPagina(1) }}>
                    <option value="">Todos</option>
                    {operadores.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label className="ctrl-label">Empresa:</label>
                  <select value={fEmpresa} onChange={(e) => { setFEmpresa(e.target.value); setPagina(1) }}>
                    <option value="">Todas</option>
                    {empresasComLog.map((c) => <option key={c} value={c}>{c} — {empresaNome[c] || c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label className="ctrl-label">Tipo:</label>
                  <select value={fTipo} onChange={(e) => { setFTipo(e.target.value); setPagina(1) }}>
                    <option value="">Todos</option>
                    <option value="iniciado">Iniciado</option>
                    <option value="concluido">Concluído</option>
                    <option value="na">N/A</option>
                    <option value="desmarcado">Desmarcado</option>
                  </select>
                </div>
                <button className="btn btn-sec" onClick={() => { setFOperador(''); setFEmpresa(''); setFTipo(''); setPagina(1) }}>Limpar</button>
              </div>

              <div className="data-table">
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Data/Hora</th><th>Operador</th><th>Empresa</th><th>Tarefa</th>
                        <th>De</th><th>Para</th><th>Período</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsPagina.length === 0 ? (
                        <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>Nenhum registro.</td></tr>
                      ) : logsPagina.map((l) => (
                        <tr key={l.id}>
                          <td className="muted">{new Date(l.ts).toLocaleString('pt-BR')}</td>
                          <td style={{ fontWeight: 600 }}>{l.user_nome || '—'}</td>
                          <td>{l.company_cod} · {empresaNome[l.company_cod] || l.company_cod}</td>
                          <td>{TASK_LABEL[l.task_key] || l.task_key}</td>
                          <td><span className={`chip chip-de`}>{valTxt(l.valor_antes)}</span></td>
                          <td><span className={`chip ${VAL_CHIP[l.valor_depois ?? ''] || 'chip-de'}`}>{valTxt(l.valor_depois)}</span></td>
                          <td className="muted">{periodoLabel(l.periodo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pager">
                  <button className="btn btn-sec" disabled={paginaAtual <= 1} onClick={() => setPagina((p) => p - 1)}>‹ Anterior</button>
                  <span>Página {paginaAtual} de {totalPaginas} · {logsFiltrados.length} registros</span>
                  <button className="btn btn-sec" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima ›</button>
                </div>
              </div>
            </>
          )}

          {aba === 'operador' && (
            <div className="data-table">
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>Operador</th><th>Iniciadas</th><th>Concluídas</th><th>N/A</th><th>Desmarcadas</th><th>Última atividade</th></tr>
                  </thead>
                  <tbody>
                    {porOperador.length === 0 ? (
                      <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sem atividade no período.</td></tr>
                    ) : porOperador.map((o) => (
                      <tr key={o.nome}>
                        <td style={{ fontWeight: 600 }}>{o.nome}</td>
                        <td>{o.iniciadas}</td>
                        <td>{o.concluidas}</td>
                        <td>{o.na}</td>
                        <td style={{ color: o.desmarcadas ? 'var(--vermelho)' : undefined, fontWeight: o.desmarcadas ? 600 : 400 }}>{o.desmarcadas}</td>
                        <td className="muted">{o.ultima ? new Date(o.ultima).toLocaleString('pt-BR') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pager"><span className="muted">Desmarcadas = retorno a vazio (indicador de correção/erro).</span></div>
            </div>
          )}

          {aba === 'empresa' && (
            <div className="data-table">
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>Cód</th><th>Empresa</th><th>Responsável</th><th>Concluídas</th><th>Desmarcações</th></tr>
                  </thead>
                  <tbody>
                    {porEmpresa.length === 0 ? (
                      <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sem atividade no período.</td></tr>
                    ) : porEmpresa.map((e) => (
                      <tr key={e.cod}>
                        <td className="muted">{e.cod}</td>
                        <td>{e.empresa}</td>
                        <td style={{ fontWeight: 600 }}>{e.responsavel}</td>
                        <td>{e.concluidas}</td>
                        <td style={{ color: e.desmarcadas ? 'var(--vermelho)' : undefined, fontWeight: e.desmarcadas ? 600 : 400 }}>{e.desmarcadas}</td>
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

function Card({ label, value, sub, small }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className="card-value" style={small ? { fontSize: 16 } : undefined}>{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  )
}
