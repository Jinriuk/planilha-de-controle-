// ─────────────────────────────────────────────────────────────────────────
// Regras de negócio da planilha (portadas de controle_apuracao_online.html).
// ─────────────────────────────────────────────────────────────────────────

// [chave, label, categoria, fn_aplica(company)]
// company.tipo: 'Serviços' | 'Comércio' | 'Comércio / Serviços'
// company.iss/icms/sf/sc: booleans
export const TAREFAS = [
  ['nfe_ent', 'NFe Entrada', 'doc', () => true],
  ['nfe_sai', 'NFe Saída', 'doc', (c) => (c.tipo || '').includes('Comércio')],
  ['nf_tom', 'NF Serv Tomado', 'doc', (c) => (c.tipo || '').includes('Serviços')],
  ['nf_pres', 'NF Serv Prestado', 'doc', (c) => (c.tipo || '').includes('Serviços')],
  ['nfce', 'NFCe', 'doc', (c) => (c.tipo || '').includes('Comércio')],
  ['fisco_sol', 'Fisco Fácil Solic', 'doc', () => true],
  ['fisco_rec', 'Fisco Fácil Receb', 'doc', () => true],
  ['iss_g', 'Guia ISS', 'guia', (c) => !!c.iss],
  ['icms_g', 'Guia ICMS', 'guia', (c) => !!c.icms],
  ['difal_g', 'Guia DIFAL', 'guia', (c) => !!c.icms],
  ['pis_g', 'Guia PIS/COFINS', 'guia', (c) => !!c.sc],
  ['parc_g', 'Guia Parcelamento', 'guia', () => true],
  ['reinf', 'REINF', 'obrig', (c) => !!c.sc],
  ['dctf', 'DCTF', 'obrig', (c) => !!c.sc],
  ['efd_f', 'EFD Fiscal', 'obrig', (c) => !!c.sf],
  ['efd_c', 'EFD Contribuições', 'obrig', (c) => !!c.sc],
  ['fat', 'Rel. Faturamento', 'rel', () => true],
]

// Mapa rápido chave -> label
export const TASK_LABEL = Object.fromEntries(TAREFAS.map((t) => [t[0], t[1]]))

// Ciclo de estados: '' → andamento → feito → na → ''
export const CICLO = ['', 'andamento', 'feito', 'na']
export const CICLO_LABEL = { '': '', andamento: '⏳ Andamento', feito: '✅ Feito', na: '—  N/A' }
export const CICLO_CLS = {
  '': 'st-vazio',
  andamento: 'st-andamento',
  feito: 'st-feito',
  na: 'st-na',
}

export const CAT_HDR = {
  doc: 'th-grupo-doc',
  guia: 'th-grupo-guia',
  obrig: 'th-grupo-obrig',
  rel: 'th-grupo-rel',
}
export const CAT_LABEL = {
  doc: 'Solicitação de Documentos XML',
  guia: 'Guias de Pagamento',
  obrig: 'Obrigações Acessórias',
  rel: 'Relatório',
}

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

// Tarefas aplicáveis a uma empresa.
export function tarefasAplicaveis(company) {
  return TAREFAS.filter((t) => t[3](company))
}

// Status agregado de uma empresa dado o mapa de valores { task_key: valor }.
// Espelha a lógica do HTML: baseado em quantas tarefas aplicáveis estão 'feito'.
export function statusEmpresa(company, valores) {
  const aplicaveis = tarefasAplicaveis(company)
  const total = aplicaveis.length
  const feitos = aplicaveis.filter((t) => (valores[t[0]] || '') === 'feito').length
  const pct = total ? Math.round((feitos / total) * 100) : 100
  let st
  if (total === 0) st = 'N/A'
  else if (feitos === total) st = 'Concluído'
  else if (feitos === 0) st = 'Não iniciado'
  else st = 'Em andamento'
  return { total, feitos, pct, st }
}

export const STATUS_CORES = {
  Concluído: '#15803d',
  'Em andamento': '#b45309',
  'Não iniciado': '#6d28d9',
  'N/A': '#9ca3af',
}
export const STATUS_CLS = {
  Concluído: 'sc-ok',
  'Em andamento': 'sc-and',
  'Não iniciado': 'sc-new',
  'N/A': 'sc-na',
}
