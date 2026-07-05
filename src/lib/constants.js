// ─────────────────────────────────────────────────────────────────────────
// Regras de negócio — Gestão da Rotina do Departamento Fiscal
// Atividades, documentos de anexo, status e cores (spec).
// ─────────────────────────────────────────────────────────────────────────

// [chave, label, categoria, fn_aplica(company)]
// Categorias: sol (Solicitação de Documentos) · imp (Importação de XMLs)
//             obrig (Obrigações Fiscais) · parc (Parcelamentos)
// fn_aplica dá só a *dica visual* de aplicabilidade — toda célula continua
// editável e pode receber "Não se aplica".
const temComercio = (c) => (c.tipo || '').includes('Comércio')
const temServicos = (c) => (c.tipo || '').includes('Serviços')

export const TAREFAS = [
  // Solicitação de documentos ao cliente
  ['sol_xml_ent',   'XML NF Entrada',      'sol',   () => true],
  ['sol_xml_sai',   'XML NF Saída',        'sol',   temComercio],
  ['sol_xml_serv',  'XML NF Serviço',      'sol',   temServicos],
  ['sol_xml_cupom', 'XML Cupom Fiscal',    'sol',   temComercio],
  ['sol_xml_cte',   'XML CT-e',            'sol',   () => true],
  // Importação de documentos fiscais
  ['imp_xml_ent',   'XML NF Entrada',      'imp',   () => true],
  ['imp_xml_sai',   'XML NF Saída',        'imp',   temComercio],
  ['imp_xml_sp',    'XML Serv. Prestado',  'imp',   temServicos],
  ['imp_xml_st',    'XML Serv. Tomado',    'imp',   temServicos],
  ['imp_xml_cupom', 'XML Cupom Fiscal',    'imp',   temComercio],
  ['imp_xml_cte',   'XML CT-e',            'imp',   () => true],
  // Obrigações fiscais
  ['reinf',         'REINF',               'obrig', (c) => !!c.sc],
  ['efd_f',         'EFD Fiscal',          'obrig', (c) => !!c.sf],
  ['efd_c',         'EFD Contribuições',   'obrig', (c) => !!c.sc],
  ['dctf',          'DCTF',                'obrig', (c) => !!c.sc],
  ['mit',           'MIT',                 'obrig', () => true],
  // Parcelamentos
  ['parc_envio',    'Envio guias parc.',   'parc',  () => true],
]

// Labels antigos (dados/auditoria de versões anteriores) + atuais.
export const TASK_LABEL = {
  ...Object.fromEntries(TAREFAS.map((t) => [t[0], t[1]])),
  // legado (v1)
  nfe_ent: 'NFe Entrada (v1)', nfe_sai: 'NFe Saída (v1)', nf_tom: 'NF Serv Tomado (v1)',
  nf_pres: 'NF Serv Prestado (v1)', nfce: 'NFCe (v1)', fisco_sol: 'Fisco Fácil Solic (v1)',
  fisco_rec: 'Fisco Fácil Receb (v1)', iss_g: 'Guia ISS (v1)', icms_g: 'Guia ICMS (v1)',
  difal_g: 'Guia DIFAL (v1)', pis_g: 'Guia PIS/COFINS (v1)', parc_g: 'Guia Parcelamento (v1)',
  fat: 'Rel. Faturamento (v1)',
}

// ── Ciclo de estados (valores do banco) e labels do spec ──
// '' = Não iniciado · andamento = Em andamento · feito = Finalizado · na = Não se aplica
export const CICLO = ['', 'andamento', 'feito', 'na']
export const CICLO_LABEL = {
  '': 'Não iniciado',
  andamento: 'Em andamento',
  feito: 'Finalizado',
  na: 'Não se aplica',
}
export const CICLO_LABEL_CURTO = { '': '—', andamento: '⏳ Andamento', feito: '✅ Finalizado', na: 'N/A' }
export const CICLO_CLS = {
  '': 'st-vazio',
  andamento: 'st-andamento',
  feito: 'st-feito',
  na: 'st-na',
}

export const CAT_HDR = {
  sol: 'th-grupo-doc',
  imp: 'th-grupo-imp',
  obrig: 'th-grupo-obrig',
  parc: 'th-grupo-guia',
}
export const CAT_LABEL = {
  sol: 'Solicitação de Documentos',
  imp: 'Importação de XMLs',
  obrig: 'Obrigações Fiscais',
  parc: 'Parcelamentos',
}

// ── Documentos do Controle de Anexos ──
export const DOCS_ANEXOS = [
  ['rel_nfs_p',      'Rel. NFS Prestado',      'rel'],
  ['rel_nfs_t',      'Rel. NFS Tomado',        'rel'],
  ['guia_iss',       'Guia de ISS',            'guia'],
  ['reg_icms',       'Reg. Apuração ICMS',     'apur'],
  ['guia_icms',      'Guia de ICMS',           'guia'],
  ['apur_piscofins', 'Apuração PIS/COFINS',    'apur'],
  ['guia_piscofins', 'Guia PIS/COFINS',        'guia'],
  ['rec_efd_f',      'Recibo EFD Fiscal',      'rec'],
  ['rec_efd_c',      'Recibo EFD Contrib.',    'rec'],
  ['rec_reinf',      'Recibo REINF',           'rec'],
  ['rec_dctf',       'Recibo DCTF',            'rec'],
  ['rec_mit',        'Recibo MIT',             'rec'],
  ['guias_parc',     'Guias Parcelamento',     'guia'],
]
export const DOC_LABEL = Object.fromEntries(DOCS_ANEXOS.map((d) => [d[0], d[1]]))
export const DOC_CAT_LABEL = {
  rel: 'Relatórios', guia: 'Guias', apur: 'Apurações', rec: 'Recibos',
}
export const DOC_CAT_HDR = {
  rel: 'th-grupo-rel', guia: 'th-grupo-guia', apur: 'th-grupo-imp', rec: 'th-grupo-obrig',
}

// ── Status de parcelamento ──
export const PARC_STATUS = ['ativo', 'quitado', 'suspenso', 'cancelado']
export const PARC_STATUS_LABEL = {
  ativo: 'Ativo', quitado: 'Quitado', suspenso: 'Suspenso', cancelado: 'Cancelado',
}
export const PARC_STATUS_CLS = {
  ativo: 'chip-para-andamento', quitado: 'chip-para-feito',
  suspenso: 'chip-de', cancelado: 'chip-para-vazio',
}

// ── Períodos ──
export const PERIODOS_2026 = [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
]
export const PERIODOS_2025 = [
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
  '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
]
export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function periodoLabel(p) {
  const [ano, mes] = p.split('-')
  return `${MESES[parseInt(mes, 10) - 1]} ${ano}`
}

export const PERIODO_ATUAL = '2026-06'

export const CORES_AVATAR = [
  '#2E5FA3', '#15803d', '#b45309', '#6d28d9', '#b91c1c', '#0e7490', '#065f46',
]

export function corAvatar(nome) {
  if (!nome) return '#64748b'
  const idx = nome.charCodeAt(0) % CORES_AVATAR.length
  return CORES_AVATAR[idx]
}

export function iniciais(nome) {
  if (!nome) return '?'
  return nome.trim()[0].toUpperCase()
}

// ── Agregação de status por empresa ──
export function tarefasAplicaveis(company) {
  return TAREFAS.filter((t) => t[3](company))
}

// Progresso considera Finalizado + Não se aplica como resolvidos.
export function statusEmpresa(company, valores) {
  const aplicaveis = tarefasAplicaveis(company)
  const total = aplicaveis.length
  const feitos = aplicaveis.filter((t) => (valores[t[0]] || '') === 'feito').length
  const nas = aplicaveis.filter((t) => (valores[t[0]] || '') === 'na').length
  const resolvidos = feitos + nas
  const pct = total ? Math.round((resolvidos / total) * 100) : 100
  let st
  if (total === 0) st = 'Não se aplica'
  else if (resolvidos === total) st = 'Finalizado'
  else if (aplicaveis.every((t) => !(valores[t[0]] || ''))) st = 'Não iniciado'
  else st = 'Em andamento'
  return { total, feitos, nas, resolvidos, pct, st }
}

// Cores do spec: vermelho / amarelo / verde / cinza
export const STATUS_CORES = {
  Finalizado: '#15803d',
  'Em andamento': '#b45309',
  'Não iniciado': '#b91c1c',
  'Não se aplica': '#6b7280',
}
export const STATUS_CLS = {
  Finalizado: 'sc-ok',
  'Em andamento': 'sc-and',
  'Não iniciado': 'sc-new',
  'Não se aplica': 'sc-na',
}

// ── Datas / prazos ──
export function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

// vencida = prazo passou e não está Finalizado/N-A
export function atividadeVencida(cell) {
  if (!cell?.prazo) return false
  const st = cell.valor || ''
  if (st === 'feito' || st === 'na') return false
  return cell.prazo < hojeISO()
}

// próxima do prazo = vence em até N dias
export function atividadeProxima(cell, dias = 3) {
  if (!cell?.prazo) return false
  const st = cell.valor || ''
  if (st === 'feito' || st === 'na') return false
  const hoje = hojeISO()
  if (cell.prazo < hoje) return false
  const lim = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10)
  return cell.prazo <= lim
}

export function fmtData(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export function fmtMoeda(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
