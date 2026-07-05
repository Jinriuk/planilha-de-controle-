// ─────────────────────────────────────────────────────────────────────────
// Relatório Gerencial em PDF (via impressão do navegador) — A4, print-ready.
// buildRelatorioHTML(data) é puro (usado também no harness de QA);
// gerarRelatorioPDF(data) abre a janela de impressão.
// ─────────────────────────────────────────────────────────────────────────
import {
  CAT_LABEL, tarefasAplicaveis, periodoLabel, fmtMoeda, fmtData,
} from './constants.js'
import { calcParcelamento, vencimentoProximo, vencimentoAtrasado } from './parc.js'

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const PCT_COR = (pct) => (pct >= 80 ? '#15803d' : pct >= 40 ? '#b45309' : '#b91c1c')

function barra(pct, cor, h = 7) {
  return `<span class="bar" style="height:${h}px"><span class="bar-fill" style="width:${Math.min(pct, 100)}%;background:${cor}"></span></span>`
}

function chipStatus(st) {
  const map = {
    Finalizado: ['#dcfce7', '#15803d'],
    'Em andamento': ['#fef3c7', '#92400e'],
    'Não iniciado': ['#fee2e2', '#b91c1c'],
    'Não se aplica': ['#f3f4f6', '#6b7280'],
    Ativo: ['#fef3c7', '#92400e'],
    Quitado: ['#dcfce7', '#15803d'],
    Suspenso: ['#f3f4f6', '#6b7280'],
    Cancelado: ['#fee2e2', '#b91c1c'],
  }
  const [bg, fg] = map[st] || ['#f3f4f6', '#6b7280']
  return `<span class="chip" style="background:${bg};color:${fg}">${esc(st)}</span>`
}

function rodape(compet, emissao) {
  return `<div class="rodape">
    <span>Controle de Apuração — AM Assessoria e Consultoria Tributária</span>
    <span>Competência ${esc(compet)} · Emitido em ${esc(emissao)}</span>
  </div>`
}

function kpi(label, valor, opts = {}) {
  const cor = opts.cor || '#1F3864'
  const sub = opts.sub ? `<div class="kpi-sub">${esc(opts.sub)}</div>` : ''
  return `<div class="kpi${opts.destaque ? ' kpi-destaque' : ''}">
    <div class="kpi-label">${esc(label)}</div>
    <div class="kpi-valor" style="color:${cor}">${valor}</div>
    ${sub}
  </div>`
}

function hbars(rows, { max, cor = '#2E5FA3', sufixo = '' } = {}) {
  const m = Math.max(max ?? Math.max(...rows.map((r) => r.valor), 1), 1)
  return `<div class="hbars">${rows
    .map(
      (r) => `<div class="hbar">
        <div class="hbar-label">${esc(r.label)}</div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${Math.round((r.valor / m) * 100)}%;background:${r.cor || cor}"></div></div>
        <div class="hbar-val">${r.valor}${sufixo}</div>
      </div>`
    )
    .join('')}</div>`
}

export function buildRelatorioHTML({ periodo, companies, apuracao, parcelamentos, dados }) {
  const emissao = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
  const compet = periodoLabel(periodo)
  const ativas = companies.filter((c) => c.ativo !== false)

  // situação por cliente
  const vmap = {}
  apuracao.forEach((r) => { vmap[`${r.company_cod}__${r.task_key}`] = r.valor || '' })
  const clientes = ativas
    .map((c) => {
      const aplicaveis = tarefasAplicaveis(c)
      const total = aplicaveis.length
      const res = aplicaveis.filter((t) => ['feito', 'na'].includes(vmap[`${c.cod}__${t[0]}`] || '')).length
      const pct = total ? Math.round((res / total) * 100) : 100
      const st = total === 0 ? 'Não se aplica' : res === total ? 'Finalizado' : res === 0 ? 'Não iniciado' : 'Em andamento'
      return { cod: c.cod, empresa: c.empresa, grupo: c.grupo, total, res, pct, st }
    })
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
  const clientesMostrados = clientes.slice(0, 40)

  const parcAtivos = parcelamentos.filter((p) => p.status === 'ativo')
  const nomeEmpresa = Object.fromEntries(companies.map((c) => [c.cod, c.empresa]))

  const resumoGrupos = ['sol', 'imp', 'obrig', 'parc'].map((g) => {
    const { pend, total } = dados.porGrupo[g]
    const done = total - pend
    const pct = total ? Math.round((done / total) * 100) : 100
    return { g, label: CAT_LABEL[g], total, done, pend, pct }
  })

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório Gerencial — ${esc(compet)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --navy: #1F3864; --navy2: #2E5FA3; --ink: #1e293b; --sub: #64748b;
    --hair: #e2e8f0; --bg-soft: #f8fafc;
  }
  html, body { background: #fff; }
  body {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: var(--ink); font-size: 10.5px; line-height: 1.45;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  @page { size: A4 portrait; margin: 12mm 12mm 12mm; }
  .sheet { break-after: page; min-height: 268mm; display: flex; flex-direction: column; }
  .alertas { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 4px; }
  .alerta-item { display: flex; align-items: center; gap: 8px; border: 1px solid var(--hair); border-radius: 9px; padding: 9px 11px; }
  .alerta-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .alerta-num { font-size: 15px; font-weight: 800; }
  .alerta-txt { font-size: 8px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: var(--sub); line-height: 1.3; }
  td.nowrap { white-space: nowrap; }
  .sheet:last-child { break-after: auto; }
  .rodape {
    margin-top: auto; padding-top: 6px; border-top: 1px solid var(--hair);
    display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8;
  }

  /* Cabeçalho principal */
  .capa {
    background: linear-gradient(120deg, #1F3864 0%, #2E5FA3 78%, #3d74c4 100%);
    color: #fff; border-radius: 12px; padding: 26px 28px 24px; margin-bottom: 16px;
  }
  .capa .org { font-size: 10px; letter-spacing: 2.2px; text-transform: uppercase; color: #a9c4e8; font-weight: 600; }
  .capa h1 { font-size: 25px; font-weight: 800; letter-spacing: -.3px; margin: 6px 0 2px; }
  .capa .sub { font-size: 12px; color: #cddcf2; }
  .capa .meta { display: flex; gap: 26px; margin-top: 16px; padding-top: 13px; border-top: 1px solid rgba(255,255,255,.28); }
  .capa .meta div b { display: block; font-size: 8.5px; letter-spacing: 1.4px; text-transform: uppercase; color: #a9c4e8; font-weight: 700; margin-bottom: 2px; }
  .capa .meta div span { font-size: 12.5px; font-weight: 600; }

  /* Seções */
  .sec { margin: 15px 0 8px; display: flex; align-items: center; gap: 8px; }
  .sec::before { content: ''; width: 4px; height: 15px; background: var(--navy2); border-radius: 2px; }
  .sec h2 { font-size: 12.5px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: var(--navy); }
  .sec small { color: var(--sub); font-weight: 500; font-size: 9.5px; margin-left: auto; }

  /* KPIs */
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .kpi { border: 1px solid var(--hair); border-radius: 9px; padding: 9px 11px; background: #fff; }
  .kpi-destaque { background: var(--bg-soft); border-color: #c9d7ea; }
  .kpi-label { font-size: 7.8px; font-weight: 700; letter-spacing: .9px; text-transform: uppercase; color: var(--sub); }
  .kpi-valor { font-size: 17px; font-weight: 800; margin-top: 3px; letter-spacing: -.2px; }
  .kpi-sub { font-size: 8.5px; color: var(--sub); margin-top: 1px; }

  /* Hero de conclusão */
  .hero {
    display: flex; align-items: center; gap: 18px; border: 1px solid var(--hair);
    border-radius: 10px; padding: 14px 18px; margin-top: 10px; background: var(--bg-soft);
  }
  .hero .num { font-size: 34px; font-weight: 800; letter-spacing: -1px; }
  .hero .rot { font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--sub); }
  .hero .trilho { flex: 1; }

  /* Barras */
  .bar { display: inline-block; width: 100%; background: #e9eef5; border-radius: 4px; overflow: hidden; vertical-align: middle; }
  .bar-fill { display: block; height: 100%; border-radius: 4px; }
  .hbars { margin-top: 4px; }
  .hbar { display: grid; grid-template-columns: 150px 1fr 40px; gap: 8px; align-items: center; margin-bottom: 5px; }
  .hbar-label { font-size: 9px; color: var(--ink); text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hbar-track { height: 11px; background: #e9eef5; border-radius: 4px; overflow: hidden; }
  .hbar-fill { height: 100%; border-radius: 4px; min-width: 2px; }
  .hbar-val { font-size: 9.5px; font-weight: 700; font-variant-numeric: tabular-nums; }

  /* Tabelas */
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  thead th {
    background: var(--navy); color: #fff; font-size: 8.2px; font-weight: 700;
    letter-spacing: .5px; text-transform: uppercase; padding: 6px 7px; text-align: left;
  }
  thead th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody td { padding: 5px 7px; border-bottom: 1px solid #eef2f7; font-size: 9.3px; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tr { break-inside: avoid; }
  .chip { display: inline-block; border-radius: 20px; padding: 1.5px 8px; font-size: 8px; font-weight: 700; white-space: nowrap; }
  .cli-nome { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .duas-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .quadro { border: 1px solid var(--hair); border-radius: 10px; padding: 12px 14px; }
  .nota { font-size: 8.5px; color: var(--sub); margin-top: 6px; }

</style>
</head>
<body>

<!-- ═══ PÁGINA 1 — Visão geral ═══ -->
<div class="sheet">
  <div class="capa">
    <div class="org">AM Assessoria e Consultoria Tributária</div>
    <h1>Relatório Gerencial do Departamento Fiscal</h1>
    <div class="sub">Gestão da rotina fiscal — acompanhamento de atividades, anexos e parcelamentos</div>
    <div class="meta">
      <div><b>Competência</b><span>${esc(compet)}</span></div>
      <div><b>Clientes ativos</b><span>${dados.totalClientes}</span></div>
      <div><b>Emissão</b><span>${esc(emissao)}</span></div>
    </div>
  </div>

  <div class="sec"><h2>Indicadores do período</h2></div>
  <div class="kpis">
    ${kpi('Total de clientes', dados.totalClientes)}
    ${kpi('Atividades aplicáveis', dados.aplicaveisTotal)}
    ${kpi('Atividades resolvidas', dados.resolvidosTotal, { cor: '#15803d' })}
    ${kpi('Atividades vencidas', dados.vencidas, { cor: dados.vencidas ? '#b91c1c' : '#15803d' })}
    ${kpi('Solicitações pendentes', dados.porGrupo.sol.pend, { cor: dados.porGrupo.sol.pend ? '#b91c1c' : '#15803d', sub: `de ${dados.porGrupo.sol.total} aplicáveis` })}
    ${kpi('XMLs pend. importação', dados.porGrupo.imp.pend, { cor: dados.porGrupo.imp.pend ? '#b91c1c' : '#15803d', sub: `de ${dados.porGrupo.imp.total} aplicáveis` })}
    ${kpi('Obrigações pendentes', dados.porGrupo.obrig.pend, { cor: dados.porGrupo.obrig.pend ? '#b91c1c' : '#15803d', sub: `de ${dados.porGrupo.obrig.total} aplicáveis` })}
    ${kpi('Docs pend. anexação', dados.anexosPend, { cor: dados.anexosPend ? '#b45309' : '#15803d' })}
  </div>

  <div class="hero">
    <div>
      <div class="rot">Conclusão geral</div>
      <div class="num" style="color:${PCT_COR(dados.pctGeral)}">${dados.pctGeral}%</div>
    </div>
    <div class="trilho">
      ${barra(dados.pctGeral, PCT_COR(dados.pctGeral), 14)}
      <div class="nota">${dados.resolvidosTotal} de ${dados.aplicaveisTotal} atividades finalizadas ou não aplicáveis na competência ${esc(compet)}.</div>
    </div>
  </div>

  <div class="sec"><h2>Resumo por etapa da rotina</h2></div>
  <table>
    <thead>
      <tr>
        <th style="width:34%">Etapa</th>
        <th class="num">Aplicáveis</th>
        <th class="num">Resolvidas</th>
        <th class="num">Pendentes</th>
        <th style="width:26%">Conclusão</th>
        <th class="num">%</th>
      </tr>
    </thead>
    <tbody>
      ${resumoGrupos
        .map(
          (r) => `<tr>
            <td style="font-weight:600">${esc(r.label)}</td>
            <td class="num">${r.total}</td>
            <td class="num" style="color:#15803d;font-weight:600">${r.done}</td>
            <td class="num" style="color:${r.pend ? '#b91c1c' : '#15803d'};font-weight:600">${r.pend}</td>
            <td>${barra(r.pct, PCT_COR(r.pct))}</td>
            <td class="num" style="font-weight:700">${r.pct}%</td>
          </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <div class="sec"><h2>Alertas do período</h2></div>
  <div class="alertas">
    <div class="alerta-item">
      <span class="alerta-dot" style="background:${dados.vencidas ? '#dc2626' : '#15803d'}"></span>
      <div><div class="alerta-num" style="color:${dados.vencidas ? '#b91c1c' : '#15803d'}">${dados.vencidas}</div>
      <div class="alerta-txt">Atividades vencidas</div></div>
    </div>
    <div class="alerta-item">
      <span class="alerta-dot" style="background:${dados.proximas ? '#f59e0b' : '#15803d'}"></span>
      <div><div class="alerta-num" style="color:${dados.proximas ? '#b45309' : '#15803d'}">${dados.proximas ?? 0}</div>
      <div class="alerta-txt">Vencem em até 3 dias</div></div>
    </div>
    <div class="alerta-item">
      <span class="alerta-dot" style="background:${dados.parcAtrasados ? '#dc2626' : '#15803d'}"></span>
      <div><div class="alerta-num" style="color:${dados.parcAtrasados ? '#b91c1c' : '#15803d'}">${dados.parcAtrasados}</div>
      <div class="alerta-txt">Parcelamentos em atraso</div></div>
    </div>
    <div class="alerta-item">
      <span class="alerta-dot" style="background:${dados.parcProximos ? '#f59e0b' : '#15803d'}"></span>
      <div><div class="alerta-num" style="color:${dados.parcProximos ? '#b45309' : '#15803d'}">${dados.parcProximos}</div>
      <div class="alerta-txt">Parcelamentos vencem em 7 dias</div></div>
    </div>
  </div>
  <div class="nota">Alertas calculados automaticamente a partir dos prazos informados nas atividades e nos parcelamentos.</div>
  ${rodape(compet, emissao)}
</div>

<!-- ═══ PÁGINA 2 — Produtividade, pendências e parcelamentos ═══ -->
<div class="sheet">
  <div class="sec"><h2>Produtividade da equipe</h2><small>competência ${esc(compet)}</small></div>
  <div class="duas-col">
    <div class="quadro">
      <div class="sec" style="margin-top:0"><h2 style="font-size:10.5px">Finalizadas por colaborador</h2></div>
      ${dados.colaboradores.length
        ? hbars(dados.colaboradores.map((c) => ({ label: c.nome, valor: c.qtd })), { cor: '#2E5FA3' })
        : '<div class="nota">Sem atividades finalizadas no período.</div>'}
    </div>
    <div class="quadro">
      <div class="sec" style="margin-top:0"><h2 style="font-size:10.5px">Evolução por competência</h2></div>
      ${hbars(dados.competencias.map((c) => ({ label: periodoLabel(c.periodo), valor: c.pct, cor: PCT_COR(c.pct) })), { max: 100, sufixo: '%' })}
      <div class="nota">% de atividades resolvidas nos últimos 6 meses.</div>
    </div>
  </div>

  <div class="sec"><h2>Clientes com mais pendências</h2><small>top ${Math.min(dados.topClientes.length, 10)}</small></div>
  <div class="quadro">
    ${dados.topClientes.length
      ? hbars(dados.topClientes.map((c) => ({ label: c.nome, valor: c.pend })), { cor: '#b91c1c' })
      : '<div class="nota">Nenhuma pendência registrada na competência.</div>'}
  </div>

  <div class="sec"><h2>Controle de Parcelamentos</h2></div>
  <div class="kpis">
    ${kpi('Parcelamentos ativos', dados.parcAtivos)}
    ${kpi('Valor total das dívidas', fmtMoeda(dados.divida))}
    ${kpi('Valor total pago', fmtMoeda(dados.pago), { cor: '#15803d' })}
    ${kpi('Saldo devedor', fmtMoeda(dados.saldo), { cor: '#b91c1c' })}
  </div>

  ${parcAtivos.length || parcelamentos.length
    ? `<table style="margin-top:12px">
    <thead>
      <tr>
        <th>Cliente</th><th>Órgão</th><th>Débito</th>
        <th class="num">Dívida</th><th class="num">Parc.</th><th class="num">Pagas</th>
        <th class="num">Saldo devedor</th><th style="width:14%">Quitado</th>
        <th>Próx. venc.</th><th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${parcelamentos
        .map((p) => {
          const c = calcParcelamento(p)
          const atras = vencimentoAtrasado(p)
          const prox = vencimentoProximo(p)
          const stLbl = { ativo: 'Ativo', quitado: 'Quitado', suspenso: 'Suspenso', cancelado: 'Cancelado' }[p.status]
          return `<tr>
            <td class="cli-nome" style="font-weight:600">${esc(nomeEmpresa[p.company_cod] || p.company_cod)}</td>
            <td>${esc(p.orgao || '—')}</td>
            <td>${esc(p.tipo_debito || '—')}</td>
            <td class="num">${fmtMoeda(c.valorTotal)}</td>
            <td class="num">${c.qtd}</td>
            <td class="num" style="color:#15803d;font-weight:600">${c.pagas}</td>
            <td class="num" style="font-weight:700">${fmtMoeda(c.saldo)}</td>
            <td>${barra(c.pct, c.pct === 100 ? '#15803d' : '#2E5FA3')} <span style="font-size:8.5px;font-weight:700">${c.pct}%</span></td>
            <td class="nowrap" style="${atras ? 'color:#b91c1c;font-weight:700' : prox ? 'color:#b45309;font-weight:700' : ''}">${atras ? '▲ ' : prox ? '● ' : ''}${fmtData(p.proximo_vencimento)}</td>
            <td>${chipStatus(stLbl)}</td>
          </tr>`
        })
        .join('')}
    </tbody>
  </table>
  ${dados.parcProximos || dados.parcAtrasados
    ? `<div class="nota" style="color:#b91c1c;font-weight:600">▲ ${dados.parcAtrasados ? `${dados.parcAtrasados} parcelamento(s) com vencimento atrasado. ` : ''}${dados.parcProximos ? `${dados.parcProximos} parcelamento(s) vencem nos próximos 7 dias.` : ''}</div>`
    : ''}`
    : '<div class="quadro"><div class="nota">Nenhum parcelamento cadastrado.</div></div>'}
  ${rodape(compet, emissao)}
</div>

<!-- ═══ PÁGINA 3 — Situação por cliente ═══ -->
<div class="sheet">
  <div class="sec"><h2>Situação por cliente</h2><small>${clientesMostrados.length < clientes.length ? `${clientesMostrados.length} clientes com menor conclusão (de ${clientes.length})` : `${clientes.length} clientes ativos`}</small></div>
  <table>
    <thead>
      <tr>
        <th style="width:34px">Cód</th>
        <th>Cliente</th>
        <th>Grupo</th>
        <th class="num">Resolvidas</th>
        <th style="width:20%">Conclusão</th>
        <th class="num">%</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${clientesMostrados
        .map(
          (c) => `<tr>
            <td style="color:#64748b">${esc(c.cod)}</td>
            <td class="cli-nome" style="font-weight:600">${esc(c.empresa)}</td>
            <td>${esc(c.grupo || '—')}</td>
            <td class="num">${c.res}/${c.total}</td>
            <td>${barra(c.pct, PCT_COR(c.pct))}</td>
            <td class="num" style="font-weight:700;color:${PCT_COR(c.pct)}">${c.pct}%</td>
            <td>${chipStatus(c.st)}</td>
          </tr>`
        )
        .join('')}
    </tbody>
  </table>
  ${clientesMostrados.length < clientes.length
    ? `<div class="nota">Exibindo os ${clientesMostrados.length} clientes com menor percentual de conclusão. Os demais ${clientes.length - clientesMostrados.length} clientes possuem situação igual ou melhor.</div>`
    : ''}
  ${rodape(compet, emissao)}
</div>
</body>
</html>`
}

// Abre a janela de impressão do navegador com o relatório (Salvar como PDF).
export async function gerarRelatorioPDF(data) {
  const html = buildRelatorioHTML(data)
  const win = window.open('', '_blank')
  if (!win) throw new Error('Popup bloqueado — permita popups para gerar o PDF')
  win.document.open()
  win.document.write(html)
  win.document.close()
  await new Promise((r) => setTimeout(r, 350)) // deixa o layout assentar
  win.focus()
  win.print()
}
