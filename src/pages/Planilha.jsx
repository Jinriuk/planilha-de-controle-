import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import Spinner from '../components/Spinner'
import {
  TAREFAS, CICLO, CICLO_LABEL, CICLO_CLS, CAT_HDR, CAT_LABEL,
  PERIODOS_2026, PERIODOS_2025, periodoLabel,
  corAvatar, tarefasAplicaveis, statusEmpresa, STATUS_CORES, STATUS_CLS,
} from '../lib/constants'

const PERIODO_PADRAO = '2026-06'
const POLL_MS = 20_000

const vkey = (cod, task) => `${cod}__${task}`

export default function Planilha() {
  const { user, profile } = useAuth()
  const toast = useToast()

  const [companies, setCompanies] = useState([])
  const [periodo, setPeriodo] = useState(PERIODO_PADRAO)
  const [valores, setValores] = useState({}) // { `${cod}__${task}`: {valor, nome, at} }
  const [resp, setResp] = useState({}) // { cod: {user_nome, started_at} }
  const [loading, setLoading] = useState(true)

  const [busca, setBusca] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fGrupo, setFGrupo] = useState('')
  const [fStatus, setFStatus] = useState('')

  const valoresRef = useRef(valores)
  valoresRef.current = valores
  const respRef = useRef(resp)
  respRef.current = resp

  const nome = profile?.nome || user?.email || ''

  // ── Carga inicial de empresas (uma vez) ──
  useEffect(() => {
    let active = true
    supabase
      .from('companies')
      .select('*')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          toast('Erro ao carregar empresas')
          return
        }
        const ordenadas = (data || []).sort(
          (a, b) => (Number(a.cod) || 0) - (Number(b.cod) || 0)
        )
        setCompanies(ordenadas)
      })
    return () => {
      active = false
    }
  }, [toast])

  // ── Carrega apuração + responsáveis do período ──
  const carregarPeriodo = useCallback(
    async (per, showSpinner = false) => {
      if (showSpinner) setLoading(true)
      const [ap, re] = await Promise.all([
        supabase
          .from('apuracao')
          .select('company_cod, task_key, valor, updated_by_nome, updated_at')
          .eq('periodo', per),
        supabase
          .from('responsavel_empresa')
          .select('company_cod, user_nome, started_at')
          .eq('periodo', per),
      ])
      const vmap = {}
      for (const r of ap.data || []) {
        vmap[vkey(r.company_cod, r.task_key)] = {
          valor: r.valor || '',
          nome: r.updated_by_nome,
          at: r.updated_at,
        }
      }
      const rmap = {}
      for (const r of re.data || []) {
        rmap[r.company_cod] = { user_nome: r.user_nome, started_at: r.started_at }
      }
      setValores(vmap)
      setResp(rmap)
      setLoading(false)
    },
    []
  )

  useEffect(() => {
    carregarPeriodo(periodo, true)
  }, [periodo, carregarPeriodo])

  // ── Realtime + polling de fallback ──
  useEffect(() => {
    const canal = supabase
      .channel(`planilha:${periodo}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'apuracao', filter: `periodo=eq.${periodo}` },
        (payload) => {
          const row = payload.new?.company_cod ? payload.new : payload.old
          if (!row) return
          const k = vkey(row.company_cod, row.task_key)
          setValores((prev) => {
            if (payload.eventType === 'DELETE') {
              const cp = { ...prev }
              delete cp[k]
              return cp
            }
            return {
              ...prev,
              [k]: { valor: payload.new.valor || '', nome: payload.new.updated_by_nome, at: payload.new.updated_at },
            }
          })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'responsavel_empresa', filter: `periodo=eq.${periodo}` },
        (payload) => {
          setResp((prev) => {
            const cp = { ...prev }
            if (payload.eventType === 'DELETE') {
              delete cp[payload.old.company_cod]
            } else {
              cp[payload.new.company_cod] = {
                user_nome: payload.new.user_nome,
                started_at: payload.new.started_at,
              }
            }
            return cp
          })
        }
      )
      .subscribe()

    const poll = setInterval(() => carregarPeriodo(periodo), POLL_MS)

    return () => {
      supabase.removeChannel(canal)
      clearInterval(poll)
    }
  }, [periodo, carregarPeriodo])

  // ── Clique numa célula: cicla estado + grava ──
  const handleClick = useCallback(
    async (company, taskKey) => {
      const k = vkey(company.cod, taskKey)
      const atual = valoresRef.current[k]?.valor || ''
      const idx = CICLO.indexOf(atual)
      const prox = CICLO[(idx + 1) % CICLO.length]

      // otimista
      const novoMapa = {
        ...valoresRef.current,
        [k]: { valor: prox, nome, at: new Date().toISOString() },
      }
      setValores(novoMapa)

      // grava apuracao
      const { error } = await supabase.from('apuracao').upsert(
        {
          company_cod: company.cod,
          task_key: taskKey,
          periodo,
          valor: prox,
          updated_by: user.id,
          updated_by_nome: nome,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_cod,task_key,periodo' }
      )
      if (error) {
        toast('Erro ao salvar — recarregando')
        carregarPeriodo(periodo)
        return
      }

      // ── Responsável (§6.3 / §8.1): definido quando há atividade e ninguém
      // ainda é responsável; limpo quando TODAS as tarefas voltam a vazio.
      const temAtividade = TAREFAS.some(
        (t) => (novoMapa[vkey(company.cod, t[0])]?.valor || '') !== ''
      )
      const jaTemResp = !!respRef.current[company.cod]

      if (!temAtividade && jaTemResp) {
        setResp((prev) => {
          const cp = { ...prev }
          delete cp[company.cod]
          return cp
        })
        await supabase
          .from('responsavel_empresa')
          .delete()
          .eq('company_cod', company.cod)
          .eq('periodo', periodo)
      } else if (temAtividade && !jaTemResp) {
        setResp((prev) => ({
          ...prev,
          [company.cod]: { user_nome: nome, started_at: new Date().toISOString() },
        }))
        await supabase.from('responsavel_empresa').upsert(
          {
            company_cod: company.cod,
            periodo,
            user_id: user.id,
            user_nome: nome,
            started_at: new Date().toISOString(),
          },
          { onConflict: 'company_cod,periodo', ignoreDuplicates: true }
        )
      }

      toast(`${CICLO_LABEL[prox] || 'Limpo'} — salvo!`)
    },
    [periodo, user, nome, toast, carregarPeriodo]
  )

  // ── Filtros ──
  const grupos = useMemo(
    () => [...new Set(companies.map((c) => c.grupo).filter(Boolean))].sort(),
    [companies]
  )

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase()
    return companies.filter((c) => {
      if (
        q &&
        !c.empresa.toLowerCase().includes(q) &&
        !String(c.cod).includes(q) &&
        !(c.grupo || '').toLowerCase().includes(q)
      )
        return false
      if (fTipo && c.tipo !== fTipo) return false
      if (fGrupo && c.grupo !== fGrupo) return false
      if (fStatus) {
        const vmap = valoresMapaEmpresa(c.cod, valores)
        const { st } = statusEmpresa(c, vmap)
        if (st !== fStatus) return false
      }
      return true
    })
  }, [companies, busca, fTipo, fGrupo, fStatus, valores])

  // ── Stats ──
  const stats = useMemo(() => {
    const cnt = { Concluído: 0, 'Em andamento': 0, 'Não iniciado': 0, 'N/A': 0 }
    filtradas.forEach((c) => {
      const vmap = valoresMapaEmpresa(c.cod, valores)
      const { st } = statusEmpresa(c, vmap)
      cnt[st]++
    })
    return cnt
  }, [filtradas, valores])

  function limparFiltros() {
    setBusca('')
    setFTipo('')
    setFGrupo('')
    setFStatus('')
  }

  function exportarCSV() {
    const header = ['Cód', 'Empresa', 'Tipo', 'Grupo', 'Responsável', ...TAREFAS.map((t) => t[1]), 'Status']
    const rows = [header]
    filtradas.forEach((c) => {
      const vmap = valoresMapaEmpresa(c.cod, valores)
      const { st } = statusEmpresa(c, vmap)
      const vals = TAREFAS.map((t) => vmap[t[0]] || '')
      rows.push([
        c.cod, c.empresa, c.tipo || '', c.grupo || '',
        resp[c.cod]?.user_nome || '', ...vals, st,
      ])
    })
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(csv)
    a.download = `controle_${periodo}.csv`
    a.click()
  }

  // ── Cabeçalho por categoria ──
  const catSpans = useMemo(() => {
    const out = []
    let prev = ''
    let count = 0
    TAREFAS.forEach((t, i) => {
      if (t[2] !== prev) {
        if (prev) out.push({ cat: prev, count })
        prev = t[2]
        count = 1
      } else count++
      if (i === TAREFAS.length - 1) out.push({ cat: prev, count })
    })
    return out
  }, [])

  if (loading) return <Spinner full label="Carregando controle..." />

  return (
    <>
      <div className="barra">
        <div className="per-sel" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="ctrl-label">Período:</label>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}
            style={{ fontWeight: 700, color: 'var(--azul)', borderColor: 'var(--azul2)' }}>
            <optgroup label="── 2026 ──">
              {PERIODOS_2026.map((p) => (
                <option key={p} value={p}>{periodoLabel(p)}</option>
              ))}
            </optgroup>
            <optgroup label="── 2025 ──">
              {PERIODOS_2025.map((p) => (
                <option key={p} value={p}>{periodoLabel(p)}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <input className="busca" placeholder="Buscar empresa ou grupo..."
          value={busca} onChange={(e) => setBusca(e.target.value)} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="ctrl-label">Tipo:</label>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option>Comércio</option>
            <option>Serviços</option>
            <option>Comércio / Serviços</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="ctrl-label">Grupo:</label>
          <select value={fGrupo} onChange={(e) => setFGrupo(e.target.value)}>
            <option value="">Todos</option>
            {grupos.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="ctrl-label">Status:</label>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="Concluído">Concluído</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Não iniciado">Não iniciado</option>
            <option value="N/A">N/A</option>
          </select>
        </div>
        <button className="btn btn-sec" onClick={limparFiltros}>Limpar</button>
        <div className="ml-auto" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-grn" onClick={exportarCSV}>⬇ Exportar CSV</button>
          <button className="btn btn-prim" onClick={() => { carregarPeriodo(periodo, true); toast('↻ Atualizado') }}>
            ↻ Atualizar
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><strong>{filtradas.length}</strong>&nbsp;empresas</div>
        {Object.entries(stats).map(([s, n]) => (
          <div className="stat" key={s}>
            <span className="dot" style={{ background: STATUS_CORES[s] }} />
            <strong>{n}</strong>&nbsp;{s}
          </div>
        ))}
      </div>

      <div className="tabela-wrap">
        {filtradas.length === 0 ? (
          <div className="sem-resultado">Nenhuma empresa encontrada com os filtros selecionados.</div>
        ) : (
          <table className="planilha">
            <thead>
              <tr>
                <th className="th-grupo-id" rowSpan={2} style={{ width: 32 }}>#</th>
                <th className="th-grupo-id" rowSpan={2} style={{ width: 36 }}>Cód</th>
                <th className="th-grupo-id th-emp" rowSpan={2}>Empresa</th>
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
                  <th key={t[0]} className={CAT_HDR[t[2]]} style={{ width: 76, fontSize: 9, fontWeight: 500 }}>
                    {t[1]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c, idx) => (
                <LinhaEmpresa
                  key={c.cod}
                  idx={idx}
                  company={c}
                  valores={valores}
                  resp={resp[c.cod]}
                  onClick={handleClick}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// Extrai { task_key: valor } de uma empresa a partir do mapa geral.
function valoresMapaEmpresa(cod, valores) {
  const out = {}
  for (const t of TAREFAS) {
    const v = valores[vkey(cod, t[0])]
    if (v) out[t[0]] = v.valor
  }
  return out
}

function LinhaEmpresa({ idx, company, valores, resp, onClick }) {
  const vmap = valoresMapaEmpresa(company.cod, valores)
  const { total, feitos, pct, st } = statusEmpresa(company, vmap)
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
          <span
            style={{ fontWeight: 600, color: corAvatar(resp.user_nome) }}
            title={`Tarefa iniciada por ${resp.user_nome}${resp.started_at ? ' em ' + new Date(resp.started_at).toLocaleString('pt-BR') : ''}`}
          >
            {resp.user_nome}
          </span>
        ) : ''}
      </td>

      {TAREFAS.map((t) => {
        const aplica = t[3](company)
        const cell = valores[vkey(company.cod, t[0])]
        const val = cell?.valor || ''
        const dica = val
          ? `${CICLO_LABEL[val]}${cell?.nome ? ' · por ' + cell.nome : ''}${cell?.at ? ' em ' + new Date(cell.at).toLocaleString('pt-BR') : ''}`
          : aplica
            ? 'Clique para mudar status'
            : 'Normalmente não se aplica — clique para preencher mesmo assim'
        return (
          <td key={t[0]}>
            <span
              className={`cel ${CICLO_CLS[val]}${aplica ? '' : ' cel-naoaplic'}`}
              onClick={() => onClick(company, t[0])}
              title={dica}
            >
              {CICLO_LABEL[val]}
            </span>
          </td>
        )
      })}

      <td>
        <span style={{ fontSize: 10, color: '#64748b' }}>{feitos}/{total}</span>
        <div className="prog-bar-bg">
          <div className="prog-bar-fill" style={{ width: `${pct}%`, background: STATUS_CORES[st] }} />
        </div>
      </td>
      <td><span className={`status-chip ${STATUS_CLS[st]}`}>{st}</span></td>
    </tr>
  )
}
