import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase, fetchAllRows } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Spinner from '../components/Spinner'
import {
  TAREFAS, DOCS_ANEXOS, tarefasAplicaveis,
  PERIODOS_ANO_ATUAL, PERIODOS_ANO_ANT, ANO_ATUAL, ANO_ANT, periodoLabel, PERIODO_ATUAL,
  fmtMoeda, atividadeVencida, atividadeProxima,
} from '../lib/constants'
import { calcParcelamento, vencimentoProximo, vencimentoAtrasado } from '../lib/parc'
import { gerarRelatorioPDF } from '../lib/relatorio'

const REFRESH_MS = 30_000

// Períodos anteriores (inclusive) para o gráfico por competência.
function ultimosPeriodos(periodo, n = 6) {
  const [a, m] = periodo.split('-').map(Number)
  const out = []
  let ano = a
  let mes = m
  for (let i = 0; i < n; i++) {
    out.unshift(`${ano}-${String(mes).padStart(2, '0')}`)
    mes--
    if (mes === 0) { mes = 12; ano-- }
  }
  return out
}

export default function Dashboard() {
  const toast = useToast()
  const [periodo, setPeriodo] = useState(PERIODO_ATUAL)
  const [loading, setLoading] = useState(true)
  // Espelho do período p/ descartar respostas obsoletas + último período cujos
  // dados chegaram com sucesso (evita exibir números de um período sob o rótulo
  // de outro, inclusive no PDF).
  const periodoRef = useRef(periodo)
  periodoRef.current = periodo
  const carregadoRef = useRef(null)
  const [companies, setCompanies] = useState([])
  const [apuracao, setApuracao] = useState([])   // período selecionado (com detalhes)
  const [apuracaoHist, setApuracaoHist] = useState([]) // últimos 6 períodos (leve)
  const [anexos, setAnexos] = useState([])
  const [parcelamentos, setParcelamentos] = useState([])
  const [gerandoPdf, setGerandoPdf] = useState(false)

  const periodos6 = useMemo(() => ultimosPeriodos(periodo), [periodo])

  const carregar = useCallback(async (spin = false) => {
    if (spin) setLoading(true)
    const [c, ap, hist, ax, pc] = await Promise.all([
      supabase.from('companies').select('*'),
      fetchAllRows((sb) => sb.from('apuracao')
        .select('company_cod, task_key, valor, updated_by_nome, responsavel_nome, prazo, data_conclusao')
        .eq('periodo', periodo)
        .order('company_cod', { ascending: true })
        .order('task_key', { ascending: true })),
      fetchAllRows((sb) => sb.from('apuracao')
        .select('periodo, company_cod, task_key, valor')
        .in('periodo', periodos6)
        .order('periodo', { ascending: true })
        .order('company_cod', { ascending: true })
        .order('task_key', { ascending: true })),
      fetchAllRows((sb) => sb.from('anexos')
        .select('company_cod, doc_key, status')
        .eq('periodo', periodo)
        .order('company_cod', { ascending: true })
        .order('doc_key', { ascending: true })),
      supabase.from('parcelamentos').select('*'),
    ])
    // Resposta obsoleta (usuário já trocou de competência): descarta.
    if (periodo !== periodoRef.current) return
    // Falha em qualquer consulta: nunca zera os indicadores (zeros seriam
    // lidos — e impressos no PDF — como números reais). Se os dados na tela
    // são deste mesmo período, mantém; senão segue no spinner e o refresh de
    // 30s tenta de novo.
    if ([c, ap, hist, ax, pc].some((r) => r.error)) {
      toast('Erro ao atualizar o dashboard')
      if (carregadoRef.current === periodo) setLoading(false)
      return
    }
    setCompanies(c.data || [])
    setApuracao(ap.data || [])
    setApuracaoHist(hist.data || [])
    setAnexos(ax.data || [])
    setParcelamentos(pc.data || [])
    carregadoRef.current = periodo
    setLoading(false)
  }, [periodo, periodos6, toast])

  useEffect(() => {
    carregar(true)
    const t = setInterval(() => carregar(), REFRESH_MS)
    return () => clearInterval(t)
  }, [carregar])

  // ── Indicadores ──
  const dados = useMemo(() => {
    const ativas = companies.filter((c) => c.ativo !== false)

    // mapa cod__task -> row
    const vmap = {}
    apuracao.forEach((r) => { vmap[`${r.company_cod}__${r.task_key}`] = r })

    const porGrupo = { sol: { pend: 0, total: 0 }, imp: { pend: 0, total: 0 }, obrig: { pend: 0, total: 0 }, parc: { pend: 0, total: 0 } }
    let aplicaveisTotal = 0
    let resolvidosTotal = 0
    let vencidas = 0
    let proximas = 0
    const pendPorCliente = {}
    const feitasPorColab = {}

    ativas.forEach((c) => {
      const aplicaveis = tarefasAplicaveis(c)
      aplicaveis.forEach((t) => {
        const row = vmap[`${c.cod}__${t[0]}`]
        const st = row?.valor || ''
        const resolvido = st === 'feito' || st === 'na'
        aplicaveisTotal++
        porGrupo[t[2]].total++
        if (resolvido) resolvidosTotal++
        else {
          porGrupo[t[2]].pend++
          pendPorCliente[c.cod] = (pendPorCliente[c.cod] || 0) + 1
        }
        if (row && atividadeVencida({ ...row, valor: st })) vencidas++
        else if (row && atividadeProxima({ ...row, valor: st })) proximas++
      })
    })

    apuracao.forEach((r) => {
      if (r.valor === 'feito' && r.updated_by_nome) {
        feitasPorColab[r.updated_by_nome] = (feitasPorColab[r.updated_by_nome] || 0) + 1
      }
    })

    // anexos pendentes: slots (empresa ativa × 13 docs) não Finalizado/N-A
    const amap = {}
    anexos.forEach((r) => { amap[`${r.company_cod}__${r.doc_key}`] = r.status || '' })
    let anexosPend = 0
    ativas.forEach((c) => {
      DOCS_ANEXOS.forEach((d) => {
        const st = amap[`${c.cod}__${d[0]}`] || ''
        if (st !== 'feito' && st !== 'na') anexosPend++
      })
    })

    // parcelamentos
    const parcAtivos = parcelamentos.filter((p) => p.status === 'ativo')
    let divida = 0, pago = 0, saldo = 0
    parcAtivos.forEach((p) => {
      const calc = calcParcelamento(p)
      divida += calc.valorTotal
      pago += calc.valorPago
      saldo += calc.saldo
    })
    const parcProximos = parcAtivos.filter((p) => vencimentoProximo(p)).length
    const parcAtrasados = parcAtivos.filter((p) => vencimentoAtrasado(p)).length

    const pctGeral = aplicaveisTotal ? Math.round((resolvidosTotal / aplicaveisTotal) * 100) : 0

    // gráfico por cliente: top 10 com mais pendências
    const topClientes = Object.entries(pendPorCliente)
      .map(([cod, pend]) => ({ cod, pend, nome: (ativas.find((c) => c.cod === cod)?.empresa || cod) }))
      .sort((a, b) => b.pend - a.pend)
      .slice(0, 10)

    // gráfico por colaborador
    const colaboradores = Object.entries(feitasPorColab)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10)

    // gráfico por competência (% conclusão nos últimos 6 períodos)
    const histPorPeriodo = {}
    apuracaoHist.forEach((r) => {
      if (!histPorPeriodo[r.periodo]) histPorPeriodo[r.periodo] = {}
      histPorPeriodo[r.periodo][`${r.company_cod}__${r.task_key}`] = r.valor || ''
    })
    const competencias = periodos6.map((per) => {
      let total = 0
      let res = 0
      ativas.forEach((c) => {
        tarefasAplicaveis(c).forEach((t) => {
          total++
          const st = histPorPeriodo[per]?.[`${c.cod}__${t[0]}`] || ''
          if (st === 'feito' || st === 'na') res++
        })
      })
      return { periodo: per, pct: total ? Math.round((res / total) * 100) : 0 }
    })

    return {
      totalClientes: ativas.length,
      porGrupo, aplicaveisTotal, resolvidosTotal, pctGeral, vencidas, proximas,
      anexosPend,
      parcAtivos: parcAtivos.length, divida, pago, saldo, parcProximos, parcAtrasados,
      topClientes, colaboradores, competencias,
    }
  }, [companies, apuracao, apuracaoHist, anexos, parcelamentos, periodos6])

  async function baixarRelatorio() {
    setGerandoPdf(true)
    try {
      await gerarRelatorioPDF({
        periodo,
        companies,
        apuracao,
        anexos,
        parcelamentos,
        dados,
      })
    } catch (e) {
      toast('Erro ao gerar relatório: ' + e.message)
    }
    setGerandoPdf(false)
  }

  if (loading) return <Spinner full label="Carregando dashboard..." />

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div className="page-title" style={{ margin: 0 }}>Dashboard Gerencial</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="ctrl-label">Competência:</span>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}
            style={{ fontWeight: 700, color: 'var(--azul)', border: '1px solid var(--azul2)', borderRadius: 6, padding: '5px 10px' }}>
            <optgroup label={`── ${ANO_ATUAL} ──`}>
              {PERIODOS_ANO_ATUAL.map((p) => <option key={p} value={p}>{periodoLabel(p)}</option>)}
            </optgroup>
            <optgroup label={`── ${ANO_ANT} ──`}>
              {PERIODOS_ANO_ANT.map((p) => <option key={p} value={p}>{periodoLabel(p)}</option>)}
            </optgroup>
          </select>
          <button className="btn btn-grn" onClick={baixarRelatorio} disabled={gerandoPdf}>
            {gerandoPdf ? 'Gerando...' : '📄 Relatório PDF'}
          </button>
        </div>
      </div>

      {/* ── Indicadores ── */}
      <div className="cards">
        <Card label="Total de clientes" value={dados.totalClientes} sub="ativos na carteira" />
        <Card label="% geral de conclusão" value={`${dados.pctGeral}%`} sub={`${dados.resolvidosTotal} de ${dados.aplicaveisTotal} atividades`} verde={dados.pctGeral >= 80} ambar={dados.pctGeral >= 40 && dados.pctGeral < 80} vermelho={dados.pctGeral < 40} />
        <Card label="Solicitações pendentes" value={dados.porGrupo.sol.pend} sub={`de ${dados.porGrupo.sol.total} aplicáveis`} vermelho={dados.porGrupo.sol.pend > 0} />
        <Card label="XMLs pend. importação" value={dados.porGrupo.imp.pend} sub={`de ${dados.porGrupo.imp.total} aplicáveis`} vermelho={dados.porGrupo.imp.pend > 0} />
        <Card label="Obrigações pendentes" value={dados.porGrupo.obrig.pend} sub={`de ${dados.porGrupo.obrig.total} aplicáveis`} vermelho={dados.porGrupo.obrig.pend > 0} />
        <Card label="Docs pend. anexação" value={dados.anexosPend} sub="controle de anexos" />
        <Card label="Atividades vencidas" value={dados.vencidas} alerta={dados.vencidas > 0 ? 'err' : ''} vermelho={dados.vencidas > 0} />
      </div>

      <div className="cards">
        <Card label="Parcelamentos ativos" value={dados.parcAtivos} />
        <Card label="Valor total das dívidas" value={fmtMoeda(dados.divida)} small />
        <Card label="Valor total pago" value={fmtMoeda(dados.pago)} small verde />
        <Card label="Saldo devedor" value={fmtMoeda(dados.saldo)} small vermelho />
        <Card label="Venc. próximos (7d)" value={dados.parcProximos} ambar alerta={dados.parcProximos > 0 ? 'warn' : ''} />
        {dados.parcAtrasados > 0 && <Card label="Venc. atrasados" value={dados.parcAtrasados} vermelho alerta="err" />}
      </div>

      {/* ── Gráficos ── */}
      <div className="dash-grid">
        <div className="viz-root">
          <div className="viz-title">Atividades finalizadas por colaborador — {periodoLabel(periodo)}</div>
          {dados.colaboradores.length === 0 ? (
            <div className="muted">Sem atividades finalizadas no período.</div>
          ) : (
            <HBarChart
              rows={dados.colaboradores.map((c) => ({ label: c.nome, valor: c.qtd }))}
              max={Math.max(...dados.colaboradores.map((c) => c.qtd))}
              cor="#2a78d6"
            />
          )}
        </div>

        <div className="viz-root">
          <div className="viz-title">Clientes com mais pendências — {periodoLabel(periodo)}</div>
          {dados.topClientes.length === 0 ? (
            <div className="muted">🎉 Nenhuma pendência.</div>
          ) : (
            <HBarChart
              rows={dados.topClientes.map((c) => ({ label: c.nome, valor: c.pend }))}
              max={Math.max(...dados.topClientes.map((c) => c.pend))}
              cor="#1baf7a"
            />
          )}
        </div>

        <div className="viz-root">
          <div className="viz-title">% de conclusão por competência (últimos 6 meses)</div>
          <HBarChart
            rows={dados.competencias.map((c) => ({ label: periodoLabel(c.periodo), valor: c.pct, sufixo: '%' }))}
            max={100}
            cor="#2a78d6"
          />
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, sub, small, verde, vermelho, ambar, alerta }) {
  return (
    <div className={`card${alerta === 'err' ? ' card-alerta' : alerta === 'warn' ? ' card-alerta-warn' : ''}`}>
      <div className="card-label">{label}</div>
      <div className={`card-value${verde ? ' verde' : ''}${vermelho ? ' vermelho' : ''}${ambar ? ' ambar' : ''}`}
        style={small ? { fontSize: 17 } : undefined}>{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  )
}

// Barras horizontais em HTML puro (uma série, rótulos diretos).
function HBarChart({ rows, max, cor, sufixo = '' }) {
  const m = Math.max(max, 1)
  return (
    <div>
      {rows.map((r, i) => (
        <div className="hbar-row" key={i} title={`${r.label}: ${r.valor}${r.sufixo ?? sufixo}`}>
          <div className="hbar-label">{r.label}</div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${Math.round((r.valor / m) * 100)}%`, background: cor }} />
          </div>
          <div className="hbar-val">{r.valor}{r.sufixo ?? sufixo}</div>
        </div>
      ))}
    </div>
  )
}
